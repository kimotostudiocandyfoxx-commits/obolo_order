# Build depth layers from the raw masks:  python3 make_layers.py <project-dir> [img ...]
# settings per picture (all optional): <project>/layers/layer_cfg.json  { "<img>": { "src": ["birefnet-general"], "sam": [0, 1],
#   "thr": .5, "cut": [[u,v,ru,rv]], "add": [[u,v,ru,rv]], "ring": [[u,v,ru,rv,band]], "dil": 16, "feather": 1.4 } }
#   layers/<key>-mask.png  cleaned soft figure mask (full res)
#   layers/<key>-fg.webp   RGBA cut-out (edge colour decontaminated), original registration
#   layers/<key>-bg.webp   background plate with the figure area inpainted
import sys, os, glob, json, re
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from pymatting import estimate_foreground_ml
import json
PRJ = os.path.abspath(sys.argv[1])
PJ = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))
LAYERED = sorted({s['img'] for s in PJ['scenes'] if s.get('layers')})
def art(img): return next(os.path.join(PRJ, 'art', img + e) for e in ('.jpg', '.jpeg', '.png', '.webp') if os.path.exists(os.path.join(PRJ, 'art', img + e)))
CF = f'{PRJ}/layers/layer_cfg.json'
CFG = json.load(open(CF)) if os.path.exists(CF) else {}
nums = sys.argv[2:] or LAYERED

def pushpull(img, w):
    """smooth multi-scale fill of the unknown (w=0) pixels from the known ones (pull: weighted pyramid, push: blend down)"""
    lv = [(img * w[..., None], w)]
    while lv[-1][1].shape[0] > 4:
        a, b = lv[-1]; h, ww = b.shape; nh, nw = (h + 1) // 2, (ww + 1) // 2
        lv.append((cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA), cv2.resize(b, (nw, nh), interpolation=cv2.INTER_AREA)))
    a, b = lv[-1]; col = a / np.maximum(b, 1e-6)[..., None]
    if (b <= 1e-6).any(): col[b <= 1e-6] = (a.sum((0, 1)) / max(b.sum(), 1e-6))
    for a, b in reversed(lv[:-1]):
        h, ww = b.shape; up = cv2.GaussianBlur(cv2.resize(col, (ww, h), interpolation=cv2.INTER_LINEAR), (0, 0), 1.0)
        k = np.clip(b * 1.0, 0, 1)[..., None]   # confidence at this level
        col = np.where(k > 1e-6, a / np.maximum(b, 1e-6)[..., None], 0) * k + up * (1 - k)
    return col

def disk(r): y, x = np.ogrid[-r:r + 1, -r:r + 1]; return (x * x + y * y <= r * r).astype(np.uint8)

