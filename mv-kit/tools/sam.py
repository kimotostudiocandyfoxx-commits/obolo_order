# SAM masks for parts the matting models miss (wings, halos): one SAM call per group of points.
# python3 sam.py <project-dir> [img ...]  -> <project>/layers/raw/<img>-sam<k>.png per group
# points: <project>/layers/sam_prompts.json  { "<img>": [ [ [[u,v], ...positive], [[u,v], ...negative] ], ... ] }
import sys, os, glob, json
import numpy as np
from rembg import new_session
from PIL import Image
import json
PRJ = os.path.abspath(sys.argv[1])
PJ = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))
LAYERED = sorted({s['img'] for s in PJ['scenes'] if s.get('layers')})
def art(img): return next(os.path.join(PRJ, 'art', img + e) for e in ('.jpg', '.jpeg', '.png', '.webp') if os.path.exists(os.path.join(PRJ, 'art', img + e)))
# groups: list of (positive points, negative points) in image coords 0..1
P = json.load(open(f'{PRJ}/layers/sam_prompts.json'))
nums = sys.argv[2:] or sorted(P)
sess = new_session('sam')
for n in nums:
    im = Image.open(art(n)).convert('RGB'); S = im.width
    acc = np.zeros((S, S), np.uint8)
    for gi, (pos, neg) in enumerate(P[n]):
        pr = [{'type': 'point', 'label': 1, 'data': [u * S, v * S]} for u, v in pos] + [{'type': 'point', 'label': 0, 'data': [u * S, v * S]} for u, v in neg]
        m = np.asarray(sess.predict(im, sam_prompt=pr)[0])
        Image.fromarray(m).save(f'{PRJ}/layers/raw/{n}-sam{gi}.png')
        acc = np.maximum(acc, m)
    Image.fromarray(acc).save(f'{PRJ}/layers/raw/{n}-sam.png'); print(n, 'sam groups', len(P[n]), flush=True)
