#!/usr/bin/env python3
"""A picture for checking lyric timing by eye: the singing voice's loudness, 20 s per row, with
  green = each line's start, red = its sung end (project.json), blue ticks = voice onsets (work/asr.json),
  grey = downbeats (work/beats.json), and the line number.
  python3 mv-kit/tools/timing_sheet.py <project-dir>   -> <project>/qa/timing.png
Look for: every green line sits exactly where the voice rises after a pause (not on a breath or a backing voice)."""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

PRJ = os.path.abspath(sys.argv[1]); P = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(PRJ, 'work', 'vocals.wav'), '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], check=True, capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
hop = 80; n = len(x) // hop                                   # 10 ms
db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-7)
lo, hi = np.percentile(db[db > -90], 25), np.percentile(db, 99.5); lv = np.clip((db - lo) / (hi - lo), 0, 1) ** 1.5   # relative: shows where the voice rises
dur = n / 100; ROW, PX, RH = 20, 60, 90                       # 20 s per row, 60 px per second, row height
rows = int(np.ceil(dur / ROW)); im = Image.new('RGB', (ROW * PX + 40, rows * RH + 10), (16, 14, 20)); d = ImageDraw.Draw(im)
def xy(t): r = int(t // ROW); return 30 + (t - r * ROW) * PX, 5 + r * RH
for k in range(n):
    X, Y = xy(k / 100); h = lv[k] * (RH - 30)
    d.line([(X, Y + RH - 20 - h), (X, Y + RH - 20)], fill=(90, 120, 170))
for r in range(rows):
    for s in range(ROW + 1):
        X, Y = 30 + s * PX, 5 + r * RH
        d.line([(X, Y + RH - 18), (X, Y + RH - 14)], fill=(120, 120, 120)); d.text((X + 2, Y + RH - 14), f'{r * ROW + s}', fill=(150, 150, 150))
beats = os.path.join(PRJ, 'work', 'beats.json')
if os.path.exists(beats):
    for t in json.load(open(beats))['down']:
        X, Y = xy(t); d.line([(X, Y), (X, Y + RH - 20)], fill=(70, 70, 70))
asr = os.path.join(PRJ, 'work', 'asr.json')
if os.path.exists(asr):
    for a, b in json.load(open(asr, encoding='utf-8'))['phrases']:
        X, Y = xy(a); d.line([(X, Y + RH - 34), (X, Y + RH - 20)], fill=(80, 160, 255), width=2)
for i, l in enumerate(P['lines']):
    X, Y = xy(l['s']); d.line([(X, Y), (X, Y + RH - 20)], fill=(60, 220, 90), width=2); d.text((X + 3, Y + 2), str(i + 1), fill=(60, 220, 90))
    X, Y = xy(l['e']); d.line([(X, Y + 10), (X, Y + RH - 20)], fill=(230, 70, 70), width=1)
os.makedirs(os.path.join(PRJ, 'qa'), exist_ok=True); out = os.path.join(PRJ, 'qa', 'timing.png'); im.save(out); print('->', out)
