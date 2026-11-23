#!/usr/bin/env python3
"""
Cut-out review (2026-11-23): every character picture the app shows without a background, measured with
scripts/lib/keying.audit (key fringe on the edge, half-transparent parts inside, key colour left, islands, pin holes)
and ranked worst first.

  python3 scripts/cutouts/audit.py [--sheets DIR] [--only SUBSTR] [--json OUT]

--sheets DIR: each asset composited over black, white and mid-grey at 2× (the 2× crop is the edge region of the
figure's head, where fringes show) as DIR/<name>.png, plus DIR/_index.txt.
The background each family was cut from (FAMILIES) is the key the fringe is measured against; for a picture whose
source is unknown every likely key is tried and the worst kept.
"""
import argparse
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

PUB = 'apps/web/public'
GREY, WHITE, TALK_GREEN, GREEN = (128, 128, 128), (255, 255, 255), (0, 158, 70), (0, 255, 0)
GUESS = [WHITE, GREY, GREEN, TALK_GREEN, (255, 0, 255)]


def families():
    """(path, family, key or None) of every cut-out character picture in use"""
    out = []
    green_src = {os.path.basename(p)[:-4] for p in glob.glob('design/kimorin/*.jpg')}
    grey_src = {os.path.basename(p)[:-4] for p in glob.glob(f'{PUB}/onboarding/s/*.jpg')}
    for p in sorted(glob.glob(f'{PUB}/talk/*/*.webp')):
        out.append((p, 'talk/' + p.split('/')[-2], TALK_GREEN))
    for p in sorted(glob.glob(f'{PUB}/story/cast/*.webp')):
        out.append((p, 'story/cast', None))
    skip = ('pod-', 'ship-', 'chest-', 'cover-', 'jupiter-tree', 'kororin-vessel', 'bfb-', 'av-')
    for p in sorted(glob.glob(f'{PUB}/onboarding/*.webp')):
        n = os.path.basename(p)[:-5]
        if n.startswith(skip):
            continue
        stem = n
        for suf in ('-body', '-tail', '-mouth', '-eyes', '-shut'):
            if n.endswith(suf):
                stem = n[: -len(suf)]
        if stem in green_src:
            out.append((p, 'onboarding/kimorin-green', GREEN))
        elif stem in grey_src:
            out.append((p, 'onboarding/sprite-grey', GREY))
        else:
            out.append((p, 'onboarding/other', None))
    return out


def head_crop(rgba, size=200):
    """the top of the figure (head, ears, hair: where a fringe shows most), `size` px square around its top centre"""
    al = rgba[..., 3]
    box = keying.trim_box(al, 40)
    if not box:
        return rgba[:size, :size]
    x0, y0, x1, y1 = box
    # centred on the top of the figure (its top 12 %)
    cols = np.where((al[y0:y0 + max(4, (y1 - y0) // 8)] > 40).any(axis=0))[0]
    cx = int((cols.min() + cols.max()) // 2) if len(cols) else (x0 + x1) // 2
    sx = max(0, min(rgba.shape[1] - size, cx - size // 2))
    sy = max(0, min(rgba.shape[0] - size, y0 - 10))
    return rgba[sy:sy + size, sx:sx + size]


def sheet(rgba, scale_full=None, h=360):
    """the whole figure over the three grounds (fitted to h) above a 2× crop of its head over the three grounds"""
    im = Image.fromarray(rgba, 'RGBA')
    s = h / im.height
    full = np.asarray(im.resize((max(1, round(im.width * s)), h), Image.LANCZOS))
    top = keying.composite(full)
    crop = keying.composite(head_crop(rgba, 180), scale=2)
    w = max(top.shape[1], crop.shape[1])
    pad = lambda x: np.pad(x, ((0, 0), (0, w - x.shape[1]), (0, 0)), constant_values=40)
    return np.concatenate([pad(top), np.full((8, w, 3), 40, np.uint8), pad(crop)], axis=0)


def measure(path, key):
    rgba = np.asarray(Image.open(path).convert('RGBA'))
    if rgba[..., 3].min() > 250:
        return rgba, None
    if key is not None:
        r = keying.audit(rgba, key)
        r['key'] = keying.hex_of(key)
        return rgba, r
    best = None
    for k in GUESS:
        r = keying.audit(rgba, k)
        r['key'] = keying.hex_of(k) + '?'
        if best is None or r['score'] > best['score']:
            best = r
    return rgba, best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheets')
    ap.add_argument('--only', default='')
    ap.add_argument('--json')
    a = ap.parse_args()
    rows = []
    for path, fam, key in families():
        if a.only not in path:
            continue
        rgba, r = measure(path, key)
        if r is None:
            continue
        r.update(path=path, family=fam)
        rows.append(r)
        if a.sheets:
            os.makedirs(a.sheets, exist_ok=True)
            Image.fromarray(sheet(rgba)).save(os.path.join(a.sheets, path.replace('/', '_').replace(PUB.replace('/', '_') + '_', '') + '.png'))
    rows.sort(key=lambda r: -r['score'])
    cols = ['score', 'fringe', 'fringe_de', 'semi', 'keyleft', 'small_islands', 'pinholes', 'clearance', 'key']
    print('\t'.join(cols + ['path']))
    for r in rows:
        print('\t'.join(str(r.get(c, '')) for c in cols) + '\t' + r['path'])
    if a.json:
        json.dump(rows, open(a.json, 'w'), indent=1)


if __name__ == '__main__':
    main()
