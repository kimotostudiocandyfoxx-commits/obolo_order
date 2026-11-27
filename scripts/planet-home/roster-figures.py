"""M-R341 / M-R342 (handoff planets-08, chapter 2): the oshi roster's figures on every planet, from the story team's art
(design/mv-art/out on the story branch, extracted to a folder) — the same cuts as the prototype's design/home/build.py:
  - Saturn   kor4-<key>   (on white) → fig-saturn-<key>.webp, 220 px   · the chibi that pops out: chibi-<key> (on green) → chibi-<key>.webp, 300 px
  - Jupiter  chibi4-<key> (on green) → fig-jupiter-<key>.webp, 260 px
  - Mercury  ship4-<key>  (on white) → fig-mercury-<key>.webp, 260 px
  - Mars / Venus / Uranus / Pluto / Neptune  p5-<planet>-<key> (on white) → fig-<planet>-<key>.webp, 220 px
Keys: the seven Sushimon and the residents that had no figure yet (brother / sister / monban / kimorin / mikie / user are
from before and are left alone unless --all is given).
  python3 scripts/planet-home/roster-figures.py <art folder> [--all]
  → apps/web/public/planets/sample/"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

SRC = sys.argv[1]
D = os.path.join(os.path.dirname(__file__), '../../apps/web/public/planets/sample')
NEW = 'sapon gari ebi uni ika shari kani kaiser freezy hipokin bossg longg hatg croco onimonk'.split()
OLD = 'kimorin monban mikie brother sister'.split()
KEYS = NEW + (OLD if '--all' in sys.argv else [])


def key(im):
    """build.py key(): green out, the green spill pulled down, backdrop-coloured fringes that touch the border too (M-R325)"""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    o0 = a.copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gn = g - np.maximum(r, b)
    al = np.clip(1 - (gn - 28) / 55, 0, 1)
    a[..., 1] = np.minimum(g, np.maximum(r, b) + 12)
    bd = np.concatenate([o0[0], o0[-1], o0[:, 0], o0[:, -1]])
    bgc = np.median(bd, axis=0)
    near = np.abs(o0 - bgc).max(2) < 60
    lab, _n = nd.label(near)
    ed = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    al[np.isin(lab, list(ed))] = 0
    k = Image.fromarray(np.dstack([a.clip(0, 255), al * 255]).astype(np.uint8), 'RGBA')
    return k.crop(k.getbbox())


def unwhite(im):
    """build.py unwhite(): a picture painted on a plain light background (M-R325) — the background colour measured on the
    border, flooded from outside through flat near-background pixels, enclosed flat holes of it removed too"""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    bd = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(bd, axis=0)
    dist = np.abs(a - bg).max(2)
    lum = a.mean(2)
    grad = np.hypot(nd.sobel(lum, 1), nd.sobel(lum, 0))
    bgl = (dist <= 12) & (grad < 60)
    lab, n = nd.label(bgl)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    out = np.isin(lab, list(edge))
    hole = np.zeros_like(out)
    if n:
        idx = np.arange(1, n + 1)
        area = nd.sum(np.ones_like(lab), lab, idx)
        md = nd.mean(dist, lab, idx)
        sd = nd.standard_deviation(lum, lab, idx)
        for k, ar, m, sdv in zip(idx, area, md, sd):
            if k in edge or ar < 0.0006 * h * w or m > 7 or sdv > 3:
                continue
            comp = lab == k
            ring = nd.binary_dilation(comp, iterations=3) & ~comp
            if dist[ring].mean() > 45:
                hole |= comp
    clear = out | hole
    al = Image.fromarray(((~clear) * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    o = im.convert('RGBA')
    o.putalpha(al)
    bb = o.getbbox()
    return o.crop(bb) if bb else o


def save(im, name, size, q):
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(f'{D}/{name}.webp', 'WEBP', quality=q, method=6)
    print(name, im.size)


for k in KEYS:
    for src, name, cut, size, q in [
        (f'chibi-{k}', f'chibi-{k}', key, 300, 86),
        (f'kor4-{k}', f'fig-saturn-{k}', unwhite, 220, 88),
        (f'chibi4-{k}', f'fig-jupiter-{k}', key, 260, 86),
        (f'ship4-{k}', f'fig-mercury-{k}', unwhite, 260, 88),
        *[(f'p5-{pl}-{k}', f'fig-{pl}-{k}', unwhite, 220, 84) for pl in ['mars', 'venus', 'uranus', 'pluto', 'neptune']],
    ]:
        f = f'{SRC}/{src}.jpg'
        if not os.path.exists(f):
            print('MISSING', f)
            continue
        save(cut(Image.open(f)), name, size, q)
