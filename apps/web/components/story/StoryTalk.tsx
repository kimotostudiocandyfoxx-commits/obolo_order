'use client';

import { ruleBeats, type TalkExpression, type TalkFace, type TalkLook, type TalkMotion } from '@obolo/shared';
import type { TalkItem, TalkPerson } from '@/components/talk/TalkScene';
import LAYERS from '@/lib/story/sprite-layers.json';
import MOUTHS from '@/lib/story/sprite-mouths.json';
import { spriteUrl, stillShows } from '@/lib/onboarding/media';
import { exprFor } from '@/lib/story/expression';
import { batiLook, TONES, toneOf } from '@/lib/talk/looks';
import { castLook } from '@/lib/talk/demoLooks';
import { charSpec } from './Stage';
import type { Speaker, StoryVars } from '@/lib/onboarding/script';

/**
 * The story's lines in the side-by-side talk (会話の画面 M-R241〜M-R249, client M-R251: "all conversations take this
 * form"): who stands in the row for the scene, their looks (the painted story characters with their poses and talking
 * mouths), the bubble colours, and the thread's lines as talk items. The scene behind (motions, stills) stays the
 * story's own; the talk is laid over it.
 */

/** the story's pictures: which sprite is which speaker */
const SPRITE_OF: Record<string, Speaker> = {
  monban: 'MONBAN',
  obolon: 'OBOLON',
  'obolon-pit': 'OBOLON',
  'kimorin-sun': 'KIMORIN',
  'kimorin-n': 'KIMORIN',
  'kimorin-g': 'KIMORIN',
  'kimorin-i': 'KIMORIN',
  'kimorin-iu': 'KIMORIN',
  kimorin: 'KIMORIN',
  'kimorin-1': 'KIMORIN',
  'kimorin-2': 'KIMORIN',
  'kimorin-3': 'KIMORIN',
  'kimorin-8': 'KIMORIN',
  'kimorin-dragon': 'KIMORIN',
  'takoyaki-brother': 'たこ焼きブラザー',
  'takoyaki-sister': 'たこ焼きシスター',
  kaiser1: '大根カイザー',
  'daikon-kaiser': '大根カイザー',
  freezy: 'フリージー',
  hipokin: 'ヒポキン',
  'unchi-pinpon': 'うんちピンポンくん',
  bossg: 'ボスG',
  hatg: 'ハットG',
  longg: 'ロングG',
  mikie: 'MIKIE⭐︎DRILL',
  '@bati': 'バティ',
  '@bati-weak': 'バティ',
};
/** a speaker's picture when nobody put one on stage (the plain one) */
const DEFAULT_SPRITE: Partial<Record<Speaker, string>> = {
  MONBAN: 'monban',
  OBOLON: 'obolon',
  たこ焼きブラザー: 'takoyaki-brother',
  たこ焼きシスター: 'takoyaki-sister',
  大根カイザー: 'kaiser1',
  フリージー: 'freezy',
  ヒポキン: 'hipokin',
  うんちピンポンくん: 'unchi-pinpon',
  ボスG: 'bossg',
  ハットG: 'hatg',
  ロングG: 'longg',
  'MIKIE⭐︎DRILL': 'mikie',
  バティ: '@bati',
};
export const speakerOfSprite = (name: string): Speaker | null => SPRITE_OF[name] ?? null;
/** the talk id of a speaker (KIMORIN and KIMORIN⭐︎ are one) */
export const talkId = (who: string) => (who.startsWith('KIMORIN') ? 'KIMORIN' : who);

/** M-R245: each one's bubble colour, fixed ({bati} はちみつ; the cast in the group colours, one each) */
const TONE_OF: Record<string, keyof typeof TONES> = { KIMORIN: 'apricot', MONBAN: 'greyblue', OBOLON: 'lilac', バティ: 'honey', たこ焼きブラザー: 'rose', たこ焼きシスター: 'rose', うんちピンポンくん: 'sage', 'MIKIE⭐︎DRILL': 'rose' };
const toneFor = (id: string) => TONES[TONE_OF[id] ?? ''] ?? toneOf(id);

