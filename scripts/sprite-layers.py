#!/usr/bin/env python3
"""A story character's pose → the layers the stage animates (client 2026-10-25), all on one canvas:
  <stem>.webp        the whole figure (closed mouth)
  <stem>-body.webp   without the tail feathers           (from <stem>-notail.jpg)
  <stem>-tail.webp   the tail feathers alone (they sway)
  <stem>-mouth.webp  only the pixels of the open mouth   (from <stem>-o.jpg; laid over while speaking)
  <stem>-eyes.webp   the eye slits glowing brighter (from <stem>-glow.jpg; laid over, breathing; not for sunglasses on)
Usage: scripts/sprite-layers.py <dir with the grey jpgs> <out dir> <stem> [--no-eyes]
The paintings are on flat #808080; the open-mouth and tail-less ones were edited from the closed one, so
they line up; the mouth patch keeps only the changed pixels around the face (no flicker elsewhere)."""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

src, out, stem = sys.argv[1], sys.argv[2], sys.argv[3]
no_eyes = '--no-eyes' in sys.argv
MAX_H = 1100


def load(name):
    try:
        return np.asarray(Image.open(f'{src}/{name}.jpg').convert('RGB')).astype(np.int16)
    except FileNotFoundError:
        return None


def alpha_of(a, tol=26):
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(border, axis=0)
    grey = (np.abs(a - ref).max(axis=2) <= tol) & ((a.max(axis=2) - a.min(axis=2)) <= 22)
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if grey[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if grey[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and grey[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    al = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    return np.asarray(al).astype(np.float32) / 255.0, ref


def defringe(a, al, ref):
    rgb = a.astype(np.float32)
    edge = (al > 0.02) & (al < 0.98)
    k = al[..., None]
    fixed = np.clip((rgb - (1 - k) * ref) / np.maximum(k, 0.05), 0, 255)
    return np.where(edge[..., None], fixed, rgb)


base = load(stem)
if base is None:
    sys.exit(f'no {stem}.jpg')
al, ref = alpha_of(base)
rgb = defringe(base, al, ref)
h, w = al.shape
ys, xs = np.where(al > 0.03)
pad = 8
box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + pad), min(h, ys.max() + pad))
scale = min(1.0, MAX_H / (box[3] - box[1]))


def save(name, rgb_, al_):
    im = Image.fromarray(np.dstack([np.clip(rgb_, 0, 255), np.clip(al_, 0, 1) * 255]).astype(np.uint8), 'RGBA').crop(box)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(f'{out}/{name}.webp', 'WEBP', quality=88, method=6)
    print(f'{out}/{name}.webp', im.size)


save(stem, rgb, al)

# body / tail: the tail is what the tail-less painting no longer has
nt = load(f'{stem}-notail')
if nt is not None:
    al_body, _ = alpha_of(nt)
    tail = np.clip(al - al_body, 0, 1)
    tail = np.asarray(Image.fromarray((tail * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    body = np.clip(al - tail, 0, 1)
    save(f'{stem}-body', rgb, body)
    save(f'{stem}-tail', rgb, tail)

# the open mouth: changed pixels near the face, the largest patch
op = load(f'{stem}-o')
if op is not None:
    diff = np.abs(op - base).max(axis=2)
    face_y0, face_y1 = int(ys.min()), int(ys.min() + (ys.max() - ys.min()) * 0.42)
    m = np.zeros((h, w), bool)
    m[face_y0:face_y1] = diff[face_y0:face_y1] > 38
    # keep the biggest connected blob (the mouth), grow it a little, feather
    lab = np.zeros((h, w), np.int32)
    best, best_n, n_id = 0, 0, 0
    for y0, x0 in zip(*np.where(m)):
        if lab[y0, x0]:
            continue
        n_id += 1
        q = deque([(y0, x0)])
        lab[y0, x0] = n_id
        cnt = 0
        while q:
            y, x = q.popleft()
            cnt += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n_id
                    q.append((ny, nx))
        if cnt > best_n:
            best, best_n = n_id, cnt
    if best:
        mm = Image.fromarray(((lab == best) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2.5))
        mask = np.asarray(mm).astype(np.float32) / 255 * al
        save(f'{stem}-mouth', op.astype(np.float32), mask)

# the eye slits: what a copy with only the slits glowing brighter changed (<stem>-glow.jpg) → a soft glow layer
gl = None if no_eyes else load(f'{stem}-glow')
if gl is not None:
    diff = np.abs(gl - base).max(axis=2)
    face_y0, face_y1 = int(ys.min()), int(ys.min() + (ys.max() - ys.min()) * 0.42)
    eye = np.zeros((h, w), bool)
    eye[face_y0:face_y1] = diff[face_y0:face_y1] > 45
    if eye.sum() > 20:
        glow = Image.fromarray((eye * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))
        ga = np.asarray(glow).astype(np.float32) / 255
        save(f'{stem}-eyes', gl.astype(np.float32), np.clip(ga * 1.3, 0, 1) * al)

# record which layers this pose has (the stage reads apps/web/lib/story/sprite-layers.json)
import json, os
reg_path = 'apps/web/lib/story/sprite-layers.json'
reg = json.load(open(reg_path)) if os.path.exists(reg_path) else {}
reg[stem] = sorted(k for k in ('body', 'tail', 'mouth', 'eyes') if os.path.exists(f'{out}/{stem}-{k}.webp'))
json.dump(dict(sorted(reg.items())), open(reg_path, 'w'), indent=1)
