#!/usr/bin/env python3
"""Cut a character out of a flat mid-grey background (the older story sprites were painted on #808080) → WebP with
alpha, trimmed to the figure (8 px margin).
Usage: scripts/cutout-grey.py <in.jpg> <out.webp> [tolerance (ignored now)] [max_height=1100]
The shared matte (scripts/lib/keying.py, cut-out review 2026-11-23). Grey is a poor key — the characters' own grey
shading is near it: new pictures are painted on the key colour of scripts/lib/key-colours.json."""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import keying  # noqa: E402

src, dst = sys.argv[1], sys.argv[2]
max_h = int(sys.argv[4]) if len(sys.argv) > 4 else 1100

rgba, info = keying.cut(np.asarray(Image.open(src).convert('RGB')), (128, 128, 128))
out = Image.fromarray(rgba, 'RGBA')
box = keying.trim_box(rgba[..., 3], 8, pad=8)
if box:
    out = out.crop(box)
if out.height > max_h:
    out = out.resize((round(out.width * max_h / out.height), max_h), Image.LANCZOS)
out.save(dst, 'WEBP', quality=88, method=6)
print(dst, out.size, info)
