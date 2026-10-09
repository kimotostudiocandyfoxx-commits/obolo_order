"""
OBOLO ORDER — Seed-VC singing voice conversion worker (client decision 2026-10-09).

Seed-VC (GPL-3.0, github.com/Plachtaa/seed-vc) converts a sung vocal into another voice from a short
reference recording (1–30 s), zero-shot: no training per member. It runs in its own Python
environment (/opt/svc: PyTorch 2.4, transformers 4.46 as Seed-VC pins them), next to ACE-Step's,
as a small local HTTP server that app.py starts and calls:

POST /convert {source, target, out, steps, cfg} (wav paths)  → {ok, shift, seconds}
POST /transcribe {path, language}                           → {ok, text}  (Whisper: which take sang the words)
GET  /health                                                → {ready, error}

`python svc_worker.py download` fetches the checkpoints at image build time (no GPU needed).
Run with the working directory /opt/seedvc (Seed-VC's own modules and checkpoint cache).
"""
import json
import os
import sys
import threading
import time
import traceback
from argparse import Namespace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.getcwd())
import numpy as np  # noqa: E402

state = {"ready": False, "error": None}
models = {}
lock = threading.Lock()


def load():
    import inference  # Seed-VC's own module (sets its checkpoint cache under ./checkpoints)

    t = time.time()
    # the singing model: F0-conditioned DiT (whisper-base), BigVGAN 44.1 kHz, RMVPE for pitch
    m = inference.load_models(Namespace(f0_condition=True, checkpoint=None, config=None, fp16=True))
    models["inference"] = inference
    models["m"] = m
    print(f"seed-vc ready in {time.time() - t:.0f}s on {inference.device}", flush=True)


def convert(source: str, target: str, out: str, steps: int = 30, cfg: float = 0.7) -> dict:
    """The sung vocal `source` in the voice of `target` (pitch kept; moved by an octave if the
    reference voice sits far from it, so the song's key stays right)."""
    import librosa
    import torch
    import torchaudio

    inference = models["inference"]
    model, semantic_fn, f0_fn, vocoder_fn, campplus_model, mel_fn, mel_fn_args = models["m"]
    device = inference.device
    sr = mel_fn_args["sampling_rate"]  # 44100 for the singing model
    hop = 512
    max_context_window = sr // hop * 30
    overlap_frame_len = 16
    overlap_wave_len = overlap_frame_len * hop

    with torch.no_grad():
        source_audio = torch.tensor(librosa.load(source, sr=sr)[0]).unsqueeze(0).float().to(device)
        ref_audio = torch.tensor(librosa.load(target, sr=sr)[0][: sr * 25]).unsqueeze(0).float().to(device)
        t0 = time.time()
        src16 = torchaudio.functional.resample(source_audio, sr, 16000)
        # whisper features of the source, 30 s windows with 5 s overlap
        if src16.size(-1) <= 16000 * 30:
            s_alt = semantic_fn(src16)
        else:
            overlap_t = 5
            parts, buffer, done = [], None, 0
            while done < src16.size(-1):
                if buffer is None:
                    chunk = src16[:, done : done + 16000 * 30]
                else:
                    chunk = torch.cat([buffer, src16[:, done : done + 16000 * (30 - overlap_t)]], dim=-1)
                s = semantic_fn(chunk)
                parts.append(s if done == 0 else s[:, 50 * overlap_t :])
                buffer = chunk[:, -16000 * overlap_t :]
                done += 30 * 16000 if done == 0 else chunk.size(-1) - 16000 * overlap_t
            s_alt = torch.cat(parts, dim=1)
        ref16 = torchaudio.functional.resample(ref_audio, sr, 16000)
        s_ori = semantic_fn(ref16)
        mel = mel_fn(source_audio.float())
        mel2 = mel_fn(ref_audio.float())
        target_lengths = torch.LongTensor([mel.size(2)]).to(device)
        target2_lengths = torch.LongTensor([mel2.size(2)]).to(device)
        feat2 = torchaudio.compliance.kaldi.fbank(ref16, num_mel_bins=80, dither=0, sample_frequency=16000)
        style2 = campplus_model((feat2 - feat2.mean(dim=0, keepdim=True)).unsqueeze(0))

        f0_ori = torch.from_numpy(f0_fn(ref16[0], thred=0.03)).to(device)[None]
        f0_alt = torch.from_numpy(f0_fn(src16[0], thred=0.03)).to(device)[None]
        # octave move only (any other shift would put the vocal out of the song's key)
        shift = 0
        v_ori, v_alt = f0_ori[f0_ori > 1], f0_alt[f0_alt > 1]
        if v_ori.numel() > 10 and v_alt.numel() > 10:
            gap = 12 * float(torch.log2(torch.median(v_ori) / torch.median(v_alt)))
            if abs(gap) >= 8:
                shift = 12 if gap > 0 else -12
        shifted = f0_alt.clone()
        if shift:
            shifted[f0_alt > 1] = f0_alt[f0_alt > 1] * 2 ** (shift / 12)

        cond, *_ = model.length_regulator(s_alt, ylens=target_lengths, n_quantizers=3, f0=shifted)
        prompt_cond, *_ = model.length_regulator(s_ori, ylens=target2_lengths, n_quantizers=3, f0=f0_ori)
        max_source_window = max_context_window - mel2.size(2)
        processed, chunks, previous = 0, [], None
        while processed < cond.size(1):
            chunk_cond = cond[:, processed : processed + max_source_window]
            last = processed + max_source_window >= cond.size(1)
            cat = torch.cat([prompt_cond, chunk_cond], dim=1)
            with torch.autocast(device_type=device.type, dtype=torch.float16 if inference.fp16 else torch.float32):
                vc = model.cfm.inference(cat, torch.LongTensor([cat.size(1)]).to(device), mel2, style2, None, steps, inference_cfg_rate=cfg)
                vc = vc[:, :, mel2.size(-1) :]
            wave = vocoder_fn(vc.float()).squeeze()[None, :]
            if processed == 0:
                if last:
                    chunks.append(wave[0].cpu().numpy())
                    break
                chunks.append(wave[0, :-overlap_wave_len].cpu().numpy())
                previous = wave[0, -overlap_wave_len:]
                processed += vc.size(2) - overlap_frame_len
            elif last:
                chunks.append(inference.crossfade(previous.cpu().numpy(), wave[0].cpu().numpy(), overlap_wave_len))
                break
            else:
                chunks.append(inference.crossfade(previous.cpu().numpy(), wave[0, :-overlap_wave_len].cpu().numpy(), overlap_wave_len))
                previous = wave[0, -overlap_wave_len:]
                processed += vc.size(2) - overlap_frame_len
        out_wave = torch.tensor(np.concatenate(chunks))[None, :].float()
        torchaudio.save(out, out_wave.cpu(), sr)
    sec = time.time() - t0
    print(f"seed-vc: {out_wave.size(-1) / sr:.1f}s of vocal in {sec:.1f}s (octave shift {shift})", flush=True)
    return {"ok": True, "shift": shift, "seconds": round(sec, 1)}


