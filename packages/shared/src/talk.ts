/**
 * 隣に並ぶトーク (M-R232〜M-R235): the side-by-side talk — the speakers stand next to each other, the bubbles over their
 * heads, older words on a ring. These are the shapes the web, the api and the image jobs share.
 */

/** M-R234: the six expressions every look gets (free); more come later with mana (TALK_EXTRA_FACES, placeholder) */
export const TALK_FACES = ['normal', 'smile', 'surprised', 'thinking', 'sad', 'shy'] as const;
export type TalkFace = (typeof TALK_FACES)[number];
/** M-R234: your own look stays gentle — no dark faces */
export const SELF_TALK_FACES = ['normal', 'smile', 'surprised', 'shy'] as const satisfies readonly TalkFace[];
/** PLACEHOLDER (P-TALK-1): 「表情を足す」 (ドヤ顔・泣き笑い・怒った顔 …, mana) — not made yet */
export const TALK_EXTRA_FACES = [] as const;

/**
 * M-R235: the reactions that come back with the expression in the same reply (no extra call). `none` = only the face.
 * hop = a little jump (a good thing said), lean = leans back (surprised), nod = nods, tilt = tilts the head, sway = a slow
 * happy sway, shrink = droops a little (sad).
 */
export const TALK_MOTIONS = ['none', 'hop', 'lean', 'nod', 'tilt', 'sway', 'shrink'] as const;
export type TalkMotion = (typeof TALK_MOTIONS)[number];

/** where a part sits on its picture: left, top, width, height as fractions (0..1) of the whole picture */
export interface PartBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One expression (M-R234 §7): a still picture with its swap parts (M-R235: an eyes-closed patch for the blink, an
 * open-mouth patch for the lip flap, each with where it sits), or — later, a members' add-on — a short looping video.
 * The container takes either, so a video can be added without changing the shape.
 */
export type TalkExpression =
  | {
      kind: 'image';
      /** the whole figure, without a background */
      url: string;
      /** M-R235: the eyes closed — a small patch laid at `eyesBox` (the whole picture when no box) */
      blink?: string;
      eyesBox?: PartBox;
      /** M-R235: the mouth open — a small patch laid at `mouthBox` (the whole picture when no box) */
      mouth?: string;
      mouthBox?: PartBox;
    }
  | {
      kind: 'video';
      /** a short loop, without a background (webm with alpha, or an mp4 on the place's colour) */
      url: string;
      poster?: string;
      /** M-R234 §7: a members' add-on (not made now) */
      members?: boolean;
    };

/**
 * M-R240: an expression's own pose (smile = both hands up, surprised = leaning back, thinking = a hand on the chin, sad =
 * shoulders down, shy = scratching the head) — whole pictures aligned to the same feet, with their own eyes-closed and
 * open-mouth pictures. The second tier over the plain standing faces; a face without one keeps its standing picture.
 */
export interface TalkPose {
  url: string;
  blink?: string;
  mouth?: string;
}

/** someone's look in the talk: the standing figure, its expressions and its コロリン mini (M-R233) */
export interface TalkLook {
  /** the picture it was made from (when the look changes, everything is made again) */
  of: string;
  /** the decided look as a standing figure (no background) */
  stand: string;
  faces?: Partial<Record<TalkFace, TalkExpression>>;
  /** M-R240: the expressions' poses (the second tier); missing = the face's standing picture */
  poses?: Partial<Record<TalkFace, TalkPose>>;
  /** still being made in the background */
  making?: boolean;
}

/** the expression to show: the face asked for, or the nearest one there is, or the standing figure */
export function talkExpression(look: Pick<TalkLook, 'stand' | 'faces'> | null | undefined, face: TalkFace = 'normal'): TalkExpression | null {
  if (!look) return null;
  const near: Record<TalkFace, TalkFace[]> = {
    normal: ['normal'],
    smile: ['smile', 'normal'],
    surprised: ['surprised', 'normal'],
    thinking: ['thinking', 'normal'],
    sad: ['sad', 'normal'],
    shy: ['shy', 'smile', 'normal'],
  };
  for (const f of near[face]) {
    const e = look.faces?.[f];
    if (e) return e;
  }
  return look.stand ? { kind: 'image', url: look.stand } : null;
}

