"""Shared chroma keying for every character cut-out (cut-out review, 2026-11-23).

One matte for all the scripts that take a character off a flat painted background (scripts/talk-assets,
scripts/kimorin, scripts/ui-art, scripts/cutout*.py, scripts/story) — the API mirrors it in
apps/api/src/media/keying.ts for the live looks and {bati}.

Why: the old keys were per-script RGB thresholds against green / grey / white. When the background was close to a
colour of the character (grey shading on a grey key, a white mask on white, a green leaf on green) the edge kept a
fringe of the key, parts of the character were eaten, and small bits of background stayed. Now:

  * the key colour is chosen per character (choose_key): of a few flat candidates (#00FF00, #0000FF, #FF00FF,
    cyan, orange, yellow), the one whose distance in OKLab to every colour the character uses is largest; the
    choice is kept in scripts/lib/key-colours.json so later paintings reuse it;
  * the matte (cut) measures each pixel's OKLab distance to the background colour measured on the picture's
    border, with a soft band between "background" and "character" set from the border's own noise; in that band
    alpha is found by unmixing the pixel between the key and the nearby character colour (not by a fixed ramp);
  * the key is taken out of half-covered edge pixels (un-premultiply) and the key's hue is pulled out of the
    character's outer few pixels (despill, in OKLab: only the part of the colour pointing toward the key);
  * clean-up: the largest figure and anything sizeable beside it stay, small specks of background go; holes inside
    the figure are filled unless they really are the key seen through a gap (between an arm and the body);
  * a light erosion and feather of the edge.

audit() measures a finished cut-out the same way (fringe of the key on the edge, half-transparent pixels inside the
figure, opaque key colour left, small islands, pin holes) so the review can rank them.

Only numpy, OpenCV and Pillow (the same as scripts/kimorin/build.py).
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np

# the flat candidates a painting can be keyed on (pure, so the painter reproduces them well)
CANDIDATES = {
    'green': (0, 255, 0),
    'blue': (0, 0, 255),
    'magenta': (255, 0, 255),
    'cyan': (0, 255, 255),
    'orange': (255, 128, 0),
    'yellow': (255, 255, 0),
}
# how the prompts name them
KEY_WORDS = {
    'green': 'pure chroma-key green (#00FF00)',
    'blue': 'pure chroma-key blue (#0000FF)',
    'magenta': 'pure magenta (#FF00FF)',
    'cyan': 'pure cyan (#00FFFF)',
    'orange': 'pure orange (#FF8000)',
    'yellow': 'pure yellow (#FFFF00)',
}
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'key-colours.json')
# a character whose nearest colour is closer than this (OKLab) to the key keys badly (the matte reaches full
# opacity at ~0.13): choose another key
MIN_CLEARANCE = 0.15


# --- colour ---------------------------------------------------------------------------------------------------------

_M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]], np.float32)
_M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]], np.float32)
_M2i = np.linalg.inv(_M2).astype(np.float32)
_M1i = np.linalg.inv(_M1).astype(np.float32)


def oklab(rgb) -> np.ndarray:
    """sRGB 0..255 (any shape …×3) → OKLab (L 0..1)"""
    c = np.asarray(rgb, np.float32) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    lms = np.cbrt(lin @ _M1.T)
    return lms @ _M2.T


def srgb(lab) -> np.ndarray:
    """OKLab → sRGB 0..255 (float, clipped)"""
    lms = np.asarray(lab, np.float32) @ _M2i.T
    lin = np.clip((lms ** 3) @ _M1i.T, 0, 1)
    c = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.clip(c * 255.0, 0, 255)


def hex_of(rgb) -> str:
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in rgb)


def rgb_of(hex_or_name) -> tuple[int, int, int]:
    if isinstance(hex_or_name, (tuple, list, np.ndarray)):
        return tuple(int(v) for v in hex_or_name)
    s = str(hex_or_name)
    if s in CANDIDATES:
        return CANDIDATES[s]
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def border_colour(rgb: np.ndarray, band: int = 6) -> np.ndarray:
    """the flat background colour, measured on the picture's border (paintings drift a little from the asked hex)"""
    a = np.asarray(rgb, np.float32)
    b = np.concatenate([a[:band].reshape(-1, 3), a[-band:].reshape(-1, 3), a[:, :band].reshape(-1, 3), a[:, -band:].reshape(-1, 3)])
    return np.median(b, axis=0)


