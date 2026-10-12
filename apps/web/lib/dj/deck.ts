import type { StretchNode } from 'signalsmith-stretch';
import { DeckFx, type FxType } from './fx';

/**
 * One DJ deck (Venus DJ, client request 2026-10-12). The track plays through Signalsmith Stretch
 * (MIT, WASM in an AudioWorklet): tempo changes keep the key when key lock is on. Then the channel
 * strip: trim → 3-band EQ → filter knob (low-pass ⇠ 0 ⇢ high-pass) → effect → channel fader →
 * (crossfader, set by the engine) → master.
 *
 * Times are positions in the track (seconds of the original audio), whatever the tempo.
 */
export const TEMPO_RANGE = 0.16;
export const HOT_CUES = 4;
/** loop / beat jump sizes, in beats */
export const LOOP_SIZES = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

export interface TrackMeta {
  title: string;
  /** known BPM (our own songs) or detected */
  bpm: number | null;
  /** where the first beat is (seconds), for SYNC's phase */
  firstBeat: number;
  /** our own song / MV, or a file from the device */
  source: 'song' | 'file';
  /** the MV to show as VJ (later) */
  videoUrl?: string | null;
}

export class Deck {
  readonly out: GainNode;
  /** the crossfader's side of this deck (the engine sets it) */
  readonly xf: GainNode;
  readonly fx: DeckFx;
  /** the deck's sound after its fader, for the level light and the VJ visuals */
  readonly analyser: AnalyserNode;
  /** the channel fader as set (0–1), for the VJ mix */
  faderValue = 0.85;
  private readonly trim: GainNode;
  private readonly low: BiquadFilterNode;
  private readonly mid: BiquadFilterNode;
  private readonly high: BiquadFilterNode;
  private readonly hp: BiquadFilterNode;
  private readonly lp: BiquadFilterNode;
  private readonly fader: GainNode;

  buffer: AudioBuffer | null = null;
  meta: TrackMeta | null = null;
  playing = false;
  tempo = 0;
  keylock = true;
  cue = 0;
  hotCues: (number | null)[] = Array(HOT_CUES).fill(null);
  /** the loop playing now (track seconds), or null */
  loop: { start: number; end: number } | null = null;
  /** the loop's length and the beat jump's distance, in beats (one size for both) */
  loopBeats = 4;
  /** a peak per 1/100 s, for the waveform */
  peaks: Float32Array = new Float32Array(0);
  /** the same per frequency band (low < 250 Hz, mid, high > 4 kHz), 0–1 each — the coloured waveform */
  bands: { low: Float32Array; mid: Float32Array; high: Float32Array } | null = null;

