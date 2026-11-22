"""Talk screen assets (M-R232〜M-R235): chroma-key the green-background character pictures and align every
expression of a character to its base picture, so swapping faces does not make the body jump.

python3 scripts/talk-assets/cutout.py  →  design/talk/<char>/*.webp (faces, poses, stand, kororin) and bg-moon.webp
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
    """Chroma key against the picture's own background colour (read from the border), so a slightly
    different green from the generator is still removed cleanly."""
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    alpha = np.clip((dist - 38) / 52.0, 0, 1)
    # despill: on edge pixels, pull the green channel down toward the other two
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    over = np.clip(g - np.maximum(r, b), 0, None)
    a[..., 1] = np.where(alpha < 0.98, g - over * 0.9, g)
    out = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    al = img.getchannel('A').filter(ImageFilter.GaussianBlur(0.6))
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
            cv.thumbnail((10000, 720), Image.LANCZOS)
            cv.save(f'{OUT}/{c}/{f}.webp', 'WEBP', quality=82, method=4)
        k = key(f'{SRC}/talk-{c}-kororin-1.jpg')
        x0, y0, x1, y1 = bbox(k)
        k = k.crop((x0, y0, x1, y1))
        k.thumbnail((256, 256), Image.LANCZOS)
        k.save(f'{OUT}/{c}/kororin.webp', 'WEBP', quality=82, method=4)
    bg = Image.open(f'{SRC}/talk-bg-moon-1.jpg').convert('RGB')
    bg.thumbnail((1152, 2048), Image.LANCZOS)
    bg.save(f'{OUT}/bg-moon.webp', 'WEBP', quality=80)





# ---- poses (M-R240): a pose keeps the base picture's scale (arms up must not shrink the body) and stands on
# the same point; the pose's own talk/blink pictures are aligned to that pose by their outline.
POSES = {'user': ['smile', 'surprised', 'shy'],
         'friend': ['smile', 'surprised', 'thinking', 'sad', 'shy'],
         'bati': ['smile', 'surprised', 'thinking', 'sad', 'shy']}
HP = 720  # final height of the base picture in WebP


def place(img, scale, canvas_w, canvas_h, foot_y):
    x0, y0, x1, y1 = bbox(img)
    crop = img.crop((x0, y0, x1, y1))
    crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.LANCZOS)
    cv = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    cv.paste(crop, ((canvas_w - crop.width) // 2, foot_y - crop.height), crop)
    return cv


def poses():
    for c, faces in POSES.items():
        base = key(f'{SRC}/talk-{c}-base-1.jpg')
        bx0, by0, bx1, by1 = bbox(base)
        scale = HP / (by1 - by0)
        canvas_h = int(HP * 1.25)             # room above the head for raised arms
        canvas_w = int((bx1 - bx0) * scale * 1.7)
        foot = canvas_h - 8
        # the base again on the same canvas, so base and poses share one frame
        place(base, scale, canvas_w, canvas_h, foot).save(f'{OUT}/{c}/stand.webp', 'WEBP', quality=82, method=4)
        for f in faces:
            pose = key(f'{SRC}/talk-{c}-{f}-pose-1.jpg')
            place(pose, scale, canvas_w, canvas_h, foot).save(f'{OUT}/{c}/{f}-pose.webp', 'WEBP', quality=82, method=4)
            px0, py0, px1, py1 = bbox(pose)
            for v in ('talk', 'blink'):
                path = f'{SRC}/talk-{c}-{f}-pose-{v}-1.jpg'
                if not os.path.exists(path):
                    continue
                im = key(path)
                ix0, iy0, ix1, iy1 = bbox(im)
                s2 = scale * (py1 - py0) / (iy1 - iy0)  # same outline height as its pose
                place(im, s2, canvas_w, canvas_h, foot).save(f'{OUT}/{c}/{f}-pose-{v}.webp', 'WEBP', quality=82, method=4)





def stand_parts():
    """talk/blink for the plain standing picture, on the same canvas as the poses."""
    for c in POSES:
        base = key(f'{SRC}/talk-{c}-base-1.jpg')
        bx0, by0, bx1, by1 = bbox(base)
        scale = HP / (by1 - by0)
        canvas_h = int(HP * 1.25)
        canvas_w = int((bx1 - bx0) * scale * 1.7)
        for v in ('talk', 'blink'):
            im = key(f'{SRC}/talk-{c}-{v}-1.jpg')
            ix0, iy0, ix1, iy1 = bbox(im)
            s2 = scale * (by1 - by0) / (iy1 - iy0)
            place(im, s2, canvas_w, canvas_h, canvas_h - 8).save(f'{OUT}/{c}/stand-{v}.webp', 'WEBP', quality=82, method=4)


if __name__ == '__main__':
    main()
    poses()
    stand_parts()