/** M-R240: the pose of a face as an expression (null: none — the standing face is used) */
export function talkPose(look: Pick<TalkLook, 'poses'> | null | undefined, face: TalkFace): TalkExpression | null {
  if (face === 'normal') return null;
  const p = look?.poses?.[face];
  return p ? { kind: 'image', url: p.url, ...(p.blink ? { blink: p.blink } : {}), ...(p.mouth ? { mouth: p.mouth } : {}) } : null;
}

/** your own look: only the gentle faces (M-R234); `fixed` = 「表情を変えない」 */
export function selfFace(face: TalkFace, fixed = false): TalkFace {
  if (fixed) return 'normal';
  return (SELF_TALK_FACES as readonly TalkFace[]).includes(face) ? face : 'normal';
}

export const isTalkFace = (s: unknown): s is TalkFace => typeof s === 'string' && (TALK_FACES as readonly string[]).includes(s);
export const isTalkMotion = (s: unknown): s is TalkMotion => typeof s === 'string' && (TALK_MOTIONS as readonly string[]).includes(s);

/** the old {bati} face names (M-R139) → the talk's six */
export const BATI_FACE_TO_TALK: Record<string, TalkFace> = { smile: 'smile', surprise: 'surprised', think: 'thinking', sad: 'sad', shy: 'shy' };

/** M-R234: 「表情を変えない」 (your own look keeps its plain face): a sys story value */
export const TALK_FIXED_FACE_KEY = 'sys.talk_fixed_face';

/**
 * M-R238: an utterance's expressions, sentence by sentence — nobody picks them by hand; they come from the words. The
 * face switches as the bubble's words come out (or as the voice goes on). {bati}'s come from the reply's own call; yours
 * and a dachi's from one small call on sending, or these rules when it cannot be had.
 */
export interface TalkBeat {
  face: TalkFace;
  motion?: TalkMotion;
  /** M-R243: how the bubble comes in (pop / slam / slow / shake) and its shape (round / burst / cloud / whisper) */
  in?: TalkIn;
  shape?: TalkShape;
  /** M-R244: a new bubble starts at this sentence (a long utterance shown as several) */
  br?: boolean;
}

/** an utterance cut into sentences (the end marks stay with their sentence; 「……」 and 「w」 too) */
export function talkSentences(marked: string): string[] {
  const text = talkPlain(marked);
  // a leading 「……」 belongs to the sentence after it
  const out = text.match(/(?:[…‥]+)?[^。！？!?…‥\n]+(?:[。！？!?…‥]+|[wｗ笑]+(?=\s|$)|$)|[…‥]+/g) ?? [];
  const parts = out.map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : text.trim() ? [text.trim()] : [];
}

/**
 * M-R238's rules when no AI can be had: a question → a head tilt ('thinking'); 「！」「笑」「w」 → a smile; 「……」 → a
 * little sad; else plain. `self`: your own look only shows the bright faces.
 */
export function ruleBeats(text: string, self = false): TalkBeat[] {
  return talkSentences(text).map((s) => {
    const t = s.trim();
    let b: TalkBeat;
    if (/[！!][？?]+$|[？?][！!]+$/.test(t)) b = { face: 'surprised', motion: 'lean' };
    else if (/[？?]$/.test(t)) b = { face: 'thinking', motion: 'tilt' };
    else if (/(…|‥|\.\.\.)$/.test(t) || /…{2,}/.test(t)) b = { face: 'sad' };
    else if (/[！!]$|[笑wｗ]$/.test(t)) b = { face: 'smile', motion: /[！!]{1}$/.test(t) && /(やった|すごい|うれし|嬉し|たのし|楽し)/.test(t) ? 'hop' : undefined };
    else b = { face: 'normal' };
    // M-R243: 「！！」「！？」 shout; 「……」 at the start or the end muses; a whisper is small; else it pops
    if (/[！!]{2,}|[！!][？?]|[？?][！!]/.test(t)) Object.assign(b, { in: 'slam', shape: 'burst' });
    else if (/^(…|‥)|(…|‥)[。]?$/.test(t)) Object.assign(b, { in: 'slow', shape: 'cloud' });
    else if (/（小声）|\(小声\)|ひそひそ|こっそり/.test(t)) Object.assign(b, { in: 'slow', shape: 'whisper' });
    return self ? brightBeat(b) : b;
  });
}