  // where the track was at the last known moment (for a smooth position between worklet updates)
  private at = { input: 0, ctx: 0 };
  private bend = 0;
  private scratch: { wasPlaying: boolean } | null = null;
  private cueHeld = false;
  private listeners = new Set<() => void>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly stretch: StretchNode,
  ) {
    this.trim = ctx.createGain();
    this.low = ctx.createBiquadFilter();
    this.low.type = 'lowshelf';
    this.low.frequency.value = 220;
    this.mid = ctx.createBiquadFilter();
    this.mid.type = 'peaking';
    this.mid.frequency.value = 1000;
    this.mid.Q.value = 0.8;
    this.high = ctx.createBiquadFilter();
    this.high.type = 'highshelf';
    this.high.frequency.value = 3800;
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 10;
    this.hp.Q.value = 0.9;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 22000;
    this.lp.Q.value = 0.9;
    this.fx = new DeckFx(ctx);
    this.fader = ctx.createGain();
    this.xf = ctx.createGain();
    this.out = ctx.createGain();
    stretch.connect(this.trim).connect(this.low).connect(this.mid).connect(this.high).connect(this.hp).connect(this.lp);
    this.lp.connect(this.fx.input);
    this.fx.output.connect(this.fader).connect(this.xf).connect(this.out);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.7;
    this.fader.connect(this.analyser);
    void stretch.setUpdateInterval(0.05, (t) => {
      this.at = { input: t, ctx: ctx.currentTime };
      this.emit();
    });
  }

  /** Something on the deck changed (for the screen). */
  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  get rate() {
    return 1 + this.tempo;
  }
  /** BPM now (after the tempo slider) */
  get bpm() {
    return this.meta?.bpm ? this.meta.bpm * this.rate : null;
  }
  get duration() {
    return this.buffer?.duration ?? 0;
  }
  /** seconds of one beat at the current tempo */
  get beat() {
    return this.bpm ? 60 / this.bpm : 0.5;
  }

  /** Where the track is now. */
  position(): number {
    let p = this.playing ? this.at.input + (this.ctx.currentTime - this.at.ctx) * this.rate * (1 + this.bend) : this.at.input;
    // inside a loop the worklet wraps round at its end: so does the guess between its updates
    const l = this.loop;
    if (l && p >= l.end && this.at.input < l.end + 0.05) p = l.start + ((p - l.start) % (l.end - l.start));
    return Math.max(0, Math.min(this.duration, p));
  }

  /** How far into the current beat (0–1), from the first beat. */
  phase(): number {
    if (!this.meta?.bpm) return 0;
    const b = 60 / this.meta.bpm;
    const x = (this.position() - this.meta.firstBeat) / b;
    return x - Math.floor(x);
  }

  async load(buffer: AudioBuffer, meta: TrackMeta) {
    this.pause();
    await this.stretch.dropBuffers();
    const ch = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c));
    // a mono file plays on both sides
    await this.stretch.addBuffers(ch.length === 1 ? [ch[0], ch[0]] : ch);
    this.buffer = buffer;
    this.meta = meta;
    this.peaks = peaksOf(buffer);
    this.bands = null;
    // the bands take a moment (three offline filter passes): drawn when ready
    void bandsOf(buffer).then((b) => {
      if (this.buffer === buffer) {
        this.bands = b;
        this.emit();
      }
    }, () => undefined);
    this.cue = meta.firstBeat;
    this.hotCues = Array(HOT_CUES).fill(null);
    this.loop = null;
    this.at = { input: this.cue, ctx: this.ctx.currentTime };
    await this.stretch.schedule({ active: false, input: this.cue, rate: this.rate, semitones: this.semitones(), loopStart: 0, loopEnd: 0 });
    this.fx.setBeat(this.beat);
    this.emit();
  }

  private semitones() {
    // key lock off = the pitch moves with the speed, like a record
    return this.keylock ? 0 : 12 * Math.log2(this.rate * (1 + this.bend));
  }

  private send(extra: { active?: boolean; input?: number } = {}) {
    const input = extra.input ?? this.position();
    // a jump out of the loop (hot cue, CUE, the wheel) lets the loop go
    if (this.loop && (input < this.loop.start - 0.01 || input > this.loop.end + 0.01)) this.loop = null;
    this.at = { input, ctx: this.ctx.currentTime };
    void this.stretch.schedule({ active: this.playing, input, rate: Math.max(0.01, this.rate * (1 + this.bend)), semitones: this.semitones(), loopStart: this.loop?.start ?? 0, loopEnd: this.loop?.end ?? 0, ...extra });
  }

  // --- loop and beat jump ----------------------------------------------------------------------

  /** one beat in track seconds (the grid the loop and the jump snap to) */
  private get gridBeat() {
    return this.meta?.bpm ? 60 / this.meta.bpm : 0.5;
  }

  /** LOOP: on → a loop of `loopBeats` from the beat just passed; on again → off (the track plays on). */
  toggleLoop() {
    if (!this.buffer) return;
    if (this.loop) {
      const p = this.position();
      this.loop = null;
      this.send({ input: p });
    } else {
      const b = this.gridBeat;
      const first = this.meta?.firstBeat ?? 0;
      const p = this.position();
      // short loops snap to their own size, longer ones to the beat
      const step = this.loopBeats < 1 ? b * this.loopBeats : b;
      const start = Math.max(0, first + Math.floor((p - first) / step + 1e-6) * step);
      this.loop = { start, end: Math.min(this.duration, start + b * this.loopBeats) };
      this.send({ input: p });
    }
    this.emit();
  }

  /** ½ / ×2: the size for the next loop and jump; a loop playing now shrinks / grows from its start. */
  resizeLoop(dir: -1 | 1) {
    const i = LOOP_SIZES.indexOf(this.loopBeats) + dir;
    if (i < 0 || i >= LOOP_SIZES.length) return;
    this.loopBeats = LOOP_SIZES[i];
    if (this.loop) {
      const p = this.position();
      this.loop = { start: this.loop.start, end: Math.min(this.duration, this.loop.start + this.gridBeat * this.loopBeats) };
      const len = this.loop.end - this.loop.start;
      this.send({ input: p >= this.loop.end ? this.loop.start + ((p - this.loop.start) % len) : p });
    }
    this.emit();
  }

  /** Beat jump: `loopBeats` beats back / ahead, on the beat; a loop playing moves along with it. */
  beatJump(dir: -1 | 1) {
    if (!this.buffer) return;
    const d = dir * this.gridBeat * this.loopBeats;
    const p = this.position() + d;
    if (p < 0 || p > this.duration - 0.05) return;
    if (this.loop) this.loop = { start: this.loop.start + d, end: this.loop.end + d };
    this.send({ input: p });
    this.emit();
  }

  play() {
    if (!this.buffer || this.playing) return;
    this.playing = true;
    this.send({ active: true, input: this.at.input });
    this.emit();
  }

  pause() {
    if (!this.playing) return;
    const p = this.position();
    this.playing = false;
    this.send({ active: false, input: p });
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    this.send({ input: Math.max(0, Math.min(this.duration - 0.05, t)) });
    this.emit();
  }

  /** CUE as on a CDJ: playing → back to the cue point and stop; stopped elsewhere → the cue point
   * moves here; stopped on it → plays while held, back to it on release. */
  cueDown() {
    if (!this.buffer) return;
    if (this.playing) {
      this.playing = false;
      this.send({ active: false, input: this.cue });
    } else if (Math.abs(this.position() - this.cue) > 0.02) {
      this.cue = this.position();
    } else {
      this.cueHeld = true;
      this.playing = true;
      this.send({ active: true, input: this.cue });
    }
    this.emit();
  }
  cueUp() {
    if (!this.cueHeld) return;
    this.cueHeld = false;
    this.playing = false;
    this.send({ active: false, input: this.cue });
    this.emit();
  }

  /** A hot cue pad: empty → remember here; set → jump there (playing on if playing). */
  hotCue(i: number) {
    if (!this.buffer) return;
    const at = this.hotCues[i];
    if (at === null) this.hotCues[i] = this.position();
    else this.seek(at);
    this.emit();
  }
  clearHotCue(i: number) {
    this.hotCues[i] = null;
    this.emit();
  }

  setTempo(x: number) {
    this.tempo = Math.max(-TEMPO_RANGE, Math.min(TEMPO_RANGE, x));
    this.send();
    this.fx.setBeat(this.beat);
    this.emit();
  }

  setKeylock(on: boolean) {
    this.keylock = on;
    this.send();
    this.emit();
  }

  /** EQ band in dB (−26 = kill … +6). */
  setEq(band: 'low' | 'mid' | 'high', db: number) {
    const f = band === 'low' ? this.low : band === 'mid' ? this.mid : this.high;
    f.gain.setTargetAtTime(Math.max(-26, Math.min(6, db)), this.ctx.currentTime, 0.01);
  }

  /** Filter knob: −1 … 0 … +1 = low-pass closing ⇠ open ⇢ high-pass closing. */
  setFilter(x: number) {
    const t = this.ctx.currentTime;
    const lp = x < 0 ? 22000 * Math.pow(200 / 22000, -x) : 22000;
    const hp = x > 0 ? 10 * Math.pow(6000 / 10, x) : 10;
    this.lp.frequency.setTargetAtTime(lp, t, 0.02);
    this.hp.frequency.setTargetAtTime(hp, t, 0.02);
  }

  setFader(v: number) {
    this.faderValue = Math.max(0, Math.min(1, v));
    // a slight curve: the top of the fader is where the level is
    this.fader.gain.setTargetAtTime(Math.pow(Math.max(0, Math.min(1, v)), 1.6), this.ctx.currentTime, 0.01);
  }

  setTrim(v: number) {
    this.trim.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  setFx(type: FxType, amount: number) {
    this.fx.set(type, amount);
  }

  // --- the jog wheel ---------------------------------------------------------------------------

  /** Touch on the top of the wheel: scratch (the track follows the finger). On the rim: bend. */
  jogStart(top: boolean) {
    if (!this.buffer) return;
    if (top) {
      this.scratch = { wasPlaying: this.playing };
      if (this.playing) {
        // the hand stops the record
        this.playing = false;
        this.send({ active: false });
      }
    }
  }

  /**
   * The wheel turned by `seconds` of track (one turn ≈ 1.8 s, like a 33⅓ record). Scratching moves
   * the track with the hand (forwards and back); bending speeds up / slows down a playing track.
   */
  jogMove(seconds: number, dt: number) {
    if (!this.buffer) return;
    if (this.scratch) {
      const p = this.position() + seconds;
      const speed = dt > 0 ? Math.abs(seconds) / dt : 0;
      this.at = { input: p, ctx: this.ctx.currentTime };
      // a short burst of sound at the hand's speed (backwards by stepping the position back)
      void this.stretch.schedule({ active: speed > 0.05, input: Math.max(0, p), rate: Math.max(0.05, Math.min(4, speed)), semitones: this.keylock ? 0 : 12 * Math.log2(Math.max(0.05, Math.min(4, speed))) });
      this.emit();
    } else if (this.playing) {
      this.bend = Math.max(-0.3, Math.min(0.3, (seconds / Math.max(dt, 0.016)) * 0.25));
      this.send();
    } else {
      // stopped: the wheel finds the spot
      this.seek(this.position() + seconds);
    }
  }

  jogEnd() {
    if (this.scratch) {
      const was = this.scratch.wasPlaying;
      this.scratch = null;
      this.playing = was;
      this.send({ active: was });
    } else if (this.bend) {
      this.bend = 0;
      this.send();
    }
    this.emit();
  }
}

