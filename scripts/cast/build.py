#!/usr/bin/env python3
"""MONBAN's repainted pictures (design/cast/<id>.jpg, design/cast-art-queue.json; client 2026-11-27) → the cut-outs
the story shows, in apps/web/public/onboarding:

  monban.webp, monban-close.webp, monban-x-{talk,point,arms,stop}.webp, monban-back.webp
      keyed out of the flat chroma green they are painted on (the shared matte, scripts/lib/keying.py), trimmed to
      the figure with a small margin
  monban-halo.webp
      the golden halo disc, painted on pure black: its brightness becomes its transparency (the black is gone, the
      gold lines stay), so the stage can lay it behind his head as a layer of its own

Nothing of MONBAN is green, so what green the matte leaves (between a hanging cord and the robe, through a thin cord)
is taken out (degreen). Every full figure is laid on a canvas with the gold eye in the middle column, at the standing
picture's figure height and foot line (figure()).

Prints each cut-out's size and where the figure is in it (box and foot in px, top / footAt / eye as fractions of the
picture) — the numbers components/story/Stage.tsx CHAR.monban (face, eye, close, halo) and lib/story/views.json hold.

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
HALO_PX = 800


def halo(src, out):
    """gold lines on black → gold with alpha (un-premultiplied, so it lies cleanly over any background)"""
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    lum = a.max(axis=2)
    alpha = np.clip((lum - 0.04) / 0.6, 0, 1)
    # the gold stays gold where it is faint (never grey)
    rgb = np.clip(a / np.maximum(lum, 1e-3)[..., None], 0, 1)
    rgba = np.dstack([rgb, alpha])
    im = Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA')
    # a soft layer behind a head: it is never shown larger than this (and the full painting weighs close to 1 MB)
    im.thumbnail((HALO_PX, HALO_PX), Image.LANCZOS)
    im.save(out, 'WEBP', quality=84, method=6, exact=True)
    return im.size


def audit(rgba):
    try:
        a = keying.audit(rgba, keying.rgb_of('green'))
        return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in a.items() if isinstance(v, (int, float, str, bool))}
    except Exception as e:  # the audit is a report, never a reason to stop
        return {'audit': str(e)[:80]}


def degreen(rgba, K):
    """
    MONBAN is black and gold: nothing of him is green. Whatever green the matte left — a pocket of background between
    a hanging cord and the robe too small to count as a gap, the green that shines through a thin cord, a shade of the
    key at the hem — is the key mixed in: taken out of the colour, and out of the coverage by the same share.
    """
    a = rgba.astype(np.float32)
    c, al = a[..., :3], a[..., 3] / 255
    kk = float(K[1] - max(K[0], K[2]))
    ex = c[..., 1] - np.maximum(c[..., 0], c[..., 2])
    f = np.clip((ex - 4) / max(kk * 0.9, 1), 0, 0.98)[..., None]
    un = np.clip((c - f * K) / (1 - f), 0, 255)
    # (what is left of the green after un-mixing: never above the other two channels)
    un[..., 1] = np.minimum(un[..., 1], np.maximum(un[..., 0], un[..., 2]))
    hit = (ex > 4) & (al > 0)
    c = np.where(hit[..., None], un, c)
    al = np.where(hit, al * (1 - f[..., 0]), al)
    al[al < 0.03] = 0
    return np.dstack([c, al * 255]).round().astype(np.uint8), int(hit.sum())


def eye_x(rgba):
    """the polished-gold eye on the forehead (the largest patch of bright gold in the top sixth), as a column; None from
    behind"""
    a = rgba.astype(np.int32)
    h = a.shape[0]
    gold = (a[..., 0] > 190) & (a[..., 1] > 120) & (a[..., 2] < 120) & (a[..., 3] > 128)
    gold[int(h * 0.16):] = False
    n, _, st, cen = cv2.connectedComponentsWithStats(cv2.dilate(gold.astype(np.uint8), np.ones((9, 9), np.uint8)))
    if n < 2:
        return None
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return float(cen[k][0]) if st[k, cv2.CC_STAT_AREA] > 400 else None


def figure(src, out, like=None, close=False):
    """
    like: (figure height, canvas width) of the standing picture — a pose or the back view is brought to the same figure
    height, and every full figure is laid on a canvas with the head in the middle column and the same foot line, so a
    change of pose on the stage (pictures centred, as tall as each other) never moves or resizes him, and the halo
    behind his head sits in the same place for all of them. The close-up is only trimmed.
    """
    rgb = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB).astype(np.float32)
    rgba, _ = keying.cut(rgb, keying.rgb_of('green'))
    rgba, _ = degreen(rgba, keying.border_colour(rgb))
    box = keying.trim_box(rgba[..., 3], pad=PAD if close else 0)
    if box:
        x0, y0, x1, y1 = box
        rgba = rgba[y0:y1, x0:x1]
    if not close:
        fh, fw = rgba.shape[:2]
        if like and like[0] != fh:
            k = like[0] / fh
            rgba = np.asarray(Image.fromarray(rgba, 'RGBA').resize((max(1, round(fw * k)), like[0]), Image.LANCZOS))
            fh, fw = rgba.shape[:2]
        ex = eye_x(rgba)
        if ex is None:
            # from behind: the middle of the hood (the top twelfth of the figure)
            xs = np.where((rgba[: max(1, fh // 12), :, 3] > 128).any(axis=0))[0]
            ex = float(xs.mean()) if len(xs) else fw / 2
        half = int(np.ceil(max(ex, fw - ex))) + PAD
        if like and src.endswith('-back.jpg'):
            half = max(half, like[1] // 2)  # (the views share the front's canvas: lib/story/views.json)
        canvas = np.zeros((fh + 2 * PAD, half * 2, 4), np.uint8)
        left = int(round(half - ex))
        canvas[PAD:PAD + fh, left:left + fw] = rgba
        rgba = canvas
    Image.fromarray(rgba, 'RGBA').save(out, 'WEBP', quality=88, method=6, exact=True)
    al = rgba[..., 3] > 128
    ys, xs = np.where(al)
    h, w = al.shape
    a = rgba.astype(np.int32)
    gold = (a[..., 0] > 190) & (a[..., 1] > 120) & (a[..., 2] < 120) & al
    gold[int(h * (0.45 if close else 0.16)):] = False
    n, _, st, cen = cv2.connectedComponentsWithStats(cv2.dilate(gold.astype(np.uint8), np.ones((9, 9), np.uint8)))
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])) if n > 1 else 0
    eye = [round(float(cen[k][0]) / w, 3), round(float(cen[k][1]) / h, 3)] if k and st[k, cv2.CC_STAT_AREA] > 400 else None
    where = {'box': [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)], 'foot': int(ys.max()),
             'top': round(float(ys.min()) / h, 3), 'footAt': round(float(ys.max()) / h, 3), 'eye': eye}
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
    # the standing picture first: the others take its figure height and canvas
    ids.sort(key=lambda i: i != 'monban')
    like = None
    if 'monban' not in ids and os.path.exists(f'{out}/monban.webp'):
        w0, h0 = Image.open(f'{out}/monban.webp').size
        like = (h0 - 2 * PAD, w0)
    for i in ids:
        p = f'{src}/{i}.jpg'
        if not os.path.exists(p):
            print(f'- {i}: not painted yet ({p})')
            continue
        o = f'{out}/{i}.webp'
        if i.endswith('-halo'):
            print(f'- {i}: {halo(p, o)} → {o}')
            continue
        r = figure(p, o, like=like, close=i.endswith('-close'))
        if i == 'monban':
            like = (r[0][1] - 2 * PAD, r[0][0])
        print(f'- {i}: {r} → {o}')


if __name__ == '__main__':
    main()
