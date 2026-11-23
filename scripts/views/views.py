#!/usr/bin/env python3
"""
Angle views of the story cast (2026-11-23, "TV drama" shots for day 3+): for each character a back view (for
over-the-shoulder shots), a three-quarter view facing left and a side profile facing left — the right-facing ones are
the same pictures mirrored (CSS scaleX(-1)).

  python3 scripts/views/views.py paint [--only ID] [--view back|q3|side] [--try N]   # queue items for Story images
  python3 scripts/views/views.py build [--only ID]                                   # cut, align, manifest, sheets

paint: the character's current front picture (composited on its key colour) is the reference image, the prompt asks
for the same character from another angle on that flat key colour. paint only adds items view-<id>-<view>-v<try> to design/story-queue.json (reference:
design/story/refs/views/<id>-front.jpg); after a push the Story images workflow (docs/handoff/story-images.md) paints
them with Seedream 5.0 Pro and commits design/story/out/<item>-1.jpg.

build: each kept painting (KEEP below: id → view → try) is cut with scripts/lib/keying.py on the character's key,
scaled so the figure is as tall as in the front picture and placed on a canvas of the front picture's size with the
same foot line and horizontal centre, saved as webp with alpha next to the front picture (<stem>-back.webp,
-q3.webp, -side.webp), and described in apps/web/lib/story/views.json (sizes, foot line, head box) for the camera.
Contact sheets (front | 3/4 | side | back over grey) go to docs/review/views/.
"""
import argparse
import io
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'lib'))
import keying  # noqa: E402

PUB = os.path.join(ROOT, 'apps', 'web', 'public')
SHEETS = os.path.join(ROOT, 'docs', 'review', 'views')
MANIFEST = os.path.join(ROOT, 'apps', 'web', 'lib', 'story', 'views.json')
VIEWS = ('back', 'q3', 'side')
YEN_EACH = 7  # Seedream 5.0 Pro on Runware, about $0.045 a picture (scripts/story-images/generate.mjs)

