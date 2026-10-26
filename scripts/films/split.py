#!/usr/bin/env python3
"""A finished luxury film → what the story plays (client 2026-10-26): silent parts of ~5 s, each squeezed under
1 MB (docs/media.md) as apps/web/public/onboarding/mfilm-<id>-<k>.mp4 (+ .jpg), and the film's sound as one
music track bgm-film-<id>.m4a (gapless on the music channel while the parts play one after another).
Usage: scripts/films/split.py <film.mp4> <id> [part seconds]
Prints the motion ids for the 'film' step."""
import os, subprocess, sys

src, fid = sys.argv[1], sys.argv[2]
part = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
O = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../apps/web/public/onboarding')
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).decode())
ff = lambda *a: subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *a], check=True)
ids, k, t = [], 1, 0.0
while t < dur - 0.05:
    d = min(part, dur - t)
    out = f'{O}/mfilm-{fid}-{k}.mp4'
    for crf in (23, 26, 29, 32):
        ff('-ss', f'{t:.3f}', '-t', f'{d:.3f}', '-i', src, '-an', '-vf', 'scale=720:1280,setsar=1', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', str(crf), '-preset', 'slow', '-movflags', '+faststart', out)
        if os.path.getsize(out) <= 1_000_000:
            break
    ff('-i', out, '-frames:v', '1', '-q:v', '3', f'{O}/mfilm-{fid}-{k}.jpg')
    ids.append(f'film-{fid}-{k}')
    t += d
    k += 1
ff('-i', src, '-vn', '-c:a', 'aac', '-b:a', '128k', f'{O}/bgm-film-{fid}.m4a')
print(' '.join(ids))
