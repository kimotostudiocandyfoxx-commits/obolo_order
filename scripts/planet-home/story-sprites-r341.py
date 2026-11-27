"""M-R336 / M-R341: the story's standing pictures for the people handoff planets-08 adds — the seven Sushimon (the
boarding scene of day 3, D04-S002b) from their chibi pictures (on green), and Neptune's resident オニモンク from the
client's reference picture (out/res/onimonk-ref2.jpg, on white). Same cuts as roster-figures.py.
  python3 scripts/planet-home/story-sprites-r341.py <art folder>   (design/mv-art/out of the story branch)
  → apps/web/public/onboarding/sushi-<key>.webp, onimonk.webp"""
import os
import sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(__file__)
D = os.path.join(HERE, '../../apps/web/public/onboarding')


def cuts():
    # the two cut functions only (the file is read up to its own loop, which is not run)
    src = open(os.path.join(HERE, 'roster-figures.py'), encoding='utf8').read().split('\ndef save(')[0]
    ns = {'__file__': os.path.join(HERE, 'roster-figures.py')}
    exec(compile(src, 'roster-figures.py', 'exec'), ns)
    return ns['key'], ns['unwhite']


key, unwhite = cuts()
for k in 'sapon gari ebi uni ika shari kani'.split():
    im = key(Image.open(f'{SRC}/chibi-{k}.jpg'))
    im.save(f'{D}/sushi-{k}.webp', 'WEBP', quality=90, method=6)
    print('sushi-' + k, im.size)
im = unwhite(Image.open(f'{SRC}/res/onimonk-ref2.jpg'))
im.save(f'{D}/onimonk.webp', 'WEBP', quality=90, method=6)
print('onimonk', im.size)
