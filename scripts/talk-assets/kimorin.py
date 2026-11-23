"""KIMORIN's talk look (M-R251 review, 2026-11-23): the same cut-out and alignment as the talk cast (user / friend /
bati, scripts/talk-assets/cutout.py on the design branch), for KIMORIN in his main look (the red robe and the round
sunglasses, kimorin-sun). Pictures from scripts/story-images/m-r251/stage1-3.json in design/story/out.

python3 scripts/talk-assets/kimorin.py  →  apps/web/public/talk/kimorin/*.webp (the exact file set of friend / bati)
The sunglasses cover the eyes: the blink pictures are the open ones (nothing to close behind the glasses).
"""

import os
import numpy as np
from PIL import Image, ImageFilter

SRC = 'design/story/out'
OUT = 'apps/web/public/talk'


def key(path):
    """the shared matte (scripts/lib/keying.py: OKLab distance to the border's green, unmixing, despill, clean-up)"""
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
    import keying
    img, _ = keying.cut_file(path, 'green')
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



def kimorin():
    c = 'kimorin'
    os.makedirs(f'{OUT}/{c}', exist_ok=True)
    base = key(f'{SRC}/{c}-talk-base-1.jpg')
    bx0, by0, bx1, by1 = bbox(base)
    scale = HP / (by1 - by0)
    canvas_h = int(HP * 1.25)
    canvas_w = int((bx1 - bx0) * scale * 1.5)
    foot = canvas_h - 8
    save = lambda im, name: im.save(f'{OUT}/{c}/{name}.webp', 'WEBP', quality=82, method=4)
    stand = place(base, scale, canvas_w, canvas_h, foot)
    save(stand, 'stand')
    save(stand, 'stand-blink')
    im = key(f'{SRC}/{c}-talk-talk-1.jpg')
    ix0, iy0, ix1, iy1 = bbox(im)
    save(place(im, scale * (by1 - by0) / (iy1 - iy0), canvas_w, canvas_h, foot), 'stand-talk')
    for f in ['smile', 'surprised', 'thinking', 'sad', 'shy']:
        pose = key(f'{SRC}/{c}-talk-{f}-pose-1.jpg')
        p = place(pose, scale, canvas_w, canvas_h, foot)
        save(p, f'{f}-pose')
        if f == 'smile':
            save(p, 'smile-pose-blink')
        px0, py0, px1, py1 = bbox(pose)
        path = f'{SRC}/{c}-talk-{f}-pose-talk-1.jpg'
        if os.path.exists(path):
            im = key(path)
            ix0, iy0, ix1, iy1 = bbox(im)
            save(place(im, scale * (py1 - py0) / (iy1 - iy0), canvas_w, canvas_h, foot), f'{f}-pose-talk')
    k = key(f'{SRC}/{c}-talk-kororin-1.jpg')
    k = k.crop(bbox(k))
    k.thumbnail((256, 256), Image.LANCZOS)
    save(k, 'kororin')


HP = 720

if __name__ == '__main__':
    kimorin()
