#!/usr/bin/env python3
"""KIMORIN's story sprites, painted again (client 2026-11-22: the grey background cut badly, the talking mouth
landed in the wrong place, the face changed between pictures; plus a blushing face for 「ア、、、アイ//？」).

Writes design/kimorin-art-queue.json for scripts/ui-art/paint.mjs (.github/workflows/ui-art.yml):
  <stem>          the pose, on flat pure chroma green, from fixed references (costume + the face sheet)
  <stem>-o        the same picture with only the mouth open (an edit of <stem>) → the talking mouth
  <stem>-notail   the same picture without the tail feathers (an edit of <stem>) → the swaying tail layer
Saved under design/kimorin/ (not deployed); scripts/kimorin/build.py cuts them into apps/web/public/onboarding.
Run: python3 scripts/kimorin/make-queue.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import keying  # noqa: E402

# the key colour KIMORIN is painted on (scripts/lib/key-colours.json: the one farthest from his colours)
KEY = keying.key_for('KIMORIN')[0]
KW = keying.KEY_WORDS[KEY]
COLOUR = {'green': 'green', 'blue': 'blue', 'magenta': 'magenta', 'cyan': 'cyan', 'orange': 'orange', 'yellow': 'yellow'}[KEY]

# a trial: only the stems given (python3 scripts/kimorin/make-queue.py kimorin-i-talk …)
ARGS = sys.argv[1:]
REDO_STEMS = set(ARGS[ARGS.index('--redo') + 1:]) if '--redo' in ARGS else set()
ONLY = set(ARGS[:ARGS.index('--redo')] if '--redo' in ARGS else ARGS) | REDO_STEMS

FACE_REF = 'design/story/refs/cast/kimorin-face-ref.png'
RAW = 'design/kimorin'

BODY = (
    "KIMORIN is a small chibi fox-spirit character, about three heads tall, standing. "
    "His face (copy it exactly from the face reference picture): a smooth round pure-white porcelain fox-mask face with no nose and no muzzle; "
    "on the forehead a small blue three-petal leaf mark; {eyes} "
    "a blue spiral on each cheek; a tiny thin dark ω-shaped cat mouth in the middle of the lower face. "
    "Big pointed white fox ears with deep blue insides and white fluffy fur. Behind him a large round fan of tail feathers: white inside, black outside with red-orange tips. "
    "White paw hands with blue paw pads, white feet with blue paw pads."
)
EYES = "two thin curved glowing light-blue eye slits like gently closed smiling eyelids, no pupils, no eyeballs;"
HIDDEN = ("his eyes are hidden: the two dark round lenses of his {what} sit directly ON his face over the eyes and cover them completely, no eye slits visible "
          "(in picture 2 the eyes show and the glasses are pushed up — NOT here: here the lenses are worn down over the eyes, nothing is pushed up onto his head);")
LOOKS = {
    # the inventor, goggles down (day 2 until the startle in the Earth temple)
    'kimorin-i': ("apps/web/public/onboarding/s/kimorin-i-talk.jpg",
                  "He wears a white, slightly worn laboratory coat over a black shirt, a leather tool belt with small brass gadgets, "
                  "brass steampunk goggles with dark round lenses worn OVER his eyes (the lenses hide the eye slits), "
                  "and a small silver box-shaped device on top of his head between the ears with a thin coiled cable."),
    # the inventor, goggles pushed up (until the Moon)
    'kimorin-iu': ("apps/web/public/onboarding/s/kimorin-iu-talk.jpg",
                   "He wears a white, slightly worn laboratory coat over a black shirt, a leather tool belt with small brass gadgets, "
                   "brass steampunk goggles pushed UP onto the top of his head above the forehead mark (his glowing eye slits are visible), "
                   "and a small silver box-shaped device on top of his head between the ears with a thin coiled cable."),
    # after the dragon on the Moon: red robe, sunglasses on
    'kimorin-xs': ("apps/web/public/onboarding/s/kimorin-xs-talk.jpg",
                   "He wears a deep red velvet hooded robe with ornate silver-white embroidered trim, the hood up between his ears, "
                   "a blue jewel brooch at the collar with two blue tassels, round black sunglasses with a thin silver frame worn over his eyes "
                   "(the black lenses hide the eye slits completely), and a small white dragon wing behind him on one side."),
}
POSES = {
    'stand': "Pose: standing relaxed and upright facing the viewer, arms down at his sides. Calm expression, mouth closed.",
    'talk': "Pose: facing the viewer, one paw held out forward, open palm up, as if calmly explaining something. Mouth closed.",
    'lecture': "Pose: facing the viewer, one paw raised with the index finger pointing straight up like a teacher, the other paw open at his side. Mouth closed.",
    'joy': "Pose: both arms spread wide open, delighted and happy, body bouncing. A wide closed-mouth smile.",
    'point': "Pose: facing the viewer, pointing one paw straight at the viewer, confident, the other paw on his hip. Mouth closed.",
    'shock': "Pose: startled, leaning back a little, both paws raised up beside his head, tiny round surprised mouth.",
    'smug': "Pose: one paw under his chin, the other paw on his hip, chin raised proudly, smug and pleased with himself. Mouth closed in a smug little smile.",
    'tears': "Pose: both paws clasped together in front of his chest, deeply moved, small drops of glowing blue light falling like tears from his eyes. Mouth closed.",
    'think': "Pose: one paw at his chin, head tilted slightly, thinking hard. Mouth closed.",
    'blush': "Pose: shy and flustered, shoulders raised, both paws held together in front of his chest, fidgeting. His face is blushing: soft pink-red blush across both cheeks, "
             "two small embarrassed sweat drops beside his head, tiny wobbly closed mouth. (Only the blush is new; the face design stays the same.)",
}
BG = (f"Background: a completely flat, solid, {KW} everywhere around him, no gradient, no floor, no shadow, no light spill, no other objects. "
      f"Nothing on the character is {COLOUR}. The whole body is in the picture, centred, from the ear tips to the feet with a small margin, "
      "the feet near the bottom, the figure fills about 88% of the picture's height. Clean sharp outline. "
      "Highly detailed painterly anime render, soft studio light from the front. No text, no letters.")
KEEP = f"Edit the first picture: keep everything exactly the same, pixel for pixel — the same character, pose, framing, size, colours, light and the flat {KW} background — "
OPEN = KEEP + ("and change ONLY his tiny mouth: it is now open as if saying 'a', a small rounded open mouth with dark red inside and a little pink tongue, "
               "in the same place as the closed mouth. Nothing else changes: not the eyes, not the face marks, not the cheeks or any blush on them, not the hands. No text.")
NOTAIL = KEEP + ("but remove the whole fan of tail feathers{wing} behind him, so the flat " + COLOUR + " background shows where they were. "
                 "Everything else stays exactly as it is. No text.")

items = []
for look, (costume, dress) in LOOKS.items():
    for pose, how in POSES.items():
        if look == 'kimorin-xs' and pose == 'stand':
            stem = 'kimorin-sun'
        elif pose == 'stand':
            stem = look
        else:
            stem = f'{look}-{pose}'
        if ONLY and stem not in ONLY:
            continue
        eyes = EYES if look == 'kimorin-iu' else HIDDEN.format(what='brass goggles' if look == 'kimorin-i' else 'round black sunglasses')
        prompt = (f"Picture 1 shows his costume and body; picture 2 shows his exact face design — copy both faithfully, the same character in every detail. "
                  f"{BODY.format(eyes=eyes)} {dress} {how} {BG}")
        if look != 'kimorin-iu':
            prompt = prompt.replace("from his eyes", "from under his " + ('goggles' if look == 'kimorin-i' else 'sunglasses'))
        items.append({'id': stem, 'w': 1536, 'h': 2048, 'size': [960, 1280], 'always': False, 'refs': [costume, FACE_REF], 'prompt': prompt})
        src = f'{RAW}/{stem}.jpg'
        items.append({'id': f'{stem}-o', 'w': 1536, 'h': 2048, 'size': [960, 1280], 'always': False, 'refs': [src], 'prompt': OPEN})
        items.append({'id': f'{stem}-notail', 'w': 1536, 'h': 2048, 'size': [960, 1280], 'always': False, 'refs': [src],
                      'prompt': NOTAIL.format(wing=' and the small dragon wing' if look == 'kimorin-xs' else '')})

# a repainted pose: its old pictures are deleted, so the pose is painted first and its edits wait for it
# (paint.mjs's redo would edit the old picture in the same pass)
import os
for x in items:
    if x['id'].removesuffix('-o').removesuffix('-notail') in REDO_STEMS and os.path.exists(f"{RAW}/{x['id']}.jpg"):
        os.remove(f"{RAW}/{x['id']}.jpg")
queue = {
    'note': 'KIMORIN の立ち絵を描き直す（2026-11-22）: 緑の背景（クロマキー）、顔は design/story/refs/cast/kimorin-face-ref.png に固定。'
            '<stem>-o は口だけ開いた絵、<stem>-notail は尾羽なし。scripts/kimorin/build.py で切り抜いて onboarding/<stem>.webp と口の位置 (lib/story/sprite-mouths.json) にする',
    'dir': '../../../' + RAW,
    'png': True,
    'always': '',
    'items': items,
    # repaint: python3 scripts/kimorin/make-queue.py --redo <stem> … (the stem and its two edits)
    'redo': [],
}
json.dump(queue, open('design/kimorin-art-queue.json', 'w'), ensure_ascii=False, indent=1)
print(len(items), 'items')
