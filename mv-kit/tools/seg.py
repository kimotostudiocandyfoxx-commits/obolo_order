# Figure masks (matting model, rembg): python3 seg.py <project-dir> [img ...]   (default: every scene with "layers")
# -> <project>/layers/raw/<img>-birefnet-general.png
import sys, os, glob, time
from rembg import new_session, remove
from PIL import Image
import json
PRJ = os.path.abspath(sys.argv[1])
PJ = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))
LAYERED = sorted({s['img'] for s in PJ['scenes'] if s.get('layers')})
def art(img): return next(os.path.join(PRJ, 'art', img + e) for e in ('.jpg', '.jpeg', '.png', '.webp') if os.path.exists(os.path.join(PRJ, 'art', img + e)))
model = os.environ.get('MODEL', 'birefnet-general'); nums = sys.argv[2:] or LAYERED
sess = new_session(model)
os.makedirs(f'{PRJ}/layers/raw', exist_ok=True)
for n in nums:
    f = art(n)
    t = time.time()
    m = remove(Image.open(f).convert('RGB'), session=sess, only_mask=True)
    m.save(f'{PRJ}/layers/raw/{n}-{model}.png'); print(n, model, round(time.time() - t, 1), flush=True)
