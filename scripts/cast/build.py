#!/usr/bin/env python3
"""MONBAN's repainted pictures (design/cast/<id>.jpg, design/cast-art-queue.json; client 2026-11-27) → the cut-outs
the story shows, in apps/web/public/onboarding:

  monban.webp, monban-close.webp, monban-x-{talk,point,arms,stop}.webp, monban-back.webp
      keyed out of the flat chroma green they are painted on (the shared matte, scripts/lib/keying.py), trimmed to
      the figure with a small margin
  monban-halo.webp
      the golden halo disc, painted on pure black: its brightness becomes its transparency (the black is gone, the
      gold lines stay), so the stage can lay it behind his head as a layer of its own

Prints each cut-out's size and where the figure is in it (as fractions of the picture) — the numbers
components/story/Stage.tsx CHAR.monban (face, eye) and lib/story/views.json need when the new pictures are wired in.

Usage: python3 scripts/cast/build.py [id …]      (default: every picture of the queue that has been painted)
       python3 scripts/cast/build.py --src <dir> --out <dir> [id …]   (try it somewhere else)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

QUEUE = 'design/cast-art-queue.json'
PAD = 12


def halo(src, out):
    """gold lines on black → gold with alpha (un-premultiplied, so it lies cleanly over any background)"""
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    lum = a.max(axis=2)
    alpha = np.clip((lum - 0.04) / 0.6, 0, 1)
    # the gold stays gold where it is faint (never grey)
    rgb = np.clip(a / np.maximum(lum, 1e-3)[..., None], 0, 1)
    rgba = np.dstack([rgb, alpha])
    Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA').save(out, 'WEBP', quality=92, method=6, exact=True)
    return rgba.shape[1], rgba.shape[0]


def audit(rgba):
    try:
        a = keying.audit(rgba, keying.rgb_of('green'))
        return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in a.items() if isinstance(v, (int, float, str, bool))}
    except Exception as e:  # the audit is a report, never a reason to stop
        return {'audit': str(e)[:80]}


def figure(src, out):
    rgb = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB).astype(np.float32)
    rgba, _ = keying.cut(rgb, keying.rgb_of('green'))
    box = keying.trim_box(rgba[..., 3], pad=PAD)
    if box:
        x0, y0, x1, y1 = box
        rgba = rgba[y0:y1, x0:x1]
    Image.fromarray(rgba, 'RGBA').save(out, 'WEBP', quality=92, method=6, exact=True)
    al = rgba[..., 3] > 128
    ys = np.where(al.any(axis=1))[0]
    h, w = al.shape
    # the hood: the middle of the figure's top fifth
    top = al[ys.min(): ys.min() + max(1, (ys.max() - ys.min()) // 5)]
    xs = np.where(top.any(axis=0))[0]
    where = {'top': round(float(ys.min()) / h, 3), 'foot': round(float(ys.max()) / h, 3), 'hoodX': round(float(xs.mean()) / w, 3) if len(xs) else None}
    return (w, h), where, audit(rgba)


def main():
    args = sys.argv[1:]
    src, out = 'design/cast', 'apps/web/public/onboarding'
    while args and args[0] in ('--src', '--out'):
        if args[0] == '--src':
            src = args[1]
        else:
            out = args[1]
        args = args[2:]
    ids = args or [x['id'] for x in json.load(open(QUEUE))['items']]
    os.makedirs(out, exist_ok=True)
    for i in ids:
        p = f'{src}/{i}.jpg'
        if not os.path.exists(p):
            print(f'- {i}: not painted yet ({p})')
            continue
        o = f'{out}/{i}.webp'
        print(f'- {i}: {halo(p, o) if i.endswith("-halo") else figure(p, o)} → {o}')


if __name__ == '__main__':
    main()
