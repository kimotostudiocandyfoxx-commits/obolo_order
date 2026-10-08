#!/usr/bin/env python3
"""Art workshop: cut a sprite painted on flat white out of its background -> transparent webp.

usage: python3 scripts/art/cutout.py <in.png> <out.webp> [--width 640] [--glow-below 0.7] [--holes 400]

Only the white connected to the picture's border is removed (white inside the sprite stays),
with a soft edge so glows do not get a hard halo. The result is trimmed to its content.
--glow-below f: below that fraction of the height, light pixels are glow painted on white — they
become see-through coloured light (so a saucer's under-glow is not a pale cloud on dark skies).
"""
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('dst')
ap.add_argument('--width', type=int, default=640)
ap.add_argument('--glow-below', type=float, default=None)
ap.add_argument('--holes', type=int, default=0, help='also clear enclosed pure-white areas bigger than this many pixels')
a = ap.parse_args()

img = Image.open(a.src).convert('RGB')
rgb = np.asarray(img).astype(np.float32)
# distance from white: 0 = pure white
dist = 255 - rgb.min(axis=2)
near = dist < 40
lab, _ = ndimage.label(near)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bg = np.isin(lab, border[border > 0])
if a.holes:
    # gaps of background seen through the sprite (between sails, ribbons…): nearly pure white blobs
    lab3, n3 = ndimage.label(dist < 12)
    sizes = ndimage.sum(np.ones_like(dist), lab3, index=np.arange(1, n3 + 1))
    big = np.flatnonzero(sizes > a.holes) + 1
    bg = bg | (np.isin(lab3, big) & ~bg)
# soft alpha: inside the background region fade by how far from white; feather the edge
alpha = np.where(bg, np.clip((dist - 8) / 32, 0, 1), 1.0)
alpha = ndimage.gaussian_filter(alpha, 0.8)
alpha = np.where(bg | ndimage.binary_dilation(bg, iterations=1), alpha, 1.0)
if a.glow_below is not None:
    rows = np.arange(rgb.shape[0])[:, None] >= int(rgb.shape[0] * a.glow_below)
    # only light areas reachable from the outside (the hull's dark outline stops the flood)
    lab2, _ = ndimage.label((dist < 150) & rows)
    touch = np.unique(lab2[ndimage.binary_dilation(bg, iterations=2) & (lab2 > 0)])
    halo = np.isin(lab2, touch[touch > 0])
    glow = np.clip(dist / 170, 0, 1) ** 1.2
    alpha = np.where(halo, np.minimum(alpha, glow), alpha)
# un-premultiply the white out of semi-transparent edge pixels
a3 = np.maximum(alpha, 1e-3)[..., None]
fg = np.clip((rgb - 255 * (1 - a3)) / a3, 0, 255)
out = np.dstack([fg, alpha * 255]).astype(np.uint8)
im = Image.fromarray(out, 'RGBA')
bbox = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
if bbox:
    pad = 6
    im = im.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad)))
if im.width > a.width:
    im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
im.save(a.dst, 'WEBP', quality=88, method=6)
print(a.dst, im.size)
