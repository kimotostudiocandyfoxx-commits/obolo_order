"""
OBOLO ORDER — Mercury instrumental generator (Cloud Run with an NVIDIA L4 GPU).

POST /generate  {prompt, seconds, bpm, keyRoot, scale, progression, melody}  → audio/mp4 (AAC)
GET  /health    → {ready, loading, error, engine}

Only the API's service account may call it (Cloud Run IAM, no public access). The model loads in a
background thread at start-up (weights cached on the Cloud Storage volume mounted at /models), so a
cold instance answers 503 {"warming": true} until it is ready; the API tells the visitor to retry.

ENGINE (MUSIC_ENGINE):
  acestep  (default, client decision 2026-10-06) — ACE-Step, Apache-2.0, commercial use OK.
           The design's chords + melody are rendered as a synth guide and given as the reference
           audio (audio2audio) so the instrumental keeps the design's tempo, key and chords.
  musicgen — MusicGen-Melody (CC-BY-NC weights: tests only, never for the paid service).
"""
import os
import subprocess
import tempfile
import threading
import traceback

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from scipy.io import wavfile

from render import render_guide

ENGINE = os.environ.get("MUSIC_ENGINE", "acestep")
MODEL_ID = os.environ.get("MUSIC_MODEL", "facebook/musicgen-melody-large")
ACE_DIR = os.environ.get("ACE_CHECKPOINT_DIR", "/models/ace-step")
# how closely the result follows the synth guide (0 = ignore it, 1 = copy it). PLACEHOLDER (P-MER-6): tune by ear.
ACE_REF_STRENGTH = float(os.environ.get("ACE_REF_STRENGTH", "0.35"))
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

state: dict = {"engine": None, "error": None, "loading": False}
gen_lock = threading.Lock()
app = FastAPI()


# --- engines --------------------------------------------------------------------------------------


class AceStep:
    max_seconds = 120

    def __init__(self) -> None:
        from acestep.pipeline_ace_step import ACEStepPipeline

        os.makedirs(ACE_DIR, exist_ok=True)
        self.pipe = ACEStepPipeline(checkpoint_dir=ACE_DIR, dtype="bfloat16", torch_compile=False)
        # download (first start) and load the weights now instead of on the first request
        if hasattr(self.pipe, "load_checkpoint"):
            self.pipe.load_checkpoint(ACE_DIR)

    def generate(self, r: "GenerateReq", seconds: float, guide: np.ndarray, guide_sr: int) -> tuple[np.ndarray, int]:
        tags = f"{r.prompt}, {r.bpm} bpm, {NAMES[r.keyRoot]} {r.scale}, instrumental"
        with tempfile.TemporaryDirectory() as d:
            ref = os.path.join(d, "guide.wav")
            wavfile.write(ref, guide_sr, (guide * 32767).astype(np.int16))
            out = os.path.join(d, "out.wav")
            args = dict(
                audio_duration=seconds,
                prompt=tags,
                lyrics="[instrumental]",
                infer_step=60,
                guidance_scale=15.0,
                scheduler_type="euler",
                cfg_type="apg",
                omega_scale=10.0,
                manual_seeds=None,
                guidance_interval=0.5,
                guidance_interval_decay=0.0,
                min_guidance_scale=3.0,
                use_erg_tag=True,
                use_erg_lyric=False,
                use_erg_diffusion=True,
                oss_steps=None,
                guidance_scale_text=0.0,
                guidance_scale_lyric=0.0,
                save_path=out,
                format="wav",
            )
            try:
                # steer the tempo / key / chords with the guide (reference audio)
                self.pipe(**args, audio2audio_enable=True, ref_audio_strength=ACE_REF_STRENGTH, ref_audio_input=ref)
            except TypeError:
                # an ACE-Step version without audio2audio: text only
                self.pipe(**args)
            path = out if os.path.exists(out) else next((os.path.join(d, f) for f in os.listdir(d) if f.endswith((".wav", ".flac", ".mp3")) and f != "guide.wav"), None)
            if not path:
                raise RuntimeError("ACE-Step produced no audio file")
            return read_audio(path)


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


def load() -> None:
    state["loading"] = True
    try:
        state["engine"] = AceStep() if ENGINE == "acestep" else MusicGen()
        print(f"engine {ENGINE} ready", flush=True)
    except Exception as e:  # noqa: BLE001 — reported by /health and /generate
        state["error"] = f"{e!r}"
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
    return {"engine": ENGINE, "ready": state["engine"] is not None, "loading": state["loading"], "error": state["error"]}


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
