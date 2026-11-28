"""Day 2's rewrite with pictures (client 2026-11-28, design/refs/2026-11-28-rocket/storyboard.md): writes
design/rocket-art-queue.json — the rocket plaza's background plates (no characters) and KIMORIN's back views on chroma
green — painted by the "UI art" workflow (queue=design/rocket-art-queue.json) into design/cast/rocket/.

    python3 scripts/rocket/queue.py design/rocket-art-queue.json
"""
import json, sys
R = 'design/refs/2026-11-28-rocket/refs/'
STYLE = ("Vertical 9:16 frame for a premium Japanese anime feature film, in exactly the look of the reference pictures: "
         "cinematic photoreal-painterly 3DCG dark fantasy, deep blacks, polished black stone with fine real-gold inlay, warm golden lantern light "
         "against a deep evening sky (indigo above, a thin band of amber and rose at the horizon, gold-lit clouds), crisp detail, "
         "physically plausible light, gentle atmospheric haze for depth, film-grade composition. "
         "No text, no letters, no numbers, no writing, no logos, no watermark anywhere.")
HALL = ("THE ROCKET PLAZA of the society (ロケット場), straight beyond the Earth temple: a vast OPEN-AIR ceremonial plaza under the evening sky "
        "(it is outdoors: no roof, no ceiling, no walls closing it in; the sky is wide above). Its ground is polished black stone like a dark mirror, inlaid with thin gold "
        "lines in large geometric star patterns, reflecting every light. Along both sides stand rows of tall black obelisks carved with fine gold ornament, and between them "
        "ornate golden lanterns on black stone posts glow warmly. At the far end, a broad flight of black-and-gold steps rises to a ROUND PLATFORM, and on it stands THE ROCKET, "
        "towering like a 20-storey building: a slender black rocket with an elegant pointed nose, its hull engraved with gold filigree and an eye emblem, glowing neon lines "
        "running along it (one bright magenta-pink line down the centre with a pink ring-and-dot near the nose, thin teal-cyan lines beside it, small blue panels), "
        "EXACTLY THREE swept fins whose lower tips are level with the bronze engine nozzles (copy the rocket of the rocket reference picture exactly), "
        "a small arched glowing door at its base reached by the steps. Behind the rocket floats an enormous ring of golden light, engraved with faint runes, "
        "with four small star-like glints on it.")
PLATE = "This is an EMPTY background plate: no people, no characters, no creatures, no figures, no animals anywhere in the picture."
KIM = ("KIMORIN (copy him exactly from the character reference pictures): a small chibi white fox-spirit about three heads tall; big pointed white fox ears "
       "with deep blue insides; a small silver box-shaped device on top of his head between the ears with a thin coiled cable; brass steampunk goggles "
       "pushed up onto his forehead; a white, slightly worn laboratory coat over a black shirt with a leather tool belt and small brass gadgets; white paws "
       "with blue paw pads; behind him a large round fan of tail feathers growing from his body: white inside, black outside with red-orange tips.")
GREEN = ("Background: a completely flat, solid, pure chroma-key green (#00FF00) everywhere around him, no gradient, no floor, no ground shadow, "
         "no light spill, no other objects. Nothing on the character is green. Clean sharp outline. The whole figure is in the picture with a small margin.")

def plate(i, prompt, refs, w=1152, h=2048):
    return {"id": i, "w": w, "h": h, "size": [1080, 1920], "refs": refs, "prompt": prompt + " " + STYLE}

