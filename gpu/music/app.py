"""
OBOLO ORDER — Mercury instrumental generator (Cloud Run with an NVIDIA L4 GPU).

POST /generate  {prompt, seconds, bpm, keyRoot, scale, progression, melody}  → audio/mp4 (AAC)
POST /song      {prompt, lyrics, seconds, bpm, keyRoot, scale, language, voice?} → JSON: the whole song
                sung (ACE-Step with the lyrics), split by HTDemucs into vocals + instrumental, the
                time of every lyric line, and — with `voice` (the member's recording) — the vocal
                turned into their voice by Seed-VC (svc_worker.py, zero-shot) and mixed again
                (client decisions 2026-10-09: replace Fish line-by-line singing)
POST /paint     {items: [{prompt, seed}], negative, side, steps, cfg} → {images: [base64 JPEG | null]}
                Mars MV scenes with Animagine XL 4.0 (paint.py; loaded on the first call)
GET  /health    → {ready, loading, error, engine, painter}

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
import json
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

import paint as painter
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


def ace_song(engine: "AceStep15", r: "SongReq", seconds: float, out_dir: str) -> tuple[str, list[dict]]:
    """The whole song with vocals (ACE-Step text2music with the lyrics) → (wav path, lyric line times)."""
    from acestep.inference import GenerationConfig, GenerationParams, generate_music

    key = f"{NAMES[r.keyRoot]} {'Major' if r.scale == 'major' else 'minor'}"
    lyrics = format_lyrics(r.lyrics)
    params = GenerationParams(
        task_type="text2music",
        caption=r.prompt[:512],
        lyrics=lyrics,
        instrumental=False,
        vocal_language=r.language,
        bpm=r.bpm,
        keyscale=key,
        timesignature="4",
        duration=max(10.0, seconds),
        inference_steps=r.steps,
        shift=r.shift,
        thinking=r.lm,
        use_cot_metas=False,
        use_cot_caption=False,
        use_cot_language=False,
        **({"seed": r.seed} if r.seed is not None else {}),
    )
    config = GenerationConfig(batch_size=1, audio_format="wav", use_random_seed=r.seed is None, **({"seeds": [r.seed]} if r.seed is not None else {}))
    result = generate_music(engine.handler, lm_handler() if r.lm else None, params, config, save_dir=out_dir)
    if not result.success or not result.audios:
        raise RuntimeError(f"ACE-Step 1.5: {result.error}")
    return result.audios[0]["path"], line_times(engine, result.extra_outputs or {}, seconds, r.language)


ACE_LM = os.environ.get("ACE_LM_MODEL", "acestep-5Hz-lm-1.7B")
_lm: dict = {"h": None}
_lm_lock = threading.Lock()


def lm_handler():
    """ACE-Step's 5Hz LM (loaded on first use; PyTorch backend so it shares the card politely)."""
    with _lm_lock:
        if _lm["h"] is None:
            from acestep.llm_inference import LLMHandler

            t = time.time()
            h = LLMHandler()
            msg, ok = h.initialize(checkpoint_dir=CKPT_DIR, lm_model_path=ACE_LM, backend="pt", device="cuda")
            if not ok:
                raise RuntimeError(f"ACE-Step LM init failed: {msg}")
            print(f"LM {ACE_LM} ready in {time.time() - t:.0f}s", flush=True)
            _lm["h"] = h
        return _lm["h"]


def format_lyrics(lines: list["LyricLine"]) -> str:
    """Our lines → ACE-Step lyrics with structure tags ([Verse] / [Chorus] / [Bridge])."""
    out: list[str] = []
    last = None
    for l in lines:
        if l.section != last:
            if out:
                out.append("")
            out.append(f"[{l.section.capitalize()}]")
            last = l.section
        out.append(l.text.strip())
    return "\n".join(out)[:4000]