# id (the sprite stem the stage uses) → what to paint. front: public path of the picture the view must match;
# key: the flat background (scripts/lib/key-colours.json where the cut-out review chose one, else chosen here with
# keying.choose_key: bossg magenta 0.325, mikie blue 0.252); head: the share of the figure's height, from its top, that
# is the head (for the head box); desc: the look in words, so the painter keeps it from behind.
CAST = {
    'kimorin-sun': dict(name='KIMORIN', front='onboarding/kimorin-sun.webp', key='magenta', head=0.40,
                        refs=['design/story/refs/talk-kimorin.jpg'],
                        notes={'back': 'From behind, the huge fan of many white, black and red-tipped feather tails spreads out wide on BOTH '
                                       'sides behind the robe, as wide as in the reference, symmetric; the hood and the two fox ears seen from '
                                       'the back; the small white bat wing sticks out on the left side of the picture.'},
                        desc='a small white fox-like mascot with big white-and-blue fox ears, wearing a dark red velvet hooded robe with '
                             'white lattice trim, a blue jewel brooch with blue tassels, round black sunglasses, white paws, white feet '
                             'with blue paw pads, a huge fan of white, black and red-tipped feather tails behind, and one small white bat wing'),
    'takoyaki-brother': dict(name='たこ焼きブラザー', front='onboarding/takoyaki-brother.webp', key='magenta', head=0.17,
                             desc='a huge muscular dark blue-grey creature whose head is a spiky takoyaki ball with a wide toothy grin and '
                                  'two long whiskers, wrapped in rusty chains, a ragged chain-mail skirt, chain shackles on wrists and ankles'),
    'takoyaki-sister': dict(name='たこ焼きシスター', front='onboarding/takoyaki-sister.webp', key='magenta', head=0.15,
                            desc='a tall thin figure whose head is a pale cracked takoyaki ball with a small smile and long pale blue '
                                 'jellyfish-like strands for hair, wearing a long dark purple gown with fine gold geometric patterns and a '
                                 'frayed hem that trails on the ground'),
    'unchi-pinpon': dict(name='うんちピンポンくん', front='onboarding/unchi-pinpon.webp', key='blue', head=1.0,
                         desc='a cute glossy caramel-brown swirl-shaped mascot (soft-serve / spiral shell shape) with golden stars and a '
                              'heart on it, big shiny brown eyes, pink cheeks and a small smile, no arms, no legs'),
    'kaiser1': dict(name='大根カイザー', front='onboarding/kaiser1-x-talk.webp', stem='kaiser1', key='blue', head=0.35,
                    desc='a stern giant white daikon radish with a grumpy wrinkled face, glowing orange eyes, a long white beard of '
                         'roots, green leaves on top and a mass of long tangled white roots for legs'),
    'freezy': dict(name='フリージー', front='onboarding/freezy.webp', key='blue', head=0.45,
                   desc='a tall upright wooden coffin-shaped body with three yellow eyes and a black moustache, wild black fur all around, '
                        'a dark purple robe with a rope belt, grey clawed hands and feet, holding a small white hand fan, purple smoke wisps'),
    'hipokin': dict(name='ヒポキン', front='onboarding/hipokin.webp', key='magenta', head=0.20,
                    desc='a big grey hippo gentleman with glowing blue eyes, a black three-piece suit with gold paisley embroidery, a dark '
                         'red tie, a gold pocket watch chain, black leather shoes'),
    'bossg': dict(name='ボスG', front='onboarding/bossg.webp', key='magenta', head=0.20,
                  desc='a huge black gorilla boss with a gold cigar, heavy gold chains and a big gold medallion "5454", black leather '
                       'shorts, black-and-gold mechanical cyber arms with glowing cyan lights',
                  notes={'back': 'From behind: the gold chains go around the back of the neck only, the medallion hangs on the chest and is '
                                 'NOT visible from behind; both mechanical arms keep their black-and-gold plates and glowing cyan lights, '
                                 'seen from the back.'}),
    'mikie': dict(name='MIKIE⭐︎DRILL', front='onboarding/mikie.webp', key='blue', head=0.30,
                  desc='a small smiling woman with a black bob haircut and round black sunglasses, a loose hot-pink blouse, a colourful '
                       'flower-print skirt, beige flat shoes; her right arm is a silver hook and her left arm is a golden-silver gatling gun'),
    'monban': dict(name='MONBAN', front='onboarding/monban.webp', key='magenta', head=0.22, views=('back',),
                   desc='a tall hooded figure in a long black robe with fine gold patterns, face hidden in the dark hood'),
    'talk-user': dict(name='{neo}', front='talk/user/stand.webp', key='blue', head=0.30, views=('back',),
                      desc='a black-and-white cartoon boy with black hair, round black glasses, a white T-shirt, a black open jacket, black '
                           'trousers, white cartoon gloves and black shoes'),
    'talk-friend': dict(name='friend', front='talk/friend/stand.webp', key='blue', head=0.18, views=('back',),
                        desc='a muscular young man with wavy blond hair, bare chest, a cream cloth wrapped around the waist, barefoot'),
    'talk-bati': dict(name='バティ', front='talk/bati/stand.webp', key='blue', head=1.0, size=(1536, 1152), views=('back',),
                      desc='a round fluffy sea-urchin creature: a dark purple body covered in long golden-orange spikes, orange roe on top, '
                           'big sparkling eyes, pink cheeks and a happy open mouth, two small purple arms'),
}
# user decision 2026-11-23: a user's look, a friend (another user's look) and a Bati get ONLY a back view besides the front
# (the talk-* entries above); the story cast keeps back, 3/4 and side
# OBOLON is a black sphere: its views are the front picture itself (mirror for the other side)
SPHERES = {'obolon': dict(name='OBOLON', front='onboarding/obolon.webp', head=1.0)}

# which painting was kept per view (after looking at each next to the front picture); missing = rejected / not painted
KEEP: dict[str, dict[str, int]] = {}
KEEP_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keep.json')
if os.path.exists(KEEP_FILE):
    KEEP = json.load(open(KEEP_FILE))

ANGLE = {
    'back': ('seen exactly from behind (back view, rear view): we see the back of the head and the back of the body and outfit; '
             'the face is NOT visible at all, no eyes, no mouth'),
    'q3': ('in a three-quarter view: body and head turned about 45 degrees toward the LEFT side of the picture, so the character looks '
           'toward the left edge; we see the face and the front at an angle, and a little of the right side of the body'),
    'side': ('in a strict side profile: turned 90 degrees, facing the LEFT side of the picture; we see exactly one side of the head '
             'and body in profile, nose and toes pointing left'),
}


def prompt_of(c: dict, view: str) -> str:
    return (f'The same character as in the reference picture — {c["desc"]} — drawn {ANGLE[view]}. '
            'Full body from the top of the head to the feet, standing upright, neutral relaxed pose, the whole character inside the '
            'frame with a small margin, the same size in the frame as the reference. '
            'Exactly the same design: the same outfit, the same colours, the same materials and details, the same proportions and the '
            'same art style and rendering as the reference picture. Do not add or remove anything. One character only, no extra limbs. '
            f'{c.get("notes", {}).get(view, "")} {keying.key_prompt(c["key"])} No text, no letters.')


