'use client';

/**
 * One AudioContext shared by the story BGM and the sound effects. It is created/resumed from the
 * visitor's first tap (iOS requirement) and kept alive across screens, so the countdown ticks can
 * play right after the story ends without another tap.
 */
let ctx: AudioContext | null = null;

type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } };

/**
 * iOS Safari mutes Web Audio when the ringer/silent switch is on (while <video> keeps playing),
 * which made the BGM and countdown sounds inaudible. Declaring a "playback" audio session
 * (Safari 16.4+) makes them play like music. Returns false where the API is missing.
 */
export function hasPlaybackSession(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as NavigatorWithAudioSession;
  if (!n.audioSession) return false;
  try {
    if (n.audioSession.type !== 'playback') n.audioSession.type = 'playback';
    return true;
  } catch {
    return false;
  }
}

export function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  hasPlaybackSession();
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
