"""
OBOLO ORDER — Mercury instrumental generator (Cloud Run with an NVIDIA L4 GPU).

POST /generate  {prompt, seconds, bpm, keyRoot, scale, progression, melody}  → audio/mp4 (AAC)
GET  /health    → {ready, loading, error, engine}

Only the API's service account may call it (Cloud Run IAM, no public access). The model loads in a
background thread at start-up (weights cached on the Cloud Storage volume mounted at /models), so a
cold instance answers 503 {"warming": true} until it is ready; the API tells the visitor to retry.

ENGINE (MUSIC_ENGINE):
  acestep15 (default, client decision 2026-10-06) — ACE-Step 1.5 (MIT, commercial use OK).
            Tempo, key, length and "instrumental" are passed directly from the song design.
            Optionally (ACE_REF_STRENGTH > 0) the design's chords + melody synth guide is used as
            a cover source; off by default (the v1 test with the guide came out muffled / noisy).
  musicgen  — MusicGen-Melody (CC-BY-NC weights: tests only, never for the paid service).
"""
import os
import subprocess
import sys
import time
import tempfile
import threading
import traceback

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from scipy.io import wavfile

from render import render_guide

ENGINE = os.environ.get("MUSIC_ENGINE", "acestep15")
MODEL_ID = os.environ.get("MUSIC_MODEL", "facebook/musicgen-melody-large")
# ACE-Step 1.5 DiT: acestep-v15-turbo (2B, fast) or acestep-v15-xl-turbo (4B, better, fits a 24 GB L4)
ACE15_MODEL = os.environ.get("ACE15_MODEL", "acestep-v15-turbo")
# how strongly the synth guide steers the result (0 = not used). PLACEHOLDER (P-MER-6): tune by ear.
ACE_REF_STRENGTH = float(os.environ.get("ACE_REF_STRENGTH", "0"))
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

state: dict = {"engine": None, "error": None, "loading": False, "phase": "starting", "since": time.time()}
gen_lock = threading.Lock()
app = FastAPI()


# --- engines --------------------------------------------------------------------------------------


class AceStep15:
    """ACE-Step 1.5 (MIT, commercial use OK). DiT only: our own song design already fixes the tempo,
    key and length, so the 5Hz LM planner is not needed (faster, less GPU memory)."""

    max_seconds = 120

    def __init__(self) -> None:
        from acestep.handler import AceStepHandler

        self.handler = AceStepHandler()
        msg, ok = self.handler.initialize_service(
            project_root=os.environ.get("ACESTEP_PROJECT_ROOT", "/opt/ace"),
            config_path=ACE15_MODEL,
            device="cuda",
            prefer_source="huggingface",
        )
        if not ok:
            raise RuntimeError(f"ACE-Step 1.5 init failed: {msg}")

    def generate(self, r: "GenerateReq", seconds: float, guide: np.ndarray, guide_sr: int) -> tuple[np.ndarray, int]:
        from acestep.inference import GenerationConfig, GenerationParams, generate_music

        key = f"{NAMES[r.keyRoot]} {'Major' if r.scale == 'major' else 'minor'}"
        with tempfile.TemporaryDirectory() as d:
            extra: dict = {}
            if ACE_REF_STRENGTH > 0:
                # optional: let the synth guide (design chords + melody) steer the result as a cover source
                ref = os.path.join(d, "guide.wav")
                wavfile.write(ref, guide_sr, (guide * 32767).astype(np.int16))
                extra = dict(task_type="cover", src_audio=ref, audio_cover_strength=ACE_REF_STRENGTH)
            params = GenerationParams(
                **({"task_type": "text2music"} | extra),
                caption=f"{r.prompt}, instrumental"[:512],
                lyrics="[Instrumental]",
                instrumental=True,
                bpm=r.bpm,
                keyscale=key,
                timesignature="4",
                duration=max(10.0, seconds),
                inference_steps=8,
                shift=3.0,
                thinking=False,
                use_cot_metas=False,
                use_cot_caption=False,
                use_cot_language=False,
            )
            config = GenerationConfig(batch_size=1, audio_format="wav", use_random_seed=True)
            result = generate_music(self.handler, None, params, config, save_dir=d)
            if not result.success or not result.audios:
                raise RuntimeError(f"ACE-Step 1.5: {result.error}")
            return read_audio(result.audios[0]["path"])


class MusicGen:
    max_seconds = 30

    def __init__(self) -> None:
        import torch
        from transformers import AutoProcessor, MusicgenMelodyForConditionalGeneration

        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.processor = AutoProcessor.from_pretrained(MODEL_ID)
        self.model = MusicgenMelodyForConditionalGeneration.from_pretrained(MODEL_ID, torch_dtype=self.dtype).to(self.device)
        self.model.eval()

    @property
    def guide_sr(self) -> int:
        return self.processor.feature_extractor.sampling_rate

    def generate(self, r: "GenerateReq", seconds: float, guide: np.ndarray, guide_sr: int) -> tuple[np.ndarray, int]:
        inputs = self.processor(audio=guide, sampling_rate=guide_sr, text=[r.prompt], padding=True, return_tensors="pt")
        inputs = {k: (v.to(self.device, self.dtype) if v.is_floating_point() else v.to(self.device)) for k, v in inputs.items()}
        with self.torch.inference_mode():
            out = self.model.generate(**inputs, do_sample=True, guidance_scale=3.0, max_new_tokens=int(seconds * 50) + 4)
        return out[0, 0].float().cpu().numpy(), self.model.config.audio_encoder.sampling_rate


