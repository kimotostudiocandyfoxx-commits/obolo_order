#!/usr/bin/env python3
"""Days 1–2 after the client's playtest (2026-11-28; design/refs/2026-11-28-playtest/README.md) — the stills composed
from pictures we already have (nothing repainted), written to apps/web/public/onboarding/s at 720×1280:

  d2-gate-open.jpg            the open gate, MONBAN stepped aside (the last frame of motion 11): the push toward the
                              Earth temple during which KIMORIN calls 「待ちなさい。」
  d2-kimorin-mouth-only.jpg   「なんですか、この怪しい建物は。」: black, only KIMORIN's mouth and cheeks in a soft pool of
  (+ -mouth.webp)             light (his eyes are not seen) — cropped from s/d2-pinpon-end and its open-mouth patch, so
                              the mouth still moves with the voice (media.ts STILL_MOUTH)

  obolon-back.webp            OBOLON seen from behind, for the foreground of the Moon-temple cut-in: the client's own
                              picture (onboarding/obolon.webp) with its two eyes covered by the orb's own black (the back of
                              the orb has no face) — nothing repainted, the orb and its corona are his

Usage: python3 scripts/playtest/build.py
"""
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageFilter

OUT = 'apps/web/public/onboarding/s'
W, H = 720, 1280


def gate_open():
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, 'last.png')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-sseof', '-0.5', '-i', 'apps/web/public/onboarding/m11.mp4', '-update', '1', f], check=True)
        Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS).save(f'{OUT}/d2-gate-open.jpg', quality=88, optimize=True, progressive=True)


# the part of s/d2-pinpon-end under his eyes: the cheeks' blue swirls, the mouth, the chin (x0, y0, x1, y1)
CROP = (246, 550, 534, 680)
SCALE = 2.5
CENTRE_Y = 0.47  # the pool of light a little above the middle (the speech bubble sits low)


def mask(w, h):
    """a soft oval pool: full in the middle, fading to black well inside the crop's edges (no hard border)"""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (x - w / 2) / (w / 2)
    ny = (y - h * 0.46) / (h / 2)
    r = np.sqrt(nx ** 2 + ny ** 2)
    m = np.clip((1.0 - r) / 0.6, 0, 1)
    m = m * m * (3 - 2 * m)  # smoothstep
    # the top edge (where the eyes would be) falls off sooner: a shadow from above
    top = np.clip((y / h + 0.05) / 0.4, 0, 1)
    return m * (top * top * (3 - 2 * top))


def mouth_only():
    src = Image.open(f'{OUT}/d2-pinpon-end.jpg').convert('RGB').crop(CROP)
    pat = Image.open(f'{OUT}/d2-pinpon-end-mouth.webp').convert('RGBA').crop(CROP)
    w, h = round(src.width * SCALE), round(src.height * SCALE)
    src = src.resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    pat = pat.resize((w, h), Image.LANCZOS)
    m = mask(w, h)
    # night tone: a touch darker and warmer, the light falling on him from the gate's lanterns
    a = np.asarray(src).astype(np.float32) / 255
    a = a ** 1.12 * np.array([1.02, 0.96, 0.88]) * 0.97
    ox, oy = (W - w) // 2, round(H * CENTRE_Y - h / 2)
    canvas = np.zeros((H, W, 3), np.float32)
    canvas[oy:oy + h, ox:ox + w] = a * m[..., None]
    # a faint film grain so the black is not a dead flat (the other stills have their own)
    rng = np.random.default_rng(7)
    canvas = np.clip(canvas + rng.normal(0, 0.006, canvas.shape), 0, 1)
    Image.fromarray((canvas * 255 + 0.5).astype(np.uint8), 'RGB').save(f'{OUT}/d2-kimorin-mouth-only.jpg', quality=90, optimize=True, progressive=True)
    # the open-mouth patch: the same crop, scale and place; toned and faded like the picture under it
    p = np.asarray(pat).astype(np.float32) / 255
    rgb = (p[..., :3] ** 1.12 * np.array([1.02, 0.96, 0.88]) * 0.97) * m[..., None]
    out = np.zeros((H, W, 4), np.float32)
    out[oy:oy + h, ox:ox + w, :3] = rgb
    out[oy:oy + h, ox:ox + w, 3] = p[..., 3]
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/d2-kimorin-mouth-only-mouth.webp', 'WEBP', quality=90, method=6, exact=True)


def obolon_back():
    im = Image.open('apps/web/public/onboarding/obolon.webp').convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    r = np.hypot(x - w / 2, y - h / 2) / (w / 2)
    lum = a[..., :3].mean(-1)
    # the eyes: bright pixels well inside the orb (the corona is outside 0.5 of the width)
    eyes = ((r < 0.42) & (lum > 6)).astype(np.uint8) * 255
    eyes = np.asarray(Image.fromarray(eyes).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
    black = np.median(a[(r < 0.4) & (lum <= 6)][:, :3], axis=0)
    a[..., :3] = a[..., :3] * (1 - eyes[..., None]) + black * eyes[..., None]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save('apps/web/public/onboarding/obolon-back.webp', 'WEBP', quality=90, method=6, exact=True)


if __name__ == '__main__':
    gate_open()
    mouth_only()
    obolon_back()
    print('wrote', f'{OUT}/d2-gate-open.jpg', f'{OUT}/d2-kimorin-mouth-only.jpg', f'{OUT}/d2-kimorin-mouth-only-mouth.webp')