# --- the key colour -------------------------------------------------------------------------------------------------

def subject_lab(rgb: np.ndarray, alpha: np.ndarray, max_px: int = 250_000) -> np.ndarray:
    """the OKLab colours of the character's solid pixels (alpha high, 2 px in from the edge: no fringe)"""
    solid = (np.asarray(alpha, np.float32) > 0.9).astype(np.uint8)
    solid = cv2.erode(solid, np.ones((5, 5), np.uint8))
    px = np.asarray(rgb, np.float32)[solid > 0]
    if len(px) > max_px:
        px = px[np.random.default_rng(0).choice(len(px), max_px, replace=False)]
    return oklab(px)


def clearance(lab_px: np.ndarray, key, q: float = 0.1) -> float:
    """how far the character's colours are from `key`: the q-th percentile (0.1 = the nearest 0.1 % of its pixels,
    so a few JPEG specks do not count) of the OKLab distance"""
    if not len(lab_px):
        return 1.0
    d = np.linalg.norm(lab_px - oklab(np.array(rgb_of(key), np.float32)), axis=1)
    return float(np.percentile(d, q))


def rank_keys(lab_px: np.ndarray, candidates=None) -> list[tuple[str, float, float]]:
    """[(name, clearance, share of pixels nearer than MIN_CLEARANCE)] best first"""
    cand = candidates or CANDIDATES
    out = []
    for name, rgb in cand.items():
        d = np.linalg.norm(lab_px - oklab(np.array(rgb, np.float32)), axis=1) if len(lab_px) else np.ones(1)
        out.append((name, float(np.percentile(d, 0.1)), float((d < MIN_CLEARANCE).mean())))
    return sorted(out, key=lambda t: (-t[1], t[2]))


def choose_key(rgb: np.ndarray, alpha: np.ndarray, candidates=None) -> tuple[str, tuple[int, int, int], list]:
    """the candidate farthest from every colour of the character (rgb + its alpha: a cut-out or a matte)"""
    ranked = rank_keys(subject_lab(rgb, alpha), candidates)
    name = ranked[0][0]
    return name, (candidates or CANDIDATES)[name], ranked


def load_manifest() -> dict:
    try:
        with open(MANIFEST) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def key_for(character: str, default: str = 'green') -> tuple[str, tuple[int, int, int]]:
    """the key colour kept for a character (scripts/lib/key-colours.json), else `default`"""
    e = load_manifest().get('characters', {}).get(character)
    name = e['key'] if e else default
    return name, CANDIDATES[name]


def key_prompt(character_or_key: str) -> str:
    """the words a prompt uses for the background of a character's painting"""
    name = character_or_key if character_or_key in CANDIDATES else key_for(character_or_key)[0]
    return (f'Background: a completely flat, solid, {KEY_WORDS[name]} everywhere around the character — one single even colour, '
            'no gradient, no floor, no shadow, no light spill on the character, no other objects. '
            f'Nothing on the character is that colour.')


def replace_bg_prompt(key: str) -> str:
    """an image edit that changes only the background (the character stays pixel for pixel)"""
    return (f'Edit the picture: replace only the background with a completely flat, solid {KEY_WORDS[key]} — one single even colour '
            'everywhere around the character, also in the gaps between the arms, legs, hair and tail; no gradient, no shadow, no floor. '
            'Keep the character exactly the same, pixel for pixel: the same pose, size, position, outline, colours, light and details. '
            'Nothing else changes. No text, no letters.')


# --- the matte ------------------------------------------------------------------------------------------------------

def _masked_blur(rgb: np.ndarray, mask: np.ndarray, sigma: float) -> tuple[np.ndarray, np.ndarray]:
    m = mask.astype(np.float32)
    w = cv2.GaussianBlur(m, (0, 0), sigma)
    s = cv2.GaussianBlur(rgb * m[..., None], (0, 0), sigma)
    return s / np.maximum(w, 1e-6)[..., None], w


def _dist_to(mask: np.ndarray) -> np.ndarray:
    """pixels' distance (px) to the nearest pixel of `mask`"""
    return cv2.distanceTransform((~mask).astype(np.uint8), cv2.DIST_L2, 3)


