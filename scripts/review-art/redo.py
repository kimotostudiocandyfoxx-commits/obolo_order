#!/usr/bin/env python3
"""
A review round from the story chat (art/review/saturn/rounds/r<N>.jsonl, one line per key:
{"key", "base", "mode": decide|edit|regen, "do"}) → new candidates in design/review-art-queue.json:
- decide: the chosen candidate is recorded in art/review/saturn/picks.json, nothing is painted;
- edit:   two edits of the chosen candidate (base "c", or "edit:V02/K7-c"; "<決定>" = the first new candidate of that key);
- regen:  three new pictures from the corrected prompt (the review's rules: no people in photo frames, no style
          pictures in empty frames, SHOT/SUBJECT apart, KIMORIN's reference sheet first, LOCATION on every V02 key).
New ids: <key>-r<N>a, -r<N>b … so the earlier candidates stay for comparison.

  python3 scripts/review-art/redo.py 1
"""
import json, os, re, sys

N = sys.argv[1]
ROOT = 'art/review/saturn'
lines = [json.loads(l) for l in open(f'{ROOT}/rounds/r{N}.jsonl', encoding='utf8') if l.strip()]
q = json.load(open('design/review-art-queue.json', encoding='utf8'))
old = {i['id']: i for i in q['items']}
picks_path = f'{ROOT}/picks.json'
picks = json.load(open(picks_path)) if os.path.exists(picks_path) else {}

R = 'design/story/refs/'
UI = 'apps/web/public/onboarding/'
STYLE_REFS = [R + 'style-obolon-temple.jpg', R + 'style-gate.jpg']
NOTEXT = 'No text, no letters, no numbers, no symbols that read as writing, no logos, no watermark, no signature.'
STYLE = ('STYLE: Vertical 9:16 cinematic keyframe for a Japanese mobile story game, in exactly the art style of the reference pictures: highly '
         'detailed painterly dark fantasy, deep blacks with glowing gold light and fine ornament, finest anime-film background quality; '
         'characters in a semi-realistic 3D-CG texture, KIMORIN in cute chibi proportions within the same texture. ' + NOTEXT +
         ' Use the reference pictures for their art style only, never their content.')
STYLE_EMPTY = ('STYLE: Vertical 9:16 cinematic keyframe, highly detailed painterly dark fantasy, deep blacks with glowing gold light, finest '
               'anime-film background quality. ' + NOTEXT + ' Empty scene: absolutely no people, no characters, no creatures, no figures.')
PHOTO = ('PHOTO: Vertical 9:16 photorealistic night photograph, 35mm film look, natural light, real-world texture indistinguishable from a '
         'photo. No recognizable landmarks, no signs, no text, no logos, no brands. No people at all. Clean empty sky with room at the top.')
LAB = ('KIMORIN, a small chibi white fox about three heads tall whose face looks like a white fox mask: smooth white round face, blue leaf '
       'mark on the forehead, blue spiral marks on the cheeks, tiny cat-like ω mouth, tall fox ears with blue insides. Brass steampunk goggles '
       'worn over the eyes (eyes completely hidden, no glow). An oversized, patched, stained white lab coat with the sleeves clearly rolled up, '
       'a tool belt with dangling wires, white gloves with blue paw pads on the fingertips and palms, white shoes with blue paw pads. On his head '
       'between the ears sits a rounded silver box with a small dark screen on its front; one continuous thin cable runs from it down to a '
       'rounded-rectangle silver handset with one round button and a gold-glowing rim, held in one hand (no engraving). A huge fan of clean '
       'white, black and vermilion-tipped feathers (no stains, no spots on the feathers) grows from his back. No hood, no robe.')
TAIL_CLOSED = 'His feather tail is folded closed into a narrow bundle behind his back, only the vermilion tips peeking out.'
TAIL_OPEN = 'His feather tail is burst open into a huge fan behind him.'
LOCATION = ('LOCATION: inside the giant black-and-gold gate of the headquarters city at sunset; the low sun is outside the gate, behind '
            'KIMORIN, so he is backlit with a warm rim light; floating gold dust.')
LAB_REFS = [f'{ROOT}/sheets/kimorin-lab-c.jpg', UI + 'kimorin-i-joy.webp']
GATE_REFS = [R + 'story/places/headquarters-gate.webp', UI + 's/d2-gate-inside.jpg']


def path(cid):
    return f'{ROOT}/{cid}.jpg'


def item(cid, prompt, refs):
    return {'id': cid, 'w': 1152, 'h': 2048, 'size': [720, 1280], 'refs': [r for r in dict.fromkeys(refs)][:6], 'prompt': prompt[:2990]}


new = []
for l in lines:
    key, base, mode, do = l['key'], l['base'], l['mode'], l['do']
    v = key.split('/')[0]
    if mode == 'decide':
        picks[key] = f'{key}-{base}'
        continue
    sheet = key.startswith('sheets/')
    size = ([2048, 1152, [1280, 720]] if sheet else [1152, 2048, [720, 1280]])
    if mode == 'edit':
        if base.startswith('edit:'):
            src = base[5:].replace('<決定>', f'r{N}a')
        else:
            src = f'{key}-{base}'
        # the edit of a key still to be painted in this round waits for it (paint.mjs's passes)
        refs = [path(src)]
        if v == 'V02':
            refs += LAB_REFS[:1]
        if 'MONBAN' in do:
            refs.append(R + 'story/cast/monban.jpg')
        text = ('Edit the first picture: keep the place, camera, framing, light, style and every character exactly the same unless told '
                f'otherwise, and change only this: {do} {NOTEXT}')
        for c in 'ab':
            it = item(f'{key}-r{N}{c}', text, refs)
            it['w'], it['h'], it['size'] = size
            new.append(it)
        continue
    # regen
    orig = old.get(f'{key}-a', {}).get('prompt', '')
    if sheet:
        prompt = ('Design reference sheet on a flat plain mid-grey background (#808080), even studio light. No text, no letters. ' + do + ' ' +
                  (LAB if 'kimorin' in key else re.sub(r'^.*?(?:three times[^.]*\.)', '', orig)))
        refs = LAB_REFS if 'kimorin' in key else [R + 'story/places/rocket.jpg', f'{ROOT}/sheets/rocket-c.jpg']
    elif orig.startswith('PHOTO'):
        prompt = f'{PHOTO} {do}'
        refs = []
    elif re.search(r'No (style )?reference images|Empty scene', do):
        prompt = f'{STYLE_EMPTY} {do}'
        refs = []
    elif v == 'V02':
        tail = TAIL_OPEN if key.split('/')[1] in ('K8', 'K13', 'K13b', 'K14') else TAIL_CLOSED
        shot = re.match(r'(SHOT:[^.]*\.)', do)
        rest = do[shot.end():].strip() if shot else do
        prompt = f'{STYLE} {(shot.group(1) + " ") if shot else ""}{LOCATION} SUBJECT: {LAB} {tail} {rest}'
        refs = LAB_REFS + GATE_REFS
    else:
        # the frames of V01 left to redraw are all empty scenes: the style pictures (with figures) stay out
        prompt = f'{STYLE_EMPTY} {do}'
        refs = []
    for c in 'abc':
        it = item(f'{key}-r{N}{c}', prompt, refs)
        it['w'], it['h'], it['size'] = size
        new.append(it)

# the new round first, so the reviewers get it before the rest of the queue
ids = {i['id'] for i in new}
q['items'] = new + [i for i in q['items'] if i['id'] not in ids]
json.dump(q, open('design/review-art-queue.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(picks, open(picks_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f'round {N}: {len(new)} new pictures, {len(picks)} picks')
