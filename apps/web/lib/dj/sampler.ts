/**
 * The sound sampler (client request 2026-10-12): one-shot DJ sounds — air horn, dub siren… — fired from
 * the pad on the mixer's right (the left one is the picture sampler, visuals.ts).
 *
 * Every sound is synthesised here on first use (an offline render, kept), so there are no sample files
 * to license or download. Round two ("音がしょぼい"): each sound is now built like a produced one —
 * layered and detuned voices, saturation, stereo width, a dub echo where it belongs and a shared
 * plate-like reverb — then levelled so no pad drowns the others.
 */
export type SampleId = 'horn' | 'siren' | 'laser' | 'riser' | 'impact' | 'down' | 'scratch' | 'clap';

export const SAMPLES: { id: SampleId; name: string; short: string }[] = [
  { id: 'horn', name: 'AIR HORN', short: 'HORN' },
  { id: 'siren', name: 'DUB SIREN', short: 'SIREN' },
  { id: 'laser', name: 'LASER', short: 'LASER' },
  { id: 'riser', name: 'RISER', short: 'RISER' },
  { id: 'impact', name: 'IMPACT', short: 'IMPACT' },
  { id: 'down', name: 'DOWNLIFT', short: 'DOWN' },
  { id: 'scratch', name: 'SCRATCH', short: 'SCRATCH' },
  { id: 'clap', name: 'CLAP', short: 'CLAP' },
];

const RATE = 44100;

export class Sampler {
  readonly out: GainNode;
  private readonly made = new Map<SampleId, Promise<AudioBuffer>>();

  constructor(private readonly ctx: AudioContext) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
  }

  /** Fire a sound (again and again: each tap is a new voice). `beat` = seconds per beat (riser, echoes). */
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

// --- building blocks ---------------------------------------------------------------------------

type Ctx = OfflineAudioContext;

function noise(ctx: Ctx, seconds: number, stereo = false) {
  const b = ctx.createBuffer(stereo ? 2 : 1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = ctx.createBufferSource();
  n.buffer = b;
  return n;
}

function drive(ctx: Ctx, amount: number) {
  const ws = ctx.createWaveShaper();
  const c = new Float32Array(2048);
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  ws.curve = c;
  ws.oversample = '4x';
  return ws;
}

function filter(ctx: Ctx, type: BiquadFilterType, f: number, q = 0.7, gain = 0) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = gain;
  return b;
}

/** A plate-like reverb: decaying stereo noise that darkens as it fades. */
function reverb(ctx: Ctx, seconds: number, decay = 0.45) {
  const len = Math.ceil(seconds * ctx.sampleRate);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      // darker with time: a one-pole low-pass whose cutoff falls
      const k = 0.9 - 0.75 * Math.min(1, t / seconds);
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * Math.exp(-t / decay) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  const cv = ctx.createConvolver();
  cv.buffer = ir;
  return cv;
}

/** A dub echo: ping-pong between left and right, each repeat darker. */
function pingPong(ctx: Ctx, time: number, feedback: number, tone = 2600) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const merge = ctx.createChannelMerger(2);
  const dl = ctx.createDelay(2);
  const dr = ctx.createDelay(2);
  dl.delayTime.value = time;
  dr.delayTime.value = time;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const lp = filter(ctx, 'lowpass', tone, 0.5);
  const hp = filter(ctx, 'highpass', 250, 0.5);
  input.connect(dl);
  dl.connect(dr);
  dr.connect(lp).connect(hp).connect(fb).connect(dl);
  dl.connect(merge, 0, 0);
  dr.connect(merge, 0, 1);
  merge.connect(output);
  return { input, output };
}

/** Put a mono voice a little to the side (a few ms between the ears = width). */
function wide(ctx: Ctx, ms: number) {
  const input = ctx.createGain();
  const split = ctx.createChannelMerger(2);
  const d = ctx.createDelay(0.05);
  d.delayTime.value = ms / 1000;
  input.connect(split, 0, 0);
  input.connect(d).connect(split, 0, 1);
  return { input, output: split };
}

/**
 * The bus every sound plays into: dry, a reverb send and a glue compressor, then the speakers.
 * Returns the dry input and the reverb send.
 */
function bus(ctx: Ctx, wet: number, roomSeconds = 2.4, decay = 0.5) {
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -14;
  glue.ratio.value = 3;
  glue.attack.value = 0.01;
  glue.release.value = 0.2;
  glue.connect(ctx.destination);
  const dry = ctx.createGain();
  dry.connect(glue);
  const send = ctx.createGain();
  send.gain.value = wet;
  send.connect(reverb(ctx, roomSeconds, decay)).connect(glue);
  dry.connect(send);
  return { dry, send };
}