def line_times(engine: "AceStep15", extra: dict, seconds: float, language: str) -> list[dict]:
    """When each lyric line is sung (ACE-Step's own cross-attention alignment). [] if not available."""
    try:
        need = ["pred_latents", "encoder_hidden_states", "encoder_attention_mask", "context_latents", "lyric_token_idss"]
        if any(extra.get(k) is None for k in need):
            return []
        res = engine.handler.get_lyric_timestamp(
            pred_latent=extra["pred_latents"][0:1],
            encoder_hidden_states=extra["encoder_hidden_states"][0:1],
            encoder_attention_mask=extra["encoder_attention_mask"][0:1],
            context_latents=extra["context_latents"][0:1],
            lyric_token_ids=extra["lyric_token_idss"][0:1],
            total_duration_seconds=float(seconds),
            vocal_language=language,
            inference_steps=8,
            seed=42,
        )
        if not res.get("success"):
            print(f"lyric times: {res.get('error')}", flush=True)
            return []
        out = []
        for st in res.get("sentence_timestamps") or []:
            get = (lambda k: st.get(k)) if isinstance(st, dict) else (lambda k: getattr(st, k, None))
            text = str(get("text") or "").strip()
            if not text or text.startswith("["):  # structure tags are not sung
                continue
            out.append({"text": text, "start": float(get("start") or 0), "end": float(get("end") or 0)})
        return out
    except Exception as e:  # noqa: BLE001 — the song is still fine without the times
        print(f"lyric times failed: {e!r}", flush=True)
        return []


# --- HTDemucs (Demucs v4, MIT): vocals / instrumental split ------------------------------------------

_demucs = None


def separate(wav_path: str, out_dir: str) -> tuple[str, str]:
    """A song → (vocals.wav, instrumental.wav) with HTDemucs (fine-tuned htdemucs_ft by default)."""
    global _demucs
    # demucs 4.0.1 checkpoints are full pickles; PyTorch >= 2.6 loads weights-only by default
    os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")
    import torch
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    if _demucs is None:
        _demucs = get_model(os.environ.get("DEMUCS_MODEL", "htdemucs_ft"))
        _demucs.eval()
    model = _demucs
    sr = model.samplerate
    # the model's own rate, stereo, float
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", wav_path, "-ac", "2", "-ar", str(sr), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    audio = torch.from_numpy(np.frombuffer(raw, dtype=np.float32).copy().reshape(-1, 2).T)
    ref = audio.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    with torch.inference_mode():
        stems = apply_model(model, ((audio - mean) / std)[None], device="cuda" if torch.cuda.is_available() else "cpu", split=True, overlap=0.25, progress=False)[0]
    stems = stems * std + mean
    names = list(model.sources)
    vocals = stems[names.index("vocals")]
    rest = sum(stems[i] for i, n in enumerate(names) if n != "vocals")
    paths = []
    for name, x in (("vocals", vocals), ("instrumental", rest)):
        path = os.path.join(out_dir, f"{name}.wav")
        wavfile.write(path, sr, np.clip(x.T.cpu().numpy(), -1, 1).astype(np.float32))
        paths.append(path)
    return paths[0], paths[1]


# --- Seed-VC (svc_worker.py, its own environment) ----------------------------------------------------

SVC_PORT = int(os.environ.get("SVC_PORT", "8091"))
SVC_PYTHON = os.environ.get("SVC_PYTHON", "/opt/svc/bin/python")
SVC_DIR = os.environ.get("SVC_DIR", "/opt/seedvc")
_svc_proc = None


def start_svc() -> None:
    """Start the Seed-VC worker next to us (if it is installed)."""
    global _svc_proc
    if not (os.path.exists(SVC_PYTHON) and os.path.isdir(SVC_DIR)):
        print("seed-vc not installed: songs keep the studio's voice", flush=True)
        return
    env = {**os.environ, "SVC_PORT": str(SVC_PORT), "HF_HUB_OFFLINE": "1", "PYTHONUNBUFFERED": "1"}
    _svc_proc = subprocess.Popen([SVC_PYTHON, os.path.join(os.path.dirname(os.path.abspath(__file__)), "svc_worker.py")], cwd=SVC_DIR, env=env)


def svc_call(method: str, path: str, body: dict | None = None, timeout: float = 5) -> dict:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(f"http://127.0.0.1:{SVC_PORT}{path}", method=method, data=json.dumps(body).encode() if body is not None else None, headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}") | {"ok": False, "status": e.code}