def ref_png(c: dict, size: tuple[int, int]) -> bytes:
    """the front picture on its key colour, padded to the painting's aspect"""
    im = Image.open(os.path.join(PUB, c['front'])).convert('RGBA')
    W, H = size
    s = min(W * 0.86 / im.width, H * 0.92 / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    bg = Image.new('RGBA', (W, H), keying.CANDIDATES[c['key']] + (255,))
    bg.alpha_composite(im, ((W - im.width) // 2, (H - im.height) // 2))
    out = io.BytesIO()
    bg.convert('RGB').save(out, 'PNG')
    return out.getvalue()


REFS = os.path.join(ROOT, 'design', 'story', 'refs', 'views')
QUEUE = os.path.join(ROOT, 'design', 'story-queue.json')
OUT = os.path.join(ROOT, 'design', 'story', 'out')


def item_id(cid: str, view: str, k: int) -> str:
    return f'view-{cid}-{view}-v{k}'


def raw_of(cid: str, view: str, k: int) -> str:
    """the painting the Story images workflow saved for that queue item"""
    return os.path.join(OUT, f'{item_id(cid, view, k)}-1.jpg')


def cmd_paint(a):
    """write queue items for the Story images workflow (docs/handoff/story-images.md): it paints them with Seedream
    5.0 Pro and commits design/story/out/<id>-1.jpg. The reference is the front picture on its key colour
    (design/story/refs/views/<id>-front.jpg). Read-modify-write: other agents add items too."""
    os.makedirs(REFS, exist_ok=True)
    new = []
    order = {'back': 0, 'q3': 1, 'side': 2}  # the workflow paints at most 16 a run, in queue order: backs first
    for v in sorted(VIEWS, key=order.get):
        if a.view and v not in a.view.split(','):
            continue
        for cid, c in CAST.items():
            if a.only and cid not in a.only.split(','):
                continue
            if v not in c.get('views', VIEWS):
                continue
            size = c.get('size', (1152, 1536))
            ref = os.path.join(REFS, f'{cid}-front.jpg')
            if not os.path.exists(ref):
                Image.open(io.BytesIO(ref_png(c, size))).save(ref, 'JPEG', quality=92)
            refs = [os.path.relpath(ref, ROOT)] + c.get('refs', [])
            new.append({'id': item_id(cid, v, a.try_), 'size': f'{size[0]}x{size[1]}', 'refs': refs, 'prompt': prompt_of(c, v)})
    q = json.load(open(QUEUE))
    have = {it.get('id') for it in q.get('items', [])}
    add = [it for it in new if it['id'] not in have]
    q.setdefault('items', []).extend(add)
    with open(QUEUE, 'w') as f:
        json.dump(q, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'queued {len(add)} items (about {len(add) * YEN_EACH} yen)')


# --- build -------------------------------------------------------------------------------------------------------------

def stem_paths(c: dict, view: str) -> tuple[str, str]:
    front = c['front']
    base, _ = os.path.splitext(front)
    if c.get('stem'):
        base = f'{os.path.dirname(front)}/{c["stem"]}'  # kaiser1's front is a pose (kaiser1-x-talk): its views are kaiser1-*
    if front.startswith('talk/'):
        rel = f'{os.path.dirname(front)}/{view}.webp'  # talk/user/back.webp
    else:
        rel = f'{base}-{view}.webp'  # onboarding/kimorin-sun-back.webp
    return rel, os.path.join(PUB, rel)


def metrics(alpha: np.ndarray, head_frac: float) -> dict:
    x0, y0, x1, y1 = keying.trim_box(alpha, thr=40)
    hb = y0 + max(1, round((y1 - y0) * head_frac))
    band = alpha[y0:hb] > 40
    xs = np.where(band.any(axis=0))[0]
    return {'box': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)], 'foot': int(y1),
            'head': [int(xs.min()), int(y0), int(xs.max() + 1 - xs.min()), int(hb - y0)]}


def place(rgba: np.ndarray, front_alpha: np.ndarray, front_size: tuple[int, int]) -> Image.Image:
    """scale the cut-out so the figure is as tall as in the front picture, same foot line, same centre"""
    fx0, fy0, fx1, fy1 = keying.trim_box(front_alpha, thr=40)
    x0, y0, x1, y1 = keying.trim_box(rgba[:, :, 3], thr=40)
    fig = Image.fromarray(rgba, 'RGBA').crop((x0, y0, x1, y1))
    s = (fy1 - fy0) / (y1 - y0)
    fig = fig.resize((max(1, round(fig.width * s)), fy1 - fy0), Image.LANCZOS)
    W, H = front_size
    cx = (fx0 + fx1) / 2
    left = round(cx - fig.width / 2)
    pad = max(0, -left, left + fig.width - W)  # a wider pose (a side view's tail) widens the canvas evenly
    canvas = Image.new('RGBA', (W + 2 * pad, H), (0, 0, 0, 0))
    canvas.alpha_composite(fig, (left + pad, fy0))
    return canvas


def quantised_png(im: Image.Image, path: str):
    im.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)


