#!/usr/bin/env python3
"""KIMORIN's chat icons from the repainted sprites (client 2026-11-22: one face everywhere): a square around the
head of each look's 'talk' pose, on the icon's old background colour → apps/web/public/story/avatars/<name>.webp.
Run after scripts/kimorin/build.py:  python3 scripts/kimorin/avatars.py"""
import json
from PIL import Image

O, A = 'apps/web/public/onboarding', 'apps/web/public/story/avatars'
M = json.load(open('apps/web/lib/story/sprite-mouths.json'))
for name, stem in (('kimorin-i', 'kimorin-i-talk'), ('kimorin-iu', 'kimorin-iu-talk'), ('kimorin-glasses', 'kimorin-xs-talk')):
    old = Image.open(f'{A}/{name}.webp').convert('RGB')
    bg = old.getpixel((3, 3))
    im = Image.open(f'{O}/{stem}.webp').convert('RGBA')
    W, H = im.size
    m = M[stem]
    cx, cy = (m['x'] + m['w'] / 2) * W, (m['y'] + m['h'] / 2) * H
    side = 0.40 * H
    x0, y0 = cx - side / 2, cy - side * 0.72
    tile = Image.new('RGBA', (round(side), round(side)), bg + (255,))
    tile.alpha_composite(im.crop((round(x0), round(y0), round(x0 + side), round(y0 + side))))
    tile.convert('RGB').resize((256, 256), Image.LANCZOS).save(f'{A}/{name}.webp', 'WEBP', quality=88)
    print(name, bg)
