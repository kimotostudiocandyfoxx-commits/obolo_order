#!/usr/bin/env python3
"""KIMORIN's repainted sprites (design/kimorin/<stem>.jpg on chroma green, scripts/kimorin/make-queue.py) → the
layers the story stage animates, in apps/web/public/onboarding (client 2026-11-22):

  <stem>.webp        the whole figure, keyed out of its key colour (scripts/lib/keying.py)
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

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

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
    """alpha and clean colour from a picture on its flat key colour (the shared matte, scripts/lib/keying.py: OKLab
    distance with a soft band, un-mixed and despilled edge, specks gone, holes filled unless they are the key)"""
    rgba, _ = keying.cut(a, keying.key_for('KIMORIN')[1])
    return rgba[..., 3].astype(np.float32) / 255, rgba[..., :3].astype(np.float32)


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


def donor_of(stem):
    look = 'kimorin-xs' if stem == 'kimorin-sun' or stem.startswith('kimorin-xs') else 'kimorin-iu' if stem.startswith('kimorin-iu') else 'kimorin-i'
    d = f'{look}-talk'
    return None if d == stem else d


DONOR = {}


def closed_mouth(base, al, ys, fig_h):
    """the closed mouth: the lowest dark (not blue) mark inside the white face, near the head's middle"""
    h, w = al.shape
    y0, y1 = int(ys.min() + fig_h * 0.08), int(ys.min() + fig_h * 0.45)
    skin = ((base.mean(axis=2) > 185) & ((base.max(axis=2) - base.min(axis=2)) < 45)).astype(np.uint8)
    face = np.zeros_like(skin)
    face[y0:y1] = skin[y0:y1]
    face = cv2.morphologyEx(face, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(face, 8)
    if n < 2:
        return None
    # the face: the biggest white patch in the band, with the big ones beside it (sunglasses cut the face in two)
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    kx = st[k, 0] + st[k, 2] / 2
    ks = [j for j in range(1, n) if st[j, cv2.CC_STAT_AREA] >= st[k, cv2.CC_STAT_AREA] * 0.2 and abs(st[j, 0] + st[j, 2] / 2 - kx) < st[k, 2] * 0.5]
    region = np.isin(lab, ks).astype(np.uint8)
    # closed a little first: a mouth line near the chin's shading is still inside the face
    filled = cv2.morphologyEx(region, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    cnts, _ = cv2.findContours(filled.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(filled, cnts, -1, 1, thickness=cv2.FILLED)
    R, G, B = base[..., 0], base[..., 1], base[..., 2]
    # the mouth line: darker than the skin and not the strong blue of the face marks (it may be a blue-grey)
    dark = ((base.mean(axis=2) < 175) & ~(((B - R) > 60) & (B > 120)) & (filled > 0) & (region == 0)).astype(np.uint8)
    n, lab2, st2, cen = cv2.connectedComponentsWithStats(dark, 8)
    fx = np.where(region.any(axis=0))[0]
    cx = (fx.min() + fx.max()) / 2
    best = None
    for j in range(1, n):
        if not (12 <= st2[j, cv2.CC_STAT_AREA] <= 4000) or abs(cen[j][0] - cx) > (fx.max() - fx.min()) * 0.22:
            continue
        if st2[j, cv2.CC_STAT_WIDTH] > (fx.max() - fx.min()) * 0.5:
            continue
        if best is None or cen[j][1] > cen[best][1]:
            best = j
    if best is None:
        return None
    # the pieces beside it on the same line (a ω drawn in two strokes)
    cy = cen[best][1]
    js = [j for j in range(1, n) if abs(cen[j][1] - cy) < 14 and abs(cen[j][0] - cen[best][0]) < (fx.max() - fx.min()) * 0.2 and st2[j, cv2.CC_STAT_AREA] >= 6]
    x0 = min(st2[j, 0] for j in js); y0_ = min(st2[j, 1] for j in js)
    x1 = max(st2[j, 0] + st2[j, 2] for j in js); y1_ = max(st2[j, 1] + st2[j, 3] for j in js)
    return (x0, y0_, x1, y1_), fx.max() - fx.min(), region


def transplant(stem, base, al, rgb, box, scale, size, save, ys, fig_h):
    d = DONOR[stem]
    h, w = al.shape
    # where the donor's closed mouth is in this face: template matching (a few scales) inside the face band,
    # else the lowest dark mark on the face (a different mouth shape: the 'o' of a surprise)
    g = cv2.cvtColor(base.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    a0, a1 = int(ys.min() + fig_h * 0.1), int(ys.min() + fig_h * 0.45)
    best = (-1.0, 1.0, 0.0, 0.0)
    for sc in np.arange(0.75, 1.31, 0.05):
        tp = cv2.resize(d['tpl'], None, fx=sc, fy=sc)
        r = cv2.matchTemplate(g[a0:a1], tp, cv2.TM_CCOEFF_NORMED)
        _, mx, _, loc = cv2.minMaxLoc(r)
        if mx > best[0]:
            best = (mx, sc, loc[0] + tp.shape[1] / 2, a0 + loc[1] + tp.shape[0] / 2)
    hint = OVERRIDE.get(stem)
    if hint:
        sc, cx, cy, cover = 1.0, hint[0] * w, hint[1] * h, None
    elif best[0] >= 0.72:
        sc, cx, cy, cover = best[1], best[2], best[3], None
    else:
        me = closed_mouth(base, al, ys, fig_h)
        if not me:
            return None
        cover = me[0]
        sc, cx, cy = 1.0, (cover[0] + cover[2]) / 2, (cover[1] + cover[3]) / 2
    print(f'  {stem}: open mouth from {d["from"]} (match {best[0]:.2f}{", hint" if hint else ""})')
    patch = cv2.resize(d['patch'], None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
    ph, pw = patch.shape[:2]
    px0, py0 = int(round(cx - pw / 2)), int(round(cy - ph / 2))
    bx0, by0, bx1, by1 = px0, py0, px0 + pw, py0 + ph
    if cover:
        bx0, by0, bx1, by1 = min(bx0, cover[0] - 8), min(by0, cover[1] - 8), max(bx1, cover[2] + 8), max(by1, cover[3] + 8)
    canvas = np.zeros((h, w, 3), np.float32)
    # under it, this face's own skin (painting over the closed mouth), an ellipse feathered at the edge
    ring = ((base.mean(axis=2) > 185) & ((base.max(axis=2) - base.min(axis=2)) < 45))[by0:by1, bx0:bx1]
    canvas[by0:by1, bx0:bx1] = np.median(base[by0:by1, bx0:bx1][ring], axis=0) if ring.sum() > 20 else 238
    ell = np.zeros((h, w), np.uint8)
    cv2.ellipse(ell, (int((bx0 + bx1) / 2), int((by0 + by1) / 2)), (max(2, int((bx1 - bx0) / 2) - 2), max(2, int((by1 - by0) / 2) - 2)), 0, 0, 360, 255, -1)
    alpha = cv2.GaussianBlur(ell.astype(np.float32), (0, 0), 2.5) / 255
    sl = (slice(py0, py0 + ph), slice(px0, px0 + pw))
    pa = patch[..., 3:4] / 255
    canvas[sl] = canvas[sl] * (1 - pa) + patch[..., :3] * pa
    alpha[sl] = np.maximum(alpha[sl], patch[..., 3] / 255)
    fx0, fy0 = (bx0 - box[0]) * scale, (by0 - box[1]) * scale
    fx1, fy1 = (bx1 - box[0]) * scale, (by1 - box[1]) * scale
    crop = (int(fx0), int(fy0), int(np.ceil(fx1)), int(np.ceil(fy1)))
    save(f'{stem}-mouth', canvas, alpha * al, crop)
    W, H = size
    return {'x': round(crop[0] / W, 4), 'y': round(crop[1] / H, 4), 'w': round((crop[2] - crop[0]) / W, 4), 'h': round((crop[3] - crop[1]) / H, 4)}


def remember_donor(stem, base, op, mask, mbox):
    """a 'talk' pose's open mouth and the closed mouth under it, kept (in the painting's pixels) for the poses
    of its look that have no open-mouth painting"""
    x0, y0, x1, y1 = mbox
    g = cv2.cvtColor(base.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    DONOR['__' + stem] = {
        'from': stem,
        'tpl': g[y0:y1, x0:x1].copy(),
        'patch': np.dstack([op[y0:y1, x0:x1], mask[y0:y1, x0:x1] * 255]).astype(np.float32),
    }


# a mouth found by hand where both ways above miss (fractions of the painting): stem → (x, y)
OVERRIDE = {'kimorin-xs-smug': (0.502, 0.328)}  # checked on the painting, 2026-11-22


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
        # ... and only on his face: the white skin with its holes filled (the mouth, the face marks), so the
        # goggles, the device on his head or a hand never count
        skin = ((base.mean(axis=2) > 185) & ((base.max(axis=2) - base.min(axis=2)) < 45)).astype(np.uint8)
        filled = skin.copy()
        cnts, _ = cv2.findContours(skin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(filled, cnts, -1, 1, thickness=cv2.FILLED)
        m[y0:y1] = ((diff > 40) & (lum < 175) & (filled > 0))[y0:y1].astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
        # the head's middle: the figure's columns in the face band
        cols = np.where((al[y0:y1] > 0.5).any(axis=0))[0]
        cx_head = (cols.min() + cols.max()) / 2 if len(cols) else w / 2
        # the mouth sits on his white face: around it (a ring) the closed picture is mostly white skin
        skin = skin > 0
        best, best_s = 0, 0
        for j in range(1, n):
            area = st[j, cv2.CC_STAT_AREA]
            bw, bh = st[j, cv2.CC_STAT_WIDTH], st[j, cv2.CC_STAT_HEIGHT]
            if area < 30 or bw > fig_h * 0.16 or bh > fig_h * 0.12:
                continue
            low = (cen[j][1] - y0) / (y1 - y0)
            mid = 1 - min(1.0, abs(cen[j][0] - cx_head) / (fig_h * 0.12))
            bx_, by_ = st[j, 0], st[j, 1]
            sl = (slice(max(0, by_ - 16), by_ + bh + 16), slice(max(0, bx_ - 16), bx_ + bw + 16))
            blobj = (lab[sl] == j).astype(np.uint8)
            ring = cv2.dilate(blobj, np.ones((25, 25), np.uint8)) & (1 - cv2.dilate(blobj, np.ones((7, 7), np.uint8)))
            white = skin[sl][ring > 0].mean() if ring.any() else 0
            if white < 0.55:
                continue
            s = area * (0.2 + low) * (0.05 + mid) ** 2 * white
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
            if stem.endswith('-talk'):
                remember_donor(stem, base, op, mask * al, (mx0, my0, mx1, my1))
            W, H = size
            mouth = {'x': round(crop[0] / W, 4), 'y': round(crop[1] / H, 4), 'w': round((crop[2] - crop[0]) / W, 4), 'h': round((crop[3] - crop[1]) / H, 4)}
            layers.append('mouth')

    # no open-mouth painting (or nothing found in it): the open mouth of the same look's 'talk' pose, scaled to
    # this face and put over this pose's closed mouth (found as the lowest dark mark on the white face)
    if mouth is None and DONOR.get(stem):
        mouth = transplant(stem, base, al, rgb, box, scale, size, save, ys, fig_h)
        if mouth:
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
    # the 'talk' poses first: their open mouths stand in where a pose has no open-mouth painting
    stems = sorted(stems, key=lambda s_: not s_.endswith('-talk'))
    if not any(s_.endswith('-talk') for s_ in stems):
        stems = [d for d in {donor_of(s_) for s_ in stems} if d] + stems
    for st in stems:
        d = donor_of(st)
        if d and '__' + d in DONOR:
            DONOR[st] = DONOR['__' + d]
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
