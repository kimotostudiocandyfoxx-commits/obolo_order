/**
 * R14 (client 2026-11-25, iPad: 「バティが話している最中に、返事しようとマイクを押したら、話すのをやめてこっちのターンに
 * してほしい」): barge-in. Pressing the mic (or starting to type in ⌨) while a voice speaks stops it at once (an 80 ms fade,
 * no click), the line being said shows all its words at once (nothing is lost), the lines not started yet stay in the talk
 * as words, unspoken — and then the mic records. One voice and one mic on a page: the voice that plays is the one
 * registered here (webVoice's clip), every talk that reveals lines listens (TalkScene, the Moon chat's voice queue).
 * No DOM imports: the tests drive it with a fake audio clip.
 */
export const BARGE_FADE_MS = 80;

/** what is playing now (webVoice's clip): stopped with a fade */
export type Speaking = { stop: (fadeMs?: number) => void };

let speaking: Speaking | null = null;
const listeners = new Set<() => void>();
/** R16: who wants to know when a voice starts / stops (Bluena's music ducks under it) */
const voiceListeners = new Set<(on: boolean) => void>();
/** R16: who wants to know when the mic is pressed (one mic: Bluena's music pauses) */
const micListeners = new Set<() => void>();

/** the voice now playing (null: it ended) — webVoice keeps this up to date */
export function setSpeaking(s: Speaking | null) {
  const was = !!speaking;
  speaking = s;
  if (was !== !!s) for (const fn of [...voiceListeners]) fn(!!s);
}
export const isSpeaking = () => !!speaking;

/** R16: a voice started (true) / ended (false) */
export function onVoice(fn: (on: boolean) => void): () => void {
  voiceListeners.add(fn);
  return () => void voiceListeners.delete(fn);
}
/** R16: the mic was pressed */
export function onMic(fn: () => void): () => void {
  micListeners.add(fn);
  return () => void micListeners.delete(fn);
}

/** a talk that reveals lines / queues voices: what to do when the member takes the turn (returns: stop listening) */
export function onBargeIn(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/**
 * the member takes the turn: the voice fades out in BARGE_FADE_MS, every talk shows its line whole and drops the queued
 * voices. Safe to call when nothing plays (the talks still drop what was queued). The next voice plays as usual.
 * R16: `mic` — the mic was pressed (not typing): Bluena's music pauses too (one mic).
 */
export function bargeIn(opts: { mic?: boolean } = {}) {
  const s = speaking;
  setSpeaking(null);
  s?.stop(BARGE_FADE_MS);
  if (opts.mic) for (const fn of [...micListeners]) fn();
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      /* a talk that is gone */
    }
  }
}
