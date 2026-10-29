#!/usr/bin/env python3
"""Cut the approved luxury clips to the seconds the story chat chose (design/review-video-cuts.json), without the
sound the video model made up (story chat 2026-10-29: always -an): art/review/saturn/video/<id>.mp4 → .../cut/<id>.mp4"""
import json, os, subprocess

q = json.load(open('design/review-video-cuts.json'))
os.makedirs('art/review/saturn/cut', exist_ok=True)
for cid, spec in q['cuts'].items():
    a, b = spec[0], spec[1]
    speed = spec[2] if len(spec) > 2 else 1
    src, out = f'art/review/saturn/video/{cid}.mp4', f'art/review/saturn/cut/{cid}.mp4'
    if not os.path.exists(src):
        print('missing', cid)
        continue
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(a), '-to', str(b), '-i', src, '-an', *(['-vf', f'setpts=PTS/{speed}'] if speed != 1 else []), '-c:v', 'libx264', '-profile:v', 'high',
                    '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', out], check=True)
    print(cid, a, b, speed)
