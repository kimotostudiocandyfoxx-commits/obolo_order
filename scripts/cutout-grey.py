#!/usr/bin/env python3
"""Cut a character out of a flat mid-grey background (the story's sprites are painted on #808080 so the white
mask and feathers stay) → WebP with alpha, trimmed to the figure.
Usage: scripts/cutout-grey.py <in.jpg> <out.webp> [tolerance=26] [max_height=1100]
Only grey connected to the border is removed; the edge is softened and the grey fringe pulled out of it."""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
tol = int(sys.argv[3]) if len(sys.argv) > 3 else 26
max_h = int(sys.argv[4]) if len(sys.argv) > 4 else 1100

im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape
# the background grey, measured on the border (paintings drift a little from #808080)
border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
ref = np.median(border, axis=0)
dist = np.abs(a - ref).max(axis=2)
sat = a.max(axis=2) - a.min(axis=2)
greyish = (dist <= tol) & (sat <= 22)
bg = np.zeros((h, w), dtype=bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if greyish[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if greyish[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and greyish[ny, nx]:
            bg[ny, nx] = True
            q.append((ny, nx))
alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
# close tiny holes, then a soft 1–2 px edge
alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
al = np.asarray(alpha).astype(np.float32) / 255.0
# pull the grey out of half-transparent edge pixels (un-premultiply against the background grey)
rgb = a.astype(np.float32)
edge = (al > 0.02) & (al < 0.98)
k = al[..., None]
fixed = np.clip((rgb - (1 - k) * ref) / np.maximum(k, 0.05), 0, 255)
rgb = np.where(edge[..., None], fixed, rgb)
out = Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8), 'RGBA')
bbox = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
if bbox:
    pad = 8
    out = out.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad)))
if out.height > max_h:
    out = out.resize((round(out.width * max_h / out.height), max_h), Image.LANCZOS)
out.save(dst, 'WEBP', quality=88, method=6)
print(dst, out.size)
