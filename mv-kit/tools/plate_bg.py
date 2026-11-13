#!/usr/bin/env python3
"""Background plates from the painted "figure removed" pictures (art: <key>-plate.jpg).
Inside the area the figure covered (dilated), the plate replaces the smeared inpaint; outside, the original painting stays.
The plate is colour-matched to the painting on a ring just outside the hole, and blended with a soft edge.
usage: python3 plate_bg.py <project-dir> [img ...]   (plate picture: <project>/art/<img>-plate.jpg)"""
import os, sys
import numpy as np, cv2
from PIL import Image

import json
PRJ = os.path.abspath(sys.argv[1])
PJ = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))
LAYERED = sorted({s['img'] for s in PJ['scenes'] if s.get('layers')})
def art(img): return next(os.path.join(PRJ, 'art', img + e) for e in ('.jpg', '.jpeg', '.png', '.webp') if os.path.exists(os.path.join(PRJ, 'art', img + e)))

def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y <= r * r).astype(np.uint8)

for key in (sys.argv[2:] or [i for i in LAYERED if os.path.exists(f'{PRJ}/art/{i}-plate.jpg')]):
    im = np.asarray(Image.open(art(key)).convert('RGB')).astype(np.float32)
    S = im.shape[0]
    plate = np.asarray(Image.open(f'{PRJ}/art/{key}-plate.jpg').convert('RGB').resize((S, S), Image.LANCZOS)).astype(np.float32)
    a = np.asarray(Image.open(f'{PRJ}/layers/{key}-mask.png').convert('L')).astype(np.float32) / 255
    hole = cv2.dilate((a > .3).astype(np.uint8), disk(26))
    ring = cv2.dilate(hole, disk(40)) & (1 - hole)
    r = ring.astype(bool)
    # per-channel tone match (mean / spread) of the plate to the painting around the hole
    for ch in range(3):
        pm, ps = plate[..., ch][r].mean(), plate[..., ch][r].std() + 1e-3
        im_, is_ = im[..., ch][r].mean(), im[..., ch][r].std() + 1e-3
        plate[..., ch] = (plate[..., ch] - pm) * (is_ / ps) * .85 + (plate[..., ch] - pm) * .15 + im_
    hm = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 9)[..., None]
    hm = np.clip(hm * 1.25, 0, 1)
    bg = im * (1 - hm) + plate * hm
    old = f'{PRJ}/layers/{key}-bg.webp'
    keep = f'{PRJ}/layers/{key}-bg.inpaint.webp'
    if os.path.exists(old) and not os.path.exists(keep):
        os.replace(old, keep)
    Image.fromarray(np.clip(bg, 0, 255).round().astype(np.uint8)).save(old, 'WEBP', quality=88, method=6)
    print(key, 'plate bg', os.path.getsize(old) // 1024, 'KB, hole', round(float(hole.mean()), 3), flush=True)
