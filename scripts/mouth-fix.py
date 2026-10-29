"""KIMORIN's mouth layers made again where the painted open mouth did not line up (client 2026-10-29: the mouth
flapped in the wrong place in many scenes).

  closed mouth in the pose (ω)  → <stem>-mouth.webp : an opening under the ω (from kimorin-i-talk's own patch,
                                  scaled to the ω), shown while the voice is loud
  open mouth in the pose (joy, shock) → <stem>-shut.webp (mode fill=: only painted over, the pose has its ω) : the mouth painted over with skin and the ω drawn on,
                                  shown while the voice is quiet — so the mouth closes and opens as he talks
Run from apps/web/public/onboarding:  python3 ../../../../scripts/mouth-fix.py <stem>:x0,y0,x1,y1 …
(the box: around the mouth). Prints what it found; writes the layers next to the poses.
"""
import sys, json, os
import numpy as np, cv2
from PIL import Image, ImageFilter

SRC = 'kimorin-i-talk'


def arr(p):
    return np.array(Image.open(p).convert('RGBA')).astype(np.float32)


def omega_box(a, box):
    """the ω: thin dark lines on white skin inside the box"""
    x0, y0, x1, y1 = box
    s = a[y0:y1, x0:x1]
    lum = s[..., :3].mean(2)
    skin = np.median(lum[s[..., 3] > 200])
    m = ((lum < skin - 55) & (s[..., 3] > 200)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return None, skin
    # the widest dark thing in the box, with the pieces beside it (a ω drawn in two strokes)
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_WIDTH]))
    cy = st[k, 1] + st[k, 3] / 2
    ks = [j for j in range(1, n) if st[j, 2] >= 6 and st[j, 3] <= 24 and abs(st[j, 1] + st[j, 3] / 2 - cy) <= 12]
    xa = min(st[j, 0] for j in ks); ya = min(st[j, 1] for j in ks)
    xb = max(st[j, 0] + st[j, 2] for j in ks); yb = max(st[j, 1] + st[j, 3] for j in ks)
    return (x0 + xa, y0 + ya, x0 + xb, y0 + yb), skin


# the opening of kimorin-i-talk, without the skin around it (alpha from darkness)
_src_m = Image.open(f'{SRC}-mouth.webp').convert('RGBA')
_bx = _src_m.getbbox()
OPEN = np.array(_src_m.crop((_bx[0] + 14, _bx[1] + 12, _bx[0] + 67, _bx[1] + 38))).astype(np.float32)
OPEN[..., 3] = np.clip((185 - OPEN[..., :3].mean(2)) / 50, 0, 1) * OPEN[..., 3]
# the ω of kimorin-i-talk (closed), as a dark line with alpha
_src = arr(f'{SRC}.webp')
_ob, _sk = omega_box(_src, (380, 325, 485, 375))
_o = _src[_ob[1] - 3:_ob[3] + 3, _ob[0] - 3:_ob[2] + 3].copy()
_o[..., 3] = np.clip((_sk - _o[..., :3].mean(2) - 15) / 60, 0, 1) * 255
OMEGA = _o


def paste(layer, patch, left, top):
    H, W = layer.shape[:2]
    h, w = patch.shape[:2]
    x0, y0 = max(0, left), max(0, top)
    x1, y1 = min(W, left + w), min(H, top + h)
    p = patch[y0 - top:y1 - top, x0 - left:x1 - left]
    a = p[..., 3:4] / 255
    dst = layer[y0:y1, x0:x1]
    out_a = a + dst[..., 3:4] / 255 * (1 - a)
    rgb = (p[..., :3] * a + dst[..., :3] * (dst[..., 3:4] / 255) * (1 - a)) / np.maximum(out_a, 1e-6)
    layer[y0:y1, x0:x1, :3] = rgb
    layer[y0:y1, x0:x1, 3:4] = out_a * 255


def scaled(p, k):
    im = Image.fromarray(p.clip(0, 255).astype(np.uint8))
    im = im.resize((max(2, round(im.width * k)), max(2, round(im.height * k))), Image.LANCZOS)
    return np.array(im.filter(ImageFilter.GaussianBlur(0.4))).astype(np.float32)


