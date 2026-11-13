#!/usr/bin/env python3
"""Beats and downbeats of the song -> <project>/work/beats.json, and (with --snap) every scene start in project.json
moved to the nearest downbeat (within .8 s): scene changes then land on the bar, which is what makes cuts feel right.
  ~/.mvkit/py310/bin/python mv-kit/tools/beats.py <project-dir> [--snap]"""
import json, os, sys
import numpy as np, librosa
PRJ = os.path.abspath(sys.argv[1]); P = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))
y, sr = librosa.load(os.path.join(PRJ, P.get('song', 'song.mp3')), sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time', tightness=120)
S = np.abs(librosa.stft(y)); low = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S[:40]), sr=sr)
bstr = np.interp(beats, librosa.times_like(low, sr=sr), low)
k = int(np.argmax([bstr[p::4].mean() for p in range(4)]))   # downbeat phase: the strongest low-end of the 4
down = [round(float(b), 3) for b in beats[k::4]]
json.dump({'tempo': float(np.atleast_1d(tempo)[0]), 'beats': [round(float(b), 3) for b in beats], 'down': down}, open(os.path.join(PRJ, 'work', 'beats.json'), 'w'))
print('tempo', round(float(np.atleast_1d(tempo)[0]), 1), 'bpm, bar', round(240 / float(np.atleast_1d(tempo)[0]), 2), 's')
if '--snap' in sys.argv:
    for sc in P['scenes'][1:]:
        n = min(down, key=lambda d: abs(d - sc['t']))
        if abs(n - sc['t']) <= .8: print(f"  {sc['img']:<28} {sc['t']:7.2f} -> {n:7.2f}"); sc['t'] = round(n, 2)
    json.dump(P, open(os.path.join(PRJ, 'project.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
