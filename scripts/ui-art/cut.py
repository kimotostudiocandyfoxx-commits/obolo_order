"""
The pictures of a queue painted on a flat background (items with "flat": true) also as <name>-cut.png: the background
taken away with the shared matte (scripts/lib/keying.py; its colour measured in the corners), the soft shadow under the
object too, the edge shaved by about 1.5 px (story chat 2026-11-02: the prototypes lay the parts over their own scenes).
  python3 scripts/ui-art/cut.py design/ui1-art-queue.json
"""
import json, os, sys
import numpy as np
import cv2
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

queue = json.load(open(sys.argv[1]))
out = os.path.normpath(os.path.join('apps/web/public', queue.get('dir', 'ui-art')))
made = 0
for it in queue['items']:
    if not it.get('flat'):
        continue
    src = os.path.join(out, it['id'] + '.jpg')
    dst = os.path.join(out, it['id'] + '-cut.png')
    if not os.path.exists(src) or (os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)):
        continue
    im = np.array(Image.open(src).convert('RGB')).astype(np.int16)
    h, w = im.shape[:2]
    c = 16
    corners = np.concatenate([im[:c, :c].reshape(-1, 3), im[:c, -c:].reshape(-1, 3), im[-c:, :c].reshape(-1, 3), im[-c:, -c:].reshape(-1, 3)])
    ref = np.median(corners, 0)
    dist = np.abs(im - ref).max(2)
    near = dist <= 26
    # the shadow on the floor: a little darker than the background, colourless, in the lower part
    chroma = im.max(2) - im.min(2)
    shade = (np.arange(h)[:, None] >= h * 0.55) & (chroma <= 24) & (im.mean(2) >= ref.mean() - 70) & (im.mean(2) <= ref.mean() + 10)
    n, lab = cv2.connectedComponents((near | shade).astype(np.uint8))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    shadow = np.isin(lab, list(border)) & shade & ~near
    # the object itself: the shared matte (scripts/lib/keying.py) — un-mixed, despilled edge, specks gone, the
    # background seen through gaps gone too; then the floor shadow taken off and the edge shaved a little more
    rgba, _ = keying.cut(im.astype(np.float32), ref, erode=2)
    alpha = rgba[..., 3].copy()
    alpha[shadow] = 0
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    im = rgba[..., :3].astype(np.int16)
    Image.fromarray(np.dstack([im.astype(np.uint8), alpha])).save(dst, optimize=True)
    made += 1
print('cut', made)
