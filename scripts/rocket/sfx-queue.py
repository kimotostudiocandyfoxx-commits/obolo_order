"""Day 2's rewrite with pictures (client 2026-11-28): the new sound effects of the span 「待ちなさい」〜 the great hall,
added to design/story-audio-queue.json (Seed Audio, made by the "Story audio" workflow → onboarding/se-<id>.mp3).

    python3 scripts/rocket/sfx-queue.py
"""
import json

P = 'design/story-audio-queue.json'
T = ' High quality, realistic and rich, clean recording, no music, no voices.'
NEW = [
    ('whip', 'A very short, crisp cinematic whip-pan swish, like a camera turning around fast: one tight airy swoosh with a soft tail, under half a second.'),
    ('glint', 'A tiny bright metallic glint of light on polished brass: a single delicate high shimmer, very short and clean, anime sparkle-glint sound design.'),
    ('stone-door', 'Two colossal ancient stone temple doors slowly sliding apart: a deep heavy grinding rumble of stone on stone with a low resonant boom, faint dust trickling, and a soft rush of air as they open, in a huge echoing hall.'),
    ('hall-reveal', 'A vast space opening up: a slow, deep, airy swell of wind and low resonance with a faint high golden shimmer, like walking out into an immense open-air hall at dusk; cinematic reveal sound design, calm and majestic, fading softly.'),
    ('beam', 'A pillar of golden light descending from high above and touching the floor: a bright rising shimmer that falls in pitch, ending in a soft deep resonant impact and a warm humming glow that fades.'),
    ('star-sky', 'A ceiling dissolving into a starry night sky: a slow, gentle wash of soft glassy twinkles and a deep airy hum widening out, magical and calm, fading slowly.'),
    ('streak-up', 'A tiny glowing ball of light shooting up into the sky and away: a quick bright magical fizz-whoosh that rises in pitch and fades into the distance with a faint twinkle.'),
    ('zoom-back', 'A small glowing ball of light rushing back toward the camera at great speed with a growing whoosh, then braking suddenly with a short comic screech of air and a soft puff, anime comedy sound design.'),
    ('gem-hum', 'A small magical crystal glowing in a hand: a soft warm resonant crystal hum with gentle glassy glints that swirl slowly, intimate and precious, fading out.'),
    ('dissolve', 'A being of light slowly dissolving into countless tiny golden particles that drift upward: an airy, glittering shimmer rising softly and thinning into silence, mysterious and calm.'),
    ('into-light', 'Stepping through a great gate into blinding warm light: a smooth rising swell of soft air and a bright golden shimmer that blooms and then settles, cinematic transition sound design.'),
]
# (steps-hall was tried three times — thin clicks over hiss, then silence: dropped; no footsteps rather than cheap ones)
q = json.load(open(P))
ids = {x['id'] for x in q['items']}
for i, pr in NEW:
    if i not in ids:
        q['items'].append({'id': i, 'kind': 'se', 'prompt': pr + T})
with open(P, 'w') as f:
    json.dump(q, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(len(q['items']))
