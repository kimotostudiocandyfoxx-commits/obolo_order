"""The prototype's cut-outs for a picture painted on a plain light background (design/home/build.py on the story branch:
`unwhite` and `cleancut`), as they are there. `cleancut` leaves no white fringe: the border band's alpha comes from how
white each pixel is, and its colour is un-mixed from white."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd


def unwhite(im):
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


def cleancut(im):
    o = unwhite(im)
    a = np.asarray(o).astype(np.float32)
    rgb = a[..., :3]
    al = a[..., 3] / 255.0
    solid = al > 0.5
    inner = nd.binary_erosion(solid, iterations=3)
    band = nd.binary_dilation(solid, iterations=2) & ~inner
    wh = np.clip((255 - rgb.min(2)) / 70.0, 0, 1)  # 0 = pure white, 1 = clearly coloured
    na = np.where(inner, 1.0, np.where(band, wh, 0.0))
    na = nd.gaussian_filter(na, 0.6) * band + inner * 1.0
    na = np.clip(na, 0, 1)
    safe = np.maximum(na, 1e-3)[..., None]
    un = np.clip((rgb - (1 - na[..., None]) * 255) / safe, 0, 255)
    out = np.dstack([np.where(band[..., None], un, rgb), na * 255]).astype('uint8')
    o = Image.fromarray(out, 'RGBA')
    bb = o.getbbox()
    return o.crop(bb) if bb else o


def floor_shadow(o, low=0.25, sat=24, lum=150):
    """Ours, after `cleancut` (not in the prototype), only for a figure painted standing on a floor shadow (ウニ丸, シャリー;
    never a pale figure such as イカ, whose tentacles it would eat): the grey floor shadow
    is light and colourless, so `cleancut` keeps it whole and on a dark sky it reads as a white blob under the feet. In the
    bottom `low` of the picture, the light colourless pixels reached from the outside become what they were on the white
    paper: a shadow, un-mixed from white (black, alpha = how far from white), so on any background it stays a faint shadow."""
    a = np.asarray(o.convert('RGBA')).astype(np.float32)
    h = a.shape[0]
    rgb = a[..., :3]
    al = a[..., 3]
    s = rgb.max(2) - rgb.min(2)
    lu = rgb.mean(2)
    zone = np.zeros(al.shape, bool)
    zone[int(h * (1 - low)):] = True
    cand = zone & (s < sat) & (lu > lum) & (al > 0)
    # right under the feet the paper is a little warm: there a near-white with a touch of colour is the shadow too
    foot = np.zeros(al.shape, bool)
    foot[int(h * 0.85):] = True
    cand |= foot & (s < 45) & (lu > 212) & (al > 0)
    lab, _n = nd.label(cand | (al < 20))
    out_ids = set(np.unique(lab[al < 20])) - {0}
    sh = cand & np.isin(lab, list(out_ids))
    # its rim (the band `cleancut` un-mixed: a little warmer, a little darker) goes with it
    rim = zone & nd.binary_dilation(sh, iterations=4) & (((s < 48) & (lu > 110)) | (al < 200)) & ~sh
    sh |= rim
    na = np.clip(1 - lu / 255.0, 0, 1) * (al / 255.0)
    a[..., 3] = np.where(sh, na * 255, al)
    for c in range(3):
        a[..., c] = np.where(sh, 0, rgb[..., c])
    r = Image.fromarray(a.astype('uint8'), 'RGBA')
    bb = r.getbbox()
    return r.crop(bb) if bb else r
