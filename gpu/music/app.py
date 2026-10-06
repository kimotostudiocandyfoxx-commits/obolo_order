"""
OBOLO ORDER — Mercury instrumental generator (Cloud Run with an NVIDIA L4 GPU).

POST /generate  {prompt, seconds, bpm, keyRoot, scale, progression, melody}  → audio/mp4 (AAC)
GET  /health    → {ready, loading, error}

Only the API's service account may call it (Cloud Run IAM, no public access). The model loads in a
background thread at start-up (weights cached on the Cloud Storage volume mounted at /models), so a
cold instance answers 503 {"warming": true} until it is ready; the API tells the visitor to retry.

MODEL: MUSIC_MODEL (default facebook/musicgen-melody-large). PLACEHOLDER (P-MER-5): MusicGen weights
are CC-BY-NC (non-commercial) — switch to a commercially usable model before the paid launch.
"""
import os
import subprocess
import tempfile
import threading

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from scipy.io import wavfile

from render import render_guide

MODEL_ID = os.environ.get("MUSIC_MODEL", "facebook/musicgen-melody-large")
state: dict = {"model": None, "processor": None, "device": "cpu", "dtype": None, "error": None, "loading": False}
gen_lock = threading.Lock()
app = FastAPI()


def load() -> None:
    state["loading"] = True
    try:
        import torch
        from transformers import AutoProcessor, MusicgenMelodyForConditionalGeneration

        dev = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if dev == "cuda" else torch.float32
        processor = AutoProcessor.from_pretrained(MODEL_ID)
        model = MusicgenMelodyForConditionalGeneration.from_pretrained(MODEL_ID, torch_dtype=dtype).to(dev)
        model.eval()
        state.update(model=model, processor=processor, device=dev, dtype=dtype)
        print(f"model {MODEL_ID} ready on {dev}", flush=True)
    except Exception as e:  # noqa: BLE001 — reported by /health
        state["error"] = repr(e)
        print(f"model load failed: {e!r}", flush=True)
    finally:
        state["loading"] = False


@app.on_event("startup")
def start() -> None:
    threading.Thread(target=load, daemon=True).start()


class Note(BaseModel):
    midi: int | None = None
    beats: float = Field(0.5, gt=0, le=16)


class GenerateReq(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    seconds: float = Field(20, ge=4, le=30)
    bpm: int = Field(110, ge=40, le=220)
    keyRoot: int = Field(0, ge=0, le=11)
    scale: str = "major"
    progression: list[int] = Field(default_factory=lambda: [0, 4, 5, 3], max_length=16)
    melody: list[Note] = Field(default_factory=list, max_length=600)


@app.get("/health")
def health():
    return {"ready": state["model"] is not None, "loading": state["loading"], "error": state["error"], "model": MODEL_ID}


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
        raise HTTPException(500, f"model failed to load: {state['error']}")
    model, processor = state["model"], state["processor"]
    if model is None:
        return JSONResponse({"warming": True}, status_code=503)
    import torch

    sr = processor.feature_extractor.sampling_rate
    guide = render_guide(r.seconds, r.bpm, r.keyRoot, r.scale, r.progression, [n.model_dump() for n in r.melody], sr)
    inputs = processor(audio=guide, sampling_rate=sr, text=[r.prompt], padding=True, return_tensors="pt")
    inputs = {k: (v.to(state["device"], state["dtype"]) if v.is_floating_point() else v.to(state["device"])) for k, v in inputs.items()}
    with gen_lock, torch.inference_mode():
        out = model.generate(**inputs, do_sample=True, guidance_scale=3.0, max_new_tokens=int(r.seconds * 50) + 4)
    out_sr = model.config.audio_encoder.sampling_rate
    audio = out[0, 0].float().cpu().numpy()[: int(r.seconds * out_sr)]
    fade = min(len(audio), int(1.5 * out_sr))
    audio[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    audio = audio / (float(np.max(np.abs(audio))) or 1.0) * 0.9
    return Response(to_m4a(audio, out_sr), media_type="audio/mp4", headers={"x-seconds": f"{len(audio) / out_sr:.1f}"})
