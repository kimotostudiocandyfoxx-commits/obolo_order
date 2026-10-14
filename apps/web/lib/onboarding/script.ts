/**
 * Story script engine types. The scripts themselves (day1.ts, later day2.ts …) are plain data so the
 * wording, order and motions can be changed without touching the player.
 *
 * Text placeholders: {name} = the name the visitor told OBOLON, {inviter} = who invited them, {age} = times round
 * the Sun, {neo} = the NEO name, {food} = the favourite food, {bati} = the Bati's name.
 */
import type { MotionId } from './media';

export type Speaker =
  | 'MONBAN'
  | 'OBOLON'
  | 'KIMORIN'
  | 'たこ焼きブラザー'
  | 'たこ焼きシスター'
  | '大根カイザー'
  | 'フリージー'
  | 'ヒポキン'
  | 'ロングG'
  | 'ハットG'
  | 'ボスG'
  | 'バティ'
  | 'うんちピンポンくん'
  | 'コロリン';

/** Synthesised sound effects (lib/story/sfx.ts presets). */
export type SoundFx = 'sparkle' | 'chime' | 'bell' | 'gong' | 'magic' | 'whoosh' | 'pop' | 'boing' | 'knock' | 'ding' | 'heartbeat' | 'blip' | 'thud';

/** Picture effects drawn over the background ('fx' steps). */
export type PictureFx =
  /** Saturn: KIMORIN⭐︎'s kororin (a takoyaki with KIMORIN's face) */
  | 'kimorin-kororin'
  /** Saturn: the residents' kororins circle the sky as a ring */
  | 'ring'
  /** …one falls down to your feet */
  | 'ring-drop'
  /** …and gets a ☆ (the count is never shown) */
  | 'ring-star';

export type Step =
  /**
   * Play a motion once. Cannot be skipped; the last frame stays on screen afterwards.
   * `captions` appear on top while it plays (seconds from the start of the motion; no tap needed).
   */
  | { t: 'video'; motion: MotionId; captions?: TimedCaption[] }
  /** Switch background music (crossfade). null = fade out. Continues immediately. */
  | { t: 'bgm'; track: string | null }
  /**
   * Play a motion once IN THE BACKGROUND and continue immediately, so the dialogue can be read while
   * it plays. `then` motions follow automatically when it ends; the last one holds its final frame.
   * Still unskippable: there are no controls, the dialogue just runs on top of it.
   */
  | { t: 'bgvideo'; motion: MotionId; then?: MotionId[] }
  /**
   * Show a character image (transparent PNG/WebP in public/onboarding, e.g. "kimorin-1") standing in
   * front of the background motion; it stays until the next sprite step, null, or a blocking video.
   */
  | { t: 'sprite'; image: string | string[] | null }
  /** Still background image (public/onboarding/<image>.jpg) for scenes without a motion yet. */
  | { t: 'still'; image: string }
  /** Saturn ("ころりん") tutorial: the visitor listens, gives a star and drops their own voice. */
  | { t: 'saturn' }
  /** Jupiter tutorial (Day 5), coached by 大根カイザー. Placeholder screen until the client's UI arrives. */
  | { t: 'jupiter' }
  /** Mercury sea-chart tutorial (Day 6), coached by フリージー. */
  | { t: 'mercury' }
  /** Mars tutorial (Day 7), coached by ヒポキン. */
  | { t: 'mars' }
  /** Venus tutorial (Day 8), coached by the gorilla trio. */
  | { t: 'venus' }
  /** Fade the whole screen to white (~3 s), then continue; the next still/motion fades in from white. */
  | { t: 'whiteout' }
  /** Cut to a black screen (until the next motion appears) and continue immediately. */
  | { t: 'black' }
  /** Start a looping background motion and continue immediately. */
  | { t: 'loop'; motion: MotionId }
  /** テロップ: a short line in the middle of the screen (e.g. "MONBANが現れた"). Never spoken. Tap to continue. */
  | { t: 'caption'; text: string }
  /** 〔画面：…〕 a short guidance note about how something works (e.g. the riddle book). Tap to continue. */
  | { t: 'notice'; text: string }
  /** Character line. Tap to continue. */
  | { t: 'say'; who: Speaker; text: string }
  /** A single button the visitor must press ("封を開く"). */
  | { t: 'action'; label: string }
  /**
   * Several buttons. The answer is saved under `key`; `goto` jumps to a label. `prompt` is shown above
   * the buttons (a confirmation, e.g. "この姿と名前を…保存します").
   */
  | { t: 'choice'; key: string; options: { label: string; goto?: string }[]; prompt?: string }
  /** Name input (Day 1: creates the account from the invitation). */
  | { t: 'name'; placeholder: string; submit: string }
  /** Day 1: how many times you went round the Sun (age, optional). 「言わない」 jumps to `skip`. Saved as answers.age. */
  | { t: 'age'; skip: string }
  /** Day 2: the name as an OBOLO NEO ({neo}); it becomes the display name. */
  | { t: 'neoname'; placeholder: string; submit: string }
  /** Day 1: the eight riddle cards rise in a ring, 1・7・8 get their words, and they become the riddle book. */
  | { t: 'riddles' }
  /** The riddle book opens and seal `n` gets its words (Day 3: 2 「OBOLO ORDERは全員」→「表現者」). */
  | { t: 'seal'; n: number }
  /** Bluena projects (open) or closes the square screen: MONBAN at the HQ gate. */
  | { t: 'screen'; open: boolean }
  /** A sound effect (synthesised). Continues immediately. */
  | { t: 'se'; sound: SoundFx }
  /** A picture effect over the background (null = clear). Continues immediately. */
  | { t: 'fx'; fx: PictureFx | null }
  /** Saturn: murmur to the Bati → it makes a kororin → tap it to hear it → fly it to your own room. */
  | { t: 'kororin' }
  /** Ends the day here (「やめておく」, Day 2). The next visit starts again at the label `resume`. */
  | { t: 'pause'; resume: string }
  /** Choose one of the eight OBOLO NEO forms (Day 3). Saved on the account. Fallback for 'look'. */
  | { t: 'neo' }
  /** Day 2: OBOLON's questions / own words or a picture / おまかせ → the water basin's four looks → choose one. */
  | { t: 'look' }
  /** The favourite food → the Bati (Day 2: the food is given to the egg on the altar). */
  | { t: 'egg'; submit?: string }
  /** The egg hatches (the Bati image is generated meanwhile). */
  | { t: 'hatch' }
  /** Name the newborn Bati. */
  | { t: 'batiname'; placeholder: string; submit: string }
  /**
   * The Eclipse day (7): the payment (¥88/month, Stripe inside the story). Continues once paid;
   * "もう少し考える" jumps to the `cancel` label.
   */
  | { t: 'order'; cancel: string }
  /** A handwritten-style letter card. Tap to continue. */
  | { t: 'letter'; text: string }
  | { t: 'label'; id: string }
  | { t: 'goto'; id: string }
  | { t: 'end' };

