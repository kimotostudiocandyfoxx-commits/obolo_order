#!/usr/bin/env python3
"""Remove a plain white background from a character image (flood fill from the edges) → WebP with alpha.
Usage: scripts/cutout.py <in.jpg> <out.webp> [tolerance=38] [max_height=1400]
Only background connected to the image border is removed, so white parts inside the character stay."""
import sys
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
tol = int(sys.argv[3]) if len(sys.argv) > 3 else 38
max_h = int(sys.argv[4]) if len(sys.argv) > 4 else 1400

im = Image.open(src).convert('RGB')
if im.height > max_h:
    im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape
near_white = (np.abs(a - 255).max(axis=2) <= tol)
bg = np.zeros((h, w), dtype=bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if near_white[y, x] and not bg[y, x]:
            bg[y, x] = True; q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if near_white[y, x] and not bg[y, x]:
            bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and near_white[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))
# second pass: enclosed pockets of almost pure white (gaps between legs, hair strands…)
pure = (np.abs(a - 255).max(axis=2) <= max(12, tol // 2)) & ~bg
seen = np.zeros((h, w), dtype=bool)
for sy in range(h):
    for sx in range(w):
        if pure[sy, sx] and not seen[sy, sx]:
            comp = [(sy, sx)]; seen[sy, sx] = True; i = 0
            while i < len(comp):
                y, x = comp[i]; i += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and pure[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; comp.append((ny, nx))
            if len(comp) >= 150:
                for y, x in comp:
                    bg[y, x] = True
alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
# soften the edge and kill the white halo
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
out = im.convert('RGBA'); out.putalpha(alpha)
bbox = alpha.getbbox()
if bbox:
    out = out.crop(bbox)
out.save(dst, 'WEBP', quality=88, method=6)
print(dst, out.size)
