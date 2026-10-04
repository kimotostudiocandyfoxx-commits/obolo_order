'use client';

import { audioCtx, masterBus } from './audio';

/**
 * Synthesised sound effects for the "また明日" countdown (no audio files needed).
 * PLACEHOLDER (P-OB-9): replace with the client's own sounds if they make some.
 */
const out = (c: AudioContext, v: number) => {
  const g = c.createGain();
  g.gain.value = v;
  g.connect(masterBus(c));
  return g;
};

function blip(c: AudioContext, t: number, freq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(masterBus(c));
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Clock tick (alternating tick/tock with a faint shimmer). */
export function tick(alt: boolean, when = 0) {
  const c = audioCtx();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + when;
  blip(c, t, alt ? 1650 : 1320, 0.05, 0.25, 'triangle');
  blip(c, t, alt ? 3300 : 2640, 0.12, 0.035);
}

/** Low mystical drone under the countdown. Returns a stop() function. */
export function startDrone(): () => void {
  const c = audioCtx();
  if (!c) return () => undefined;
  const master = out(c, 0);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  lp.connect(master);
  const oscs = [55, 82.4, 110.3, 164.8].map((f, i) => {
    const o = c.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.detune.value = i * 4;
    const g = c.createGain();
    g.gain.value = i === 0 ? 0.5 : 0.18;
    o.connect(g).connect(lp);
    o.start();
    return o;
  });
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 250;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  master.gain.linearRampToValueAtTime(0.16, c.currentTime + 3);
  return () => {
    const t = c.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.8);
    setTimeout(() => [...oscs, lfo].forEach((o) => o.stop()), 900);
  };
}

/** The time-skip: accelerating ticks + rising shimmer, then a bell. Total ≈ seconds. */
export function playTimeSkip(seconds: number) {
  const c = audioCtx();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + 0.05;
  // accelerating ticks
  let t = 0;
  let gap = 0.32;
  let alt = false;
  while (t < seconds - 0.5) {
    tick((alt = !alt), t0 - c.currentTime + t);
    t += gap;
    gap = Math.max(0.028, gap * 0.9);
  }
  // rising shimmer
  const o = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  o.type = 'sawtooth';
  f.type = 'bandpass';
  f.Q.value = 6;
  o.frequency.setValueAtTime(110, t0);
  o.frequency.exponentialRampToValueAtTime(1760, t0 + seconds - 0.3);
  f.frequency.setValueAtTime(400, t0);
  f.frequency.exponentialRampToValueAtTime(5000, t0 + seconds - 0.3);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12, t0 + seconds - 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  o.connect(f).connect(g).connect(masterBus(c));
  o.start(t0);
  o.stop(t0 + seconds + 0.05);
  // bell
  const tb = t0 + seconds - 0.1;
  for (const [freq, vol, dur] of [
    [523.25, 0.4, 4],
    [1046.5, 0.2, 3],
    [1568, 0.12, 2.2],
    [2637, 0.06, 1.4],
  ] as const) {
    blip(c, tb, freq, dur, vol);
  }
}
