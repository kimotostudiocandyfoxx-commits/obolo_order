#!/usr/bin/env python3
"""Music lab (2026-10-09): check gpu/music/app.py's song helpers off the GPU, on GitHub Actions —
format_lyrics, and the HTDemucs split (htdemucs_ft) on a short test song, on CPU.
Run by .github/workflows/music-lab.yml."""
import os
import subprocess
import sys
import tempfile
import time

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, "gpu/music")
import app  # noqa: E402

lines = [app.LyricLine(section="verse", text="あさのひかり"), app.LyricLine(section="verse", text="まどをあけて"), app.LyricLine(section="chorus", text="ラーメン ラーメン")]
text = app.format_lyrics(lines)
print(text)
assert text == "[Verse]\nあさのひかり\nまどをあけて\n\n[Chorus]\nラーメン ラーメン", text

with tempfile.TemporaryDirectory() as d:
    # 12 s test "song": a gliding sung-like tone over chords and a beat
    src = os.path.join(d, "song.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", "sine=f=220:d=12", "-f", "lavfi", "-i", "sine=f=330:d=12",
         "-f", "lavfi", "-i", "anoisesrc=d=12:a=0.05:c=pink",
         "-filter_complex", "[0]vibrato=f=5:d=0.5[v];[v][1][2]amix=3,aformat=channel_layouts=stereo", "-ar", "48000", src],
        check=True,
    )
    t = time.time()
    vocals, inst = app.separate(src, d)
    sec = time.time() - t
    for path in (vocals, inst):
        sr, x = wavfile.read(path)
        print(os.path.basename(path), sr, x.shape, f"rms={float(np.sqrt(np.mean(x.astype(np.float64) ** 2))):.4f}")
        assert sr == 44100 and x.ndim == 2 and x.shape[1] == 2 and x.shape[0] > 44100 * 10 and np.isfinite(x).all()
    print(f"HTDemucs split of 12 s on CPU: {sec:.1f}s")
print("ok")
