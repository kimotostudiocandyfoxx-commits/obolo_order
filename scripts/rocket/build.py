#!/usr/bin/env python3
"""Day 2 told with pictures (client 2026-11-28; design/rocket-art-queue.json → design/cast/rocket/<id>.jpg) → the files
the story shows, in apps/web/public/onboarding:

  s/gh-*.jpg     the plates and inserts, at 720×1280 (the 720p rule, docs/media.md)
  kb-*.webp      KIMORIN's back views keyed out of their chroma green (the shared matte, scripts/lib/keying.py; nothing
                 of KIMORIN is green, so the green the matte leaves in the feathers is taken out as for MONBAN), trimmed
                 to the figure; at most 1400 px tall

Also writes a check sheet of every cut-out on black, white and grey (and the audit numbers) for looking at fringes:
<scratch>/rocket-cuts.jpg (the path is printed).

Usage: python3 scripts/rocket/build.py [id …]   (default: every picture of the queue that has been painted)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'cast'))
import keying  # noqa: E402
from build import degreen  # noqa: E402  (scripts/cast/build.py)

QUEUE = 'design/rocket-art-queue.json'
SRC = 'design/cast/rocket'
OUT = 'apps/web/public/onboarding'
MAX_H = 1400


def plate(i):
    im = Image.open(f'{SRC}/{i}.jpg').convert('RGB').resize((720, 1280), Image.LANCZOS)
    im.save(f'{OUT}/s/{i}.jpg', quality=88, optimize=True, progressive=True)
    return im.size


def cutout(i):
    rgb = cv2.cvtColor(cv2.imread(f'{SRC}/{i}.jpg'), cv2.COLOR_BGR2RGB).astype(np.float32)
    rgba, _ = keying.cut(rgb, keying.rgb_of('green'))
    rgba, n = degreen(rgba, keying.border_colour(rgb))
    box = keying.trim_box(rgba[..., 3], pad=4)
    if box:
        x0, y0, x1, y1 = box
        rgba = rgba[y0:y1, x0:x1]
    im = Image.fromarray(rgba, 'RGBA')
    if im.height > MAX_H:
        im = im.resize((round(im.width * MAX_H / im.height), MAX_H), Image.LANCZOS)
    im.save(f'{OUT}/{i}.webp', 'WEBP', quality=88, method=6, exact=True)
    try:
        a = keying.audit(np.asarray(im), keying.rgb_of('green'))
        a = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in a.items() if isinstance(v, (int, float, str, bool))}
    except Exception as e:  # a report only
        a = {'audit': str(e)[:80]}
    return im, a, n


def main():
    q = json.load(open(QUEUE))
    ids = sys.argv[1:] or [x['id'] for x in q['items'] if os.path.exists(f"{SRC}/{x['id']}.jpg")]
    sheet = []
    for i in ids:
        if i.startswith('kb-'):
            im, a, n = cutout(i)
            sheet.append(np.asarray(im))
            print(i, im.size, 'degreened px', n, json.dumps(a))
        else:
            print(i, plate(i))
    if sheet:
        rows = []
        for rgba in sheet:
            h = 600
            small = np.asarray(Image.fromarray(rgba).resize((round(rgba.shape[1] * h / rgba.shape[0]), h), Image.LANCZOS))
            rows.append(keying.composite(small))
        w = max(r.shape[1] for r in rows)
        out = np.vstack([np.pad(r, ((0, 8), (0, w - r.shape[1]), (0, 0))) for r in rows])
        path = os.environ.get('SHEET', '/tmp/rocket-cuts.jpg')
        Image.fromarray(out[..., :3]).save(path, quality=88)
        print('sheet', path)


if __name__ == '__main__':
    main()
