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

/** someone's look in the talk: the standing figure, its expressions and its コロリン mini (M-R233) */
export interface TalkLook {
  /** the picture it was made from (when the look changes, everything is made again) */
  of: string;
  /** the decided look as a standing figure (no background) */
  stand: string;
  faces?: Partial<Record<TalkFace, TalkExpression>>;
  /** M-R233: a small, round chibi of this look (holds the word tag on the ring); none = the look cut round stands in */
  kororin?: string | null;
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

/** your own look: only the gentle faces (M-R234); `fixed` = 「表情を変えない」 */
export function selfFace(face: TalkFace, fixed = false): TalkFace {
  if (fixed) return 'normal';
  return (SELF_TALK_FACES as readonly TalkFace[]).includes(face) ? face : 'normal';
}

export const isTalkFace = (s: unknown): s is TalkFace => typeof s === 'string' && (TALK_FACES as readonly string[]).includes(s);
export const isTalkMotion = (s: unknown): s is TalkMotion => typeof s === 'string' && (TALK_MOTIONS as readonly string[]).includes(s);

/** the old {bati} face names (M-R139) → the talk's six */
export const BATI_FACE_TO_TALK: Record<string, TalkFace> = { smile: 'smile', surprise: 'surprised', think: 'thinking', sad: 'sad', shy: 'shy' };

/** M-R233: the ring turns into コロリン at D04-S005c (day 3, Saturn): the story flag, kept with the day */
export const KORORIN_RING_FLAG = 'd3.f_kororin_ring';
/** whether the talk's ring shows コロリン (the flag, or any later day in case it was not kept) */
export const kororinRing = (me: { story?: Record<string, string>; journeyDay: number } | null | undefined) => !!me && (me.story?.[KORORIN_RING_FLAG] === 'true' || me.journeyDay >= 4);
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
}

/** an utterance cut into sentences (the end marks stay with their sentence; 「……」 and 「w」 too) */
export function talkSentences(text: string): string[] {
  const out = text.match(/[^。！？!?…\n]+(?:[。！？!?…]+|[wｗ笑]+(?=\s|$)|$)|…+/g) ?? [];
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
    return self ? brightBeat(b) : b;
  });
}

/** your own look: only the bright faces (M-R234 / M-R238) — a dark sentence stays plain */
export function brightBeat(b: TalkBeat): TalkBeat {
  if ((SELF_TALK_FACES as readonly TalkFace[]).includes(b.face)) return b;
  return { face: 'normal', ...(b.motion === 'tilt' || b.motion === 'nod' ? { motion: b.motion } : {}) };
}

/** a beat list as JSON from a model, checked: unknown faces / motions drop to plain; at most one per sentence */
export function readBeats(raw: unknown, sentences: number): TalkBeat[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = raw.slice(0, Math.max(1, sentences)).map((x): TalkBeat => {
    const o = (x ?? {}) as Record<string, unknown>;
    const face = o.e ?? o.face ?? o.expression;
    const motion = o.m ?? o.motion;
    return { face: isTalkFace(face) ? face : 'normal', ...(isTalkMotion(motion) && motion !== 'none' ? { motion } : {}) };
  });
  return out;
}
