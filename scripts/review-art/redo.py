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
       'rounded-rectangle silver handset with one round button and a gold-glowing rim, held in one hand (no engraving). No hood, no robe.')
# the tail is said once, closed or open (review 2: a fixed "huge fan grows from his back" fought "folded closed")
FEATHERS = 'clean white, black and vermilion-tipped feathers, no stains, no spots'
TAIL_CLOSED = f'His feather tail ({FEATHERS}) is folded closed into a narrow bundle behind his back, only the vermilion tips peeking out.'
TAIL_OPEN = f'His feather tail ({FEATHERS}) is burst open into a huge fan behind him.'
# review 2: he faces the player with the gate at his back (r1 drew him walking away)
FACING = 'He faces the camera (toward the viewer); the gate and the sun are behind him.'
LOCATION = ('LOCATION: inside the giant black-and-gold gate of the headquarters city at sunset; the low sun is outside the gate, behind '
            'KIMORIN, so he is backlit with a warm rim light; floating gold dust.')
# the lab-coat sheet the story chat passed in review 2 (r1b) is the first reference from now on
LAB_REFS = [f'{ROOT}/sheets/kimorin-lab-r1b.jpg', UI + 'kimorin-i-joy.webp']
DRAGON = ("a giant white-scaled long-necked dragon in KIMORIN's deep crimson hooded robe with silver embroidered borders, with KIMORIN's "
          "white fox face, blue marks and fox ears; eighty muscular arms in white gloves with blue paw pads fan out on both sides, every hand "
          "holding a colorful glowing light stick or a party popper; white, black and vermilion feather tail.")
GATE_REFS = [R + 'story/places/headquarters-gate.webp', UI + 's/d2-gate-inside.jpg']


def path(cid):
    return f'{ROOT}/{cid}.jpg'


def item(cid, prompt, refs):
    return {'id': cid, 'w': 1152, 'h': 2048, 'size': [720, 1280], 'refs': [r for r in dict.fromkeys(refs)][:6], 'prompt': prompt[:2990]}


new = []
later = []


def ref(r):
    """a review's reference: a picture of the review (V02/K9-r2b), a file of the repository, or a UI sprite"""
    for c in (f'{ROOT}/{r}.jpg', r, UI + r, UI + r.replace('onboarding/', '')):
        if os.path.exists(c):
            return c
    return None


