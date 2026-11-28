"""Mars: a Sushimon's three-second film loops (handoff planets-08 §3: 「つなぎ目なく」). The films from the story branch
jump at the loop point — the last frame to the first moves about three times as much as one frame to the next (the
light, the sun, the crab's claws pop) — so they are made seamless here, not changed otherwise:

  1. the first `fade` frames are taken off the front and the last `fade` frames are cross-faded into them, so the
     loop ends on the frame just before the one it starts with (8 frames: a third of a second; the loop is then
     64 frames, 2.67 s, at the same 24 fps — stretching it back to 72 frames was tried and dropped: the blended
     in-between frames are softer than the others, and the picture visibly breathes);
  2. encoded like the original (H.264 High, yuv420p, no sound, +faststart), but with the key frame's quality kept
     equal to the others' (crf 20, ipratio / pbratio / qcomp 1): at the original's 380 kbps the key frame the loop
     returns to is visibly crisper than the frames before it, and that alone looked like a seam. About 250 KB a film.

  python3 scripts/planet-home/mvloop.py <in.mp4> <out.mp4>      (cast-works.py calls `seamless` for every film)
"""
import json
import subprocess
import sys

import numpy as np


def _probe(src):
    o = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames', '-of', 'json', src],
        check=True, capture_output=True, text=True,
    ).stdout
    s = json.loads(o)['streams'][0]
    return int(s['width']), int(s['height']), s['r_frame_rate']


def seam(frames):
    """how much the loop point moves, against an ordinary frame step (1.0 = no different from any other step)"""
    f = frames.astype(np.float32)
    steps = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2, 3))
    return float(np.abs(f[0] - f[-1]).mean() / steps.mean())


def seamless(src, dst, fade=8, crf=20):
    w, h, rate = _probe(src)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32)
    n = len(f)
    m = n - fade
    # 1. frames fade..n-1, whose last `fade` blend into frames 0..fade-1 (the ones just before frame `fade`)
    loop = f[fade:].copy()
    for j in range(fade):
        a = (j + 1) / fade
        loop[m - fade + j] = (1 - a) * f[n - fade + j] + a * f[j]
    out = loop
    out = np.clip(out + 0.5, 0, 255).astype(np.uint8)
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', rate, '-i', '-',
         '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', str(crf),
         '-x264-params', 'ipratio=1.0:pbratio=1.0:qcomp=1.0',
         '-g', str(m), '-an', '-movflags', '+faststart', dst],
        input=out.tobytes(), check=True,
    )
    return seam(f), seam(out)


if __name__ == '__main__':
    before, after = seamless(sys.argv[1], sys.argv[2])
    print(f'loop point: {before:.2f} → {after:.2f} times an ordinary frame step')