for n in nums:
    c = CFG.get(n, {})
    if 'sam' not in c: c['sam'] = sorted(int(re.sub(r'\D', '', os.path.basename(p).split('-sam')[1])) for p in glob.glob(f'{PRJ}/layers/raw/{n}-sam[0-9]*.png'))
    f = art(n); key = n
    im = np.asarray(Image.open(f).convert('RGB')); S = im.shape[0]
    rd = lambda name: np.asarray(Image.open(f'{PRJ}/layers/raw/{n}-{name}.png').convert('L').resize((S, S), Image.BILINEAR)).astype(np.float32) / 255
    m = np.zeros((S, S), np.float32)
    for src in c.get('src', ['birefnet-general']): m = np.maximum(m, rd(src))
    for g in c.get('sam', []): m = np.maximum(m, rd(f'sam{g}'))
    b = m > c.get('thr', .5)
    yy, xx = np.mgrid[0:S, 0:S] / S
    for u, v, ru, rv in c.get('cut', []): b &= ((xx - u) / ru) ** 2 + ((yy - v) / rv) ** 2 > 1     # manual excludes (ellipses)
    for u, v, ru, rv in c.get('add', []): b |= ((xx - u) / ru) ** 2 + ((yy - v) / rv) ** 2 <= 1
    # clean: small specks out, small holes filled, a light open/close to smooth jaggies
    b = cv2.morphologyEx(b.astype(np.uint8), cv2.MORPH_CLOSE, disk(3)).astype(bool)
    lab, k = ndi.label(b); sizes = ndi.sum(b, lab, range(1, k + 1))
    b = np.isin(lab, 1 + np.flatnonzero(sizes >= c.get('minarea', 2500)))
    hl, hk = ndi.label(~b); hs = ndi.sum(~b, hl, range(1, hk + 1))
    b |= np.isin(hl, 1 + np.flatnonzero(hs < c.get('hole', 1800)))
    # thin halo rings (painted brighter than their surroundings): band around a given ellipse & local high-pass
    if c.get('ring'):
        lum = im.astype(np.float32).mean(2); hp = lum - cv2.GaussianBlur(lum, (0, 0), 6)
        for u, v, ru, rv, bw in c['ring']:
            e = np.sqrt(((xx - u) / ru) ** 2 + ((yy - v) / rv) ** 2)
            pts = np.argwhere((np.abs(e - 1) < bw) & (hp > c.get('ringthr', 6)))[:, ::-1].astype(np.float32)
            el = cv2.fitEllipse(pts); rg = np.zeros((S, S), np.uint8)
            cv2.ellipse(rg, el, 1, c.get('ringpx', 14)); rg = rg.astype(bool)
            print('  ring fit', [round(x, 1) for x in (*el[0], *el[1], el[2])])
            b |= rg
    b = cv2.morphologyEx(b.astype(np.uint8), cv2.MORPH_OPEN, disk(2)).astype(bool)
    # soft alpha: erode 1 px then feather (~3 px)
    core = cv2.erode(b.astype(np.uint8), disk(1))
    alpha = cv2.GaussianBlur(core.astype(np.float32), (0, 0), c.get('feather', 1.4))
    Image.fromarray((alpha * 255).round().astype(np.uint8)).save(f'{PRJ}/layers/{key}-mask.png')
    # fg: decontaminated colours (pymatting) at full res
    fgc = estimate_foreground_ml(im.astype(np.float64) / 255, alpha.astype(np.float64))
    rgba = np.dstack([(np.clip(fgc, 0, 1) * 255).round().astype(np.uint8), (alpha * 255).round().astype(np.uint8)])
    rgba[alpha < 1 / 255, :3] = 0
    fgim = Image.fromarray(rgba, 'RGBA'); q = c.get('fgq', 86)
    fgim.save(f'{PRJ}/layers/{key}-fg.webp', 'WEBP', quality=q, alpha_quality=100, method=6)
    # bg plate: dilate the figure, inpaint coarse (1/4 res, whole hole) + fine (full res, near the rim)
    hole = cv2.dilate(b.astype(np.uint8), disk(c.get('dil', 16)))
    coarse = pushpull(im.astype(np.float32), 1 - hole.astype(np.float32))
    fine = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(im, cv2.COLOR_RGB2BGR), hole, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB).astype(np.float32)
    # distance inside the hole: fine near the rim, coarse (smoother, no streaks) deeper inside
    dist = cv2.distanceTransform(hole, cv2.DIST_L2, 5)
    w = np.clip((dist - 6) / 30, 0, 1)[..., None]
    fill = fine * (1 - w) + coarse * w
    # a little painterly grain so the fill doesn't read as a smooth smear
    rng = np.random.default_rng(sum(map(ord, n))); gr = cv2.GaussianBlur(rng.normal(0, 1, (S, S)).astype(np.float32), (0, 0), 1.2)[..., None] * 3.0
    fill = fill + gr * np.clip(dist / 10, 0, 1)[..., None]
    hm = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 2.0)[..., None]
    bg = im.astype(np.float32) * (1 - hm) + fill * hm
    Image.fromarray(np.clip(bg, 0, 255).round().astype(np.uint8)).save(f'{PRJ}/layers/{key}-bg.webp', 'WEBP', quality=c.get('bgq', 88), method=6)
    sz = lambda p: os.path.getsize(p) // 1024
    print(n, key, 'fg', sz(f'{PRJ}/layers/{key}-fg.webp'), 'KB  bg', sz(f'{PRJ}/layers/{key}-bg.webp'), 'KB  area', round(b.mean(), 3), flush=True)
