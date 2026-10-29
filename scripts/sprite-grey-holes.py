#!/usr/bin/env python3
"""Grey background left inside a sprite (story chat 2026-10-29: KIMORIN showed flat grey between the ear and the tail):
the paintings are on flat #808080 and the cut-out only removed the grey reachable from the edge. A flat, textureless
grey area of some size inside the figure is made transparent. Run from apps/web/public: python3 ../../../scripts/sprite-grey-holes.py [--dry] files…"""
import sys
import numpy as np, cv2
from PIL import Image

dry = '--dry' in sys.argv
for f in [a for a in sys.argv[1:] if not a.startswith('--')]:
    im = Image.open(f).convert('RGBA'); a = np.array(im)
    rgb = a[..., :3].astype(np.float32); al = a[..., 3]
    near = (np.abs(rgb - 128).max(2) < 12) & (rgb.max(2) - rgb.min(2) < 7) & (al > 200)
    g = rgb.mean(2)
    std = np.sqrt(np.maximum(cv2.blur(g * g, (7, 7)) - cv2.blur(g, (7, 7)) ** 2, 0))
    flat = (near & (std < 2.6)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(flat, 8)
    m = np.zeros_like(flat)
    for k in range(1, n):
        if st[k, 4] > 350:
            m[lab == k] = 1
    if not m.any():
        continue
    # grow into the soft fringe of the same grey, then cut out with a soft edge
    grown = cv2.dilate(m, np.ones((5, 5), np.uint8)) & near.astype(np.uint8) | m
    soft = cv2.GaussianBlur(grown.astype(np.float32), (0, 0), 1.0)
    print(f, int(m.sum()))
    if not dry:
        a[..., 3] = (al * (1 - np.clip(soft, 0, 1))).astype(np.uint8)
        Image.fromarray(a).save(f, lossless=True)
