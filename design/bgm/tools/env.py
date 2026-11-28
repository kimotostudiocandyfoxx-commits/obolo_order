"""Decode an audio file to float32 stereo at 48 kHz (numpy) with ffmpeg; used by the loop tools (search.py, build.py)."""
import subprocess

import numpy as np


def load(f, sr=48000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '2', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