def read_audio(path: str) -> tuple[np.ndarray, int]:
    """Any audio file → mono float32 via ffmpeg (keeps us independent of the engine's format)."""
    sr = 44100
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy(), sr


CKPT_DIR = os.environ.get("ACESTEP_CHECKPOINTS_DIR", "/models/ace15")


def dir_bytes(path: str) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def download_models() -> None:
    """Fetch ACE-Step 1.5 checkpoints into the /models bucket (run as a Cloud Run job: no GPU,
    no idle shutdown), so the GPU service only has to load them."""
    from pathlib import Path

    from acestep.model_downloader import check_main_model_exists, check_model_exists, ensure_dit_model, ensure_main_model

    path = Path(CKPT_DIR)
    path.mkdir(parents=True, exist_ok=True)
    if not check_main_model_exists(path):
        ok, msg = ensure_main_model(path, prefer_source="huggingface")
        print(f"main model: {ok} {msg}", flush=True)
        if not ok:
            raise SystemExit(1)
    if not check_model_exists(ACE15_MODEL, path):
        ok, msg = ensure_dit_model(ACE15_MODEL, path, prefer_source="huggingface")
        print(f"{ACE15_MODEL}: {ok} {msg}", flush=True)
        if not ok:
            raise SystemExit(1)
    print(f"checkpoints ready in {CKPT_DIR} ({dir_bytes(CKPT_DIR) / 1e9:.1f} GB)", flush=True)


def load() -> None:
    state["loading"] = True
    state["phase"] = "loading model"
    state["since"] = time.time()
    try:
        state["engine"] = MusicGen() if ENGINE == "musicgen" else AceStep15()
        state["phase"] = "ready"
        print(f"engine {ENGINE} ready", flush=True)
    except Exception as e:  # noqa: BLE001 — reported by /health and /generate
        state["error"] = f"{e!r}"
        state["phase"] = "failed"
        traceback.print_exc()
    finally:
        state["loading"] = False


@app.on_event("startup")
def start() -> None:
    threading.Thread(target=load, daemon=True).start()


# --- API ------------------------------------------------------------------------------------------


class Note(BaseModel):
    midi: int | None = None
    beats: float = Field(0.5, gt=0, le=16)


class GenerateReq(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    seconds: float = Field(30, ge=4, le=120)
    bpm: int = Field(110, ge=40, le=220)
    keyRoot: int = Field(0, ge=0, le=11)
    scale: str = "major"
    progression: list[int] = Field(default_factory=lambda: [0, 4, 5, 3], max_length=16)
    melody: list[Note] = Field(default_factory=list, max_length=600)


@app.get("/health")
def health():
    try:
        import torch

        cuda = torch.cuda.is_available()
    except Exception:  # noqa: BLE001
        cuda = False
    return {
        "engine": ENGINE,
        "model": ACE15_MODEL,
        "ready": state["engine"] is not None,
        "phase": state["phase"],
        "seconds": int(time.time() - state["since"]),
        "checkpointGB": round(dir_bytes(CKPT_DIR) / 1e9, 2) if os.path.isdir(CKPT_DIR) else 0,
        "cuda": cuda,
        "error": state["error"],
    }


def to_m4a(audio: np.ndarray, sr: int) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        wav, m4a = os.path.join(d, "in.wav"), os.path.join(d, "out.m4a")
        wavfile.write(wav, sr, (np.clip(audio, -1, 1) * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", m4a], check=True)
        with open(m4a, "rb") as f:
            return f.read()


@app.post("/generate")
def generate(r: GenerateReq):
    if state["error"]:
        raise HTTPException(500, f"model failed to load: {state['error'][:300]}")
    engine = state["engine"]
    if engine is None:
        return JSONResponse({"warming": True}, status_code=503)
    seconds = min(r.seconds, engine.max_seconds)
    guide_sr = getattr(engine, "guide_sr", 32000)
    guide = render_guide(seconds, r.bpm, r.keyRoot, r.scale, r.progression, [n.model_dump() for n in r.melody], guide_sr)
    try:
        with gen_lock:
            audio, sr = engine.generate(r, seconds, guide, guide_sr)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(500, f"generation failed: {e!r}"[:400]) from e
    audio = audio[: int(seconds * sr)]
    fade = min(len(audio), int(1.5 * sr))
    if fade:
        audio[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    audio = audio / (float(np.max(np.abs(audio))) or 1.0) * 0.9
    return Response(to_m4a(audio, sr), media_type="audio/mp4", headers={"x-seconds": f"{len(audio) / sr:.1f}", "x-engine": ENGINE})


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "download":
    download_models()