def _channels(K) -> tuple[list[int], list[int]] | None:
    """a saturated key's own channels (high) and the others (low): green → [1], [0, 2]; magenta → [0, 2], [1];
    None for a colourless or muddy key (grey, white), which has no channel-difference keyer"""
    K = np.asarray(K, np.float32)
    hi = [c for c in range(3) if K[c] >= 0.6 * K.max()]
    lo = [c for c in range(3) if c not in hi]
    if not lo or K[hi].min() - K[lo].max() < 60:
        return None
    return hi, lo


def keyness(a: np.ndarray, hi, lo) -> np.ndarray:
    """how much of the key's own channels a pixel has over the others (green: g − max(r, b))"""
    return a[..., hi].min(axis=-1) - a[..., lo].max(axis=-1)


def cut(rgb: np.ndarray, key=None, *, erode: int = 1, feather: float = 0.6, despill_px: float = 3.0,
        fill_holes: bool = True, islands: float = 0.0015, min_island: int = 60, shadows: bool = True,
        soft: float = 0.10) -> tuple[np.ndarray, dict]:
    """
    Cut a character off a flat background. rgb: H×W×3 (0..255). key: the background colour asked for (name, hex or
    rgb) — the colour actually used is the border's median (a painting drifts a little), `key` only checks it.
    Returns (RGBA uint8 with straight alpha, info).
      erode      px taken off the edge before the feather (1 = half a pixel, 2 = one pixel)
      islands    pieces smaller than this share of the figure go (tears / sweat drops bigger than it stay)
      shadows    pixels of the key's own hue, only darker (a floor shadow the painter left), are background too
      soft       width (OKLab) of the band between background and character
    """
    a = np.asarray(rgb, np.float32)[..., :3]
    h, w = a.shape[:2]
    K = border_colour(a)
    if key is not None:
        # the border is not flat (the figure fills the frame): trust the asked colour; a flat border is what the
        # painter really used, even when it is not the colour asked for
        bl = oklab(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)]))
        if np.percentile(np.linalg.norm(bl - oklab(K), axis=1), 75) > 0.06:
            K = np.array(rgb_of(key), np.float32)
    lab = oklab(a)
    kl = oklab(K)
    d = np.linalg.norm(lab - kl, axis=2)
    band = np.zeros((h, w), bool)
    band[:6], band[-6:], band[:, :6], band[:, -6:] = True, True, True, True
    noise = float(np.percentile(d[band], 98))
    t_bg = float(np.clip(noise * 1.4 + 0.012, 0.03, 0.12))
    t_fg = t_bg + soft
    # texture: the painted background is flat; shading on the character near the key's colour is not (grey shading
    # on a grey key) — only flat pixels near the key are background
    m1 = cv2.blur(d, (5, 5))
    tex = np.sqrt(np.maximum(cv2.blur(d * d, (5, 5)) - m1 * m1, 0))
    t_tex = float(max(np.percentile(tex[band], 98) * 1.6, 0.006))
    bg = (d < t_bg) & (tex < t_tex)
    # a saturated key drifts across a painting (lit unevenly): what is clearly of the key's own channels is background
    # too, however far from the border's colour (the character has none of it — the key was chosen so)
    ch0 = _channels(K)
    if ch0 is not None:
        bg |= keyness(a, *ch0) >= 0.75 * float(keyness(K[None, None, :], *ch0)[0, 0])
    # the key's hue, only darker: a shadow on the floor (never for a colourless key: grey shading is the character)
    kc = float(np.hypot(kl[1], kl[2]))
    if shadows and kc > 0.08:
        hue = np.arctan2(lab[..., 2], lab[..., 1])
        dh = np.abs((hue - np.arctan2(kl[2], kl[1]) + np.pi) % (2 * np.pi) - np.pi)
        chroma = np.hypot(lab[..., 1], lab[..., 2])
        # same hue, the chroma shrinking with the lightness as a shade of the key does
        shade = (dh < 0.12) & (lab[..., 0] < kl[0] + 0.02) & (np.abs(chroma / max(kc, 1e-3) - lab[..., 0] / max(kl[0], 1e-3)) < 0.18) & (chroma > 0.04)
        # only next to the background, connected to it
        n, lb = cv2.connectedComponents((shade | bg).astype(np.uint8), connectivity=4)
        touch = np.unique(lb[bg])
        bg = bg | (np.isin(lb, touch[touch > 0]) & shade)
    core = ~bg
    # islands: the figure and what is sizeable stays; specks of background go
    n, lb, st, _ = cv2.connectedComponentsWithStats(core.astype(np.uint8), connectivity=8)
    removed = 0
    if n > 1:
        areas = st[1:, cv2.CC_STAT_AREA]
        big = areas.max()
        keep = np.zeros(n, bool)
        keep[1:] = areas >= max(min_island, big * islands)
        removed = int((~keep[1:]).sum())
        core = keep[lb]
    # holes inside the figure: filled, unless they are clearly the key seen through a gap
    filled = gaps = 0
    if fill_holes:
        n, lb, st, _ = cv2.connectedComponentsWithStats((~core).astype(np.uint8), connectivity=4)
        edge_labels = set(np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]])).tolist())
        # 'clearly the key': as close to it as the border's own noise (an eaten part of the figure is near the key,
        # not on it)
        clear = bg & ((d < max(noise * 1.15, 0.7 * t_bg)) | (d >= t_bg))  # (the latter: a shade of the key)
        for j in range(1, n):
            if j in edge_labels:
                continue
            m = lb[st[j, 1]:st[j, 1] + st[j, 3], st[j, 0]:st[j, 0] + st[j, 2]] == j
            area = st[j, cv2.CC_STAT_AREA]
            n_clear = clear[st[j, 1]:st[j, 1] + st[j, 3], st[j, 0]:st[j, 0] + st[j, 2]][m].sum()
            # a gap: a fair part of it is the key itself (a small gap is mostly its own mixed edge)
            if area >= 6 and n_clear >= max(3, 0.25 * area):
                gaps += 1
                continue
            core[st[j, 1]:st[j, 1] + st[j, 3], st[j, 0]:st[j, 0] + st[j, 2]][m] = True
            filled += 1
    # alpha: solid inside, unmixed in the band where the figure meets the background
    sure = core & (d >= t_fg)
    ref, wgt = _masked_blur(a, cv2.erode(sure.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0, 2.5)
    ref2, wgt2 = _masked_blur(a, sure, 7.0)
    ref = np.where((wgt > 0.02)[..., None], ref, ref2)
    v = ref - K
    vv = (v * v).sum(axis=2)
    au = ((a - K) * v).sum(axis=2) / np.maximum(vv, 1.0)
    ad = (d - t_bg) / max(t_fg - t_bg, 1e-3)
    # unmixing against one nearby colour under-rates a dark outline between a light colour and the key: the least
    # coverage that keeps the un-mixed colour inside the RGB cube is the floor (never an over-estimate)
    lo = np.where(a < K, (K - a) / np.maximum(K, 1.0), (a - K) / np.maximum(255.0 - K, 1.0)).max(axis=2)
    soft_a = np.clip(np.where(vv > 60.0 ** 2, np.maximum(au, lo), np.maximum(ad, lo)), 0, 1)
    # a saturated key (green, blue, magenta …) has a better measure: the classic channel difference (green:
    # g − max(r, b)), robust on white, grey and dark outlines alike — used in the edge band when the character itself
    # has none of it (true for a key chosen far from its colours)
    ch = _channels(K)
    if ch is not None:
        kn = keyness(a, *ch)
        kk = float(keyness(K[None, None, :], *ch)[0, 0])
        sure_kn = keyness(np.clip(ref, 0, 255), *ch)
        # the keyness mixes linearly between the key's and the nearby character colour's (≤ 0): coverage from that
        kke = kk * 0.92  # (the key's noise counts as key)
        ka = np.clip((kke - kn) / np.maximum(kke - np.minimum(sure_kn, 0), 1.0), 0, 1)
        soft_a = np.where(sure_kn < 10, ka, soft_a).astype(np.float32)
    to_bg = _dist_to(~core)  # distance of a figure pixel to the background
    to_fg = _dist_to(core)
    near = (core & (to_bg <= 3)) | (~core & (to_fg <= 2))
    al = np.where(core, 1.0, 0.0).astype(np.float32)
    al = np.where(near, soft_a, al)
    # a pixel deep in the figure stays solid (a filled hole, a colour near the key inside); a background pixel
    # far from it stays clear
    al = np.where(core & (to_bg > 3), 1.0, al)
    al = np.where(~core & (to_fg > 2), 0.0, al).astype(np.float32)
    # colour: the key un-mixed from half-covered pixels; at the very edge the character's own nearby colour
    k = np.maximum(al, 0.05)[..., None]
    un = np.clip((a - (1 - k) * K) / k, 0, 255)
    if ch is None:
        # unmixing by the distance is unsure at the very edge: the character's own nearby colour there
        t = np.clip(al / 0.35, 0, 1)[..., None]
        un = un * t + np.clip(ref, 0, 255) * (1 - t)
    # (also the clear pixels just outside: the feather below can give them a little alpha)
    part = (al < 0.999)[..., None]
    out = np.where(part, un, a)
    # despill: the key's hue taken out of the outer few pixels, only what the character itself has not got
    if despill_px > 0 and ch is not None:
        # the classic clamp: the key's channels not above the others (only where the character has none of the key),
        # and never pushed below them either (an over-unmixed edge turns the opposite colour: a lilac rim on green)
        hi, lo_ = ch
        edge = (to_bg <= despill_px + 1) & (core | near) & (keyness(np.clip(ref, 0, 255), hi, lo_) < 10)
        top = out[..., lo_].max(axis=-1)
        bot = out[..., lo_].min(axis=-1)
        for c in hi:
            v = np.minimum(out[..., c], top + 4)
            v = np.maximum(v, bot * 0.94)
            out[..., c] = np.where(edge, v, out[..., c])
    elif despill_px > 0 and kc > 0.03:
        edge = (to_bg <= despill_px) & (core | near)
        if edge.any():
            khat = kl[1:] / kc
            L = oklab(out[edge])
            R = oklab(np.clip(ref[edge], 0, 255))
            p = L[:, 1:] @ khat
            pr = np.maximum(R[:, 1:] @ khat, 0)
            ex = np.clip(p - pr, 0, None)
            L[:, 1:] -= ex[:, None] * khat[None, :]
            # a key brighter than the character also lifts the edge's lightness: back toward the character's
            L[:, 0] = np.where(ex > 0.02, L[:, 0] * 0.6 + R[:, 0] * 0.4, L[:, 0])
            out[edge] = srgb(L)
    # the edge: a touch tighter, then feathered
    if erode > 0:
        al = cv2.erode(al, np.ones((erode + 1, erode + 1), np.uint8))
    if feather > 0:
        al = np.minimum(cv2.GaussianBlur(al, (0, 0), feather), np.where(core | near, 1.0, 0.0).astype(np.float32))
    al[al < 0.03] = 0
    al[al > 0.97] = 1
    rgba = np.dstack([np.clip(out, 0, 255), al * 255]).round().astype(np.uint8)
    info = {'key': hex_of(K), 't_bg': round(t_bg, 3), 't_tex': round(t_tex, 4), 't_fg': round(t_fg, 3), 'islands_removed': removed,
            'holes_filled': filled, 'gaps_kept': gaps}
    info['clearance'] = round(clearance(subject_lab(a, al), K), 3)
    return rgba, info


def cut_file(path: str, key=None, **kw):
    """cut() on a picture file → (Pillow RGBA image, info)"""
    from PIL import Image
    rgb = np.asarray(Image.open(path).convert('RGB'))
    rgba, info = cut(rgb, key, **kw)
    return Image.fromarray(rgba, 'RGBA'), info


def trim_box(alpha: np.ndarray, thr: int = 10, pad: int = 0):
    ys, xs = np.where(np.asarray(alpha) > thr)
    if not len(xs):
        return None
    h, w = alpha.shape[:2]
    return max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + 1 + pad), min(h, ys.max() + 1 + pad)


