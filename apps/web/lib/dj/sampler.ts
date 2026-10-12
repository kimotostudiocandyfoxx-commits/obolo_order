/**
 * The sound sampler (client request 2026-10-12): one-shot DJ sounds — horn, siren… — fired from the pad
 * on the mixer's right (the left one is the picture sampler, visuals.ts). Every sound is synthesised here on first use (an offline render, kept), so
 * there are no sample files to license or download.
 */
export type SampleId = 'horn' | 'siren' | 'laser' | 'riser' | 'boom' | 'clap';

export const SAMPLES: { id: SampleId; name: string; icon: string }[] = [
  { id: 'horn', name: 'HORN', icon: '📯' },
  { id: 'siren', name: 'SIREN', icon: '🚨' },
  { id: 'laser', name: 'LASER', icon: '⚡' },
  { id: 'riser', name: 'RISER', icon: '🚀' },
  { id: 'boom', name: 'BOOM', icon: '💥' },
  { id: 'clap', name: 'CLAP', icon: '👏' },
];

const RATE = 44100;

export class Sampler {
  readonly out: GainNode;
  private readonly made = new Map<SampleId, Promise<AudioBuffer>>();

  constructor(private readonly ctx: AudioContext) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
  }

  /** Fire a sound (again and again: each tap is a new voice). `beat` = seconds per beat, for the riser. */
  async play(id: SampleId, beat = 0.5) {
    // the riser is two bars long, so it is made for the tempo playing now; the rest are kept
    let p = id === 'riser' ? render(id, beat) : this.made.get(id);
    if (!p) this.made.set(id, (p = render(id, beat)));
    const src = this.ctx.createBufferSource();
    src.buffer = await p;
    src.connect(this.out);
    src.start();
  }

  /** Make the sounds ahead of time (the first tap then fires at once). */
  warm() {
    for (const s of SAMPLES) if (s.id !== 'riser' && !this.made.has(s.id)) this.made.set(s.id, render(s.id, 0.5));
  }
}

function noise(ctx: BaseAudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  return n;
}

function drive(ctx: BaseAudioContext, amount: number) {
  const ws = ctx.createWaveShaper();
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  ws.curve = c;
  return ws;
}

async function render(id: SampleId, beat: number): Promise<AudioBuffer> {
  const seconds = {
    horn: 1.2,
    siren: 2.2,
    laser: 0.9,
    riser: beat * 8 + 0.2,
    boom: 1.8,
    clap: 0.5,
  }[id];
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const out = ctx.createGain();
  out.connect(ctx.destination);

  if (id === 'horn') {
    // the air horn: three blasts (short, short, long) of bright detuned saws, driven hard
    const bus = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = 'peaking';
    bp.frequency.value = 1800;
    bp.gain.value = 8;
    bus.connect(drive(ctx, 3)).connect(bp).connect(out);
    out.gain.value = 0.35;
    for (const f of [466, 470, 934, 1398]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.94, 0);
      o.frequency.exponentialRampToValueAtTime(f, 0.04);
      const g = ctx.createGain();
      g.gain.value = f > 1000 ? 0.25 : 0.5;
      o.connect(g).connect(bus);
      o.start(0);
    }
    bus.gain.setValueAtTime(0, 0);
    for (const [t, len] of [
      [0, 0.13],
      [0.19, 0.13],
      [0.38, 0.7],
    ]) {
      bus.gain.setTargetAtTime(1, t, 0.005);
      bus.gain.setTargetAtTime(0, t + len, 0.02);
    }
  } else if (id === 'siren') {
    // the dub siren: a square wave swooping up and down, faster and faster
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 800;
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(2, 0);
    lfo.frequency.linearRampToValueAtTime(9, seconds);
    const depth = ctx.createGain();
    depth.gain.value = 320;
    lfo.connect(depth).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(0.22, 0.03);
    g.gain.setValueAtTime(0.22, seconds - 0.3);
    g.gain.linearRampToValueAtTime(0, seconds);
    o.connect(lp).connect(g).connect(out);
    o.start(0);
    lfo.start(0);
  } else if (id === 'laser') {
    // three "pew"s, each a falling saw
    for (let n = 0; n < 3; n++) {
      const t = n * 0.22;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(2600, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.32);
    }
  } else if (id === 'riser') {
    // two bars of noise sweeping up, with a rising tone under it, cut on the downbeat
    const end = beat * 8;
    const n = noise(ctx, seconds);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, 0);
    bp.frequency.exponentialRampToValueAtTime(9000, end);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02, 0);
    g.gain.exponentialRampToValueAtTime(0.6, end);
    g.gain.setValueAtTime(0, end + 0.01);
    n.connect(bp).connect(g).connect(out);
    n.start(0);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, 0);
    o.frequency.exponentialRampToValueAtTime(880, end);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.01, 0);
    og.gain.exponentialRampToValueAtTime(0.12, end);
    og.gain.setValueAtTime(0, end + 0.01);
    o.connect(og).connect(out);
    o.start(0);
  } else if (id === 'boom') {
    // a deep drop: a falling sine with a long tail and a click on top
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(120, 0);
    o.frequency.exponentialRampToValueAtTime(38, 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, 0);
    g.gain.exponentialRampToValueAtTime(0.001, seconds);
    o.connect(g).connect(drive(ctx, 2)).connect(out);
    o.start(0);
    const c = noise(ctx, 0.05);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.5, 0);
    cg.gain.exponentialRampToValueAtTime(0.001, 0.04);
    c.connect(cg).connect(out);
    c.start(0);
    out.gain.value = 0.8;
  } else {
    // a clap: three quick noise hits and a short room
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 1.2;
    bp.connect(out);
    for (const [t, tail] of [
      [0, 0.02],
      [0.012, 0.02],
      [0.024, 0.25],
    ]) {
      const n = noise(ctx, tail + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + tail);
      n.connect(g).connect(bp);
      n.start(t);
    }
  }
  // every sound to about the same loudness (and never over the same peak), so no pad drowns the others
  const buf = await ctx.startRendering();
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++)
    for (const x of buf.getChannelData(c)) {
      peak = Math.max(peak, Math.abs(x));
      sum += x * x;
      n++;
    }
  const gain = peak > 0 ? Math.min(0.8 / peak, 0.18 / Math.sqrt(sum / n)) : 1;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= gain;
  }
  return buf;
}
