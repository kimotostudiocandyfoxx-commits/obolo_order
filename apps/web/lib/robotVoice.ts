'use client';

/**
 * Robot voice (client idea 2026-10-07, Saturn tutorial: 「お前さてはロボットじゃないだろうな」).
 * A recording is played back through a Web Audio chain, all on the device (no server, no cost):
 *  - vocoder: the voice's loudness in 16 bands shapes a buzzing flat-pitched carrier (the classic
 *    monotone robot),
 *  - ring modulator: multiplies the voice by a low sine (the metallic "Dalek" wobble),
 *  - a short comb delay for a tin-can ring, and a little bit-crush grit.
 * PLACEHOLDER (P-SAT-16): the three strengths are tuned by ear.
 */
export type RobotLevel = 'light' | 'robot' | 'full';

export const ROBOT_LEVELS: { id: RobotLevel; label: string }[] = [
  { id: 'light', label: 'ちょいロボ' },
  { id: 'robot', label: 'ロボ' },
  { id: 'full', label: 'がっつりロボ' },
];

const PRESETS: Record<RobotLevel, { vocoder: number; ring: number; ringHz: number; dry: number; comb: number; combMs: number; crush: number; carrierHz: number }> = {
  light: { vocoder: 0, ring: 0.75, ringHz: 34, dry: 0.35, comb: 0.35, combMs: 9, crush: 0, carrierHz: 0 },
  robot: { vocoder: 0.75, ring: 0.45, ringHz: 50, dry: 0, comb: 0.5, combMs: 7, crush: 0.25, carrierHz: 110 },
  full: { vocoder: 1, ring: 0.3, ringHz: 70, dry: 0, comb: 0.62, combMs: 5, crush: 0.6, carrierHz: 92 },
};

/** Builds the effect between `input` and `out` on any (realtime or offline) context. */
function robotChain(ctx: BaseAudioContext, input: AudioNode, out: AudioNode, level: RobotLevel, duration: number) {
  const p = PRESETS[level];
  const pre = ctx.createBiquadFilter();
  pre.type = 'highpass';
  pre.frequency.value = 110;
  input.connect(pre);

  const mix = ctx.createGain();
  mix.gain.value = 1;

  if (p.dry) {
    const dry = ctx.createGain();
    dry.gain.value = p.dry;
    pre.connect(dry).connect(mix);
  }

  // ring modulator: voice × low sine
  if (p.ring) {
    const ring = ctx.createGain();
    ring.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = p.ringHz;
    lfo.connect(ring.gain);
    lfo.start();
    lfo.stop(ctx.currentTime + duration + 1);
    const amt = ctx.createGain();
    amt.gain.value = p.ring;
    pre.connect(ring).connect(amt).connect(mix);
  }

  // vocoder: per band, the voice's envelope opens the same band of a buzzy carrier
  if (p.vocoder) {
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.value = p.carrierHz;
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.25;
    noise.buffer = nb;
    noise.loop = true;
    const carrierBus = ctx.createGain();
    carrier.connect(carrierBus);
    noise.connect(carrierBus);
    carrier.start();
    noise.start();
    carrier.stop(ctx.currentTime + duration + 1);
    noise.stop(ctx.currentTime + duration + 1);
    const rect = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.abs((i / (curve.length - 1)) * 2 - 1);
    rect.curve = curve;
    const voc = ctx.createGain();
    voc.gain.value = p.vocoder * 2.2;
    const bands = 16;
    for (let k = 0; k < bands; k++) {
      const f = 180 * Math.pow(5200 / 180, k / (bands - 1));
      const q = 6;
      const an = ctx.createBiquadFilter();
      an.type = 'bandpass';
      an.frequency.value = f;
      an.Q.value = q;
      const r = ctx.createWaveShaper();
      r.curve = curve;
      const env = ctx.createBiquadFilter();
      env.type = 'lowpass';
      env.frequency.value = 28;
      const boost = ctx.createGain();
      boost.gain.value = 9;
      pre.connect(an).connect(r).connect(env).connect(boost);
      const syn = ctx.createBiquadFilter();
      syn.type = 'bandpass';
      syn.frequency.value = f;
      syn.Q.value = q;
      const vca = ctx.createGain();
      vca.gain.value = 0;
      boost.connect(vca.gain);
      carrierBus.connect(syn).connect(vca).connect(voc);
    }
    voc.connect(mix);
  }

  // tin-can ring: short comb delay with feedback
  let tail: AudioNode = mix;
  if (p.comb) {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = p.combMs / 1000;
    const fb = ctx.createGain();
    fb.gain.value = p.comb;
    const sum = ctx.createGain();
    mix.connect(sum);
    mix.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(sum);
    tail = sum;
  }

  // grit: a stepped (bit-crushed) waveshaper
  if (p.crush) {
    const steps = Math.round(64 - p.crush * 52);
    const c = new Float32Array(2048);
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1;
      c[i] = (1 - p.crush * 0.5) * x + p.crush * 0.5 * (Math.round(x * steps) / steps);
    }
    const ws = ctx.createWaveShaper();
    ws.curve = c;
    tail.connect(ws);
    tail = ws;
  }

  const post = ctx.createBiquadFilter();
  post.type = 'lowpass';
  post.frequency.value = 5200;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  const vol = ctx.createGain();
  vol.gain.value = 0.75;
  tail.connect(post).connect(comp).connect(vol).connect(out);
}

let ctx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;

function audioCtx(): AudioContext {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
  }
  return ctx;
}

/** Call from a tap first (iPad Safari only starts sound inside a tap). */
export function unlockRobot() {
  const c = audioCtx();
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
}

export async function decodeVoice(blob: Blob): Promise<AudioBuffer> {
  return audioCtx().decodeAudioData(await blob.arrayBuffer());
}

export function stopRobot() {
  try {
    playing?.stop();
  } catch {
    /* already stopped */
  }
  playing = null;
}

/** Plays a recording as is (`level` null) or as a robot. Resolves when it ends. */
export function playRobot(buf: AudioBuffer, level: RobotLevel | null): Promise<void> {
  stopRobot();
  const c = audioCtx();
  if (c.state === 'suspended') void c.resume();
  const src = c.createBufferSource();
  src.buffer = buf;
  if (level) robotChain(c, src, c.destination, level, buf.duration);
  else src.connect(c.destination);
  playing = src;
  return new Promise((ok) => {
    src.onended = () => {
      if (playing === src) playing = null;
      ok();
    };
    src.start();
  });
}

/** Renders the robot version to a WAV file (to keep or upload). */
export async function renderRobot(buf: AudioBuffer, level: RobotLevel): Promise<Blob> {
  const off = new OfflineAudioContext(1, Math.ceil((buf.duration + 0.4) * 44100), 44100);
  const src = off.createBufferSource();
  src.buffer = buf;
  robotChain(off, src, off.destination, level, buf.duration + 0.4);
  src.start();
  const out = await off.startRendering();
  return wav(out);
}

function wav(b: AudioBuffer): Blob {
  const d = b.getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + d.length * 2));
  const w = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  view.setUint32(4, 36 + d.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, b.sampleRate, true);
  view.setUint32(28, b.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, 'data');
  view.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
  return new Blob([view], { type: 'audio/wav' });
}