items = [
    plate("gh-wall-open-b",
          "Edit the first picture: keep the temple hall EXACTLY the same — the same dark hall, the same camera, framing, perspective, golden armillary rings and the vertical "
          "beam of light in the middle, the same floor circles and colours. Change only this: the tall back wall straight behind the beam of light has split down the middle and "
          "its two huge carved black-and-gold stone doors have swung open to the left and right, and through the opening we look STRAIGHT OUT of the temple into the open air: "
          "an outdoor plaza under a deep indigo evening sky with gold-lit clouds, rows of black obelisks and golden lanterns leading straight ahead to a far flight of steps on which "
          "a towering slender black rocket with glowing magenta and teal lines stands before an enormous ring of golden light (copy the rocket and ring of the second reference "
          "picture). Warm evening light pours in through the opening across the temple floor. Remove the black orb that floats in the beam of light: the beam is empty. " + PLATE,
          ["apps/web/public/onboarding/s/d2-hall.jpg", R + "ok-look.jpg"]),
    plate("gh-hall-wide",
          HALL + " CAMERA: a grand establishing shot from the temple end of the plaza, low camera at the height of a small child, looking straight down the "
          "central axis toward the rocket, perfectly symmetrical. The rocket and its ring stand in the upper middle, the nose reaching about 8% below the top edge; "
          "the round platform and steps sit at about 62% of the picture's height; the long polished floor fills the lower third, empty, its gold lines leading the eye "
          "to the steps. The rows of obelisks and lanterns frame both sides, the wide open sky above. " + PLATE,
          [R + "ok-look.jpg", R + "p-rocket3f-front.jpg", R + "plate-base-wide.jpg"]),
    plate("gh-hall-low-b",
          "THE ROCKET of the society on its open-air plaza at dusk, seen from a WORM'S-EYE VIEW: an extreme low angle with a wide 16 mm lens from right at the bottom of "
          "its steps, the camera tilted steeply up. The black-and-gold steps start big and close at the bottom edge and fill the lower quarter; from the top of the steps the "
          "rocket soars up, hugely foreshortened, its vertical lines converging toward the top: first the bronze engine nozzles and the glowing arched door, then EXACTLY THREE "
          "swept fins (copy the rocket of the first reference picture exactly), then the slender black hull engraved with gold filigree and an eye emblem, with its glowing "
          "magenta-pink centre line and thin teal-cyan side lines, narrowing to the pointed nose at the very top of the picture against a deep indigo sky with gold-lit clouds. "
          "Behind the hull an enormous ring of golden light, partly cut off by the left and right edges of the frame. Two golden lanterns at the sides of the steps. "
          "This is a much closer and lower composition than the reference pictures: the rocket fills the frame like a skyscraper seen from its foot. " + PLATE,
          [R + "p-rocket3f-front.jpg", R + "plate-base-low.jpg"]),
    plate("gh-ots-base",
          HALL + " CAMERA: a medium shot at the eye height of a small child standing on the plaza about 15 metres from the steps: the steps and the round "
          "platform across the middle of the picture, the base of the rocket with its three fins, nozzles and glowing arched door rising out of the top of the frame "
          "(the nose is not visible), part of the golden ring behind it, two golden lanterns at the foot of the steps left and right. In front of the steps a wide empty "
          "area of polished black floor (the lower 45% of the picture) where people will stand. " + PLATE,
          [R + "plate-base-low.jpg", R + "ok-gate.jpg", R + "p-rocket3f-front.jpg"]),
    plate("gh-reverse",
          "THE OPEN-AIR ROCKET PLAZA seen in the REVERSE direction: from the foot of the rocket's steps looking back across the vast plaza toward the Earth temple. "
          "It is outdoors under the evening sky (deep indigo with gold-lit clouds, a band of amber at the horizon). The polished black mirror ground with gold star "
          "patterns, the rows of black obelisks with gold ornament and the golden lanterns run away from the camera on both sides straight toward the Earth temple at the "
          "far end: its great carved black-and-gold doors stand open and glow warmly from inside, and above them rise its spires and its large glass dome against the sky. "
          "Warm golden light from behind the camera (from the rocket's ring) rakes across the floor. Low camera at the height of a small child. The lower 45% is empty "
          "floor in the middle ground. " + PLATE,
          [R + "k-reverse.jpg", R + "ok-trio.jpg", R + "ok-aerial.jpg"]),
    plate("gh-gem-monban",
          "Close-up, from the viewer's point of view: MONBAN's gloved hand (copy MONBAN, the hooded gatekeeper, from the second reference picture: black gloves with fine "
          "gold trim at the knuckles and cuffs, a heavy black sleeve with gold embroidery along its hem) is held out toward the viewer, palm up, and on the palm lies "
          "a small MANA GEM (copy it from the first reference picture): an egg-shaped clear crystal pebble, inside it swirling threads of golden light with flecks of blue, "
          "glowing softly and lighting the glove from below. The hand and gem in the lower middle, sharp; behind, out of focus, the open-air rocket plaza at dusk: golden lanterns as "
          "round bokeh, the black rocket's teal and pink lines as soft streaks, a part of the golden ring. Only the hand and sleeve of MONBAN are seen, no face.",
          ["design/story/refs/client/managem.jpg", "design/cast/monban.jpg", R + "ok-look.jpg"]),
    plate("gh-gem-kimorin-b",
          "Medium close-up of KIMORIN. Picture 1 shows his EXACT FACE: copy the face design faithfully (only the face — not the red hood and not the sunglasses of picture 1). "
          "Picture 2 shows his costume and body for this scene. " + KIM + " HIS FACE: a smooth round pure-white porcelain fox face with no nose and no muzzle; a small blue "
          "three-petal leaf mark on the forehead; his eyes are NOT round and have no eyeballs: they are two thin curved glowing light-blue slits shaped like gently closed, "
          "smiling eyelids (thin crescent arcs), exactly as in picture 1; a blue spiral on each cheek; a tiny thin dark ω-shaped cat mouth. "
          "He holds a small MANA GEM (copy it from picture 3: an egg-shaped clear crystal pebble with swirling golden light inside) in both paws in front of his chest and gazes "
          "down at it in wonder, ears pricked up, his face lit warmly from below by the gem's golden glow. Behind him, out of focus with a shallow depth of field: the open-air "
          "rocket plaza at dusk, golden lanterns as round bokeh, the black rocket's teal and pink lines and the golden ring as soft glows. Framed from the top of his ears to "
          "his waist, the tail feathers fanning behind his shoulders.",
          [R + "kimorin-face-eyes.jpg", "apps/web/public/onboarding/kimorin-iu.webp", "design/story/refs/client/managem.jpg"]),
]

