#!/usr/bin/env python3
"""ONNX lab (2026-10-09, plan A step 3): can HTDemucs run in ONNX Runtime, as well and how fast?

Uses demucs.onnx (MIT, github.com/sevagh/demucs.onnx): the STFT / iSTFT move out of the network so
the core exports to ONNX. We export the fine-tuned *vocals* model (htdemucs_ft_vocals — all we need
to split vocals / instrumental, a quarter of the htdemucs_ft bag), then run the same song through
PyTorch and ONNX Runtime and compare the vocals and the time. Appends to $REPORT (markdown)."""
import os
import subprocess
import sys
import time

import numpy as np
import onnxruntime as ort
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

REPORT = os.environ.get("REPORT", "art/lab/onnx/report.md")
ONNX = sys.argv[1]
out = []


def say(s=""):
    print(s, flush=True)
    out.append(s)


class OrtCore:
    """The exported core network behind the same interface apply_model expects."""

    def __init__(self, torch_core, path):
        self.segment = torch_core.segment
        self.samplerate = torch_core.samplerate
        self.audio_channels = torch_core.audio_channels
        self.sources = torch_core.sources
        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.sess = ort.InferenceSession(path, so, providers=["CPUExecutionProvider"])
        self.inputs = [i.name for i in self.sess.get_inputs()]

    def __call__(self, mix, magspec):
        x, xt = self.sess.run(None, {self.inputs[0]: mix.numpy(), self.inputs[1]: magspec.numpy()})
        return torch.from_numpy(x), torch.from_numpy(xt)


def song(seconds=30, sr=44100):
    """A test mix: a gliding sung-like tone, chords, a beat, a little noise."""
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=f=220:d={seconds}", "-f", "lavfi", "-i", f"sine=f=330:d={seconds}",
         "-f", "lavfi", "-i", f"anoisesrc=d={seconds}:a=0.04:c=pink", "-filter_complex", "[0]vibrato=f=5:d=0.5[v];[v][1][2]amix=3",
         "-ac", "2", "-ar", str(sr), "-f", "f32le", "-"],
        check=True, capture_output=True).stdout
    return torch.from_numpy(np.frombuffer(raw, dtype=np.float32).copy().reshape(-1, 2).T)


# htdemucs_ft is a bag of four fine-tuned models, one per source: take the one weighted for vocals
bag = get_model("htdemucs_ft")
vi_bag = list(bag.sources).index("vocals")
core = max(zip(bag.models, bag.weights), key=lambda mw: mw[1][vi_bag])[0]
core.eval()
if not os.path.exists(ONNX):
    # export the core (STFT / iSTFT outside, as demucs.onnx's convert-pth-to-onnx.py does)
    from demucs.htdemucs import standalone_magnitude, standalone_spec
    from torch.nn import functional as F

    wav = torch.randn(1, 2, 343980)
    wav = F.pad(wav, (0, int(core.segment * core.samplerate) - wav.shape[-1]))
    os.makedirs(os.path.dirname(ONNX), exist_ok=True)
    t = time.time()
    torch.onnx.export(core, (wav, standalone_magnitude(standalone_spec(wav))), ONNX, export_params=True, opset_version=17, do_constant_folding=True, input_names=["mix", "spec"], output_names=["x", "xt"])
    print(f"exported in {time.time() - t:.0f}s", flush=True)
mix = song()
ref = mix.mean(0)
x = ((mix - ref.mean()) / (ref.std() + 1e-8))[None]
vi = list(core.sources).index("vocals")

t = time.time()
with torch.no_grad():
    y_torch = apply_model(core, x, split=True, overlap=0.25, progress=False)[0]
t_torch = time.time() - t

ort_core = OrtCore(core, ONNX)
t = time.time()
y_ort = apply_model(ort_core, x, split=True, overlap=0.25, progress=False)[0]
t_ort = time.time() - t

a, b = y_torch[vi].numpy(), y_ort[vi].numpy()
diff = float(np.max(np.abs(a - b)))
snr = float(10 * np.log10(np.sum(a**2) / max(np.sum((a - b) ** 2), 1e-12)))
say("## HTDemucs (htdemucs_ft_vocals) → ONNX Runtime")
say(f"- ONNX file: {os.path.getsize(ONNX) / 1e6:.0f} MB")
say(f"- 30 s test song on CPU: PyTorch **{t_torch:.1f}s**, ONNX Runtime **{t_ort:.1f}s** ({t_torch / t_ort:.2f}× )")
say(f"- vocals, PyTorch vs ONNX: max difference {diff:.2e}, agreement {snr:.0f} dB (above ~60 dB = the same)")
say("")
os.makedirs(os.path.dirname(REPORT), exist_ok=True)
with open(REPORT, "a") as f:
    f.write("\n".join(out) + "\n")
