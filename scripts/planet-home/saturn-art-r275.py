"""M-R275 (design/home/build.py): Saturn's final pictures from the story team's art (design/mv-art/out on the story
branch, extracted to a folder):
  - the 24 painted kororins (kor3-01…24, on white) cut to their circle, 200 px → kor-01…24.webp
  - the 2-heads anime mini figures (chibi2-*, on green) keyed, 300 px → chibi-*.webp (in place of the earlier ones)
  - the backdrop with the needle moved back (home2-bg-saturn-cutea2) → bg-saturn.webp
Then run saturn-record-mask.py (with saturn-record-mask2.png) and saturn-fg.py for the colour mask and the stones.
  python3 scripts/planet-home/saturn-art-r275.py <art folder>"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

SRC = sys.argv[1]
D = os.path.join(os.path.dirname(__file__), '../../apps/web/public/planet-home')


def key(im):
    # build.py key(): green out, the green spill pulled down
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gn = g - np.maximum(r, b)
    al = np.clip(1 - (gn - 28) / 55, 0, 1)
    a[..., 1] = np.minimum(g, np.maximum(r, b) + 12)
    k = Image.fromarray(np.dstack([a.clip(0, 255), al * 255]).astype(np.uint8), 'RGBA')
    return k.crop(k.getbbox())


for n in range(1, 25):
    f = f'{SRC}/kor3-{n:02d}.jpg'
    im = Image.open(f).convert('RGB')
    a = np.asarray(im).astype(int)
    m = (a.min(2) < 232) | ((a.max(2) - a.min(2)) > 18)
    ys, xs = np.where(m)
    x0, x1 = np.percentile(xs, [.5, 99.5])
    y0, y1 = np.percentile(ys, [.5, 99.5])
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = min(x1 - x0, y1 - y0) / 2 - 2
    S = 4
    mk = Image.new('L', (im.width * S, im.height * S), 0)
    ImageDraw.Draw(mk).ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=255)
    mk = mk.resize(im.size, Image.LANCZOS)
    o = im.convert('RGBA')
    o.putalpha(mk)
    o = o.crop((int(cx - r - 2), int(cy - r - 2), int(cx + r + 2), int(cy + r + 2)))
    o.thumbnail((200, 200), Image.LANCZOS)
    o.save(f'{D}/kor-{n:02d}.webp', 'WEBP', quality=88, method=6)

for name in ['user', 'kimorin', 'monban', 'mikie', 'brother', 'sister']:
    f = f'{SRC}/chibi2-{name}.jpg'
    if not os.path.exists(f):
        continue
    k = key(Image.open(f))
    k.thumbnail((300, 300), Image.LANCZOS)
    k.save(f'{D}/chibi-{name}.webp', 'WEBP', quality=86, method=6)

bg = Image.open(f'{SRC}/home2-bg-saturn-cutea2.jpg').convert('RGB')
bg.save(f'{D}/bg-saturn.webp', 'WEBP', quality=80, method=6)
print('ok')
