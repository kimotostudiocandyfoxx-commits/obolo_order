#!/usr/bin/env python3
"""
The background of a character picture painted again on its key colour (cut-out review 2026-11-23): one Seedream 5.0
Pro edit on Runware ("replace only the background with flat solid #XXXXXX, keep the character pixel for pixel"), the
character's key from scripts/lib/key-colours.json. The result goes to design/cutouts/rebg/<name>-<key>.jpg (not
served); scripts/cutouts/merge.py takes only its alpha (and edge colours) back onto the original picture.

  SEEDREAM_API_KEY=… python3 scripts/cutouts/rebg.py <character> <picture> [<picture> …]

About $0.045 (~7 yen) a picture; at most 2 tries each (a try whose border is not flat on the key is retried once).
"""
import base64
import io
import json
import os
import sys
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

OUT = 'design/cutouts/rebg'
MODEL = os.environ.get('SEEDREAM_MODEL', 'bytedance:seedream@5.0-pro')
KEY = os.environ.get('SEEDREAM_API_KEY', 'set-by-proxy')


def size_for(w, h):
    """the painting size: the picture's aspect at about 1.8 MP (multiples of 64)"""
    s = (1152 * 1536 / (w * h)) ** 0.5
    return int(round(w * s / 64) * 64), int(round(h * s / 64) * 64)


def paint(path, key):
    im = Image.open(path).convert('RGB')
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=95)
    w, h = size_for(*im.size)
    body = [{
        'taskType': 'imageInference', 'taskUUID': str(uuid.uuid4()), 'model': MODEL,
        'positivePrompt': keying.replace_bg_prompt(key), 'width': w, 'height': h, 'numberResults': 1,
        'outputType': 'URL', 'outputFormat': 'PNG',
        'referenceImages': ['data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()],
    }]
    req = urllib.request.Request('https://api.runware.ai/v1', json.dumps(body).encode(),
                                 {'content-type': 'application/json', 'authorization': f'Bearer {KEY}'})
    j = json.load(urllib.request.urlopen(req, timeout=300))
    if j.get('errors'):
        raise RuntimeError(json.dumps(j['errors'])[:300])
    url = j['data'][0]['imageURL']
    data = urllib.request.urlopen(url, timeout=120).read()
    return Image.open(io.BytesIO(data)).convert('RGB').resize(im.size, Image.LANCZOS)


def flat_on(img, key):
    """the border is the key colour (within a little)"""
    a = np.asarray(img).astype(np.float32)
    b = keying.border_colour(a)
    return float(np.linalg.norm(keying.oklab(b) - keying.oklab(np.array(keying.CANDIDATES[key], np.float32)))) < 0.12


def one(args):
    character, path = args
    key = keying.key_for(character)[0]
    name = os.path.splitext(os.path.basename(path))[0]
    dst = f'{OUT}/{name}-{key}.jpg'
    if os.path.exists(dst):
        return f'= {dst}'
    for k in range(2):
        try:
            img = paint(path, key)
        except Exception as e:  # noqa: BLE001
            msg = f'! {name} try {k + 1}: {e}'
            print(msg, flush=True)
            continue
        if flat_on(img, key) or k == 1:
            img.save(dst, 'JPEG', quality=95)
            return f'+ {dst} (try {k + 1})'
    return f'x {name}'


def main():
    character, paths = sys.argv[1], sys.argv[2:]
    os.makedirs(OUT, exist_ok=True)
    with ThreadPoolExecutor(4) as ex:
        for line in ex.map(one, [(character, p) for p in paths]):
            print(line, flush=True)


if __name__ == '__main__':
    main()
