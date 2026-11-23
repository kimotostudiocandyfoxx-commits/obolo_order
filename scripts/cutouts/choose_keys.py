#!/usr/bin/env python3
"""
The key colour of every character (cut-out review 2026-11-23) → scripts/lib/key-colours.json.

For each character, its cut-out pictures in use (the solid pixels, 2 px in from the edge) are measured in OKLab and
the candidate key (#00FF00, #0000FF, #FF00FF, cyan, orange, yellow) farthest from all of its colours is kept, with
how far it is (the nearest 0.1 % of its pixels) and how far every candidate is. Later paintings of the character are
asked for on that key (scripts/lib/keying.py key_for / key_prompt), and the cut uses it.

  python3 scripts/cutouts/choose_keys.py
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

PUB = 'apps/web/public'
# character → the pictures that show it (globs), the stems of a family share one key
CHARACTERS = {
    'KIMORIN': [f'{PUB}/onboarding/kimorin-[ign]-*[a-z].webp', f'{PUB}/onboarding/kimorin-iu-*[a-z].webp', f'{PUB}/onboarding/kimorin-xs-*[a-z].webp',
                f'{PUB}/onboarding/kimorin-x-*[a-z].webp', f'{PUB}/onboarding/kimorin-sun.webp'],
    'daikon-kaiser': [f'{PUB}/onboarding/daikon-kaiser*.webp'],
    'freezy': [f'{PUB}/onboarding/freezy*.webp'],
    'hipokin': [f'{PUB}/onboarding/hipokin*.webp'],
    'kaiser1': [f'{PUB}/onboarding/kaiser1-x-*.webp'],
    'monban': [f'{PUB}/onboarding/monban*.webp'],
    'takoyaki-brother': [f'{PUB}/onboarding/takoyaki-brother*.webp'],
    'takoyaki-sister': [f'{PUB}/onboarding/takoyaki-sister*.webp'],
    'unchi-pinpon': [f'{PUB}/onboarding/unchi-pinpon*.webp'],
    'talk-user': [f'{PUB}/talk/user/*.webp'],
    'talk-friend': [f'{PUB}/talk/friend/*.webp'],
    'talk-bati': [f'{PUB}/talk/bati/*.webp'],
    '大根カイザー': [f'{PUB}/story/cast/c-16ueow0*.webp'],
}
SKIP = ('-mouth', '-eyes', '-shut', '-face', '-tail', '-body')
# the key a character is painted on now: kept when it is within TIE of the best (no repainting for a hair's breadth)
CURRENT = {'KIMORIN': 'green', 'talk-user': 'green', 'talk-friend': 'green', 'talk-bati': 'green'}
TIE = 0.03


def main():
    out = {'note': 'The flat key colour each character is painted on, the candidate farthest (OKLab) from all of its colours. '
                   'Written by scripts/cutouts/choose_keys.py; read by scripts/lib/keying.py key_for().',
           'characters': {}}
    for name, globs in CHARACTERS.items():
        files = sorted({p for g in globs for p in glob.glob(g) if not any(os.path.basename(p)[:-5].endswith(s) for s in SKIP)})
        labs = []
        for p in files:
            a = np.asarray(Image.open(p).convert('RGBA'))
            labs.append(keying.subject_lab(a[..., :3], a[..., 3] / 255, max_px=40_000))
        if not labs:
            continue
        lab = np.concatenate(labs)
        ranked = keying.rank_keys(lab)
        best = ranked[0]
        cur = next((r for r in ranked if r[0] == CURRENT.get(name)), None)
        if cur and cur[1] >= best[1] - TIE and cur[1] >= keying.MIN_CLEARANCE + 0.1:
            best = cur
        out['characters'][name] = {
            'key': best[0],
            'hex': keying.hex_of(keying.CANDIDATES[best[0]]),
            'clearance': round(best[1], 3),
            'from': len(files),
            'all': {k: round(c, 3) for k, c, _ in ranked},
        }
        print(f'{name:18s} {best[0]:8s} clearance {best[1]:.3f}   ' + '  '.join(f'{k} {c:.3f}' for k, c, _ in ranked))
    json.dump(out, open(keying.MANIFEST, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
