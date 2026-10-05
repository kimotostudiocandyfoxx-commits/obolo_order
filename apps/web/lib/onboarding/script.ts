/**
 * Story script engine types. The scripts themselves (day1.ts, later day2.ts …) are plain data so the
 * wording, order and motions can be changed without touching the player.
 *
 * Text placeholders: {name} = the name the visitor told OBOLON, {inviter} = who invited them.
 */
import type { MotionId } from './media';

export type Speaker = 'MONBAN' | 'OBOLON' | 'KIMORIN' | 'たこ焼きブラザー' | 'たこ焼きシスター' | '大根カイザー' | 'フリージー';

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
  /** Cut to a black screen (until the next motion appears) and continue immediately. */
  | { t: 'black' }
  /** Start a looping background motion and continue immediately. */
  | { t: 'loop'; motion: MotionId }
  /** Narration line (e.g. "MONBANが現れた"). Tap to continue. */
  | { t: 'caption'; text: string }
  /** Character line. Tap to continue. */
  | { t: 'say'; who: Speaker; text: string }
  /** A single button the visitor must press ("封を開く"). */
  | { t: 'action'; label: string }
  /** Several buttons. The answer is saved under `key`; `goto` jumps to a label. */
  | { t: 'choice'; key: string; options: { label: string; goto?: string }[] }
  /** Name input (Day 1: creates the account from the invitation; Day 3: the NEO name). */
  | { t: 'name'; placeholder: string; submit: string }
  /** Choose one of the eight OBOLO NEO forms (Day 3). Saved on the account. */
  | { t: 'neo' }
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
  inviter: string;
  /** Name of the chosen OBOLO NEO form ({neo}). */
  neo?: string;
}

export function fill(text: string, v: StoryVars): string {
  return text
    .replaceAll('{name}', v.name || '…')
    .replaceAll('{inviter}', v.inviter || '…')
    .replaceAll('{neo}', v.neo || '…');
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