/** your own look: only the bright faces (M-R234 / M-R238) — a dark sentence stays plain */
export function brightBeat(b: TalkBeat): TalkBeat {
  if ((SELF_TALK_FACES as readonly TalkFace[]).includes(b.face)) return b;
  return { ...b, face: 'normal', ...(b.motion === 'tilt' || b.motion === 'nod' ? { motion: b.motion } : { motion: undefined }) };
}

/** a beat list as JSON from a model, checked: unknown faces / motions drop to plain; at most one per sentence */
export function readBeats(raw: unknown, sentences: number): TalkBeat[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = raw.slice(0, Math.max(1, sentences)).map((x): TalkBeat => {
    const o = (x ?? {}) as Record<string, unknown>;
    const face = o.e ?? o.face ?? o.expression;
    const motion = o.m ?? o.motion;
    const inn = o.in;
    const shape = o.shape;
    return {
      face: isTalkFace(face) ? face : 'normal',
      ...(isTalkMotion(motion) && motion !== 'none' ? { motion } : {}),
      ...(isTalkIn(inn) && inn !== 'pop' ? { in: inn } : {}),
      ...(isTalkShape(shape) && shape !== 'round' ? { shape } : {}),
      ...(o.br === true ? { br: true } : {}),
    };
  });
  return out;
}

/** M-R243: how a sentence's bubble comes in, and its shape (chosen with the face, in the same call) */
export const TALK_INS = ['pop', 'slam', 'slow', 'shake'] as const;
export type TalkIn = (typeof TALK_INS)[number];
export const TALK_SHAPES = ['round', 'burst', 'cloud', 'whisper'] as const;
export type TalkShape = (typeof TALK_SHAPES)[number];
export const isTalkIn = (s: unknown): s is TalkIn => typeof s === 'string' && (TALK_INS as readonly string[]).includes(s);
export const isTalkShape = (s: unknown): s is TalkShape => typeof s === 'string' && (TALK_SHAPES as readonly string[]).includes(s);

/**
 * M-R243 / M-R245: the marks words may carry — **bold**, ^^a little larger^^, !!a shout!! (one a sentence), and once in a
 * whole message a special one: [[金:…]] celebration, [[赤:…]] a cry, [[かわいい:…]] cute, [[しんみり:…]] eerie / quiet.
 * Nothing else is markup: everything else is shown as the letters it is.
 */
export type TalkMark = 'b' | 'big' | 'shout' | 'gold' | 'red' | 'cute' | 'eerie';
const MARKS: Record<string, TalkMark> = { '**': 'b', '^^': 'big', '!!': 'shout' };
const SPECIAL: Record<string, TalkMark> = { 金: 'gold', 赤: 'red', かわいい: 'cute', しんみり: 'eerie' };
const MARK_RE = () => /\[\[(金|赤|かわいい|しんみり):(.+?)\]\]|(\*\*|\^\^|!!)(.+?)\3/g;
/** marked words → runs of plain text with their mark ('' = none); an unclosed mark is dropped from view */
export function talkRuns(text: string): { t: string; c: TalkMark | '' }[] {
  const out: { t: string; c: TalkMark | '' }[] = [];
  const re = MARK_RE();
  let k = 0;
  let m: RegExpExecArray | null;
  const plain = (t: string) => t.replace(/\*\*|\^\^/g, '');
  while ((m = re.exec(text))) {
    if (m.index > k) out.push({ t: plain(text.slice(k, m.index)), c: '' });
    out.push(m[1] ? { t: m[2], c: SPECIAL[m[1]] } : { t: m[4], c: MARKS[m[3]] });
    k = re.lastIndex;
  }
  if (k < text.length) out.push({ t: plain(text.slice(k)), c: '' });
  return out.filter((r) => r.t);
}
/** the words without their marks */
export const talkPlain = (text: string) => talkRuns(text).map((r) => r.t).join('');