def opening(stem, box):
    a = arr(f'{stem}.webp')
    ob, skin = omega_box(a, box)
    if not ob:
        return f'{stem}: no ω found'
    w = ob[2] - ob[0]
    p = OPEN.copy()
    p[..., :3] *= min(1.05, skin / 200)
    p = scaled(p, w / 79)
    layer = np.zeros_like(a)
    cx = (ob[0] + ob[2]) / 2
    paste(layer, p, round(cx - p.shape[1] / 2), round(ob[1] + 0.045 * w))
    Image.fromarray(layer.astype(np.uint8)).save(f'{stem}-mouth.webp', lossless=True)
    if os.path.exists(f'{stem}-shut.webp'):
        os.remove(f'{stem}-shut.webp')
    return f'{stem}: opening under ω {ob}'


def shut(stem, box, omega=True):
    a = arr(f'{stem}.webp')
    x0, y0, x1, y1 = box
    s = a[y0:y1, x0:x1]
    r, g, b = s[..., 0], s[..., 1], s[..., 2]
    lum = s[..., :3].mean(2)
    m = (((r - g > 30) & (r > 80) & (b < r)) | (lum < 75)) & (s[..., 3] > 200)
    m = m.astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return f'{stem}: no open mouth found'
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    mm = np.zeros(a.shape[:2], np.uint8)
    mm[y0:y1, x0:x1] = (lab == k).astype(np.uint8)
    # the lips' dark edge too
    mm = cv2.dilate(mm, np.ones((7, 7), np.uint8))
    ys, xs = np.where(mm > 0)
    mx0, mx1, my0, my1 = xs.min(), xs.max(), ys.min(), ys.max()
    bgr = cv2.cvtColor(a[..., :3].astype(np.uint8), cv2.COLOR_RGB2BGR)
    filled = cv2.cvtColor(cv2.inpaint(bgr, mm * 255, 9, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB).astype(np.float32)
    layer = np.zeros_like(a)
    feather = cv2.GaussianBlur(cv2.dilate(mm, np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 2.0)
    layer[..., :3] = filled
    layer[..., 3] = np.clip(feather, 0, 1) * 255
    if not omega:  # the pose has its ω drawn already, over the open mouth: the mouth is only painted over
        Image.fromarray(layer.astype(np.uint8)).save(f'{stem}-shut.webp', lossless=True)
        if os.path.exists(f'{stem}-mouth.webp'):
            os.remove(f'{stem}-mouth.webp')
        return f'{stem}: open mouth painted over {(mx0, my0, mx1, my1)}'
    # the ω, as wide as the mouth was, at its top third
    w = (mx1 - mx0) * 1.05
    om = scaled(OMEGA, w / OMEGA.shape[1])
    lum_skin = np.median(filled[my0:my1 + 1, mx0:mx1 + 1].mean(2))
    om[..., :3] *= min(1.0, lum_skin / 205)
    paste(layer, om, round((mx0 + mx1) / 2 - om.shape[1] / 2), round(my0 + (my1 - my0) * 0.18))
    Image.fromarray(layer.astype(np.uint8)).save(f'{stem}-shut.webp', lossless=True)
    if os.path.exists(f'{stem}-mouth.webp'):
        os.remove(f'{stem}-mouth.webp')
    return f'{stem}: shut over the open mouth {(mx0, my0, mx1, my1)}'


reg_path = '../../lib/story/sprite-layers.json'
reg = json.load(open(reg_path))
for arg in sys.argv[1:]:
    mode, rest = arg.split('=', 1)
    stem, b = rest.split(':')
    box = tuple(int(v) for v in b.split(','))
    print(opening(stem, box) if mode == 'open' else shut(stem, box, mode == 'shut'))
    reg[stem] = sorted(k for k in ('body', 'tail', 'mouth', 'shut', 'eyes') if os.path.exists(f'{stem}-{k}.webp'))
json.dump(reg, open(reg_path, 'w'), indent=1, ensure_ascii=False, sort_keys=True)
