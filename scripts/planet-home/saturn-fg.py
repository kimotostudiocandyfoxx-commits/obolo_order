"""M-R268 (design/home/build.py sat-fg): the colourful stones at the bottom of Saturn's background, cut out to lie in
front of the kororins — below the record's rim ellipse (centre .481/.702, radii .574/.1885 of the picture), outside the
record (the provided mask) or deep in its lower part. Edge eroded 1 px and softened.

  python3 scripts/planet-home/saturn-fg.py <provided-mask.png>   (design/home/saturn-record-mask.png on the story branch)
  → apps/web/public/planet-home/bg-saturn-fg.webp (same size as bg-saturn.webp)"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

D = os.path.join(os.path.dirname(__file__), '../../apps/web/public/planet-home')
src = Image.open(f'{D}/bg-saturn.webp').convert('RGB')
mk = np.array(Image.open(sys.argv[1]).convert('L').resize(src.size)) > 128
H, W = mk.shape
yy, xx = np.mgrid[0:H, 0:W]
cx, cy, rx, ry = .481 * W, .702 * H, .574 * W, .1885 * H
inside = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1
fg = (~mk) & (yy > cy) & ((~inside) | (yy > cy + .6 * ry))
al = Image.fromarray((fg * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.6))
out = src.convert('RGBA')
out.putalpha(al)
out.save(f'{D}/bg-saturn-fg.webp', 'WEBP', quality=82, method=6)
print(out.size, os.path.getsize(f'{D}/bg-saturn-fg.webp'))