# --- the review -----------------------------------------------------------------------------------------------------

def audit(rgba: np.ndarray, key=None) -> dict:
    """
    How clean a cut-out is (rgba uint8). key: the background it was cut from (name / hex / rgb), or None (then only
    the key-independent numbers).
      fringe     share of the visible edge pixels pulled toward the key (compared with the character just inside)
      fringe_de  mean OKLab difference between the edge and the character just inside (any halo, any key)
      semi       share of the figure that is half transparent away from its outline (parts eaten)
      keyleft    share of the figure that is opaque and of the key's colour (background left inside)
      islands    opaque pieces apart from the main figure (and the small ones among them)
      pinholes   small transparent holes inside the figure
    """
    a = np.asarray(rgba)
    rgb = a[..., :3].astype(np.float32)
    al = a[..., 3].astype(np.float32) / 255
    fig = al > 0.5
    area = max(1, int(fig.sum()))
    r = {}
    # islands
    n, lb, st, _ = cv2.connectedComponentsWithStats(fig.astype(np.uint8), connectivity=8)
    if n > 1:
        areas = st[1:, cv2.CC_STAT_AREA]
        big = areas.max()
        r['islands'] = int(n - 2)
        r['small_islands'] = int(((areas < big * 0.01) & (areas >= 4)).sum())
    else:
        r['islands'] = r['small_islands'] = 0
    # holes (transparent, not reaching the border, enclosed by the figure)
    n, lb, st, _ = cv2.connectedComponentsWithStats((~fig).astype(np.uint8), connectivity=4)
    edge = set(np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]])).tolist())
    holes = [st[j, cv2.CC_STAT_AREA] for j in range(1, n) if j not in edge]
    r['pinholes'] = int(sum(1 for x in holes if x < max(30, area * 0.0002)))
    r['holes'] = len(holes)
    clear = al < 0.04
    to_clear = _dist_to(clear)
    # half transparent away from the outline (≥ 4 px in from fully clear pixels)
    semi = (al > 0.08) & (al < 0.9) & (to_clear >= 4)
    r['semi'] = round(float(semi.sum()) / area, 5)
    # the edge ring: visible pixels within 2 px of the clear area
    ring = (al > 0.15) & (to_clear <= 2.5)
    inner = (al > 0.98) & (to_clear >= 4)
    ref, wgt = _masked_blur(rgb, inner, 3.0)
    ref2, _ = _masked_blur(rgb, inner, 8.0)
    ref = np.where((wgt > 0.03)[..., None], ref, ref2)
    ok = ring & (wgt > 0.0005)
    lp, lr = oklab(rgb[ok]), oklab(np.clip(ref[ok], 0, 255))
    dd = np.linalg.norm(lp - lr, axis=1)
    r['fringe_de'] = round(float((dd * al[ok]).sum() / max(1e-6, al[ok].sum())), 4) if ok.any() else 0.0
    if key is not None:
        kl = oklab(np.array(rgb_of(key), np.float32))
        kp, kr = np.linalg.norm(lp - kl, axis=1), np.linalg.norm(lr - kl, axis=1)
        pulled = (kp < kr - 0.05) & (dd > 0.06)
        r['fringe'] = round(float((pulled * al[ok]).sum() / max(1e-6, al[ok].sum())), 4) if ok.any() else 0.0
        kd = np.linalg.norm(oklab(rgb) - kl, axis=2)
        r['keyleft'] = round(float(((al > 0.9) & (kd < 0.08)).sum()) / area, 5)
        r['clearance'] = round(clearance(subject_lab(rgb, al), key), 3)
    score = 4 * r['fringe_de'] + 30 * r['semi'] + 0.5 * min(r['small_islands'], 20) / 20 + 0.3 * min(r['pinholes'], 30) / 30
    if key is not None:
        score += 2 * r['fringe'] + 200 * r['keyleft']
    r['score'] = round(score, 4)
    return r


def composite(rgba: np.ndarray, colours=((0, 0, 0), (255, 255, 255), (128, 128, 128)), scale: int = 1, gap: int = 8) -> np.ndarray:
    """the cut-out over black, white and mid-grey side by side (straight alpha), scaled by `scale` (nearest)"""
    a = np.asarray(rgba).astype(np.float32)
    al = a[..., 3:4] / 255
    tiles = []
    for c in colours:
        t = a[..., :3] * al + np.array(c, np.float32) * (1 - al)
        tiles.append(t)
        tiles.append(np.full((a.shape[0], gap, 3), 60, np.float32))
    out = np.concatenate(tiles[:-1], axis=1).clip(0, 255).astype(np.uint8)
    if scale > 1:
        out = cv2.resize(out, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
    return out
