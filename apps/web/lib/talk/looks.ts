import { BATI_FACE_TO_TALK, type BatiView, type Me, type TalkExpression, type TalkFace, type TalkLook } from '@obolo/shared';
import LAYERS from '@/lib/story/sprite-layers.json';
import MOUTHS from '@/lib/story/sprite-mouths.json';
import { spriteUrl } from '@/lib/onboarding/media';
import { castLook } from './demoLooks';

/** M-R232: each speaker's colour on the ring (you are always blue) */
/**
 * M-R245: each person's bubble colour, fixed (in a group too): muted tones, a faint vertical gradient, a 1.5 px line in the
 * same hue and the words in a deepened version of it (never black). You pick yours once (月光パール unless you do).
 */
export type TalkTone = { id: string; name: string; a: string; b: string; line: string; ink: string };
export const TONES: Record<string, TalkTone> = {
  pearl: { id: 'pearl', name: '月光パール', a: '#f7f4fd', b: '#e7e1f6', line: '#9a8fc4', ink: '#2b2550' },
  honey: { id: 'honey', name: 'はちみつクリーム', a: '#fbf0d9', b: '#f0dcb0', line: '#c29a52', ink: '#4a3410' },
  sage: { id: 'sage', name: 'セージ', a: '#eef4ee', b: '#d9e6db', line: '#86a58e', ink: '#253d2c' },
  rose: { id: 'rose', name: 'くすみローズ', a: '#fbeff0', b: '#efd6da', line: '#b98790', ink: '#4a2730' },
  sky: { id: 'sky', name: '霧の空色', a: '#eef4fa', b: '#d6e4f1', line: '#87a3c2', ink: '#22374e' },
  apricot: { id: 'apricot', name: '杏', a: '#fdf1e8', b: '#f5dcc6', line: '#c79a73', ink: '#4a3018' },
  lilac: { id: 'lilac', name: 'ライラック', a: '#f5f0fb', b: '#e3d8f1', line: '#a48cc6', ink: '#35254f' },
  greyblue: { id: 'greyblue', name: '灰青', a: '#eef1f5', b: '#d8dee7', line: '#8a97a9', ink: '#283344' },
};
/** the colours you may pick for yourself (once, at the first talk; changeable in the settings) */
export const SELF_TONES = ['pearl', 'sky', 'rose', 'sage', 'apricot', 'lilac'];
/** the others in a group: one each, the same for that person every time */
const GROUP_TONES = ['rose', 'sky', 'apricot', 'lilac', 'greyblue'];
export const toneOf = (id: string) => TONES[GROUP_TONES[[...id].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % GROUP_TONES.length]];
/** your colour as you picked it (Me.story 'sys.talk_color'), else 月光パール */
export const TALK_COLOR_KEY = 'sys.talk_color';
export const selfTone = (me: Me | null | undefined) => TONES[me?.story?.[TALK_COLOR_KEY] ?? ''] ?? TONES.pearl;

// the key colours (a person's line colour: names, glows)
export const SELF_COLOR = TONES.pearl.line;
export const BATI_COLOR = TONES.honey.line;
export const DACHI_COLOR = TONES.sage.line;
export const colorOf = (id: string, _k = 0) => toneOf(id).line;

/** your own look in the talk: the one made for it (Me.talk), else the standing look you chose */
export function selfLook(me: Me | null | undefined): TalkLook | null {
  // no look yet (the review pages play the story without an account): the talk cast's NEO stands in
  if (!me) return castLook('user');
  if (me.talk) return me.talk;
  const stand = me.lookStandee || me.avatarUrl;
  if (!stand) return castLook('user');
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
  if (stand.startsWith('data:image/svg') || /\/story\/avatars\/|-face\.webp$/.test(stand)) return castLook('bati', stand);
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
