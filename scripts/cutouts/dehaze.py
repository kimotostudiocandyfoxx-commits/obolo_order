#!/usr/bin/env python3
"""
A cut-out that came with its own transparency but kept a haze of its old background (cut-out review 2026-11-23: the
client's 大根カイザー forms, cut from a dark backdrop, show a dark film around the roots, leaves and the floor shadow on
light stages). Half-transparent pixels whose colour is the old background's are faded out by how near they are to it;
fully opaque pixels are never touched, so the figure stays pixel for pixel.

  python3 scripts/cutouts/dehaze.py <bg colour hex|auto> <in.webp> [out.webp]   (out defaults to in)

auto: the old background is the median colour of the faintest pixels (alpha 2..60).
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402


def dehaze(rgba: np.ndarray, bg=None) -> np.ndarray:
    a = rgba.astype(np.float32)
    al = a[..., 3] / 255
    faint = (rgba[..., 3] >= 2) & (rgba[..., 3] <= 60)
    K = np.asarray(keying.rgb_of(bg), np.float32) if bg is not None else np.median(a[..., :3][faint], axis=0)
    d = np.linalg.norm(keying.oklab(a[..., :3]) - keying.oklab(K), axis=2)
    # a pixel of the old background's colour keeps nothing; a real colour keeps its alpha
    keep = np.clip((d - 0.04) / 0.12, 0, 1)
    semi = al < 0.85
    al2 = np.where(semi, al * keep, al)
    # specks left apart from the figure go
    n, lab, st, _ = cv2.connectedComponentsWithStats((al2 > 0.3).astype(np.uint8), connectivity=8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        small = np.zeros(n, bool)
        small[1:] = st[1:, cv2.CC_STAT_AREA] < max(30, big * 0.0005)
        near_main = cv2.dilate((~small[lab] & (lab > 0)).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
        al2 = np.where(near_main, al2, 0)
    al2 = np.where(al2 < 0.03, 0, al2)
    out = rgba.copy()
    out[..., 3] = np.round(al2 * 255).astype(np.uint8)
    return out


if __name__ == '__main__':
    bg = None if sys.argv[1] == 'auto' else sys.argv[1]
    src = sys.argv[2]
    dst = sys.argv[3] if len(sys.argv) > 3 else src
    rgba = np.asarray(Image.open(src).convert('RGBA'))
    Image.fromarray(dehaze(rgba, bg), 'RGBA').save(dst, 'WEBP', quality=90, method=6)
    print(dst)
