'use client';

/**
 * One AudioContext shared by the story BGM and the sound effects. It is created/resumed from the
 * visitor's first tap (iOS requirement) and kept alive across screens, so the countdown ticks can
 * play right after the story ends without another tap.
 */
let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

/** Call from a user gesture. */
export function unlockAudio(): AudioContext | null {
  const c = audioCtx();
  if (c && c.state !== 'running') void c.resume();
  return c;
}
