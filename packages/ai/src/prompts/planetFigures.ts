import { keyedBackground } from '../images';

/**
 * Client decision 2026-11-25: the member's deformed figure on every home planet, painted from their profile look (the
 * FIRST reference picture). The prompts are the lab's (scripts/art-lab/planet_avatar_prompts.json, compared in
 * art/lab/runware-planet-avatar), taken from the story branch's design/mv-art-queue.json (chibi2-*, kor4-*, chibi4-*,
 * ship4-*, p5-<planet>-*). The member's pattern card (M-R279) is the look itself for now: the {pattern} / {accessory} /
 * {top} slots get the lab's own defaults (its runware_planet_avatar.py), so every look is painted with the same words.
 *
 * Backgrounds: the Saturn chibi and the Jupiter butterfly were asked on chroma-key green in the lab; the app paints them
 * on the key colour farthest from the look's own colours (media/keying.ts chooseKey; cut-out review 2026-11-23). The
 * others were asked on pure white (the lab's choice that worked on Qwen) and are cut from the white.
 */
export type PlanetFigureStyle = 'saturnChibi' | 'saturnBall' | 'jupiter' | 'mercury' | 'mars' | 'venus' | 'uranus' | 'pluto' | 'neptune';

/** the style references sent after the look: the butterfly sheet's three cells (bstyle) or the kororin dot ball (kstyle) */
export const PLANET_FIGURE_REFS: Record<PlanetFigureStyle, 'none' | 'bstyle' | 'kstyle'> = {
  saturnChibi: 'none',
  saturnBall: 'kstyle',
  jupiter: 'bstyle',
  mercury: 'bstyle',
  mars: 'bstyle',
  venus: 'bstyle',
  uranus: 'bstyle',
  pluto: 'bstyle',
  neptune: 'bstyle',
};
/** the cells of apps/api/assets/butterfly-style.jpg the lab sent as the style (x, y, w, h) */
export const BUTTERFLY_STYLE_CELLS: [number, number, number, number][] = [
  [600, 0, 300, 300],
  [0, 300, 300, 300],
  [600, 300, 300, 300],
];
/** painted on the key colour (cut from it) or on white (cut from white) */
export const PLANET_FIGURE_BACKGROUND: Record<PlanetFigureStyle, 'key' | 'white'> = {
  saturnChibi: 'key',
  saturnBall: 'white',
  jupiter: 'key',
  mercury: 'white',
  mars: 'white',
  venus: 'white',
  uranus: 'white',
  pluto: 'white',
  neptune: 'white',
};

/** the lab's default slot words (runware_planet_avatar.py) */
export const FIGURE_SLOTS = {
  pattern: "the character's outfit colours",
  accessory: "the character's glasses or sunglasses, if any",
  top: "the character's hair, ears or hood",
};

const STYLE_2_4 =
  'In exactly the same art style as the 2nd-4th reference pictures (soft hand-drawn kawaii chibi illustration, gentle watercolour-like colouring, clean dark brown-black outlines around everything, sticker-like): ';
const CHIBI_OF_FIRST = 'a cute super-deformed chibi of the character in the FIRST reference picture (face and identity recognisable), ';
const WHITE_END = 'Plain solid pure white background, no shadow, no text.';

/**
 * M-R262 / M-R275 (chibi2-user): the 2D anime 2-heads chibi that jumps out of the popped ball — not the glossy 3D vinyl
 * figure of before. `key`: the key colour's words (KEY_WORDS), `keyName`: its name (green / magenta / blue).
 */
export function saturnChibiPrompt(key: string): string {
  return (
    "A super-deformed 2-heads-tall chibi of the character in the reference picture, drawn as a flat 2D Japanese anime illustration (like official chibi art in a popular TV anime or its character goods): a big round head and a tiny body, keeping the character's face, hairstyle, outfit, colours and signature items exactly recognisable. " +
    'Clean confident lineart, anime cel shading with soft gradient shadows, big expressive anime eyes with sparkling highlights, soft blush, bright clear colours. Not 3D, not a figure, not a render. ' +
    'Jumping out joyfully with both arms up, a big happy smile, waving one hand. Centered, the whole character inside the frame with a margin. ' +
    `On ${keyedBackground(key)}, no shadow, no ground. Safe for children. No text, no letters.`
  );
}