WHISPER = os.environ.get("WHISPER_MODEL", "openai/whisper-large-v3-turbo")
# baked into the image here (the HF cache path is a mounted volume at run time)
WHISPER_DIR = "/opt/whisper"


def asr():
    """Whisper (MIT), loaded on first use: hears which take of a song actually sang the lyrics."""
    if "asr" not in models:
        import torch
        from transformers import pipeline

        t = time.time()
        models["asr"] = pipeline(
            "automatic-speech-recognition",
            model=WHISPER_DIR if os.path.isdir(WHISPER_DIR) else WHISPER,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device=0 if torch.cuda.is_available() else -1,
        )
        print(f"whisper ready in {time.time() - t:.0f}s", flush=True)
    return models["asr"]


def transcribe(path: str, language: str = "ja") -> dict:
    t = time.time()
    out = asr()(path, chunk_length_s=30, batch_size=4, generate_kwargs={"language": language, "task": "transcribe"})
    text = out["text"] if isinstance(out, dict) else str(out)
    return {"ok": True, "text": text.strip(), "seconds": round(time.time() - t, 1)}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send(200, state)

    def do_POST(self):
        if not state["ready"]:
            return self._send(503, {"ok": False, "error": state["error"] or "loading"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("content-length", "0"))) or b"{}")
            with lock:
                if self.path.startswith("/transcribe"):
                    res = transcribe(req["path"], req.get("language", "ja"))
                else:
                    res = convert(req["source"], req["target"], req["out"], int(req.get("steps", 30)), float(req.get("cfg", 0.7)))
            self._send(200, res)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self._send(500, {"ok": False, "error": repr(e)[:300]})

    def log_message(self, *_):  # quiet
        pass


def main():
    def start():
        try:
            load()
            state["ready"] = True
        except Exception as e:  # noqa: BLE001
            state["error"] = repr(e)[:300]
            traceback.print_exc()

    threading.Thread(target=start, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("SVC_PORT", "8091"))), Handler).serve_forever()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "download":
        load()  # fetch every checkpoint into ./checkpoints (CPU is fine)
        from huggingface_hub import snapshot_download

        snapshot_download(WHISPER, local_dir=WHISPER_DIR, allow_patterns=["*.json", "*.safetensors", "*.txt", "*.model", "*.tiktoken"])
    else:
        main()
