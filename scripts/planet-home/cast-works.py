"""M-R344 / handoff planets-08 chapters 3 and 6: the works of the homes' cast on all eight planets — the seven Sushimon,
the eleven residents and KIMORIN⭐︎ — from the story branch (claude/hopeful-pascal-udqkh2, head b1fafb64 for this
material), extracted to a folder:

  design/home/sushi/sushi.json   + design/home/sushi/<key>/   + design/mv-art/out/su/<key>/     the six Sushimon
  design/home/template.html SAPON / SAPLY + design/home/sapon/ + design/mv-art/out/sapon/        サーぽん
  design/home/res/res.json       + design/home/res/<key>/     + design/mv-art/out/re/<key>/     the residents, KIMORIN⭐︎

  python3 scripts/planet-home/cast-works.py <folder holding design/>

  → apps/web/public/planets/cast/<key>/   the audio as it is (made with the M-R344 voices: mp3 32–64 kbps, nothing is
                                          re-encoded), mv.mp4 (the Sushimon), the pictures as webp (768 px, q 80)
  → apps/web/lib/planetTemplate/castWorks.json   the words (titles, the Saturn line, the lyrics, the book's pages, the
                                          game's kind) — copied character for character, never reworded
"""
import json
import os
import re
import shutil
import sys

from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..')
OUT = os.path.join(ROOT, 'apps/web/public/planets/cast')
JSON_OUT = os.path.join(ROOT, 'apps/web/lib/planetTemplate/castWorks.json')
HOME = os.path.join(SRC, 'design/home')
ART = os.path.join(SRC, 'design/mv-art/out')

SUSHI = ['gari', 'ebi', 'uni', 'ika', 'shari', 'kani']
RES = ['brother', 'sister', 'kaiser', 'freezy', 'hipokin', 'bossg', 'longg', 'hatg', 'croco', 'onimonk', 'monban', 'kimorin']
AUDIO = ['saturn', 'dadv', 'stitle', 'goodsv', 'bookv', 'gamev', 'song', 'radiov']


def pic(src, dst, size=768):
    im = Image.open(src).convert('RGB')
    if max(im.size) > size:
        im.thumbnail((size, size), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=80, method=6)


def sapon():
    """サーぽん's words live in the prototype itself (SAPON / SAPLY)"""
    t = open(os.path.join(HOME, 'template.html'), encoding='utf-8').read()
    m = re.search(r"const SAPON=\{saturn:'([^']*)',jupiter:'([^']*)',song:'([^']*)',radio:'([^']*)',goods:'([^']*)',book:'([^']*)',game:'([^']*)',\s*pages:\[(.*?)\]\};", t, re.S)
    pages = re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(8))
    ly = json.loads(re.search(r'const SAPLY=(\[\[.*?\]\]);', t, re.S).group(1))
    return {'name': 'サーぽん', 'saturn': m.group(1), 'jupiter': m.group(2), 'song': m.group(3), 'radio': m.group(4), 'goods': m.group(5), 'book': m.group(6), 'game': m.group(7), 'pages': pages, 'gameKind': 'wobble', 'genre': 'trance'}, ly


def one(key, d, audio_dir, art_dir, lyrics, group, goods_img='goods', goods_voice='goodsv'):
    out = os.path.join(OUT, key)
    os.makedirs(out, exist_ok=True)
    n = len(d['pages'])
    for a in AUDIO:
        src = os.path.join(audio_dir, (goods_voice if a == 'goodsv' else a) + '.mp3')
        shutil.copyfile(src, os.path.join(out, a + '.mp3'))
    for i in range(1, n + 1):
        shutil.copyfile(os.path.join(audio_dir, f'page{i}.mp3'), os.path.join(out, f'page{i}.mp3'))
        pic(os.path.join(art_dir, f'book-{i}.jpg'), os.path.join(out, f'book-{i}.webp'))
    pic(os.path.join(art_dir, 'dad.jpg'), os.path.join(out, 'art.webp'))
    pic(os.path.join(art_dir, goods_img + '.jpg'), os.path.join(out, 'goods.webp'))
    has = {}
    for extra, flag in (('jacket', 'hasJacket'), ('radio', 'hasRadioPic')):
        p = os.path.join(art_dir, extra + '.jpg')
        has[flag] = os.path.exists(p)
        if has[flag]:
            pic(p, os.path.join(out, extra + '.webp'))
    mv = os.path.join(audio_dir, 'mv.mp4')
    has['hasMv'] = os.path.exists(mv)
    if has['hasMv']:
        shutil.copyfile(mv, os.path.join(out, 'mv.mp4'))
    return {
        'key': key,
        'group': group,
        'name': d['name'],
        'saturn': d['saturn'],
        'art': d['jupiter'],
        'song': d['song'],
        'lyrics': lyrics,
        'genre': d.get('genre'),
        'bpm': d.get('bpm'),
        'radio': d['radio'],
        'goods': d['goods'],
        'book': d['book'],
        'pages': d['pages'],
        'game': d['game'],
        'gameKind': d['gameKind'],
        **has,
    }


def main():
    cast = []
    s, ly = sapon()
    cast.append(one('sapon', s, os.path.join(HOME, 'sapon'), os.path.join(ART, 'sapon'), ly, 'sushimon', goods_img='mug', goods_voice='mugv'))
    sushi = json.load(open(os.path.join(HOME, 'sushi/sushi.json'), encoding='utf-8'))
    for k in SUSHI:
        d = os.path.join(HOME, 'sushi', k)
        cast.append(one(k, sushi[k], d, os.path.join(ART, 'su', k), json.load(open(os.path.join(d, 'lyrics.json'), encoding='utf-8')), 'sushimon'))
    res = json.load(open(os.path.join(HOME, 'res/res.json'), encoding='utf-8'))
    for k in RES:
        d = os.path.join(HOME, 'res', k)
        cast.append(one(k, res[k], d, os.path.join(ART, 're', k), json.load(open(os.path.join(d, 'lyrics.json'), encoding='utf-8')), 'dachi' if k == 'kimorin' else 'resident'))
    json.dump(cast, open(JSON_OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(JSON_OUT, 'a').write('\n')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _d, fs in os.walk(OUT) for f in fs)
    print(len(cast), 'cast,', round(total / 1e6, 2), 'MB')


main()