/** Peak level per 10 ms (both channels), for drawing the waveform. */
function peaksOf(b: AudioBuffer): Float32Array {
  const step = Math.floor(b.sampleRate / 100);
  const n = Math.floor(b.length / step);
  const out = new Float32Array(n);
  const chans = Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c));
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const d of chans) for (let j = i * step; j < (i + 1) * step; j += 8) m = Math.max(m, Math.abs(d[j]));
    out[i] = m;
  }
  return out;
}

/**
 * How loud the lows, mids and highs are per 10 ms (client 2026-10-12: the usual DJ colours — low red,
 * mid green, high blue). The track is filtered three times offline (low-pass 250 Hz, band-pass around
 * 1 kHz, high-pass 4 kHz); each band is scaled to its own loud parts so all three show.
 */
async function bandsOf(b: AudioBuffer): Promise<{ low: Float32Array; mid: Float32Array; high: Float32Array }> {
  // a lower sample rate is plenty for a picture and quicker on a phone
  const sr = 22050;
  const len = Math.ceil(b.duration * sr);
  const pass = async (make: (ctx: OfflineAudioContext) => AudioNode[]) => {
    const ctx = new OfflineAudioContext(1, len, sr);
    const src = ctx.createBufferSource();
    src.buffer = b;
    const chain = make(ctx);
    let node: AudioNode = src;
    for (const n of chain) node = node.connect(n);
    node.connect(ctx.destination);
    src.start();
    const out = (await ctx.startRendering()).getChannelData(0);
    const step = Math.floor(sr / 100);
    const n = Math.floor(out.length / step);
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step; j < (i + 1) * step; j += 2) m = Math.max(m, Math.abs(out[j]));
      env[i] = m;
    }
    // scale to the band's own loud parts (98th percentile)
    const top = Float32Array.from(env).sort()[Math.floor(n * 0.98)] || 1;
    for (let i = 0; i < n; i++) env[i] = Math.min(1, env[i] / top);
    return env;
  };
  const biquad = (ctx: OfflineAudioContext, type: BiquadFilterType, f: number, q = 0.7) => {
    const x = ctx.createBiquadFilter();
    x.type = type;
    x.frequency.value = f;
    x.Q.value = q;
    return x;
  };
  const [low, mid, high] = await Promise.all([
    pass((c) => [biquad(c, 'lowpass', 250), biquad(c, 'lowpass', 250)]),
    pass((c) => [biquad(c, 'highpass', 250), biquad(c, 'lowpass', 4000)]),
    pass((c) => [biquad(c, 'highpass', 4000), biquad(c, 'highpass', 4000)]),
  ]);
  return { low, mid, high };
}
