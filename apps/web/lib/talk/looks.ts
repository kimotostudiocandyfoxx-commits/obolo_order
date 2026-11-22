import { BATI_FACE_TO_TALK, type BatiView, type Me, type TalkExpression, type TalkFace, type TalkLook } from '@obolo/shared';
import LAYERS from '@/lib/story/sprite-layers.json';
import MOUTHS from '@/lib/story/sprite-mouths.json';
import { spriteUrl } from '@/lib/onboarding/media';

/** M-R232: each speaker's colour on the ring (you are always blue) */
export const SELF_COLOR = '#5aa9ff';
export const BATI_COLOR = '#f2c46b';
const DACHI_COLORS = ['#ff8fb3', '#8be0a4', '#c59bff', '#ffb36b', '#6be0e0', '#f0e36b', '#ff7a7a'];
export const colorOf = (id: string, k = 0) => DACHI_COLORS[([...id].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, k) || k) % DACHI_COLORS.length];

/** your own look in the talk: the one made for it (Me.talk), else the standing look you chose */
export function selfLook(me: Me | null | undefined): TalkLook | null {
  if (!me) return null;
  if (me.talk) return me.talk;
  const stand = me.lookStandee || me.avatarUrl;
  return stand ? { of: me.avatarUrl ?? stand, stand } : null;
}

/** {bati}'s look in the talk: the one made for it, else its picture with the faces drawn at the hatching */
export function batiLook(b: BatiView | null | undefined, fallback?: string): TalkLook | null {
  if (b?.talk) return b.talk;
  const stand = b?.imageUrl || fallback;
  if (!stand) return null;
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
    return { of: 'kimorin', stand: spriteUrl('kimorin-xs-talk'), faces: { normal: f('talk'), smile: f('joy'), surprised: f('shock'), thinking: f('think'), sad: f('tears'), shy: f('blush') }, kororin: null };
  }
  if (kind === 'mikie') return { of: 'mikie', stand: spriteUrl('mikie'), kororin: null };
  return null;
}

/** where the talk is: the place behind the two (M-R232: the Moon on day 2, the planet when on a planet) */
export const PLACE_BG: Record<string, string> = {
  moon: '/onboarding/s/moon-surface.jpg',
  saturn: '/onboarding/s/saturn-inside.jpg',
};
