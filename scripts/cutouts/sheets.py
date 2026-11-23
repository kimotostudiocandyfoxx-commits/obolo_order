#!/usr/bin/env python3
"""
Before / after contact sheets of re-keyed cut-outs (cut-out review 2026-11-23) → docs/review/cutouts/<name>-NN.png.
"Before" is the picture as committed (git HEAD, or --rev), "after" the file as it is now. Each row: the whole figure
over black, white and mid-grey before | after, then the top of the figure at 2× before | after. Palette-quantised.

  python3 scripts/cutouts/sheets.py <name> <file> [<file> …] [--rev REV] [--rows 6]
"""
import argparse
import io
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import keying  # noqa: E402
from audit import head_crop  # noqa: E402

GROUNDS = ((0, 0, 0), (255, 255, 255), (128, 128, 128))


def at_rev(path, rev):
    data = subprocess.run(['git', 'show', f'{rev}:{path}'], capture_output=True, check=True).stdout
    return np.asarray(Image.open(io.BytesIO(data)).convert('RGBA'))


def fit(rgba, h):
    im = Image.fromarray(rgba, 'RGBA')
    return np.asarray(im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS))


def row(path, before, after, h=240):
    parts = []
    for a in (before, after):
        parts.append(keying.composite(fit(a, h), GROUNDS, gap=3))
        parts.append(np.full((h, 6, 3), 200, np.uint8))
    for a in (before, after):
        parts.append(keying.composite(head_crop(a, h // 2), GROUNDS[:2], scale=2, gap=3)[:h])
        parts.append(np.full((h, 6, 3), 200, np.uint8))
    hh = max(p.shape[0] for p in parts)
    parts = [np.pad(p, ((0, hh - p.shape[0]), (0, 0), (0, 0)), constant_values=30) for p in parts]
    r = np.pad(np.concatenate(parts[:-1], 1), ((18, 4), (0, 0), (0, 0)), constant_values=30)
    im = Image.fromarray(r)
    ImageDraw.Draw(im).text((4, 3), f'{path}    before | after (whole, over black / white / grey)    before | after (top, 2x)', fill=(255, 255, 0))
    return np.asarray(im)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name')
    ap.add_argument('files', nargs='+')
    ap.add_argument('--rev', default='HEAD')
    ap.add_argument('--rows', type=int, default=6)
    a = ap.parse_args()
    os.makedirs('docs/review/cutouts', exist_ok=True)
    rows = []
    for f in a.files:
        rows.append(row(f, at_rev(f, a.rev), np.asarray(Image.open(f).convert('RGBA'))))
    for k in range(0, len(rows), a.rows):
        chunk = rows[k:k + a.rows]
        w = max(r.shape[1] for r in chunk)
        chunk = [np.pad(r, ((0, 0), (0, w - r.shape[1]), (0, 0)), constant_values=30) for r in chunk]
        img = Image.fromarray(np.concatenate(chunk, 0)).quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        out = f'docs/review/cutouts/{a.name}-{k // a.rows + 1:02d}.png'
        img.save(out, optimize=True)
        print(out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    main()
