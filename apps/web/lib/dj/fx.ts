/**
 * The deck effects (Venus DJ, client request 2026-10-12), built from plain Web Audio nodes — no
 * effects library: smaller, one AudioContext, and nothing between the effect and iOS Safari.
 * Each effect sits between `input` and `output` with its own dry / wet balance; `amount` (0–1) is
 * the knob: 0 = the effect is out. Delay times follow the deck's beat (`setBeat`).
 */
export type FxType = 'echo' | 'reverb' | 'flanger' | 'sweep';
export const FX_TYPES: FxType[] = ['echo', 'reverb', 'flanger', 'sweep'];
export const FX_NAMES: Record<FxType, string> = { echo: 'ECHO', reverb: 'REVERB', flanger: 'FLANGER', sweep: 'SWEEP' };

export class DeckFx {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private type: FxType = 'echo';
  private amount = 0;
  private beat = 0.5;
  // echo
  private readonly delay: DelayNode;
  private readonly feedback: GainNode;
  // reverb
  private readonly convolver: ConvolverNode;
  // flanger
  private readonly flangeDelay: DelayNode;
  private readonly flangeFeedback: GainNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  // sweep
  private readonly sweep: BiquadFilterNode;
  private readonly sweepLfo: OscillatorNode;
  private readonly sweepDepth: GainNode;
  /** each effect's own path into `wet` */
  private readonly paths: Record<FxType, GainNode>;

  constructor(private readonly ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    this.input.connect(this.dry).connect(this.output);
    this.wet.connect(this.output);
    const path = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.wet);
      return g;
    };
    this.paths = { echo: path(), reverb: path(), flanger: path(), sweep: path() };

    // echo: a beat-synced delay feeding back into itself
    this.delay = ctx.createDelay(4);
    this.feedback = ctx.createGain();
    this.input.connect(this.delay);
    this.delay.connect(this.feedback).connect(this.delay);
    this.delay.connect(this.paths.echo);

    // reverb: a generated room (decaying noise), no sample file to load
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = room(ctx, 2.6);
    this.input.connect(this.convolver).connect(this.paths.reverb);

    // flanger: a very short delay swept by a slow LFO, with feedback
    this.flangeDelay = ctx.createDelay(0.05);
    this.flangeDelay.delayTime.value = 0.004;
    this.flangeFeedback = ctx.createGain();
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.25;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0.0025;
    this.lfo.connect(this.lfoDepth).connect(this.flangeDelay.delayTime);
    this.input.connect(this.flangeDelay);
    this.flangeDelay.connect(this.flangeFeedback).connect(this.flangeDelay);
    this.flangeDelay.connect(this.paths.flanger);
    // the flanger's sound is the dry and the swept copy together
    this.input.connect(this.paths.flanger);

    // filter sweep: a resonant band-pass moving up and down over two bars
    this.sweep = ctx.createBiquadFilter();
    this.sweep.type = 'bandpass';
    this.sweep.Q.value = 4;
    this.sweep.frequency.value = 1200;
    this.sweepLfo = ctx.createOscillator();
    this.sweepDepth = ctx.createGain();
    this.sweepDepth.gain.value = 1000;
    this.sweepLfo.connect(this.sweepDepth).connect(this.sweep.frequency);
    this.input.connect(this.sweep).connect(this.paths.sweep);

    this.lfo.start();
    this.sweepLfo.start();
    this.apply();
  }

  /** The deck's beat length in seconds (60 / BPM, after its tempo). */
  setBeat(seconds: number) {
    if (!(seconds > 0.15 && seconds < 2)) return;
    this.beat = seconds;
    this.apply();
  }

  set(type: FxType, amount: number) {
    this.type = type;
    this.amount = Math.max(0, Math.min(1, amount));
    this.apply();
  }

  get state() {
    return { type: this.type, amount: this.amount };
  }

  private apply() {
    const t = this.ctx.currentTime;
    const a = this.amount;
    const ramp = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, 0.03);
    for (const k of Object.keys(this.paths) as FxType[]) ramp(this.paths[k].gain, k === this.type ? 1 : 0);
    ramp(this.wet.gain, a > 0.001 ? 1 : 0);
    switch (this.type) {
      case 'echo':
        // 3/4 beat (a dotted eighth) sits on the groove; more knob = louder and longer repeats
        ramp(this.delay.delayTime, this.beat * 0.75);
        ramp(this.feedback.gain, 0.25 + 0.5 * a);
        ramp(this.paths.echo.gain, a);
        ramp(this.dry.gain, 1);
        break;
      case 'reverb':
        ramp(this.paths.reverb.gain, a * 0.9);
        ramp(this.dry.gain, 1 - a * 0.35);
        break;
      case 'flanger':
        // one sweep every 4 bars
        ramp(this.lfo.frequency, 1 / (this.beat * 16));
        ramp(this.flangeFeedback.gain, 0.3 + 0.55 * a);
        ramp(this.paths.flanger.gain, a * 0.7);
        ramp(this.dry.gain, 1 - a * 0.6);
        break;
      case 'sweep':
        ramp(this.sweepLfo.frequency, 1 / (this.beat * 8));
        ramp(this.sweep.frequency, 300 + 2500 * a);
        ramp(this.sweepDepth.gain, 200 + 2200 * a);
        ramp(this.paths.sweep.gain, 1.6 * a);
        ramp(this.dry.gain, 1 - a);
        break;
    }
    if (a <= 0.001) ramp(this.dry.gain, 1);
  }
}

/** A stereo room: noise that dies away over `seconds` (the reverb's impulse response). */
function room(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}
