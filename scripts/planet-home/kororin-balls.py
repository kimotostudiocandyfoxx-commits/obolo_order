"""M-R266 (design/home/README.md §11, build.py ballc-*): the 8 kororin balls, made by tinting the pearl ball (its
highlights kept) with a soft shadow baked in under it (no CSS shadow per ball).
  python3 scripts/planet-home/kororin-balls.py   → apps/web/public/planet-home/ballc-<colour>.webp"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

D = os.path.join(os.path.dirname(__file__), '../../apps/web/public/planet-home')
COLOURS = {'pearl': (255, 255, 255), 'gold': (255, 196, 70), 'pink': (255, 150, 190), 'mint': (120, 230, 195),
           'lavender': (185, 160, 255), 'sky': (130, 195, 255), 'peach': (255, 180, 140), 'night': (90, 95, 150)}

base = Image.open(f'{D}/ball-dachi.webp').convert('RGBA')
base = base.crop(base.getbbox())
base.thumbnail((192, 192), Image.LANCZOS)
sq = Image.new('RGBA', (max(base.size),) * 2, (0, 0, 0, 0))
sq.alpha_composite(base, ((sq.width - base.width) // 2, (sq.height - base.height) // 2))
base = sq
ba = np.asarray(base).astype(np.float32)
for name, (r, g, b) in COLOURS.items():
    rgb = ba[..., :3] / 255
    lum = rgb.mean(2, keepdims=True)
    tint = np.array([r, g, b]) / 255
    col = rgb if name == 'pearl' else np.clip(lum * tint * 1.15 + (lum ** 3) * .35, 0, 1)
    im = Image.fromarray(np.dstack([col * 255, ba[..., 3]]).astype(np.uint8), 'RGBA')
    W, H = im.size
    cv = Image.new('RGBA', (W, H + 14), (0, 0, 0, 0))
    sh = Image.new('RGBA', (W, H + 14), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((W * .18, H - 6, W * .82, H + 10), fill=(30, 10, 40, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(5))
    cv.alpha_composite(sh)
    cv.alpha_composite(im, (0, 0))
    cv.crop((0, 0, W, H)).save(f'{D}/ballc-{name}.webp', 'WEBP', quality=88, method=6)
    print(name, W, H)