def cmd_build(a):
    out = {'note': ('Angle views of the story cast (scripts/views/views.py). Per character: the front picture and each view that '
                    'exists. All pictures of a character share the front picture\'s scale and foot line: the view canvas has the '
                    'front\'s height and foot y; its width is the front\'s plus padX on each side (0 unless a pose is wider), the '
                    'figure centred on the front figure\'s centre. q3 and side face LEFT; mirror (scaleX(-1)) for right. back is seen '
                    'from behind (no face). Boxes are [x, y, w, h] in the picture\'s own pixels; foot = the lowest solid row. '
                    'Users\' looks, friends (other users\' looks) and Bati get ONLY a back view besides the front (user decision '
                    '2026-11-23; talk-user / talk-friend / talk-bati here): the production plan is to paint just the back view for each '
                    'look and Bati at creation, about 1/3 of the earlier three-view estimate.'),
           'views': ['q3', 'side', 'back'], 'faces': 'left', 'characters': {}, 'speakers': {}}
    os.makedirs(SHEETS, exist_ok=True)
    for cid, c in {**CAST, **SPHERES}.items():
        if a.only and cid not in a.only.split(','):
            continue
        front = Image.open(os.path.join(PUB, c['front'])).convert('RGBA')
        fa = np.asarray(front)[:, :, 3]
        entry = {'name': c['name'], 'front': {'src': '/' + c['front'], 'w': front.width, 'h': front.height, **metrics(fa, c['head'])},
                 'views': {}}
        out['characters'][cid] = entry
        out['speakers'].setdefault(c['name'], cid)
        if cid in SPHERES:
            for v in ('q3', 'side', 'back'):
                entry['views'][v] = {'src': '/' + c['front'], 'same': 'front', 'w': front.width, 'h': front.height, 'padX': 0,
                                     **metrics(fa, c['head'])}
        for v in c.get('views', VIEWS) if cid in CAST else ():
            k = KEEP.get(cid, {}).get(v)
            if not k:
                continue
            flip = isinstance(k, str) and k.endswith('f')  # "1f": try 1, mirrored (a back view painted with the sides swapped)
            k = int(str(k).rstrip('f'))
            raw = raw_of(cid, v, k)
            img = Image.open(raw).convert('RGB')
            rgb = np.asarray(img.transpose(Image.FLIP_LEFT_RIGHT) if flip else img)
            rgba, _info = keying.cut(rgb, c['key'])
            im = place(rgba, fa, front.size)
            rel, path = stem_paths(c, v)
            im.save(path, 'WEBP', quality=88, method=6)
            al = np.asarray(im)[:, :, 3]
            entry['views'][v] = {'src': '/' + rel, 'w': im.width, 'h': im.height, 'padX': (im.width - front.width) // 2,
                                 **metrics(al, c['head']), 'try': k, **({'flipped': True} if flip else {})}
        if not any('try' in e for e in entry['views'].values()):
            continue  # nothing painted yet (or a sphere): no contact sheet
        # contact sheet: front | 3/4 | side | back, over grey
        H = 520
        tiles = [front] + [Image.open(os.path.join(PUB, entry['views'][v]['src'][1:])).convert('RGBA') if v in entry['views'] else None
                           for v in ('q3', 'side', 'back')]
        cells = []
        for t in tiles:
            cell = Image.new('RGBA', (420, H + 20), (128, 128, 128, 255))
            if t is not None:
                s = H / t.height
                t = t.resize((max(1, round(t.width * s)), H), Image.LANCZOS)
                if t.width > 420:
                    t = t.resize((420, round(t.height * 420 / t.width)), Image.LANCZOS)
                cell.alpha_composite(t, ((420 - t.width) // 2, 10 + H - t.height))
            else:
                cell = Image.new('RGBA', cell.size, (90, 90, 90, 255))
            cells.append(cell)
        sheet = Image.new('RGBA', (4 * 420 + 5 * 6, H + 32), (60, 60, 60, 255))
        for i, cell in enumerate(cells):
            sheet.alpha_composite(cell, (6 + i * 426, 6))
        quantised_png(sheet, os.path.join(SHEETS, f'{cid}.png'))
    if not a.only:
        with open(MANIFEST, 'w') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print('wrote', os.path.relpath(MANIFEST, ROOT))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('paint')
    p.add_argument('--only')
    p.add_argument('--view')
    p.add_argument('--try', dest='try_', type=int, default=1)
    b = sub.add_parser('build')
    b.add_argument('--only')
    a = ap.parse_args()
    {'paint': cmd_paint, 'build': cmd_build}[a.cmd](a)


if __name__ == '__main__':
    main()
