#!/usr/bin/env python3
"""Framing from the pictures themselves: finds the characters in every scene picture (matting model, rembg) and
  1. sets each scene's camera (view centre "c" and zoom "z") so the characters stay inside the square frame from the
     first to the last frame of the shot (the zoom keeps its direction: push-in stays a push-in, pull-out a pull-out),
  2. with --layers, gives depth layers (figure / background moving apart, MANUAL step 6) to the scenes with a clear
     figure (5–60 % of the picture), anchored at the figure's feet; run make_layers.py afterwards.
  python3 mv-kit/tools/auto_frame.py <project-dir> [--layers] [--skip prefix,prefix]   (e.g. --skip mv2-map,mv2-card)
Masks are cached in <project>/layers/raw/<img>-birefnet-general.png (the same files seg.py makes)."""
import json, os, sys
import numpy as np
from PIL import Image

PRJ = os.path.abspath(sys.argv[1]); PJ = os.path.join(PRJ, 'project.json')
P = json.load(open(PJ, encoding='utf-8'))
LAYERS = '--layers' in sys.argv
SKIP = tuple(sys.argv[sys.argv.index('--skip') + 1].split(',')) if '--skip' in sys.argv else ()
RAW = os.path.join(PRJ, 'layers', 'raw'); os.makedirs(RAW, exist_ok=True)
sess = None

def art(img):
    return next((os.path.join(PRJ, 'art', img + e) for e in ('.jpg', '.jpeg', '.png', '.webp') if os.path.exists(os.path.join(PRJ, 'art', img + e))), None)

def mask(img):
    global sess
    f = os.path.join(RAW, f'{img}-birefnet-general.png')
    if not os.path.exists(f):
        from rembg import new_session, remove
        sess = sess or new_session('birefnet-general')
        remove(Image.open(art(img)).convert('RGB'), session=sess, only_mask=True).save(f)
    m = np.asarray(Image.open(f).convert('L').resize((256, 256))) > 127
    return m

info = {}
for img in sorted({s['img'] for s in P['scenes']}):
    if img.startswith(SKIP) or not art(img): continue
    m = mask(img); area = float(m.mean())
    if area < .01: info[img] = None; continue
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = np.percentile(xs, 1) / 256, np.percentile(xs, 99) / 256, np.percentile(ys, 1) / 256, np.percentile(ys, 99) / 256
    info[img] = {'area': area, 'box': [x0, y0, x1, y1]}
    print(f'{img:<34} figure {area:5.1%}  box x {x0:.2f}-{x1:.2f}  y {y0:.2f}-{y1:.2f}')

def fit(z, box, c):
    """the largest zoom <= z that keeps the box (with a small margin) visible around a view centre near c"""
    x0, y0, x1, y1 = box; m = .03
    need = max(x1 - x0 + 2 * m, y1 - y0 + 2 * m, .2)
    z = min(z, 1 / need)
    h = .5 / z
    cx = min(max(c[0], x1 + m - h), x0 - m + h); cy = min(max(c[1], y1 + m - h), y0 - m + h)
    return max(z, 1.0), [round(min(max(cx, h), 1 - h), 3), round(min(max(cy, h), 1 - h), 3)]

pan = 1
for s in P['scenes']:
    I = info.get(s['img'])
    if not I: continue
    box = I['box']; ctr = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
    z0, z1 = s['z']; push = z1 >= z0
    za, ca = fit(z0, box, ctr); zb, cb = fit(z1, box, [ctr[0], ctr[1] - .02])
    if push and zb < za + .06: za = max(1.0, zb - .1)
    if not push and za < zb + .06: zb = max(1.0, za - .1)
    s['z'] = [round(za, 3), round(zb, 3)]; s['c'] = [ca, cb]
    if LAYERS and .05 <= I['area'] <= .6 and not s['img'].startswith(SKIP):
        s['layers'] = {'a': [round(ctr[0], 3), round(min(box[3], .98), 3)], 'dir': 1 if push else -1, 'pan': pan}; pan = -pan
    elif 'layers' in s and not LAYERS: pass
json.dump(P, open(PJ, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('framed', sum(1 for s in P['scenes'] if info.get(s['img'])), 'scenes;', 'layers on', sum(1 for s in P['scenes'] if s.get('layers')))