/** the size in the row (the painted pictures have no headroom: kept under the bubbles; small ones smaller) */
const SCALE: Record<string, number> = { monban: 0.86, obolon: 0.62, 'obolon-pit': 0.62, 'unchi-pinpon': 0.42, freezy: 0.72, mikie: 0.76 };
const scaleOf = (sprite: string) => SCALE[sprite] ?? (sprite.startsWith('@') ? 1 : 0.84);
/** the round ones (OBOLON, {bati}) stand at 58% of their height (Figure's wide rule) */
const headOf = (sprite: string) => {
  const s = scaleOf(sprite);
  if (sprite.startsWith('obolon')) return 1 - s * 0.58 + 0.04;
  if (sprite.startsWith('@')) return 1 - 0.58 + 0.06;
  return 1 - s + 0.02;
};

type Box = { x: number; y: number; w: number; h: number };
/** a painted picture as a talk expression: its open-mouth patch where scripts/kimorin/build.py found it */
function paint(stem: string): TalkExpression {
  const parts = (LAYERS as Record<string, string[]>)[stem] ?? [];
  const box = (MOUTHS as Record<string, Box>)[stem];
  return { kind: 'image', url: spriteUrl(stem), ...(parts.includes('mouth') ? { mouth: spriteUrl(`${stem}-mouth`), ...(box ? { mouthBox: box } : {}) } : {}) };
}

/** the story's pose names → the talk's six faces (the bubble's face rules, the past view) */
const POSE_FACE: Record<string, TalkFace> = { joy: 'smile', shock: 'surprised', think: 'thinking', tears: 'sad', blush: 'shy', smile: 'smile', sparkle: 'smile' };
const POSE_MOTION: Record<string, TalkMotion> = { joy: 'hop', shock: 'lean', think: 'tilt', tears: 'shrink', blush: 'sway', point: 'nod', smile: 'hop', sparkle: 'hop' };

/** a painted story character's look: the standing picture, and every pose it has by name (talk, point, joy …) */
export function spriteLook(sprite: string, v: StoryVars): TalkLook | null {
  if (sprite === '@bati' || sprite === '@bati-weak') {
    const look = batiLook(v.batiImage ? { imageUrl: v.batiImage, faces: v.batiFaces } as never : null);
    if (!look) return null;
    // the story's {bati} faces by name (〔表情：@bati smile〕)
    const named: Record<string, TalkExpression> = {};
    for (const [k, url] of Object.entries(v.batiFaces ?? {})) if (url) named[k] = { kind: 'image', url };
    return { ...look, named };
  }
  const spec = charSpec(sprite);
  const faces = spec.faces ?? {};
  const named: Record<string, TalkExpression> = {};
  for (const [k, file] of Object.entries(faces)) named[k] = paint(file);
  const rest = spec.rest && faces[spec.rest] ? named[spec.rest] : paint(sprite);
  return { of: sprite, stand: (rest as { url: string }).url, faces: { normal: rest }, named };
}

/** your own look in the story's talk: none until the look is made on day 2's Moon (M-R249: first person) */
export function storySelfLook(url: string | undefined, made: boolean): TalkLook | null {
  if (url) return url.startsWith('data:image/svg') ? castLook('user', url) : { of: url, stand: url };
  // the review pages play later days without an account: the talk cast's NEO stands in once the look exists
  return made ? castLook('user') : null;
}

export type StoryEntry = { id: string; kind: 'them'; who: Speaker; text: string } | { id: string; kind: 'me'; text: string; action?: boolean } | { id: string; kind: 'sys'; text: string };

/**
 * The row for the scene: the pictures on stage (left to right, as the script placed them), then whoever has spoken in
 * this thread and is not among them (their plain picture), you at the right. A voice not seen yet (「？？？」) and a
 * speaker with no picture are heard only (their bubbles, no figure).
 */
