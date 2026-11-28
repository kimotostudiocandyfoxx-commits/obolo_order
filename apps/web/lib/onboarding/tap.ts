/**
 * What a tap on a line does (client decision 2026-11-28, all days): the reader is never held behind a voice.
 *  - the bubble still typing → the whole text at once (the next tap goes on)
 *  - a voice playing (or on its way) → it fades out quickly (LineVoice.stop(TAP_FADE)) and the story goes on; the music's
 *    dip ends with it
 *  - a line marked `listen: true` (or the older `hold: true`, OBOLON's core lines, M-R102) is heard to the end: a tap
 *    meanwhile does nothing — unless its voice never came or never ended (the wait is over: never stuck)
 * Not built (noted for later): an "auto-advance" setting that goes on by itself when a voice ends.
 */
export type TapAction = 'reveal' | 'wait' | 'next';

/** seconds a voice fades out when a tap goes on mid-line */
export const TAP_FADE = 0.2;

export function tapAction(o: {
  /** the step is a spoken line */
  say: boolean;
  /** its bubble is still typing */
  revealing: boolean;
  /** its voice is playing or loading (and can be heard: sound on, voices not at 0) */
  voice: boolean;
  /** the line must be heard to the end */
  listen: boolean;
  /** the voice did not come / did not end in time: let the tap through */
  waitOver: boolean;
}): TapAction {
  if (o.say && o.revealing) return 'reveal';
  if (o.say && o.voice && o.listen && !o.waitOver) return 'wait';
  return 'next';
}
