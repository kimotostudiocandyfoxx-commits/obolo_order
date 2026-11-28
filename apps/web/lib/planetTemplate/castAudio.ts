import type { HomePlanet, HomeWork } from '@obolo/shared';
import { castOfWork, castTapVoice } from './castWorks';
import { MUTE_KEY } from './sound';
import { trackMedia } from './sfx';

/**
 * The cast's voices (handoff planets-08 §3: 「声は、タップの瞬間に鳴らす（少し遅らせるとスマホで鳴らない）」; the prototype's
 * narr / stopNarr). One audio element for every line: it is first played inside the tap itself, so a phone lets it
 * sound, and the later lines (a picture book's pages, read one after the other) reuse it. The speed changes how fast
 * it is read, never how high (preservesPitch). The ▶ music ducks under it like under any work's voice (trackMedia).
 */
let el: HTMLAudioElement | null = null;
let current: string | null = null;
let onEnd: (() => void) | null = null;

interface PitchKeeping {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
}

function muted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function element(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!el) {
    el = trackMedia(new Audio());
    const p = el as HTMLAudioElement & PitchKeeping;
    p.preservesPitch = p.mozPreservesPitch = p.webkitPreservesPitch = true;
    el.addEventListener('ended', () => {
      const done = onEnd;
      current = null;
      onEnd = null;
      done?.();
    });
    el.addEventListener('error', () => {
      // a line that cannot be read does not stop the book: it goes on as if read
      const done = onEnd;
      current = null;
      onEnd = null;
      done?.();
    });
  }
  return el;
}

/** the line sounding now (null: none) */
export const narrating = (): string | null => current;

/**
 * Say `url` now. When that very line is already sounding (the tap started it a moment ago), it is not started again:
 * only what happens at its end, and its speed, are set. `then`: called once when the line has ended (or could not be
 * played); never called after stopNarration().
 */
export function narrate(url: string, o: { rate?: number; then?: () => void } = {}): void {
  const a = element();
  if (!a) {
    o.then?.();
    return;
  }
  const rate = o.rate ?? 1;
  if (current === url && !a.ended) {
    onEnd = o.then ?? null;
    a.playbackRate = rate;
    return;
  }
  onEnd = o.then ?? null;
  current = url;
  try {
    a.pause();
    a.muted = muted();
    a.src = url;
    a.defaultPlaybackRate = a.playbackRate = rate;
    const p = a.play();
    if (p) p.catch(() => undefined);
  } catch {
    // no sound on this device: the screen goes on without it
  }
}

/** the reading speed of the line sounding now (and nothing else) */
export function setNarrationRate(rate: number): void {
  if (el) el.playbackRate = rate;
}

export function stopNarration(): void {
  onEnd = null;
  current = null;
  if (!el) return;
  try {
    el.pause();
  } catch {
    // nothing was playing
  }
}

/** a figure was tapped: when its work is one of the cast's with a voice that starts on the tap, start it here (inside the gesture) */
export function tapVoice(planet: HomePlanet, w: Pick<HomeWork, 'id'> | null | undefined, rate = 1): void {
  const m = castOfWork(w);
  const url = m ? castTapVoice(m.cast, planet) : null;
  if (url) narrate(url, { rate });
}

/** for the tests */
export function resetNarrationForTest(): void {
  el = null;
  current = null;
  onEnd = null;
}
