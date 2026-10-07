'use client';

/**
 * The "ぱっ" of a soap bubble (client decision 2026-10-07: popping a ころりん sounds good).
 * Made on the fly with WebAudio, so no sound file to ship: a quick upward bloop, a tiny click of
 * air, and a little sparkle on top. Call `unlockPop()` from a tap first (iPad Safari).
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function unlockPop() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ctx = new Ctx();
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

/** `size` 0..1 (bigger bubbles pop a little lower). */
export function playPop(size = 0.5) {
  unlockPop();
  if (!ctx || !noise) return;
  const t = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(ctx.destination);
  const base = 620 - Math.max(0, Math.min(1, size)) * 220 + Math.random() * 60;

  // the bloop: a round tone sliding up fast
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 3.2, t + 0.07);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.9, t + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.14);

  // the click of air
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  n.connect(hp).connect(ng).connect(out);
  n.start(t);

  // a little sparkle right after
  const s = ctx.createOscillator();
  const sg = ctx.createGain();
  s.type = 'triangle';
  s.frequency.setValueAtTime(base * 4.5, t + 0.04);
  sg.gain.setValueAtTime(0.0001, t + 0.04);
  sg.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  s.connect(sg).connect(out);
  s.start(t + 0.04);
  s.stop(t + 0.24);
}
