#!/usr/bin/env python3
"""KIMORIN's repainted sprites (design/kimorin/<stem>.jpg on chroma green, scripts/kimorin/make-queue.py) → the
layers the story stage animates, in apps/web/public/onboarding (client 2026-11-22):

  <stem>.webp        the whole figure, keyed out of the green (soft edge, green spill removed)
  <stem>-body.webp   the figure without the tail feathers   (from <stem>-notail.jpg, aligned to the pose)
  <stem>-tail.webp   the tail feathers alone (they sway behind the body)
  <stem>-mouth.webp  a small patch: the open mouth only     (from <stem>-o.jpg, aligned to the pose)
  <stem>-eyes.webp   (goggles-up look only) the eye slits glowing a little brighter, laid over and breathing

and records:
  apps/web/lib/story/sprite-layers.json   stem → the layers it has
  apps/web/lib/story/sprite-mouths.json   stem → where the mouth patch sits: {x, y, w, h} as fractions of
                                          <stem>.webp (left, top, width, height) — the stage puts it there

The mouth is found by differencing: the open-mouth picture is an edit of the closed one, so after aligning the
two (OpenCV ECC on the figure) the changed pixels inside the face are the mouth.
Usage: python3 scripts/kimorin/build.py [stem …]   (default: every stem of design/kimorin-art-queue.json)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

RAW = 'design/kimorin'
OUT = 'apps/web/public/onboarding'
LAYERS = 'apps/web/lib/story/sprite-layers.json'
MOUTHS = 'apps/web/lib/story/sprite-mouths.json'
MAX_H = 1100
PAD = 10


def load(name):
    p = f'{RAW}/{name}.jpg'
    return cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB).astype(np.float32) if os.path.exists(p) else None


def key(a):
    """alpha and clean colour from a picture on flat chroma green"""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    G = g - np.maximum(r, b)  # greenness: ~200+ on the screen, <= 0 on KIMORIN (nothing on him is green)
    border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bgc = np.median(border, axis=0)
    gb = bgc[1] - max(bgc[0], bgc[2])
    t0 = 22.0
    al = np.clip(1 - (G - t0) / max(40.0, gb * 0.85 - t0), 0, 1)
    # specks of screen noise and tiny islands go; the figure and anything sizeable (tears, sweat drops) stay
    solid = (al > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros(n, bool)
        keep[1:] = st[1:, cv2.CC_STAT_AREA] >= max(60, big * 0.0015)
        near = cv2.dilate((keep[lab] & (solid > 0)).astype(np.uint8), np.ones((5, 5), np.uint8))
        al = al * near
    # the edge: 1 px tighter, then softened a touch
    al = cv2.erode(al, np.ones((2, 2), np.uint8))
    al = cv2.GaussianBlur(al, (0, 0), 0.6)
    al[al < 0.04] = 0
    # un-mix the green from half-covered edge pixels, then remove any green spill left
    k = np.maximum(al, 0.05)[..., None]
    rgb = np.where((al > 0) & (al < 0.98), 1, 0)[..., None] * ((a - (1 - k) * bgc) / k) + np.where((al > 0) & (al < 0.98), 0, 1)[..., None] * a
    rgb = np.clip(rgb, 0, 255)
    rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) + 4)
    return al, rgb


def align(moving, fixed, mask):
    """warp `moving` onto `fixed` (a small affine found by ECC on the figure)"""
    f = cv2.cvtColor(fixed.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    m = cv2.cvtColor(moving.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(f, m, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), (mask > 0.5).astype(np.uint8), 5)
    except cv2.error:
        pass
    h, w = fixed.shape[:2]
    return cv2.warpAffine(moving, warp, (w, h), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE), warp


def build(stem):
    base = load(stem)
    if base is None:
        return print(f'skip {stem} (no picture)')
    al, rgb = key(base)
    h, w = al.shape
    ys, xs = np.where(al > 0.1)
    box = (max(0, xs.min() - PAD), max(0, ys.min() - PAD), min(w, xs.max() + PAD + 1), min(h, ys.max() + PAD + 1))
    scale = min(1.0, MAX_H / (box[3] - box[1]))
    fw, fh = box[2] - box[0], box[3] - box[1]

    def save(name, rgb_, al_, crop=None):
        im = Image.fromarray(np.dstack([np.clip(rgb_, 0, 255), np.clip(al_, 0, 1) * 255]).astype(np.uint8), 'RGBA').crop(box)
        if scale < 1:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        if crop:
            im = im.crop(crop)
        im.save(f'{OUT}/{name}.webp', 'WEBP', quality=90, method=6)
        return im.size

    size = save(stem, rgb, al)
    layers = []
    fig_h = ys.max() - ys.min()

    # body / tail
    nt = load(f'{stem}-notail')
    if nt is not None:
        nt, _ = align(nt, base, al)
        al_nt, _ = key(nt)
        hard = cv2.morphologyEx((al_nt > 0.5).astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
        grown = cv2.GaussianBlur(cv2.dilate(hard * 255, np.ones((11, 11), np.uint8)).astype(np.float32), (0, 0), 2) / 255
        save(f'{stem}-body', rgb, al * grown)
        save(f'{stem}-tail', rgb, np.clip(al * (1 - grown), 0, 1))
        layers += ['body', 'tail']

    # the mouth: what the open-mouth edit changed inside the face, the best blob low and central in it
    mouth = None
    op = load(f'{stem}-o')
    if op is not None:
        op, _ = align(op, base, al)
        diff = np.abs(op - base).max(axis=2) * (al > 0.9)
        y0, y1 = int(ys.min() + fig_h * 0.08), int(ys.min() + fig_h * 0.42)
        m = np.zeros((h, w), np.uint8)
        # only changes to or from something dark (the open mouth's inside, the closed mouth's line): a blush or
        # a shading the edit also touched on the white face stays out
        lum = np.minimum(op.mean(axis=2), base.mean(axis=2))
        m[y0:y1] = ((diff > 40) & (lum < 175))[y0:y1].astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
        # the head's middle: the figure's columns in the face band
        cols = np.where((al[y0:y1] > 0.5).any(axis=0))[0]
        cx_head = (cols.min() + cols.max()) / 2 if len(cols) else w / 2
        best, best_s = 0, 0
        for j in range(1, n):
            area = st[j, cv2.CC_STAT_AREA]
            bw, bh = st[j, cv2.CC_STAT_WIDTH], st[j, cv2.CC_STAT_HEIGHT]
            if area < 30 or bw > fig_h * 0.16 or bh > fig_h * 0.12:
                continue
            low = (cen[j][1] - y0) / (y1 - y0)
            mid = 1 - min(1.0, abs(cen[j][0] - cx_head) / (fig_h * 0.12))
            s = area * (0.2 + low) * (0.05 + mid) ** 2
            if s > best_s:
                best, best_s = j, s
        if best:
            bx, by, bw, bh = st[best, :4]
            # grow the box around the change; the patch covers the closed mouth under it as well
            px, py = max(6, int(bw * 0.35)), max(6, int(bh * 0.45))
            mx0, my0, mx1, my1 = max(0, bx - px), max(0, by - py), min(w, bx + bw + px), min(h, by + bh + py)
            blob = cv2.dilate((lab == best).astype(np.uint8) * 255, np.ones((9, 9), np.uint8)).astype(np.float32)
            blob = cv2.GaussianBlur(blob, (0, 0), 2.5) / 255
            mask = np.zeros((h, w), np.float32)
            mask[my0:my1, mx0:mx1] = blob[my0:my1, mx0:mx1]
            # the patch in the final picture's pixels
            fx0, fy0 = (mx0 - box[0]) * scale, (my0 - box[1]) * scale
            fx1, fy1 = (mx1 - box[0]) * scale, (my1 - box[1]) * scale
            crop = (int(fx0), int(fy0), int(np.ceil(fx1)), int(np.ceil(fy1)))
            save(f'{stem}-mouth', op, mask * al, crop)
            W, H = size
            mouth = {'x': round(crop[0] / W, 4), 'y': round(crop[1] / H, 4), 'w': round((crop[2] - crop[0]) / W, 4), 'h': round((crop[3] - crop[1]) / H, 4)}
            layers.append('mouth')

    # the goggles-up look: the eye slits (light cyan arcs in the face) glow a little brighter, breathing
    if stem.startswith('kimorin-iu'):
        y0, y1 = int(ys.min() + fig_h * 0.08), int(ys.min() + fig_h * 0.42)
        R, G, B = base[..., 0], base[..., 1], base[..., 2]
        eye = np.zeros((h, w), np.uint8)
        eye[y0:y1] = ((G > 185) & (B > 215) & (R < 215) & ((B - R) > 30))[y0:y1]
        if eye.sum() > 20:
            ga = cv2.GaussianBlur(cv2.dilate(eye * 255, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 2.2) / 255
            lit = rgb * 0.55 + np.array([210, 248, 255], np.float32) * 0.45
            save(f'{stem}-eyes', lit, np.clip(ga * 1.4, 0, 1) * al)
            layers.append('eyes')

    # older layers this pose no longer has (the closed-mouth patch of the grey pictures)
    for k in ('shut', 'eyes', 'mouth', 'body', 'tail'):
        if k not in layers and os.path.exists(f'{OUT}/{stem}-{k}.webp'):
            os.remove(f'{OUT}/{stem}-{k}.webp')
    print(stem, size, sorted(layers), mouth)
    return sorted(layers), mouth


def main():
    q = json.load(open('design/kimorin-art-queue.json'))
    stems = sys.argv[1:] or [x['id'] for x in q['items'] if not x['id'].endswith(('-o', '-notail'))]
    reg = json.load(open(LAYERS))
    mouths = json.load(open(MOUTHS)) if os.path.exists(MOUTHS) else {}
    for st in stems:
        r = build(st)
        if not r:
            continue
        layers, mouth = r
        reg[st] = layers
        if mouth:
            mouths[st] = mouth
        else:
            mouths.pop(st, None)
    json.dump(dict(sorted(reg.items())), open(LAYERS, 'w'), indent=1)
    json.dump(dict(sorted(mouths.items())), open(MOUTHS, 'w'), indent=1)


main()