# the first references show what to draw (a cast member, a place): the "style only" guard is for the style pictures
# alone (review 3: every OBOLON came out as an ordinary hooded man)
CONTENT = 'The first reference pictures show the exact character and place to draw: keep their shapes, colours and design as they are.'
for l in lines:
    key, base, mode, do = l['key'], l['base'], l['mode'], l['do']
    v = key.split('/')[0]
    if mode == 'retry':
        continue
    if mode == 'decide':
        # the reference sheets wait for the client's OK before they become decisions (review 3)
        if key.startswith('sheets/') and 'client' in do:
            later.append(f'{key}: {base} waits for the client OK')
            continue
        picks[key] = f'{key}-{base}'
        continue
    # crops wait for the chosen master; post-processing (a blur) is done by hand, not painted
    if mode in ('crop', 'post'):
        later.append(f'{key}: {mode} {base} — {do}')
        continue
    if mode == 'edit+crop':
        later.append(f'{key}: crop the chosen edit like K11 — {do}')
    if mode == 'regen-3':
        # three separate pictures (a sheet in one picture came out as three fronts twice), placed side by side after
        for view, text in (('front', 'front view'), ('side', 'exact side profile showing the swept-back fins'),
                           ('back', 'view from directly behind and slightly below, looking into the three engine nozzles')):
            new.append({**item(f'{key}-r{N}-{view}', f'Design reference picture on a flat plain mid-grey background (#808080), even studio light, the whole rocket in frame. {NOTEXT} {text.capitalize()} of the rocket in the reference pictures: black body, dense gold arabesque engraving, crests of many planets, pink and cyan neon lines, orange crest emblems, three engine nozzles.', [f'{ROOT}/sheets/rocket-r1b.jpg', R + 'story/places/rocket.jpg']), 'w': 1152, 'h': 2048, 'size': [720, 1280]})
        continue
    if key == 'sheets/dragon-robe':
        it = item(f'{key}-r{N}a', f'Design reference sheet on a flat plain mid-grey background (#808080), even studio light: the same character three times, front view, side view and back view, side by side. {NOTEXT} {DRAGON} Exactly as the reference picture.', [R + 'story/cast/kimorin-dragon.webp', UI + 's/kimorin-dragon.jpg'])
        for c in 'abc':
            new.append({**it, 'id': f'{key}-r{N}{c}', 'w': 2048, 'h': 1152, 'size': [1280, 720]})
        continue
    if key.endswith('/MASTER'):
        # the upper-body picture the close-ups are cut from: kept at full size so a crop stays sharp
        body = re.sub(r'\s*(Reference:|Render at)[^.]*\.(\s*\d+x\d+[^.]*\.)?', '', do)
        prompt = f"{STYLE} {LOCATION} {body.replace('[KIMORIN-LAB] (tail sentence: folded closed only)', LAB + ' ' + TAIL_CLOSED)}"
        for c in 'abc':
            new.append({**item(f'{key}-r{N}{c}', prompt, LAB_REFS + GATE_REFS), 'size': [1152, 2048]})
        continue
    sheet = key.startswith('sheets/')
    size = ([2048, 1152, [1280, 720]] if sheet else [1152, 2048, [720, 1280]])
    if mode in ('edit', 'edit+crop'):
        if base.startswith('edit:'):
            src = base[5:].replace('<決定>', f'r{N}a')
            # an edit is made only from a passed picture (review 2); the master's edit takes the full-size first candidate
        else:
            src = f'{key}-{base}'
        # the edit of a key still to be painted in this round waits for it (paint.mjs's passes)
        # the source may also be a file of the repository (the client's Saturn temple, a UI sprite: review 3)
        refs = [path(src) if os.path.exists(path(src)) or '/' in src and src.split('/')[0] in ('V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V19', 'sheets', 'stills', 'sprites') else (ref(src) or path(src))]
        # the review's own second / third pictures ("exactly as in the second picture")
        refs += [x for x in (ref(r) for r in l.get('refs', [])[1:]) if x and x not in refs]
        if v == 'V02' and not l.get('refs'):
            refs += LAB_REFS[:1]
        if 'MONBAN' in do:
            # the watermark cut off (review 2)
            refs.append(R + 'story/cast/monban-clean.jpg')
        text = ('Edit the first picture: keep the place, camera, framing, light, style and every character exactly the same unless told '
                f'otherwise, and change only this: {do} {NOTEXT}')
        if mode == 'edit+crop':
            size = [1152, 2048, [1152, 2048]]
        if v == 'sprites':
            size = [1536, 2048, [960, 1280]]
        for c in 'ab':
            it = item(f'{key}-r{N}{c}', text, refs)
            it['w'], it['h'], it['size'] = size
            new.append(it)
        continue
    # regen
    orig = old.get(f'{key}-a', {}).get('prompt', '')
    if l.get('refs'):
        # drawn from the given pictures (a cast member, a place): they are content, not style (review 3)
        refs = [x for x in (ref(r) for r in l['refs']) if x]
        body = STYLE_EMPTY if v == 'V19' and 'No people' in do else STYLE.replace(' Use the reference pictures for their art style only, never their content.', '')
        prompt = f'{body} {CONTENT} {do}' if not sheet else f'Design reference picture on a flat plain mid-grey background (#808080), even studio light. {NOTEXT} {CONTENT} {do}'
    elif sheet:
        prompt = ('Design reference sheet on a flat plain mid-grey background (#808080), even studio light. No text, no letters. ' + do + ' ' +
                  (LAB if 'kimorin' in key else re.sub(r'^.*?(?:three times[^.]*\.)', '', orig)))
        refs = LAB_REFS if 'kimorin' in key else [R + 'story/places/rocket.jpg', f'{ROOT}/sheets/rocket-c.jpg']
    elif orig.startswith('PHOTO'):
        prompt = f'{PHOTO} {do}'
        refs = []
    elif re.search(r'No (style )?reference images|Empty scene', do):
        prompt = f'{STYLE_EMPTY} {do}'
        refs = []
    elif v == 'V02' and not re.search(r'\bKIMORIN\b|\bfigure\b|\bhe\b|\bhis\b', do):
        # V02 frames with nobody in them (K1: the avenue to the temple)
        prompt = f'{STYLE_EMPTY} {LOCATION.split(";")[0]}. {do}'
        refs = GATE_REFS
    elif v == 'V02':
        tail = TAIL_OPEN if key.split('/')[1] in ('K8', 'K13', 'K13b', 'K14') else TAIL_CLOSED
        shot = re.match(r'(SHOT:[^.]*\.)', do)
        rest = do[shot.end():].strip() if shot else do
        prompt = f'{STYLE} {(shot.group(1) + " ") if shot else ""}{LOCATION} SUBJECT: {LAB} {tail} {FACING} {rest}'
        refs = LAB_REFS + GATE_REFS
    else:
        # the frames of V01 left to redraw are all empty scenes: the style pictures (with figures) stay out
        prompt = f'{STYLE_EMPTY} {do}'
        refs = []
    for c in 'abc':
        it = item(f'{key}-r{N}{c}', prompt, refs)
        it['w'], it['h'], it['size'] = size
        new.append(it)

# candidates still waiting on the first prompts are dropped (review 2: their refs and tail lines are old)
q['items'] = [i for i in q['items'] if not (re.match(r'V0[12]/K[0-9b]+-[abc]$', i['id']) and not os.path.exists(path(i['id'])))]
# the new round first, so the reviewers get it before the rest of the queue
ids = {i['id'] for i in new}
q['items'] = new + [i for i in q['items'] if i['id'] not in ids]
json.dump(q, open('design/review-art-queue.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(picks, open(picks_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f'round {N}: {len(new)} new pictures, {len(picks)} picks')
for x in later:
    print('later:', x)
