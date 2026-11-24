import { BATI_FACE_TO_TALK, SELF_TALK_TONES, TALK_COLOR_KEY, TALK_TONE_DEFAULT, TALK_TONES, type TalkToneDef, type BatiView, type Me, type TalkExpression, type TalkFace, type TalkLook } from '@obolo/shared';
import LAYERS from '@/lib/story/sprite-layers.json';
import MOUTHS from '@/lib/story/sprite-mouths.json';
import { spriteUrl } from '@/lib/onboarding/media';
import { castLook } from './demoLooks';

/** M-R232: each speaker's colour on the ring (you are always blue) */
/**
 * M-R245: each person's bubble colour, fixed (in a group too): muted tones, a faint vertical gradient, a 1.5 px line in the
 * same hue and the words in a deepened version of it (never black). The tones are shared (@obolo/shared talkTone.ts);
 * iPad feedback: everyone starts with 月光パール and asks {bati} to change it (the changeable 'talk.bubbleColour').
 */
export type TalkTone = TalkToneDef;
export const TONES: Record<string, TalkTone> = TALK_TONES;
/** the colours you may have for yourself ({bati} changes it; the Moon settings too) */
export const SELF_TONES: string[] = [...SELF_TALK_TONES];
/** the others in a group: one each, the same for that person every time */
const GROUP_TONES = ['rose', 'sky', 'apricot', 'lilac', 'greyblue'];
export const toneOf = (id: string) => TONES[GROUP_TONES[[...id].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % GROUP_TONES.length]];
/** your colour as kept (Me.story 'sys.talk_color'), else 月光パール */
export { TALK_COLOR_KEY };
export const selfTone = (me: Me | null | undefined) => TONES[me?.story?.[TALK_COLOR_KEY] ?? ''] ?? TONES[TALK_TONE_DEFAULT];

// the key colours (a person's line colour: names, glows)
export const SELF_COLOR = TONES.pearl.line;
export const BATI_COLOR = TONES.honey.line;
export const DACHI_COLOR = TONES.sage.line;
export const colorOf = (id: string, _k = 0) => toneOf(id).line;

/** your own look in the talk: the one made for it (Me.talk), else the standing look you chose; none yet → null (first person) */
export function selfLook(me: Me | null | undefined): TalkLook | null {
  // no look yet (the review pages play the story without an account): the talk cast's NEO stands in
  if (!me) return castLook('user');
  if (me.talk) return me.talk;
  const stand = me.lookStandee || me.avatarUrl;
  // M-R249: no look yet (day 1 until the look is made on day 2's Moon, or after 〔写真を消す〕): you are not shown — the
  // talk is first person (TalkScene: the partners face you, your words come from the bottom right)
  if (!stand) return null;
  // a drawn stand-in on its own square background (the browser demo's look) does not stand: the talk cast's NEO does
  if (stand?.startsWith('data:image/svg')) return castLook('user', stand);
  return stand ? { of: me.avatarUrl ?? stand, stand } : null;
}

/** {bati}'s look in the talk: the one made for it, else its picture with the faces drawn at the hatching */
export function batiLook(b: BatiView | null | undefined, fallback?: string): TalkLook | null {
  if (b?.talk) return b.talk;
  const stand = b?.imageUrl || fallback;
  if (!stand) return null;
  // a drawn stand-in in a box (the demo's / the review page's {bati}) does not stand: the talk cast's {bati} does
  if (stand.startsWith('data:') || /\/story\/avatars\/|-face\.webp$/.test(stand)) return castLook('bati', stand);
  const faces: Partial<Record<TalkFace, TalkExpression>> = {};
  for (const [k, url] of Object.entries(b?.faces ?? {})) {
    const f = BATI_FACE_TO_TALK[k];
    if (f && url) faces[f] = { kind: 'image', url };
  }
  return { of: stand, stand, faces };
}

type Box = { x: number; y: number; w: number; h: number };
/** a story sprite as a talk expression: its open-mouth patch where scripts/kimorin/build.py found it */
function spriteExpr(stem: string): TalkExpression {
  const parts = (LAYERS as Record<string, string[]>)[stem] ?? [];
  const box = (MOUTHS as Record<string, Box>)[stem];
  return { kind: 'image', url: spriteUrl(stem), ...(parts.includes('mouth') ? { mouth: spriteUrl(`${stem}-mouth`), ...(box ? { mouthBox: box } : {}) } : {}) };
}

/** the story characters' looks (KIMORIN⭐︎ with his cut poses, MIKIE⭐︎DRILL) */
export function characterLook(kind: string): TalkLook | null {
  if (kind === 'kimorin') {
    const f = (s: string) => spriteExpr(`kimorin-xs-${s}`);
    return { of: 'kimorin', stand: spriteUrl('kimorin-xs-talk'), faces: { normal: f('talk'), smile: f('joy'), surprised: f('shock'), thinking: f('think'), sad: f('tears'), shy: f('blush') } };
  }
  if (kind === 'mikie') return { of: 'mikie', stand: spriteUrl('mikie') };
  return null;
}

/** where the talk is: the place behind the two (M-R232: the Moon on day 2, the planet when on a planet) */
export const PLACE_BG: Record<string, string> = {
  moon: '/talk/bg-moon.webp',
  saturn: '/onboarding/s/saturn-inside.jpg',
};
