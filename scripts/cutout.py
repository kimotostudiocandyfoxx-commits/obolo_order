#!/usr/bin/env python3
"""Remove a plain flat background (white by default) from a character image → WebP with alpha, trimmed.
Usage: scripts/cutout.py <in.jpg> <out.webp> [key=#FFFFFF] [max_height=1400]
The shared matte (scripts/lib/keying.py, cut-out review 2026-11-23): only flat pixels near the background colour go,
holes inside the figure are filled unless they are clearly the background seen through a gap, specks go, the edge is
un-mixed. (A white background eats white parts of a character: paint new pictures on the key colour of
scripts/lib/key-colours.json instead.)"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import keying  # noqa: E402

src, dst = sys.argv[1], sys.argv[2]
key = sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].isdigit() else '#FFFFFF'
max_h = int(sys.argv[4]) if len(sys.argv) > 4 else 1400

im = Image.open(src).convert('RGB')
if im.height > max_h:
    im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
rgba, info = keying.cut(np.asarray(im), key)
out = Image.fromarray(rgba, 'RGBA')
box = keying.trim_box(rgba[..., 3], 8)
if box:
    out = out.crop(box)
out.save(dst, 'WEBP', quality=88, method=6)
print(dst, out.size, info)