export function storyPeople({
  onStage,
  entries,
  speaking,
  inScene = () => true,
  v,
  self,
  name,
  speakerName,
  kimorinSprite,
}: {
  onStage: string[];
  entries: StoryEntry[];
  /** a line said in this scene (the ones from before it keep their bubbles but not their place in the row) */
  inScene?: (e: StoryEntry) => boolean;
  speaking: Speaker | null;
  v: StoryVars;
  self: TalkLook | null;
  name: string;
  speakerName: (who: Speaker) => string;
  /** KIMORIN's look today (the last kimorin-* picture), for when he speaks without being put on stage */
  kimorinSprite: string;
}): { people: TalkPerson[]; sprites: Map<string, string> } {
  const sprites = new Map<string, string>();
  const order: string[] = [];
  const add = (id: string, sprite: string) => {
    if (sprites.has(id)) return;
    sprites.set(id, sprite);
    order.push(id);
  };
  for (const s of onStage) {
    const who = speakerOfSprite(s);
    if (who) add(talkId(who), s);
  }
  const spoke = [...entries.flatMap((e) => (e.kind === 'them' && inScene(e) ? [e.who] : [])), ...(speaking ? [speaking] : [])];
  for (const who of spoke) {
    const id = talkId(who);
    if (sprites.has(id)) continue;
    const sprite = id === 'KIMORIN' ? kimorinSprite : DEFAULT_SPRITE[who];
    if (sprite) add(id, sprite);
  }
  const people: TalkPerson[] = [];
  // at most three stand with you (more crowd the phone): the latest to speak stay
  // (the one speaking now always; then whoever spoke last; then the ones the script put on stage)
  const last = (id: string) => {
    for (let k = spoke.length - 1; k >= 0; k--) if (talkId(spoke[k]) === id) return k;
    return onStage.some((s) => sprites.get(id) === s) ? -1 : -2;
  };
  const keep = order.length > 3 ? [...order].sort((a, b) => last(b) - last(a)).slice(0, 3) : order;
  for (const id of order) {
    const sprite = sprites.get(id)!;
    const look = spriteLook(sprite, v);
    const t = toneFor(id);
    const who = (id === 'KIMORIN' ? 'KIMORIN' : id) as Speaker;
    people.push({ id, name: speakerName(who), look, color: t.line, tone: t, scale: scaleOf(sprite), headAt: headOf(sprite), offstage: !look || !keep.includes(id) });
  }
  // heard only: 「？？？」, a speaker with no picture, and who spoke before this scene
  for (const who of entries.flatMap((e) => (e.kind === 'them' ? [e.who] : []))) {
    const id = talkId(who);
    if (people.some((p) => p.id === id)) continue;
    const t = toneFor(id);
    people.push({ id, name: speakerName(who), look: null, color: t.line, tone: t, offstage: true });
  }
  people.push({ id: 'me', name, look: self, color: TONES.pearl.line, tone: TONES.pearl, self: true });
  return { people, sprites };
}

/** a still that already shows one of the row's characters: it goes soft behind them (depth of field) */
export const stillShowsAny = (still: string | null, people: TalkPerson[]) => !!still && people.some((p) => !p.self && !p.offstage && stillShows(still, p.id));

/** the thread as talk items (the deeds — 〔封を開く〕 — and the narration stay out: the narration is its own line) */
export function storyItems({
  entries,
  gen,
  text,
  sprites,
  expr,
}: {
  entries: StoryEntry[];
  gen: number;
  text: (e: Extract<StoryEntry, { kind: 'them' }>) => string;
  sprites: Map<string, string>;
  /** a line's pose by hand (the script's expr / a face step), else from the words */
  expr: (e: Extract<StoryEntry, { kind: 'them' }>) => string | undefined;
}): TalkItem[] {
  const out: TalkItem[] = [];
  for (const e of entries) {
    if (e.kind === 'sys' || (e.kind === 'me' && e.action)) continue;
    if (e.kind === 'me') {
      // an answer written as a deed of saying (〔「そのアート、好きだよ」と言う〕): the bubble holds the words said
      const said = e.text.match(/^「([^」]+)」と(?:言う|いう|答える|こたえる|話す|聞く|きく|伝える)$/);
      out.push({ id: `${gen}:${e.id}`, who: 'me', text: said ? said[1] : e.text });
      continue;
    }
    const id = talkId(e.who);
    const sprite = sprites.get(id);
    const hand = expr(e);
    const pose = hand ?? (sprite && !sprite.startsWith('@') ? exprFor(e.who, e.text) : undefined);
    const face = pose ? POSE_FACE[pose] : undefined;
    const motion = pose ? POSE_MOTION[pose] : undefined;
    const words = text(e);
    // the words' rules give each sentence its bubble (M-R243: shout, muse, whisper); a painted pose decides the face
    // for the whole line, and its motion comes with the first sentence
    const beats = ruleBeats(words).map((b, k) => ({ ...b, ...(face ? { face } : {}), ...(k === 0 && motion ? { motion } : {}) }));
    out.push({
      id: `${gen}:${e.id}`,
      who: id,
      text: words,
      ...(e.who === '？？？' ? { name: '？？？' } : {}),
      ...(pose && pose !== 'stand' ? { pose } : {}),
      ...(beats.length ? { faces: beats } : {}),
    });
  }
  return out;
}