def svc_health() -> dict:
    if _svc_proc is None:
        return {"ready": False, "error": "not installed"}
    if _svc_proc.poll() is not None:
        return {"ready": False, "error": f"exited ({_svc_proc.returncode})"}
    try:
        return svc_call("GET", "/health")
    except Exception as e:  # noqa: BLE001
        return {"ready": False, "error": f"starting ({e!r})"[:120]}


def to_voice(vocals: str, voice_b64: str, out_dir: str, cfg: float) -> tuple[str | None, str]:
    """The sung vocal in the member's voice (Seed-VC), or (None, why) to keep the studio's voice."""
    import base64

    h = svc_health()
    if not h.get("ready"):
        # the worker loads with the engine: give it a little more time on a cold start
        for _ in range(60):
            time.sleep(2)
            h = svc_health()
            if h.get("ready") or (h.get("error") and "starting" not in str(h.get("error"))):
                break
    if not h.get("ready"):
        return None, f"seed-vc not ready: {h.get('error')}"
    ref_raw = os.path.join(out_dir, "voice.in")
    with open(ref_raw, "wb") as f:
        f.write(base64.b64decode(voice_b64))
    ref = os.path.join(out_dir, "voice.wav")
    # the reference: mono 44.1 kHz, silences trimmed, at most 25 s
    trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", ref_raw, "-af", f"{trim},areverse,{trim},areverse", "-t", "25", "-ac", "1", "-ar", "44100", ref], check=True)
    src = os.path.join(out_dir, "vocals-mono.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vocals, "-ac", "1", "-ar", "44100", src], check=True)
    out = os.path.join(out_dir, "vocals-member.wav")
    res = svc_call("POST", "/convert", {"source": src, "target": ref, "out": out, "steps": 30, "cfg": cfg}, timeout=600)
    if not res.get("ok"):
        return None, f"seed-vc failed: {res.get('error')}"
    return out, f"octave shift {res.get('shift', 0)}, {res.get('seconds')}s"


def mix_stems(inst: str, vocals: str, out: str, seconds: float) -> None:
    """Instrumental + (converted) vocal → the song: a little compression and room on the voice."""
    fade_at = max(0.0, seconds - 1.5)
    graph = (
        "[1:a]highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,aecho=0.8:0.6:60|120:0.12|0.06,volume=1.15[v];"
        f"[0:a][v]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st={fade_at:.2f}:d=1.5[o]"
    )
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", inst, "-i", vocals, "-filter_complex", graph, "-map", "[o]", "-t", f"{seconds:.2f}", "-ar", "44100", out], check=True)


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


# Fast cold start (2026-10-08: reading the 10 GB of weights through the Cloud Storage volume took
# 12+ minutes, ~14 MB/s). With CKPT_BUCKET set, the weights are first copied from the bucket into
# memory (/tmp is RAM on Cloud Run) with parallel, sliced downloads, then loaded from there.
CKPT_BUCKET = os.environ.get("CKPT_BUCKET", "")
CKPT_PREFIX = os.environ.get("CKPT_PREFIX", "ace15").strip("/")
LOCAL_CKPT = os.environ.get("LOCAL_CKPT_DIR", "/tmp/ace15")


def copy_weights() -> str | None:
    """Bucket → LOCAL_CKPT, in parallel. Returns the local folder, or None (then the volume is used)."""
    if not CKPT_BUCKET:
        return None
    from google.cloud import storage
    from google.cloud.storage import transfer_manager

    t0 = time.time()
    state["phase"] = "copying model"
    bucket = storage.Client().bucket(CKPT_BUCKET)
    blobs = [b for b in bucket.list_blobs(prefix=f"{CKPT_PREFIX}/") if not b.name.endswith("/") and "/.ready-" not in b.name]
    big = [b for b in blobs if (b.size or 0) > 256 * 1024 * 1024]
    small = [b for b in blobs if (b.size or 0) <= 256 * 1024 * 1024]
    total = sum(b.size or 0 for b in blobs)

    def dest(b) -> str:
        path = os.path.join(LOCAL_CKPT, b.name[len(CKPT_PREFIX) + 1 :])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    # many small files at once, then each big file in 64 MB slices at once
    results = transfer_manager.download_many(
        [(b, dest(b)) for b in small], max_workers=32, worker_type=transfer_manager.THREAD, raise_exception=True
    )
    del results
    for b in big:
        transfer_manager.download_chunks_concurrently(b, dest(b), chunk_size=64 * 1024 * 1024, max_workers=16, worker_type=transfer_manager.THREAD)
    sec = time.time() - t0
    print(f"weights copied: {len(blobs)} files, {total / 1e9:.1f} GB in {sec:.0f}s ({total / 1e6 / max(sec, 0.1):.0f} MB/s)", flush=True)
    return LOCAL_CKPT


def load() -> None:
    global CKPT_DIR
    state["loading"] = True
    state["since"] = time.time()
    try:
        try:
            local = copy_weights()
            if local:
                # the engine reads its checkpoint folder from the environment when it is created
                CKPT_DIR = local
                os.environ["ACESTEP_CHECKPOINTS_DIR"] = local
        except Exception as e:  # noqa: BLE001 — fall back to reading through the volume
            print(f"weights copy failed, using the volume: {e!r}", flush=True)
            traceback.print_exc()
            import shutil

            shutil.rmtree(LOCAL_CKPT, ignore_errors=True)  # /tmp is memory: give it back
        state["phase"] = "loading model"

        state["engine"] = MusicGen() if ENGINE == "musicgen" else AceStep15()
        state["phase"] = "ready"
        print(f"engine {ENGINE} ready in {time.time() - state['since']:.0f}s", flush=True)
    except Exception as e:  # noqa: BLE001 — reported by /health and /generate
        state["error"] = f"{e!r}"
        state["phase"] = "failed"
        traceback.print_exc()
    finally:
        state["loading"] = False


# --- idle exit ------------------------------------------------------------------------------------
# A Cloud Run GPU instance is billed for as long as it exists, and an idle one may be kept for up to
# ~15 minutes after the last request (≈ 60 yen of L4 time for nothing). With no request for
# IDLE_EXIT_SECONDS the instance ends itself; the next request starts a fresh one (cold start).
IDLE_EXIT_SECONDS = int(os.environ.get("IDLE_EXIT_SECONDS", "0"))
busy = {"n": 0, "last": time.time()}


@app.middleware("http")
async def track(request, call_next):
    busy["n"] += 1
    try:
        return await call_next(request)
    finally:
        busy["n"] -= 1
        busy["last"] = time.time()


def idle_watch() -> None:
    while True:
        time.sleep(15)
        if state["loading"] or painter.load_lock.locked():
            busy["last"] = time.time()
            continue
        if busy["n"] == 0 and time.time() - busy["last"] > IDLE_EXIT_SECONDS:
            print(f"idle for {IDLE_EXIT_SECONDS}s: ending this instance (GPU billing stops)", flush=True)
            os._exit(0)


@app.on_event("startup")
def start() -> None:
    threading.Thread(target=load, daemon=True).start()
    start_svc()
    if IDLE_EXIT_SECONDS > 0:
        threading.Thread(target=idle_watch, daemon=True).start()


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


class LyricLine(BaseModel):
    section: str = Field("verse", pattern="^(verse|chorus|bridge)$")
    text: str = Field(min_length=1, max_length=80)


class SongReq(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    lyrics: list[LyricLine] = Field(min_length=1, max_length=48)
    seconds: float = Field(60, ge=10, le=180)
    bpm: int = Field(110, ge=40, le=220)
    keyRoot: int = Field(0, ge=0, le=11)
    scale: str = "major"
    language: str = Field("ja", max_length=8)
    # the member's voice recording (base64, any ffmpeg format, ≤ ~30 s) → Seed-VC; absent = studio voice
    voice: str | None = Field(None, max_length=3_000_000)
    # how close to the member's voice (Seed-VC classifier-free guidance, 0–1)
    similarity: float = Field(0.7, ge=0, le=1)
    # tuning (the studio lab tries these; the app leaves them at the defaults)
    steps: int = Field(8, ge=4, le=64)
    shift: float = Field(3.0, ge=1.0, le=6.0)
    seed: int | None = Field(None, ge=0)
    # ACE-Step's 5Hz language model plans the song first ("thinking": melody/structure codes)
    lm: bool = False


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
        "voice": svc_health(),
        "painter": {k: v for k, v in painter.state.items() if k != "pipe"} | {"ready": painter.state["pipe"] is not None},
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


def file_m4a(path: str, stereo: bool = True) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, "out.m4a")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "2" if stereo else "1", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
        with open(out, "rb") as f:
            return f.read()


@app.post("/song")
def song(r: SongReq):
    """The whole song sung (ACE-Step), split into vocals + instrumental (HTDemucs), with line times."""
    import base64

    if state["error"]:
        raise HTTPException(500, f"model failed to load: {state['error'][:300]}")
    engine = state["engine"]
    if engine is None:
        return JSONResponse({"warming": True}, status_code=503)
    if not isinstance(engine, AceStep15):
        raise HTTPException(400, "songs with vocals need the ACE-Step engine")
    t0 = time.time()
    try:
        with gen_lock, tempfile.TemporaryDirectory() as d:
            wav, lines = ace_song(engine, r, r.seconds, d)
            t1 = time.time()
            vocals, inst = separate(wav, d)
            t2 = time.time()
            mix = os.path.join(d, "mix.wav")
            voiced, how = (None, "no voice sent")
            if r.voice:
                try:
                    voiced, how = to_voice(vocals, r.voice, d, r.similarity)
                except Exception as e:  # noqa: BLE001 — the song is still delivered in the studio's voice
                    traceback.print_exc()
                    voiced, how = None, f"seed-vc error: {e!r}"[:200]
            t3 = time.time()
            if voiced:
                mix_stems(inst, voiced, mix, r.seconds)
            else:
                # the studio's own mix, faded at the end
                fade_at = max(0.0, r.seconds - 1.5)
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-t", f"{r.seconds:.2f}", "-af", f"afade=t=out:st={fade_at:.2f}:d=1.5", mix], check=True)
            payload = {
                "seconds": r.seconds,
                "lines": lines,
                "mix": base64.b64encode(file_m4a(mix)).decode(),
                "vocals": base64.b64encode(file_m4a(voiced or vocals)).decode(),
                # the studio's own vocal (kept so a voice can be swapped later without singing again)
                "guide": base64.b64encode(file_m4a(vocals)).decode(),
                "instrumental": base64.b64encode(file_m4a(inst)).decode(),
                "voiced": bool(voiced),
                "voiceNote": how,
                "timings": {"song": round(t1 - t0, 1), "split": round(t2 - t1, 1), "voice": round(t3 - t2, 1)},
            }
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(500, f"song failed: {e!r}"[:400]) from e
    print(f"song: {len(r.lyrics)} lines, {r.seconds:.0f}s — sung {t1 - t0:.1f}s, split {t2 - t1:.1f}s, voice {t3 - t2:.1f}s ({how}), {len(lines)} line times", flush=True)
    return payload


class PaintItem(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    seed: int = 0


class PaintReq(BaseModel):
    items: list[PaintItem] = Field(min_length=1, max_length=60)
    negative: str = Field(default="", max_length=2000)
    side: int = 1024
    steps: int = Field(default=28, ge=8, le=60)
    cfg: float = Field(default=5.0, ge=1.0, le=12.0)


@app.post("/paint")
def paint(r: PaintReq):
    """Mars MV scenes, painted one after another (the API sends the whole storyboard in one call)."""
    t0 = time.time()
    painter.load(CKPT_BUCKET)
    if painter.state["pipe"] is None:
        raise HTTPException(500, f"painter failed to load: {painter.state['error']}")
    t1 = time.time()
    images = painter.paint([i.model_dump() for i in r.items], r.negative, r.side, r.steps, r.cfg)
    print(f"paint: {sum(1 for i in images if i)}/{len(images)} pictures in {time.time() - t1:.0f}s (+{t1 - t0:.0f}s loading)", flush=True)
    return {"images": images, "seconds": round(time.time() - t0, 1)}