cast = [
    {"id": "kb-back", "w": 1536, "h": 2048, "size": [1152, 1536],
     "refs": [R + "ok-look.jpg", "apps/web/public/onboarding/kimorin-iu.webp"],
     "prompt": "Copy the small white character seen from behind in the first picture exactly (his back view, the box device, the coat, the tail), and his costume from the second picture. "
               + KIM + " POSE: seen from BEHIND, a three-quarter back view (we see his back and a little of the right side of his head), standing on both feet, looking UP and a little "
               "to the right at something enormous, head tilted back; arms down at his sides; the tail fan spread behind him, seen from its back (black outside with red-orange tips "
               "and white feathers). We do NOT see his face (only the edge of his right cheek and ear). Lit warmly from the front-right (golden light) with a cool blue rim light. " + GREEN},
    {"id": "kb-ots", "w": 1536, "h": 2048, "size": [1152, 1536],
     "refs": [R + "ok-look.jpg", "apps/web/public/onboarding/kimorin-iu.webp"],
     "prompt": "Copy the small white character seen from behind in the first picture exactly, and his costume from the second picture. " + KIM +
               " FRAMING: an over-the-shoulder close view from BEHIND him: the back of his head with the big white ears (blue insides seen from behind, white fur outside), the silver "
               "box device and its cable on top, the brass goggles strap around the back of his head, his shoulders and upper back in the white lab coat, and the top half of the tail fan rising "
               "behind his shoulders. His head turned a little to the right, three-quarter back, so only the edge of his right cheek shows; no face. Cropped at the waist at the bottom edge "
               "of the picture. Lit warmly from the front-right with a cool blue rim light along the edges. " + GREEN.replace('The whole figure is in the picture with a small margin.', 'The figure is cut by the bottom edge only.')},
    {"id": "kb-walk", "w": 1536, "h": 2048, "size": [1152, 1536],
     "refs": [R + "ok-look.jpg", "apps/web/public/onboarding/kimorin-iu.webp"],
     "prompt": "Copy the small white character seen from behind in the first picture exactly, and his costume from the second picture. " + KIM +
               " POSE: seen from straight BEHIND, he is walking away from the viewer with a jaunty, happy step (one foot lifted behind him), swinging his arms, the hem of the white coat "
               "flaring, the tail fan spread wide and bouncing; his head slightly tilted as if humming a tune. We do not see his face. Soft warm light from the front (beyond him) making a thin golden "
               "rim along his outline. " + GREEN},
]

json.dump({"note": "2日目「待ちなさい」〜ロケットに乗る前（依頼主 2026-11-28）: ロケット場の背景（人なし）と、KIMORINの後ろ姿の切り抜き用（緑）。design/refs/2026-11-28-rocket/storyboard.md。背景は確認後 apps/web/public/onboarding/s/<id>.jpg (720×1280) に書き出す。切り抜きは scripts/rocket/cut.py。ロケット・ロケット場は物語の歌の絵（ok-*.jpg、p-rocket3f-front.jpg）に合わせる。実行：Actions の「UI art」を、このブランチで queue=design/rocket-art-queue.json",
           "dir": "../../../design/cast/rocket", "png": True, "always": "", "redo": [],
           "items": items + cast}, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print(len(items + cast))