// --- the sounds --------------------------------------------------------------------------------

const LENGTH: Record<SampleId, (beat: number) => number> = {
  horn: () => 2.4,
  siren: () => 4,
  laser: () => 2.4,
  riser: (beat) => beat * 8 + 1.2,
  impact: () => 3.5,
  down: () => 3,
  scratch: () => 1.6,
  clap: () => 1.8,
};

async function render(id: SampleId, beat: number): Promise<AudioBuffer> {
  const seconds = LENGTH[id](beat);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  BUILD[id](ctx, beat);
  // about the same loudness for every pad, never over the same peak
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
  const gain = peak > 0 ? Math.min(0.85 / peak, 0.2 / Math.sqrt(sum / n)) : 1;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= gain;
  }
  return buf;
}

const BUILD: Record<SampleId, (ctx: Ctx, beat: number) => void> = {
  /**
   * The dancehall air horn: a gritty reed tone (a stack of detuned saws an octave over a square body),
   * nasal peaks, hard saturation; "bap · bap · baaaap" with a scoop into each blast, vibrato on the
   * long one and a droop at its end.
   */
  horn(ctx) {
    const { dry } = bus(ctx, 0.28, 2.2, 0.45);
    const blasts: [number, number][] = [
      [0, 0.15],
      [0.22, 0.15],
      [0.44, 0.78],
    ];
    const f = 440;
    const voice = ctx.createGain();
    const tone = filter(ctx, 'highpass', 180, 0.7);
    const nasal = filter(ctx, 'peaking', 1250, 1.4, 9);
    const bite = filter(ctx, 'peaking', 3100, 1.2, 6);
    const top = filter(ctx, 'lowpass', 7500, 0.7);
    const w = wide(ctx, 9);
    voice.connect(tone).connect(drive(ctx, 5)).connect(nasal).connect(bite).connect(top).connect(w.input);
    w.output.connect(dry);
    voice.gain.setValueAtTime(0, 0);
    const pitch = ctx.createConstantSource(); // shared pitch, cents
    pitch.offset.setValueAtTime(0, 0);
    for (const [t, len] of blasts) {
      voice.gain.setTargetAtTime(1, t, 0.006);
      voice.gain.setTargetAtTime(0, t + len, 0.025);
      pitch.offset.setValueAtTime(-140, t);
      pitch.offset.linearRampToValueAtTime(0, t + 0.035);
    }
    // the long blast: vibrato, then the droop as the air runs out
    const [lt, ll] = blasts[2];
    pitch.offset.setValueAtTime(0, lt + 0.1);
    pitch.offset.setValueAtTime(0, lt + ll - 0.16);
    pitch.offset.linearRampToValueAtTime(-260, lt + ll + 0.06);
    const vib = ctx.createOscillator();
    vib.frequency.value = 6.2;
    const vibDepth = ctx.createGain();
    vibDepth.gain.setValueAtTime(0, 0);
    vibDepth.gain.setValueAtTime(0, lt + 0.15);
    vibDepth.gain.linearRampToValueAtTime(14, lt + 0.4);
    vib.connect(vibDepth);
    const voices: [OscillatorType, number, number, number][] = [
      ['sawtooth', f, -9, 0.5],
      ['sawtooth', f, 8, 0.5],
      ['sawtooth', f, 0, 0.45],
      ['sawtooth', f * 2, 4, 0.18],
      ['square', f / 2, 0, 0.32],
    ];
    for (const [type, freq, cents, level] of voices) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = cents;
      pitch.connect(o.detune);
      vibDepth.connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(voice);
      o.start(0);
    }
    pitch.start(0);
    vib.start(0);
  },

  /** The dub siren: a square wave swooping on a fast LFO, rising, thrown into a ping-pong echo. */
  siren(ctx, beat) {
    const { dry } = bus(ctx, 0.25, 2.6, 0.55);
    const echo = pingPong(ctx, Math.min(0.45, beat * 0.75), 0.55, 2200);
    echo.output.connect(dry);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(520, 0);
    o.frequency.linearRampToValueAtTime(780, 1.6);
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(3.5, 0);
    lfo.frequency.linearRampToValueAtTime(9, 1.6);
    const depth = ctx.createGain();
    depth.gain.value = 260;
    lfo.connect(depth).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(0.5, 0.02);
    g.gain.setValueAtTime(0.5, 1.45);
    g.gain.linearRampToValueAtTime(0, 1.6);
    const tone = filter(ctx, 'lowpass', 3200, 1.5);
    o.connect(tone).connect(drive(ctx, 1.6)).connect(g);
    g.connect(dry);
    g.connect(echo.input);
    o.start(0);
    lfo.start(0);
  },

  /** Four FM "pew"s, falling fast, bounced left and right by an echo. */
  laser(ctx, beat) {
    const { dry } = bus(ctx, 0.3, 2.2, 0.5);
    const echo = pingPong(ctx, Math.min(0.3, beat / 2), 0.45, 5000);
    echo.output.connect(dry);
    for (let n = 0; n < 3; n++) {
      const t = n * 0.16;
      const car = ctx.createOscillator();
      car.type = 'sawtooth';
      car.frequency.setValueAtTime(3400 - n * 300, t);
      car.frequency.exponentialRampToValueAtTime(160, t + 0.22);
      const mod = ctx.createOscillator();
      mod.frequency.setValueAtTime(900, t);
      mod.frequency.exponentialRampToValueAtTime(60, t + 0.22);
      const modDepth = ctx.createGain();
      modDepth.gain.setValueAtTime(1600, t);
      modDepth.gain.exponentialRampToValueAtTime(20, t + 0.22);
      mod.connect(modDepth).connect(car.frequency);
      const res = filter(ctx, 'bandpass', 1800, 1.2);
      res.frequency.setValueAtTime(4000, t);
      res.frequency.exponentialRampToValueAtTime(300, t + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      car.connect(res).connect(g);
      g.connect(dry);
      g.connect(echo.input);
      car.start(t);
      mod.start(t);
      car.stop(t + 0.26);
      mod.stop(t + 0.26);
    }
  },

  /**
   * The build-up: two bars ending on the downbeat — a snare roll speeding up (quarters → 32nds), a
   * detuned supersaw climbing two octaves and a noise sweep opening up, all into a big room.
   */
  riser(ctx, beat) {
    const end = beat * 8;
    const { dry } = bus(ctx, 0.35, 3, 0.7);
    // the snare roll
    const snare = ctx.createGain();
    snare.connect(filter(ctx, 'highpass', 400)).connect(filter(ctx, 'peaking', 1800, 1, 5)).connect(dry);
    const steps: [number, number][] = [
      [0, 1],
      [beat * 2, 0.5],
      [beat * 4, 0.25],
      [beat * 6, 0.125],
      [beat * 7, 0.0625],
    ];
    steps.forEach(([from, len], i) => {
      const to = steps[i + 1]?.[0] ?? end;
      for (let t = from; t < to - 0.001; t += beat * len) {
        const n = noise(ctx, 0.12);
        const g = ctx.createGain();
        const level = 0.15 + 0.85 * (t / end) ** 1.5;
        g.gain.setValueAtTime(level, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(0.11, beat * len * 0.9));
        n.connect(g).connect(snare);
        n.start(t);
      }
    });
    // the supersaw
    const saw = ctx.createGain();
    saw.gain.setValueAtTime(0.0001, 0);
    saw.gain.exponentialRampToValueAtTime(0.3, end);
    saw.gain.setValueAtTime(0, end + 0.005);
    const sawLp = filter(ctx, 'lowpass', 400, 2);
    sawLp.frequency.setValueAtTime(400, 0);
    sawLp.frequency.exponentialRampToValueAtTime(9000, end);
    const w = wide(ctx, 12);
    saw.connect(sawLp).connect(w.input);
    w.output.connect(dry);
    for (const cents of [-22, -11, 0, 11, 22]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = cents;
      o.frequency.setValueAtTime(110, 0);
      o.frequency.exponentialRampToValueAtTime(440, end);
      o.connect(saw);
      o.start(0);
      o.stop(end + 0.01);
    }
    // the noise sweep
    const n = noise(ctx, end + 0.05, true);
    const bp = filter(ctx, 'bandpass', 400, 1.5);
    bp.frequency.setValueAtTime(400, 0);
    bp.frequency.exponentialRampToValueAtTime(10000, end);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.02, 0);
    ng.gain.exponentialRampToValueAtTime(0.5, end);
    ng.gain.setValueAtTime(0, end + 0.005);
    n.connect(bp).connect(ng).connect(dry);
    n.start(0);
  },

  /** A cinematic hit: a sub dropping into the floor, a punchy burst, a shimmering crash and a huge room. */
  impact(ctx) {
    const { dry, send } = bus(ctx, 0.45, 3.2, 0.9);
    const sub = ctx.createOscillator();
    sub.frequency.setValueAtTime(150, 0);
    sub.frequency.exponentialRampToValueAtTime(34, 0.7);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(1, 0);
    sg.gain.exponentialRampToValueAtTime(0.001, 2.6);
    sub.connect(sg).connect(drive(ctx, 2.5)).connect(filter(ctx, 'lowpass', 400)).connect(dry);
    sub.start(0);
    // the punch
    const p = noise(ctx, 0.3, true);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(1, 0);
    pg.gain.exponentialRampToValueAtTime(0.001, 0.22);
    p.connect(filter(ctx, 'lowpass', 3500, 0.8)).connect(pg).connect(dry);
    p.start(0);
    // the crash, mostly into the room
    const c = noise(ctx, 2.2, true);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.35, 0);
    cg.gain.exponentialRampToValueAtTime(0.001, 2);
    c.connect(filter(ctx, 'highpass', 5000, 0.7)).connect(cg);
    cg.connect(dry);
    cg.connect(send);
    c.start(0);
  },

  /** The downlifter: a wide noise sweep and a falling tone, fading down after the drop. */
  down(ctx) {
    const { dry } = bus(ctx, 0.35, 2.6, 0.6);
    const n = noise(ctx, 2.4, true);
    const bp = filter(ctx, 'bandpass', 9000, 1.2);
    bp.frequency.setValueAtTime(9000, 0);
    bp.frequency.exponentialRampToValueAtTime(250, 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, 0);
    g.gain.exponentialRampToValueAtTime(0.001, 2.3);
    n.connect(bp).connect(g).connect(dry);
    n.start(0);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(880, 0);
    o.frequency.exponentialRampToValueAtTime(55, 2);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.12, 0);
    og.gain.exponentialRampToValueAtTime(0.001, 2);
    o.connect(filter(ctx, 'lowpass', 2500)).connect(og).connect(dry);
    o.start(0);
  },

  /**
   * A baby scratch: an "ahh" (noise through vowel formants) pushed forward and pulled back — the
   * formants slide up and down with the hand's speed, the volume follows it.
   */
  scratch(ctx) {
    const { dry } = bus(ctx, 0.12, 1.2, 0.3);
    const strokes: [number, number, number][] = [
      // start, length, direction (+1 forward = up, −1 back = down)
      [0, 0.11, 1],
      [0.12, 0.11, -1],
      [0.26, 0.07, 1],
      [0.34, 0.07, -1],
      [0.44, 0.16, 1],
      [0.62, 0.2, -1],
    ];
    const src = noise(ctx, 1);
    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0, 0);
    const formants = [700, 1150, 2600].map((f, i) => {
      const b = filter(ctx, 'bandpass', f, 8);
      const g = ctx.createGain();
      g.gain.value = [1, 0.7, 0.35][i];
      src.connect(b).connect(g).connect(voice);
      return b;
    });
    for (const [t, len, dir] of strokes) {
      // the hand speeds up then slows: the pitch rises and falls inside the stroke
      voice.gain.setValueAtTime(0, t);
      voice.gain.linearRampToValueAtTime(1, t + len * 0.25);
      voice.gain.linearRampToValueAtTime(0, t + len);
      formants.forEach((b, i) => {
        const f = [700, 1150, 2600][i];
        const lo = f * (dir > 0 ? 0.45 : 1.6);
        const hi = f * (dir > 0 ? 1.6 : 0.45);
        b.frequency.setValueAtTime(lo, t);
        b.frequency.exponentialRampToValueAtTime(hi, t + len * 0.5);
        b.frequency.exponentialRampToValueAtTime(lo * 0.9, t + len);
      });
    }
    voice.connect(drive(ctx, 2)).connect(filter(ctx, 'highpass', 200)).connect(dry);
    src.start(0);
  },

  /** A big clap: four claps a hair apart, spread across the stereo field, in a bright room. */
  clap(ctx) {
    const { dry } = bus(ctx, 0.4, 1.6, 0.4);
    for (let k = 0; k < 4; k++) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = [-0.6, 0.6, -0.25, 0.25][k];
      const tone = filter(ctx, 'bandpass', 1100 + k * 180, 1.1);
      tone.connect(pan).connect(dry);
      const t0 = k * 0.006;
      for (const [dt, tail] of [
        [0, 0.012],
        [0.011, 0.012],
        [0.022, 0.18],
      ]) {
        const n = noise(ctx, tail + 0.05);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.9, t0 + dt);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + tail);
        n.connect(g).connect(tone);
        n.start(t0 + dt);
      }
    }
  },
};