/**
 * M-R244: a long utterance is shown as several bubbles, one after another — only where to cut is chosen, the words never
 * change. Up to about 40 characters stays whole; cuts only at a sentence's end (。！？, a line break); 2–3 sentences
 * (60–80 characters) a bubble; five at most. `beats[k].br` (from the same call as the faces) starts a new bubble at
 * sentence k; without them, sentences are grouped to about 60 characters. Returns each bubble's words (the marked text
 * as written: joined they are the utterance exactly) and which sentences it holds.
 */
export interface TalkChunk {
  text: string;
  /** the sentences it holds: [from, to) */
  from: number;
  to: number;
}
export function talkChunks(marked: string, beats?: { br?: boolean }[]): TalkChunk[] {
  const parts = talkSentences(marked);
  const plainLen = [...talkPlain(marked)].length;
  if (parts.length <= 1 || plainLen <= 40) return [{ text: marked, from: 0, to: Math.max(1, parts.length) }];
  // sentence k ends after this many plain characters
  const flat = talkPlain(marked);
  const ends: number[] = [];
  let from = 0;
  for (const p of parts) {
    const i = flat.indexOf(p, from);
    from = (i < 0 ? from : i) + p.length;
    ends.push([...flat.slice(0, from)].length);
  }
  // where to start a new bubble (a sentence index > 0)
  let starts: number[] = [];
  if (beats?.some((b) => b.br)) starts = beats.map((b, k) => (k > 0 && k < parts.length && b.br ? k : -1)).filter((k) => k > 0);
  else {
    let size = 0;
    parts.forEach((p, k) => {
      const len = [...p].length;
      if (k > 0 && size > 0 && size + len > 64) {
        starts.push(k);
        size = 0;
      }
      size += len;
    });
  }
  // five at most: the shortest neighbours are merged
  while (starts.length > 4) {
    const bounds = [0, ...starts, parts.length];
    let best = 1;
    let bestLen = Infinity;
    for (let s = 1; s < bounds.length - 1; s++) {
      const len = (ends[bounds[s + 1] - 1] ?? 0) - (ends[bounds[s - 1] - 1] ?? 0);
      if (len < bestLen) (bestLen = len), (best = s);
    }
    starts = starts.filter((_, k) => k !== best - 1);
  }
  // cut the marked text after the plain character ends[k - 1] (a closing mark right after stays with it)
  const cutAt = (plainEnd: number) => {
    const re = MARK_RE();
    const tokens = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(marked))) {
      const inner = m[1] ? m[2] : m[4];
      const open = m[0].indexOf(inner);
      for (let j = 0; j < open; j++) tokens.add(m.index + j);
      for (let j = open + inner.length; j < m[0].length; j++) tokens.add(m.index + j);
    }
    // stray ** / ^^ are not words either (talkRuns drops them)
    for (const s of marked.matchAll(/\*\*|\^\^/g)) for (let j = 0; j < 2; j++) tokens.add(s.index! + j);
    let seen = 0;
    let i = 0;
    const chars = [...marked];
    let off = 0;
    for (; i < chars.length && seen < plainEnd; i++) {
      if (!tokens.has(off)) seen++;
      off += chars[i].length;
    }
    while (i < chars.length && tokens.has(off)) {
      off += chars[i].length;
      i++;
    }
    // the space after a sentence stays with it
    while (i < chars.length && /\s/.test(chars[i])) {
      off += chars[i].length;
      i++;
    }
    return off;
  };
  const out: TalkChunk[] = [];
  let at = 0;
  const bounds = [0, ...starts, parts.length];
  for (let s = 0; s < bounds.length - 1; s++) {
    const end = s === bounds.length - 2 ? marked.length : cutAt(ends[bounds[s + 1] - 1]);
    out.push({ text: marked.slice(at, end), from: bounds[s], to: bounds[s + 1] });
    at = end;
  }
  return out;
}
