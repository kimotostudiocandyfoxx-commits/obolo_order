#!/usr/bin/env bash
# MV kit — install the tools once (Linux, Python 3.11+, Node 18+, ffmpeg).
#   bash mv-kit/tools/setup.sh [<tools-dir>]   (default ~/.mvkit: models + a Python 3.10 env for Spleeter/librosa)
# Rendering needs Playwright + Chromium:  npm i -g playwright && npx playwright install chromium   (skip if already there)
set -euo pipefail
T="${1:-$HOME/.mvkit}"; mkdir -p "$T"
python3 -m pip install -q pillow numpy scipy opencv-python-headless rembg pymatting sherpa-onnx onnxruntime uv
# Spleeter (vocal separation) and librosa (beats) need Python 3.10: their own env
[ -x "$T/py310/bin/python" ] || python3 -m uv venv -q -p 3.10 "$T/py310"
VIRTUAL_ENV="$T/py310" python3 -m uv pip install -q spleeter librosa==0.10.2.post1
# models (from GitHub releases)
if [ ! -d "$T/pretrained_models/2stems" ]; then
  mkdir -p "$T/pretrained_models/2stems"
  curl -sSL https://github.com/deezer/spleeter/releases/download/v1.4.0/2stems.tar.gz | tar -xz -C "$T/pretrained_models/2stems"
fi
if [ ! -d "$T/asr-ja" ]; then
  curl -sSL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2 | tar -xj -C "$T"
  mv "$T/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01" "$T/asr-ja"
fi
echo "tools ready in $T"