export interface TimedCaption {
  text: string;
  /** seconds into the motion */
  from: number;
  /** seconds into the motion; omitted = until the motion ends */
  to?: number;
}

export interface StoryVars {
  name: string;
  /** Times round the Sun ({age}). */
  age?: string;
  /** KIMORIN is shown as "KIMORIN⭐︎" (his NEO name, from the Moon's naming on). */
  kimorinStar?: boolean;
  inviter: string;
  /** Name of the chosen OBOLO NEO form ({neo}). */
  neo?: string;
  /** The Bati's name ({bati}) and pictures used by the '@bati' / '@egg' / '@me' sprites. */
  bati?: string;
  batiImage?: string;
  batiFood?: string;
  look?: string;
}

export function fill(text: string, v: StoryVars): string {
  return text
    .replaceAll('{name}', v.name || '…')
    .replaceAll('{inviter}', v.inviter || '…')
    .replaceAll('{neo}', v.neo || '…')
    .replaceAll('{bati}', v.bati || 'バティ')
    .replaceAll('{food}', v.batiFood || '…')
    .replaceAll('{age}', v.age || '…');
}

/** The name shown on a line: the Bati's own name, KIMORIN⭐︎ after his naming. */
export function speakerName(who: Speaker, v: StoryVars): string {
  if (who === 'バティ') return v.bati || 'バティ';
  if (who === 'KIMORIN' && v.kimorinStar) return 'KIMORIN⭐︎';
  return who;
}

export function labelIndex(steps: Step[], id: string): number {
  const i = steps.findIndex((s) => s.t === 'label' && s.id === id);
  if (i < 0) throw new Error(`unknown label ${id}`);
  return i;
}

/** The media that should be on screen at step i (for resuming mid-story). null = black screen. */
export function mediaAt(steps: Step[], i: number): { motion: MotionId; loop: boolean } | null {
  for (let k = Math.min(i, steps.length - 1); k >= 0; k--) {
    const s = steps[k];
    if (s.t === 'black') return null;
    if (s.t === 'video' || s.t === 'loop') return { motion: s.motion, loop: s.t === 'loop' };
    if (s.t === 'bgvideo') return { motion: s.then?.length ? s.then[s.then.length - 1] : s.motion, loop: false };
  }
  return null;
}

/** The BGM track that should be playing at step i (for resuming mid-story). */
export function bgmAt(steps: Step[], i: number): string | null {
  for (let k = Math.min(i, steps.length - 1); k >= 0; k--) {
    const s = steps[k];
    if (s.t === 'bgm') return s.track;
  }
  return null;
}
