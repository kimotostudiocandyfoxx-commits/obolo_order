#!/usr/bin/env python3
"""
A grey sprite re-keyed from its background edit (cut-out review 2026-11-23): the matte comes from the picture whose
background scripts/cutouts/rebg.py painted again on the character's key colour (aligned onto the original by OpenCV
ECC), the colours inside the figure stay the original's pixel for pixel, the edge band takes the edit's un-mixed
colours. Then the figure and its body / tail layers are written on the same canvas as before (scripts/sprite-layers.py
geometry), so the mouth / eye patches still line up.

  python3 scripts/cutouts/merge.py [--apply] <stem> [<stem> …]   (design/cutouts/rebg/<stem>-<key>.jpg must exist)
  An edit that changed the character (drift) or its outline too much is refused (printed DRIFTED).
"""
import glob
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

SRC = 'apps/web/public/onboarding/s'
REBG = 'design/cutouts/rebg'


def aligned(moving, fixed, mask):
    f = cv2.cvtColor(fixed.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    m = cv2.cvtColor(moving.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(f, m, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), mask.astype(np.uint8), 5)
    except cv2.error:
        pass
    h, w = fixed.shape[:2]
    return cv2.warpAffine(moving, warp, (w, h), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)


def merge(stem):
    hits = glob.glob(f'{REBG}/{stem}-*.jpg')
    if not hits:
        return print(f'skip {stem} (no background edit)')
    orig = np.asarray(Image.open(f'{SRC}/{stem}.jpg').convert('RGB')).astype(np.float32)
    edit = np.asarray(Image.open(hits[0]).convert('RGB').resize((orig.shape[1], orig.shape[0]), Image.LANCZOS)).astype(np.float32)
    key = os.path.splitext(hits[0])[0].rsplit('-', 1)[1]
    rough, _ = keying.cut(orig, (128, 128, 128))
    edit = aligned(edit, orig, rough[..., 3] > 200)
    rgba, info = keying.cut(edit, keying.CANDIDATES[key])
    al = rgba[..., 3]
    # drift: how much the edit changed the character itself (after alignment), and how far the two outlines differ
    both = (al == 255) & (rough[..., 3] == 255)
    drift = float(np.abs(edit[both] - orig[both]).mean()) if both.any() else 99.0
    union = ((al > 128) | (rough[..., 3] > 128)).sum()
    iou = float(((al > 128) & (rough[..., 3] > 128)).sum() / max(1, union))
    info.update(drift=round(drift, 1), iou=round(iou, 3))
    if drift > 28 or iou < 0.85:
        print(stem, key, 'DRIFTED', info)
        return None
    inner = cv2.erode((al == 255).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    rgb = np.where(inner[..., None], orig, rgba[..., :3].astype(np.float32))
    out = np.dstack([rgb, al]).astype(np.uint8)
    os.makedirs('design/cutouts/merged', exist_ok=True)
    Image.fromarray(out, 'RGBA').save(f'design/cutouts/merged/{stem}.png')
    print(stem, key, info)
    return f'design/cutouts/merged/{stem}.png'


if __name__ == '__main__':
    apply = '--apply' in sys.argv  # without it only design/cutouts/merged/<stem>.png is written, to look at first
    for st in [a for a in sys.argv[1:] if not a.startswith('--')]:
        p = merge(st)
        if p and apply:
            # the layers again on the old canvas, from this matte (sprite-layers.py --matte-from)
            subprocess.run([sys.executable, 'scripts/sprite-layers.py', SRC, 'apps/web/public/onboarding', st, '--matte-only', '--matte-from', p], check=False)
