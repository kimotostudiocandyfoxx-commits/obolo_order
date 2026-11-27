import { foodNameByRules, LOOK_PICK4_HEADS, type LookStepWho } from '@obolo/shared';
import { DEFAULT_KEY_WORDS, keyedBackground } from '../images';
import type { LlmProvider } from '../types';

/**
 * Client 2026-11-27 (story M-R334): every {bati} born from now on is "the seed itself as a character" — the favourite
 * food (the 2nd: a sound, the 3rd: a word) drawn as a 2D Japanese-anime mascot. The words are the ones that passed the
 * style test (scripts/art-lab/runware_bati_food.py, Seedream 5.0 Flash with the reference sheet attached), on a flat key
 * colour instead of white so the newborn can be cut out and stand on the stage. ♀ / ♂ is never drawn: it is a small
 * mark beside {bati} on the screen.
 */
export function batiCharacterPrompt(seed: string, kind: 'food' | 'sound' | 'word' = 'food', key: string = DEFAULT_KEY_WORDS, withStyleRef = true): string {
  const what =
    kind === 'food'
      ? `One cute mascot character that IS "${seed}" itself (a food): the food's own shape, colours and texture become its body ` +
        '(not an animal wearing or holding the food, no bowl or plate unless the food is the bowl). '
      : `One cute mascot character that IS ${kind === 'sound' ? 'the sound' : 'the word'} "${seed}" itself: what it brings to mind — its shape, colours and feeling — becomes its body ` +
        '(not an animal wearing or holding it). ';
  return (
    what +
    '2D Japanese anime illustration, soft clean line art and gentle cel shading with a slight painterly texture, ' +
    'big round sparkling eyes with star highlights, a small happy smile, pink blush on the cheeks, ' +
    'tiny simple arms and legs, standing, facing front, full body, centred, on ' +
    keyedBackground(key) +
    '. No text, no letters, no symbols, no gender sign. ' +
    (withStyleRef ? 'Same drawing style, eyes and charm as the characters in the reference image (it is a style reference only: do not copy its characters or its white background); ' : '') +
    'one single character only. Cute and kids-friendly, never scary.'
  );
}

/** what must stay when a look is changed step by step (scripts/art-lab/runware_evolve_chain.py KEEP) */
const KEEP = 'Edit the first image. Keep the SAME character: same face, same body shape, same art style, same pose, same framing and the same plain background. Do not redesign it. ';
const STEP_RULES =
  'Rules: it must not resemble any real, existing person other than the character already in the first image; it must not copy any character, mascot, costume, logo or brand ' +
  'from an existing anime, game, film, book or company; nothing sexual or revealing; nothing violent (no weapons, blood or injuries). No text, no letters.';

/**
 * One evolve / transform step: the picture it has now (the first image) changed ONLY by what was said; `withRef`: a second
 * image was sent — a reference for the shape or the colours of that change only, never a face to copy.
 * `key`: the flat key colour it stands on, kept so it can be cut out again (every picture of a round is cut out).
 */
export function lookStepPrompt(who: LookStepWho, wish: string, withRef = false, key?: string): string {
  const w = wish.trim();
  const change = w
    ? `Change ONLY this, starting from how it looks now: "${w}".`
    : 'Change ONLY this, starting from how it looks now: make the part the second image shows look like it does there.';
  const ref = withRef
    ? ' The second image is only a reference for the shape and the colours of that change: take nothing else from it, and never copy a face or a person from it.'
    : '';
  const bg = key ? ` It stays on ${keyedBackground(key)}.` : '';
  const kept = who === 'bati' ? ' It stays the same small, cute mascot character (the same eyes, cheeks and charm).' : ' It stays the same person-like character with the same face and likeness.';
  return `${KEEP}${change}${ref}${kept}${bg} ${STEP_RULES}`;
}

/** the four touches of the four first pictures (Japanese anime that 15–20 year olds like), one per head-to-body ratio */
const PICK4_TOUCHES = [
  'a super-deformed chibi character with a big head and a tiny body, thick clean outlines, flat bright cel colours, like a mascot sticker',
  'a cute small-bodied anime character, soft rounded lines, pastel cel shading, like a light-hearted slice-of-life anime',
  'a modern TV-anime character, clean sharp line art, vivid cel shading with soft gradients in the hair and eyes',
  'a tall, stylish anime character with long legs, fine line art and a cool, cinematic anime-film finish',
] as const;

/**
 * D03-S004 (M-R334): the four first pictures of one's own look — the person of the photo (not split into boyish /
 * girlish: as they are) drawn in four Japanese-anime touches, each a different head-to-body ratio (2 / 3 / 5 / 7 heads).
 * No photo may be used (M-R250): the look wished for in words, drawn the same four ways.
 * Painted on a flat key colour: each is cut out by the checked cut-out (apps/api media/cutting.ts) before it is shown.
 */
export function lookPick4Prompt(variant: number, o: { photo: boolean; wish?: string; /** the flat key colour it is painted on (cut out afterwards) */ key?: string }): string {
  const i = ((variant % 4) + 4) % 4;
  const heads = LOOK_PICK4_HEADS[i];
  const who = o.photo
    ? 'Draw, do not photograph: turn the person in the attached photo into a drawn anime character — keep a clear likeness of their face shape, hairstyle, hair colour and the clothes they wear, as they are (do not make them more boyish or more girlish). Never a retouched photo. '
    : `Draw an original anime character from this wish: "${(o.wish ?? '').trim() || 'a friendly traveller of the stars'}". `;
  return (
    who +
    `Style: 2D Japanese anime illustration, ${PICK4_TOUCHES[i]}. Body proportions: exactly ${heads} heads tall. ` +
    `One single character, full body from head to toe, standing, facing the viewer, centred, on ${o.key ? keyedBackground(o.key) : 'a plain soft light background with no objects'}. ` +
    'No text, no letters, no logo, no watermark. It must not resemble or copy any character from an existing anime, game, film or brand; nothing sexual or revealing; nothing violent.'
  );
}

/**
 * The favourite food's NAME out of the answer as it was said (story M-R334: 「ゼロ時零分カレーだよ。」 → カレー; the bubble
 * keeps the sentence). Asked of the language model; anything odd (no model, an error, an answer that is not part of
 * what was said) falls back on the plain rules (shared foodNameByRules), so it is never empty and never invented.
 */
export async function foodNameOf(llm: LlmProvider | undefined, said: string): Promise<string> {
  const byRules = foodNameByRules(said);
  const text = said.trim();
  if (!llm || llm.name === 'mock' || !text) return byRules;
  try {
    const out = await llm.chat({
      system:
        'あなたは、話し言葉から食べ物の名前だけを取り出す係です。ユーザーの文は「好きな食べ物は？」への答えを音声認識したものです（関係ない言葉や聞き間違いが混ざることがあります）。' +
        '文の中に出てくる食べ物・飲み物の名前を、文に出てきた表記のまま、1つだけ返してください。説明・かぎかっこ・句読点はつけません。食べ物の名前が見つからない時は、NONE とだけ返してください。',
      history: [{ role: 'user', text }],
      temperature: 0,
      maxOutputTokens: 40,
    });
    const name = out.trim().replace(/^[「『"']+|[」』"'。．.]+$/gu, '').trim();
    if (!name || /^NONE$/i.test(name) || name.length > 40) return byRules;
    // never invented: the name must be in what was said (width / kana form aside)
    const norm = (t: string) => t.normalize('NFKC').replace(/\s/g, '');
    return norm(text).includes(norm(name)) ? name : byRules;
  } catch {
    return byRules;
  }
}
