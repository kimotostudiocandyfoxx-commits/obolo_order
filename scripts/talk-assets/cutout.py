"""Talk screen assets (M-R232〜M-R235): chroma-key the green-background character pictures and align every
expression of a character to its base picture, so swapping faces does not make the body jump.

python3 scripts/talk-assets/cutout.py  →  design/talk/<char>/<face>.png (+ kororin.png, bg-moon.jpg)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SRC = 'design/story/out'
OUT = 'design/talk'
CHARS = {
    'user': ['base', 'smile', 'surprised', 'shy', 'blink', 'talk'],
    'friend': ['base', 'smile', 'surprised', 'thinking', 'sad', 'shy', 'blink', 'talk'],
    'bati': ['base', 'smile', 'surprised', 'thinking', 'sad', 'shy', 'blink', 'talk'],
}
H = 900  # output height of a full-body picture


def key(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # how green the pixel is compared with its other channels
    greenness = g - np.maximum(r, b)
    alpha = np.clip(1.0 - (greenness - 25) / 45.0, 0, 1)
    # despill: pull leftover green down on the edge pixels
    spill = np.clip(greenness, 0, None)
    a[..., 1] = np.where(alpha < 1, g - spill * 0.85, g)
    out = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    # soften the edge by one pixel
    al = img.getchannel('A').filter(ImageFilter.GaussianBlur(0.7))
    img.putalpha(al)
    return img


def bbox(img):
    al = np.asarray(img.getchannel('A'))
    ys, xs = np.where(al > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def main():
    for c, faces in CHARS.items():
        os.makedirs(f'{OUT}/{c}', exist_ok=True)
        base = key(f'{SRC}/talk-{c}-base-1.jpg')
        bx0, by0, bx1, by1 = bbox(base)
        bw, bh = bx1 - bx0, by1 - by0
        scale = H / bh
        canvas_w = int(bw * scale) + 40
        for f in faces:
            img = base if f == 'base' else key(f'{SRC}/talk-{c}-{f}-1.jpg')
            x0, y0, x1, y1 = bbox(img)
            crop = img.crop((x0, y0, x1, y1))
            # align: same height as the base, bottom-centre on the same point
            s = H / (y1 - y0)
            crop = crop.resize((max(1, int((x1 - x0) * s)), H), Image.LANCZOS)
            cv = Image.new('RGBA', (canvas_w, H + 20), (0, 0, 0, 0))
            cv.paste(crop, ((canvas_w - crop.width) // 2, 10), crop)
            cv.save(f'{OUT}/{c}/{f}.png', optimize=True)
        k = key(f'{SRC}/talk-{c}-kororin-1.jpg')
        x0, y0, x1, y1 = bbox(k)
        k = k.crop((x0, y0, x1, y1))
        k.thumbnail((256, 256), Image.LANCZOS)
        k.save(f'{OUT}/{c}/kororin.png', optimize=True)
    bg = Image.open(f'{SRC}/talk-bg-moon-1.jpg').convert('RGB')
    bg.thumbnail((1152, 2048), Image.LANCZOS)
    bg.save(f'{OUT}/bg-moon.jpg', quality=84)


if __name__ == '__main__':
    main()
