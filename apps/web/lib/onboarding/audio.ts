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

let bus: DynamicsCompressorNode | null = null;

/**
 * Master output for music + effects: a gentle limiter so the louder mix never clips on phone
 * speakers. Everything synthesised or routed through Web Audio connects here.
 */
export function masterBus(c: AudioContext): AudioNode {
  if (!bus || bus.context !== c) {
    bus = c.createDynamicsCompressor();
    bus.threshold.value = -3;
    bus.knee.value = 3;
    bus.ratio.value = 20;
    bus.attack.value = 0.002;
    bus.release.value = 0.2;
    bus.connect(c.destination);
  }
  return bus;
}
