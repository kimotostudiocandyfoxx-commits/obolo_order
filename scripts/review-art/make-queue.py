#!/usr/bin/env python3
"""
Luxury cuts to Saturn (story chat's 土星まで_豪華カット台本.md, 2026-10-28): the keyframes of the chosen videos become
design/review-art-queue.json — N candidates per keyframe, painted by .github/workflows/ui-art.yml into
art/review/saturn/<V>/<K>-a.jpg … for the story chat and the client to pick.

  python3 scripts/review-art/make-queue.py <cuts.md> V01,V02 [candidates=3]
"""
import json, re, sys

src, videos = sys.argv[1], sys.argv[2].split(',')
n = int(sys.argv[3]) if len(sys.argv) > 3 else 3
md = open(src, encoding='utf8').read()

def block(start, end):
    m = re.search(re.escape(start) + r'\n```\n(.*?)\n```', md, re.S)
    return m.group(1).strip() if m else ''

STYLE = block('### 0-2. 絵柄の固定文（すべての止め絵の頭につける）', '')
PHOTO = re.search(r'```\n(PHOTO:.*?)\n```', md, re.S).group(1).strip()
# the cast lines: | [NAME] ... | text | refs |
CAST = {}
for row in re.finditer(r'^\| (\[[A-Z/額\-]+\])[^|]*\| (.+?) \| (.+?) \|$', md, re.M):
    CAST[row.group(1)] = row.group(2).strip()
LAB = CAST.get('[KIMORIN-LAB]', '')

UI = 'apps/web/public/onboarding/'
R = 'design/story/refs/'
STYLE_REFS = [R + 'style-obolon-temple.jpg', R + 'style-gate.jpg']
CAST_REFS = {
    'KIMORIN-LAB': [UI + 'kimorin-i-joy.webp', R + 'cast/kimorin-face-eyes.jpg'],
    'KIMORIN-ROBE': [R + 'story/cast/kimorin-entrance.webp', UI + 'kimorin-xs-talk.webp'],
    'KIMORIN-DRAGON': [R + 'story/cast/kimorin-dragon.webp', UI + 'kimorin-i-joy.webp'],
    'MONBAN': [R + 'story/cast/monban.jpg'],
    'OBOLON': [R + 'story/cast/obolon.jpg'],
    'BROTHER': [R + 'story/cast/takoyaki-brother.jpg'],
    'SISTER': [R + 'story/cast/takoyaki-sister.jpg'],
    'UNPON': [R + 'story/cast/unchi-pinpon-kun.webp'],
    'KORORIN-K': [UI + 's/kororin-kimorin80.jpg'],
    'ROCKET': [R + 'story/places/rocket.jpg'],
}
PLACE_REFS = {
    'V01': [], 'V02': [R + 'story/places/headquarters-gate.webp', UI + 's/d2-gate-inside.jpg'],
    'V03a': [R + 'story/places/launch-pit-rocket.webp'], 'V03b': [R + 'story/places/rocket-inside-b.webp'],
    'V04': [R + 'story/places/moon-temple-inside.jpg'], 'V10': [R + 'story/places/moon-temple-aerial-1.jpg'],
    'V05': [R + 'story/places/headquarters-gate.webp'], 'V06': [R + 'story/places/earth-temple-hall.jpg'],
    'V08': [R + 'story/places/saturn-temple-aerial.jpg'], 'V11': [R + 'story/places/headquarters-gate.webp'],
}

def expand(p):
    p = p.replace('[KIMORIN-LAB/額]', CAST.get('[KIMORIN-LAB/額]', '').replace('[KIMORIN-LAB]', LAB))
    for k, v in CAST.items():
        p = p.replace(k, v.replace('[KIMORIN-LAB]', LAB))
    return p

items = []
for v in videos:
    sec = re.search(r'^### ' + re.escape(v) + r' .*?(?=^### |\Z)', md, re.S | re.M).group(0)
    prev = None
    for k in re.finditer(r'^- \*\*(K\d+[a-z]?)\*\*(.*?)\n\s+`((?:PHOTO|STYLE)[^`]*)`(.*)$', sec, re.M):
        kid, note, prompt, tail = k.group(1), k.group(2), k.group(3), k.group(4)
        # 「同じ画角」: the end frame is an edit of the start frame of the same candidate (a pair that matches)
        same = re.match(r'^(PHOTO|STYLE)( \([^)]*\))? \+ (The s|S)ame\b', prompt) and prev
        base, prev = prev, (kid if not re.search(r'\d[a-z]$', kid) else prev)
        photo = prompt.startswith('PHOTO')
        body = expand(re.sub(r'^(PHOTO|STYLE)( \([^)]*\))? \+ ', '', prompt))
        refs = [] if photo else list(STYLE_REFS)
        refs += PLACE_REFS.get(v, []) if not photo else []
        for name, rs in CAST_REFS.items():
            if f'[{name}' in prompt:
                refs += rs
        if 'envelope' in body:
            refs.append(R + 'story/props/envelope.webp')
        if 'hooded silhouette' in body:
            refs.append(R + 'story/cast/monban.jpg')
        head = PHOTO if photo else STYLE
        for c in 'abcdefgh'[:n]:
            if same:
                edit = f'art/review/saturn/{v}/{base}-{c}.jpg'
                rs = [edit] + [r for r in refs if r not in STYLE_REFS and r not in PLACE_REFS.get(v, [])]
                text = 'Edit the first picture: keep the place, camera, framing, light, style and every character exactly the same, and change only this — ' + body
                items.append({'id': f'{v}/{kid}-{c}', 'w': 1152, 'h': 2048, 'size': [720, 1280], 'refs': list(dict.fromkeys(rs))[:6], 'prompt': f'{text} No text, no letters, no logos.'[:2990]})
            else:
                items.append({'id': f'{v}/{kid}-{c}', 'w': 1152, 'h': 2048, 'size': [720, 1280], 'refs': list(dict.fromkeys(refs))[:6], 'prompt': f'{head} {body}'[:2990]})

# reference sheets the cut script asks for before the cuts (0-3): grey background, front / side / back, for the client's OK
GREY = 'Character reference sheet on a flat plain mid-grey background (#808080): the same character shown three times side by side — front view, side view, back view — full body, standing straight, even studio light, no shadow on the background. No text, no letters, no labels.'
SHEETS = [
    ('sheets/kimorin-lab', GREY + ' ' + LAB, CAST_REFS['KIMORIN-LAB']),
    ('sheets/kimorin-dragon-labcoat', GREY + ' ' + CAST.get('[KIMORIN-DRAGON]', ''), CAST_REFS['KIMORIN-DRAGON']),
    ('sheets/rocket', 'Design reference sheet on a flat plain mid-grey background (#808080): the same rocket shown three times — front view, side view, back view — standing upright, even studio light. No text, no letters. ' + CAST.get('[ROCKET]', ''), CAST_REFS['ROCKET']),
]
if '--sheets' in sys.argv:
    for sid, prompt, refs in SHEETS:
        for c in 'abc':
            items.append({'id': f'{sid}-{c}', 'w': 2048, 'h': 1152, 'size': [1280, 720], 'refs': refs, 'prompt': prompt[:2990]})

json.dump({'note': '土星まで_豪華カット台本 のキーフレーム候補（止め絵）。art/review/saturn/<映像>/<キー>-a.jpg…。台本チャットと利用者が選ぶ。描き直しは redo に id を足す', 'dir': '../../../art/review/saturn', 'always': '', 'items': items, 'redo': []},
          open('design/review-art-queue.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(items), 'pictures')
