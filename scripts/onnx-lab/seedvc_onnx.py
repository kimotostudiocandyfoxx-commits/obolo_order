#!/usr/bin/env python3
"""ONNX lab (2026-10-09, plan A step 3): which parts of Seed-VC's singing pipeline export to ONNX,
do they give the same output, and are they faster? Run from a Seed-VC checkout (cwd) on CPU.
Parts: BigVGAN vocoder, CAM++ speaker encoder, Whisper encoder, RMVPE pitch network. The DiT
(flow matching with a KV cache and its own sampling loop) is not attempted here. Appends to $REPORT."""
import os
import sys
import time
import traceback
from argparse import Namespace

sys.path.insert(0, os.getcwd())
import librosa  # noqa: E402
import numpy as np  # noqa: E402
import onnxruntime as ort  # noqa: E402
import torch  # noqa: E402
import torchaudio  # noqa: E402

REPORT = os.environ.get("REPORT", "art/lab/onnx/report.md")
OUT = os.environ.get("ONNX_DIR", "/tmp/onnx")
os.makedirs(OUT, exist_ok=True)
lines = ["## Seed-VC parts → ONNX Runtime (CPU)", "", "| part | ONNX | size | PyTorch | ONNX Runtime | agreement |", "|---|---|---|---|---|---|"]

import inference  # noqa: E402  (Seed-VC; sets its checkpoint cache)

model, semantic_fn, f0_fn, vocoder, campplus, to_mel, mel_args = inference.load_models(Namespace(f0_condition=True, checkpoint=None, config=None, fp16=False))
sr = mel_args["sampling_rate"]
wave = torch.tensor(librosa.load("examples/source/TECHNOPOLIS - 2085 [vocals]_[cut_14sec].wav", sr=sr)[0][: sr * 10])[None].float()
w16 = torchaudio.functional.resample(wave, sr, 16000)


def check(name, module, inputs, input_names, dynamic):
    path = os.path.join(OUT, f"{name}.onnx")
    try:
        module.eval()
        with torch.no_grad():
            t = time.time()
            ref = module(*inputs)
            t_torch = time.time() - t
            ref = ref[0] if isinstance(ref, (tuple, list)) else ref
            ref = getattr(ref, "last_hidden_state", ref)
            torch.onnx.export(module, tuple(inputs), path, input_names=input_names, output_names=["out"], dynamic_axes=dynamic, opset_version=17)
        sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        feed = {n: x.numpy() for n, x in zip(input_names, inputs)}
        sess.run(None, feed)  # warm-up
        t = time.time()
        got = sess.run(None, feed)[0]
        t_ort = time.time() - t
        a = ref.numpy().astype(np.float64)
        snr = 10 * np.log10(np.sum(a**2) / max(np.sum((a - got) ** 2), 1e-20))
        size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.startswith(name)) / 1e6
        lines.append(f"| {name} | ✅ | {size:.0f} MB | {t_torch * 1000:.0f} ms | {t_ort * 1000:.0f} ms | {snr:.0f} dB |")
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        lines.append(f"| {name} | ❌ {type(e).__name__}: {str(e)[:120].replace('|', '/')} | | | | |")
    print(lines[-1], flush=True)


# BigVGAN: mel (1, 128, T) → wave
mel = to_mel(wave)
check("bigvgan", vocoder, [mel], ["mel"], {"mel": {2: "frames"}, "out": {2: "samples"}})

# CAM++: fbank (1, T, 80) → speaker embedding
feat = torchaudio.compliance.kaldi.fbank(w16, num_mel_bins=80, dither=0, sample_frequency=16000)
feat = (feat - feat.mean(dim=0, keepdim=True))[None]
check("campplus", campplus, [feat], ["fbank"], {"fbank": {1: "frames"}})


# Whisper encoder: input features (1, 80, 3000) → hidden states
class Enc(torch.nn.Module):
    def __init__(self):
        super().__init__()
        from transformers import WhisperModel

        self.enc = WhisperModel.from_pretrained(model_name).encoder.float()

    def forward(self, x):
        return self.enc(x).last_hidden_state


import yaml  # noqa: E402

from hf_utils import load_custom_model_from_hf  # noqa: E402

_, cfg_path = load_custom_model_from_hf("Plachta/Seed-VC", "DiT_seed_v2_uvit_whisper_base_f0_44k_bigvgan_pruned_ft_ema_v2.pth", "config_dit_mel_seed_uvit_whisper_base_f0_44k.yml")
model_name = yaml.safe_load(open(cfg_path))["model_params"]["speech_tokenizer"]["name"]
from transformers import AutoFeatureExtractor  # noqa: E402

fe = AutoFeatureExtractor.from_pretrained(model_name)
feats = fe([w16.squeeze(0).numpy()], return_tensors="pt", sampling_rate=16000).input_features
check("whisper-encoder", Enc(), [feats], ["features"], {})

# RMVPE: mel (1, 128, T multiple of 32) → pitch salience
rmvpe = f0_fn.__self__
m = rmvpe.mel_extractor(w16.float(), center=True)
n = m.shape[-1]
m = torch.nn.functional.pad(m, (0, 32 * ((n - 1) // 32 + 1) - n), mode="constant")
check("rmvpe", rmvpe.model, [m], ["mel"], {"mel": {2: "frames"}, "out": {1: "frames"}})

lines += ["", "- DiT (flow matching, the voice-changing core): not attempted — KV cache + its own sampling loop; needs a hand-written export.", ""]
os.makedirs(os.path.dirname(REPORT), exist_ok=True)
with open(REPORT, "a") as f:
    f.write("\n".join(lines) + "\n")
