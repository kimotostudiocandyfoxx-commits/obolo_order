/**
 * Story script engine types. The scripts themselves (day1.ts, later day2.ts …) are plain data so the
 * wording, order and motions can be changed without touching the player.
 *
 * Text placeholders: {name} = the name the visitor told OBOLON, {inviter} = who invited them.
 */
export type Speaker = 'MONBAN' | 'OBOLON' | 'KIMORIN';

export type Step =
  /** Play a motion once. Cannot be skipped; the last frame stays on screen afterwards. */
  | { t: 'video'; motion: number }
  /** Switch background music (crossfade). null = fade out. Continues immediately. */
  | { t: 'bgm'; track: string | null }
  /**
   * Play a motion once IN THE BACKGROUND and continue immediately, so the dialogue can be read while
   * it plays. `then` motions follow automatically when it ends; the last one holds its final frame.
   * Still unskippable: there are no controls, the dialogue just runs on top of it.
   */
  | { t: 'bgvideo'; motion: number; then?: number[] }
  /** Cut to a black screen (until the next motion appears) and continue immediately. */
  | { t: 'black' }
  /** Start a looping background motion and continue immediately. */
  | { t: 'loop'; motion: number }
  /** Narration line (e.g. "MONBANが現れた"). Tap to continue. */
  | { t: 'caption'; text: string }
  /** Character line. Tap to continue. */
  | { t: 'say'; who: Speaker; text: string }
  /** A single button the visitor must press ("封を開く"). */
  | { t: 'action'; label: string }
  /** Several buttons. The answer is saved under `key`; `goto` jumps to a label. */
  | { t: 'choice'; key: string; options: { label: string; goto?: string }[] }
  /** Name input → creates the account from the invitation. */
  | { t: 'name'; placeholder: string; submit: string }
  /** A handwritten-style letter card. Tap to continue. */
  | { t: 'letter'; text: string }
  | { t: 'label'; id: string }
  | { t: 'goto'; id: string }
  | { t: 'end' };

export interface StoryVars {
  name: string;
  inviter: string;
}

export function fill(text: string, v: StoryVars): string {
  return text.replaceAll('{name}', v.name || '…').replaceAll('{inviter}', v.inviter || '…');
}

export function labelIndex(steps: Step[], id: string): number {
  const i = steps.findIndex((s) => s.t === 'label' && s.id === id);
  if (i < 0) throw new Error(`unknown label ${id}`);
  return i;
}

/** The media that should be on screen at step i (for resuming mid-story). null = black screen. */
export function mediaAt(steps: Step[], i: number): { motion: number; loop: boolean } | null {
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
