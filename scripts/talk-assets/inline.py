"""Make a self-contained copy of design/talk/proto.html with every picture embedded as a data: URI
(some viewers do not resolve the page's relative image paths). Writes design/talk/proto-inline.html."""
import base64, io, json, re
from PIL import Image

D = 'design/talk'
html = open(f'{D}/proto.html', encoding='utf-8').read()
names = set()
for who in ('user', 'bati', 'friend'):
    for f in ('stand', 'stand-talk', 'stand-blink', 'kororin'):
        names.add(f'{who}/{f}.webp')
    for face in ('smile', 'surprised', 'thinking', 'sad', 'shy'):
        for v in ('', '-talk', '-blink'):
            names.add(f'{who}/{face}-pose{v}.webp')
assets = {}
import os
for n in sorted(names):
    p = f'{D}/{n}'
    if not os.path.exists(p):
        continue
    im = Image.open(p)
    if 'kororin' not in n:
        im.thumbnail((10000, 640), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=76, method=4)
    assets[n] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
bg = Image.open(f'{D}/bg-moon.webp'); buf = io.BytesIO(); bg.save(buf, 'WEBP', quality=74)
bg_uri = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

html = html.replace('url(bg-moon.webp)', f'url({bg_uri})')
html = html.replace("const src = (who, name) => `${CAST[who].dir}/${name}.webp`;",
                    "const ASSET = " + json.dumps(assets) + ";\n  const src = (who, name) => ASSET[`${CAST[who].dir}/${name}.webp`] || `${CAST[who].dir}/${name}.webp`;")
html = re.sub(r'src="(user|bati|friend)/kororin\.webp"', lambda m: f'src="{assets[m.group(1)+"/kororin.webp"]}"', html)
html = html.replace('`<div class="row"><img src="${d}/kororin.webp" alt="">', '`<div class="row"><img src="${ASSET[d+\'/kororin.webp\']}" alt="">')
assert 'ASSET[' in html
open(f'{D}/proto-inline.html', 'w', encoding='utf-8').write(html)
print(len(html) // 1024, 'KB', len(assets), 'pictures')
