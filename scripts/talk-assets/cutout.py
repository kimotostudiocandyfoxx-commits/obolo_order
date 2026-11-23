"""Talk screen cast (M-R232〜M-R240; re-keyed in the cut-out review 2026-11-23): the green-background pictures of
user / friend / bati (design/story/out/talk-<char>-*.jpg) cut out with the shared matte (scripts/lib/keying.py) and
aligned on one canvas per character, so swapping faces or poses does not make the body jump.

  python3 scripts/talk-assets/cutout.py [--src DIR] [user friend bati]  →  apps/web/public/talk/<char>/*.webp

The geometry is the M-R240 one: the plain standing picture sets the scale (its figure 720 px tall), every pose keeps
that scale and stands on the same foot line; a pose's own talk / blink picture is scaled to its pose's outline. An
existing canvas size is kept (the app lays the pictures over each other), so a re-key changes only the edges.

For KIMORIN (scripts/talk-assets/kimorin.py) the same three helpers are the ones to use: key(path) (→ RGBA PIL image,
the shared matte), bbox(img) and place(...).
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

SRC = 'design/story/out'
OUT = 'apps/web/public/talk'
POSES = {
    'user': ['smile', 'surprised', 'shy'],
    'friend': ['smile', 'surprised', 'thinking', 'sad', 'shy'],
    'bati': ['smile', 'surprised', 'thinking', 'sad', 'shy'],
}
HP = 720  # the standing figure's height on the canvas


def key(path, colour=None):
    """a picture on a flat key colour → RGBA (PIL), the shared matte; `colour` = the key asked for (else the border's)"""
    img, info = keying.cut_file(path, colour)
    return img


def bbox(img):
    al = np.asarray(img.getchannel('A'))
    ys, xs = np.where(al > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def place(img, scale, canvas_w, canvas_h, foot_y):
    x0, y0, x1, y1 = bbox(img)
    crop = img.crop((x0, y0, x1, y1))
    crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.LANCZOS)
    cv = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    cv.paste(crop, ((canvas_w - crop.width) // 2, foot_y - crop.height), crop)
    return cv


def build(c, src):
    os.makedirs(f'{OUT}/{c}', exist_ok=True)
    save = lambda im, name: im.save(f'{OUT}/{c}/{name}.webp', 'WEBP', quality=82, method=4)
    base = key(f'{src}/talk-{c}-base-1.jpg')
    bx0, by0, bx1, by1 = bbox(base)
    scale = HP / (by1 - by0)
    canvas_h = int(HP * 1.25)
    canvas_w = int((bx1 - bx0) * scale * 1.7)
    old = f'apps/web/public/talk/{c}/stand.webp'
    if os.path.exists(old):
        canvas_w, canvas_h = Image.open(old).size
    foot = canvas_h - 8
    save(place(base, scale, canvas_w, canvas_h, foot), 'stand')
    # the plain standing picture's talk / blink, scaled to its outline
    for v in ('talk', 'blink'):
        p = f'{src}/talk-{c}-{v}-1.jpg'
        if os.path.exists(p):
            im = key(p)
            ix0, iy0, ix1, iy1 = bbox(im)
            save(place(im, scale * (by1 - by0) / (iy1 - iy0), canvas_w, canvas_h, foot), f'stand-{v}')
    for f in POSES[c]:
        pose = key(f'{src}/talk-{c}-{f}-pose-1.jpg')
        save(place(pose, scale, canvas_w, canvas_h, foot), f'{f}-pose')
        px0, py0, px1, py1 = bbox(pose)
        for v in ('talk', 'blink'):
            p = f'{src}/talk-{c}-{f}-pose-{v}-1.jpg'
            if not os.path.exists(p):
                continue
            im = key(p)
            ix0, iy0, ix1, iy1 = bbox(im)
            save(place(im, scale * (py1 - py0) / (iy1 - iy0), canvas_w, canvas_h, foot), f'{f}-pose-{v}')
    p = f'{src}/talk-{c}-kororin-1.jpg'
    if os.path.exists(p):
        k = key(p)
        k = k.crop(bbox(k))
        k.thumbnail((256, 256), Image.LANCZOS)
        save(k, 'kororin')
    print(c, (canvas_w, canvas_h))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('chars', nargs='*', default=list(POSES))
    a = ap.parse_args()
    OUT = a.out
    for c in a.chars:
        build(c, a.src)