/** the prompt of one figure; `key` / `keyName` only for the ones on the key colour */
export function planetFigurePrompt(style: PlanetFigureStyle, key = 'pure chroma-key green (#00FF00)', keyName = 'green', slots = FIGURE_SLOTS): string {
  const { pattern, accessory, top } = slots;
  switch (style) {
    case 'saturnChibi':
      return saturnChibiPrompt(key);
    case 'saturnBall':
      return (
        'A round ball-shaped mascot (a perfect glossy sphere with no arms and no legs) in exactly the same style as the SECOND reference picture: soft cute anime mascot, glossy highlight top-left, and the same simple face — two tiny shiny black dot eyes, a small ω-shaped cat mouth and soft round pink blush. ' +
        `Its colour and surface pattern are designed from the character in the FIRST reference picture: ${pattern}. Accessory: ${accessory} on the face. On top: ${top}. It must still read as a round ball first. ` +
        'Front view, centered, filling about 80% of the frame. Plain solid pure white background, no shadow, no text.'
      );
    case 'jupiter':
      return (
        "Draw the character from the FIRST reference picture as a cute super-deformed chibi, in exactly the same art style as the other reference pictures (soft hand-drawn kawaii chibi illustration, gentle muted watercolour-like colouring, clean brown-black outlines, sticker-like): the character is dressed up as a butterfly — keep the character's face and identity recognisable, give it curly butterfly antennae on the head or hood, " +
        `and butterfly wings growing from its back whose colours and patterns are designed from the character's outfit: ${pattern} (no ${keyName}). ` +
        'The chibi is flying gently and hugging a rolled-up old paper scroll with a red cord in both arms. Front view, centered, the whole character and both wings inside the frame with a margin. ' +
        `On ${keyedBackground(key)}, no shadow. Safe for children. No text, no letters.`
      );
    case 'mercury':
      return (
        STYLE_2_4 +
        `a small cute sailboat seen from the side with a sail shaped like a music note. The boat's hull and sail colours and patterns are designed from the character: ${pattern}. ` +
        'Riding in the boat is a cute super-deformed chibi of the character in the FIRST reference picture (face and identity recognisable), happily carrying a big boombox speaker on its shoulder. No water, no sea. ' +
        'Centered, the whole boat and character inside the frame with a margin. ' +
        WHITE_END
      );
    case 'mars':
      return STYLE_2_4 + CHIBI_OF_FIRST + "riding a small cute round flying saucer UFO whose colours and patterns are designed from the character's outfit, a soft projector beam glowing under it. Centered, everything inside the frame with a margin. " + WHITE_END;
    case 'venus':
      return (
        STYLE_2_4 +
        CHIBI_OF_FIRST +
        "working as a radio DJ: sitting at a tiny cute radio DJ booth desk (with a little mixer and an ON AIR lamp) whose colours and patterns are designed from the character's outfit, wearing headphones and talking happily into a microphone on a desk arm that pops up in front, the whole little booth floating on a small fluffy cloud. Centered, everything inside the frame with a margin. " +
        WHITE_END
      );
    case 'uranus':
      return STYLE_2_4 + CHIBI_OF_FIRST + "hanging from a bunch of balloons with a gift box whose colours and patterns are designed from the character's outfit. Centered, everything inside the frame with a margin. " + WHITE_END;
    case 'pluto':
      return STYLE_2_4 + CHIBI_OF_FIRST + "riding on a big open flying book whose cover colours and patterns are designed from the character's outfit, little glowing letters floating. Centered, everything inside the frame with a margin. " + WHITE_END;
    case 'neptune':
      return STYLE_2_4 + CHIBI_OF_FIRST + "floating inside a big transparent bubble holding a game controller whose colours and patterns are designed from the character's outfit. Centered, everything inside the frame with a margin. " + WHITE_END;
  }
}
