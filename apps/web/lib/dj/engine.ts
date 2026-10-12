import { Deck, TEMPO_RANGE, type TrackMeta } from './deck';

/**
 * The Venus DJ engine (client request 2026-10-12): two decks, a crossfader and the master out, on one
 * AudioContext. Made on the first tap (iOS needs a touch to start sound).
 *
 * iOS Safari notes: the context is resumed inside the tap; `navigator.audioSession.type = 'playback'`
 * (Safari 17+) keeps the sound on when the phone's silent switch is on.
 */
export class DjEngine {
  readonly decks: [Deck, Deck];
  private readonly master: GainNode;
  private crossfade = 0.5;

  private constructor(
    readonly ctx: AudioContext,
    a: Deck,
    b: Deck,
  ) {
    this.decks = [a, b];
    this.master = ctx.createGain();
    // a gentle limiter so two loud songs together do not clip
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    a.out.connect(this.master);
    b.out.connect(this.master);
    this.master.connect(limiter).connect(ctx.destination);
    this.setCrossfader(0.5);
  }

  /** Call from a tap / click. */
  static async create(): Promise<DjEngine> {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.resume();
    // Signalsmith Stretch builds its AudioWorklet from its own source text, so it must reach the browser
    // untouched by the bundler (bundled, the worklet never started): a copy of the package file is
    // served as is from public/vendor and imported at run time (keep it in step with package.json)
    const load = new Function('u', 'return import(u)') as (u: string) => Promise<{ default: typeof import('signalsmith-stretch').default }>;
    const { default: SignalsmithStretch } = await load('/vendor/signalsmith-stretch-1.3.2.mjs');
    const within = <T,>(p: Promise<T>) => Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error('the tempo engine did not start')), 15000))]);
    const [sa, sb] = await within(Promise.all([SignalsmithStretch(ctx), SignalsmithStretch(ctx)]));
    // phones: the lighter setting (two stretchers at once)
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) await Promise.all([sa.configure({ blockMs: null, preset: 'cheaper' }), sb.configure({ blockMs: null, preset: 'cheaper' })]);
    return new DjEngine(ctx, new Deck(ctx, sa), new Deck(ctx, sb));
  }

  /** 0 = only deck A … 1 = only deck B, equal-power in between. */
  setCrossfader(x: number) {
    this.crossfade = Math.max(0, Math.min(1, x));
    const t = this.ctx.currentTime;
    this.decks[0].xf.gain.setTargetAtTime(Math.cos((this.crossfade * Math.PI) / 2), t, 0.005);
    this.decks[1].xf.gain.setTargetAtTime(Math.sin((this.crossfade * Math.PI) / 2), t, 0.005);
  }

  setMaster(v: number) {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  /** A file / song → a deck: decoded, BPM and first beat found (a known BPM is kept). */
  async load(i: 0 | 1, data: ArrayBuffer, meta: Partial<TrackMeta> & { title: string; source: TrackMeta['source'] }) {
    const buffer = await this.ctx.decodeAudioData(data);
    const { bpm, firstBeat } = await detectBeat(buffer, meta.bpm ?? null);
    await this.decks[i].load(buffer, { firstBeat, ...meta, bpm });
  }

  /**
   * SYNC: deck `i` follows the other deck's tempo (a half / double time if that fits the ±16%
   * slider better) and, when both play, lines its beat up with the other's.
   */
  sync(i: 0 | 1): boolean {
    const me = this.decks[i];
    const other = this.decks[1 - i];
    if (!me.meta?.bpm || !other.bpm) return false;
    let target = other.bpm;
    const fits = (t: number) => Math.abs(t / me.meta!.bpm! - 1) <= TEMPO_RANGE;
    if (!fits(target) && fits(target * 2)) target *= 2;
    else if (!fits(target) && fits(target / 2)) target /= 2;
    me.setTempo(target / me.meta.bpm - 1);
    if (me.playing && other.playing) {
      let d = other.phase() - me.phase();
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      me.seek(me.position() + d * (60 / me.meta.bpm));
    }
    return true;
  }

  close() {
    void this.ctx.close();
  }
}

/** BPM and first beat: web-audio-beat-detector (MIT, in a worker); a known BPM wins over its guess. */
export async function detectBeat(buffer: AudioBuffer, known: number | null): Promise<{ bpm: number | null; firstBeat: number }> {
  try {
    const { guess } = await import('web-audio-beat-detector');
    const r = await guess(buffer, { maxTempo: 180, minTempo: 70 });
    return { bpm: known ?? Math.round(r.bpm * 10) / 10, firstBeat: Math.max(0, r.offset) };
  } catch {
    return { bpm: known, firstBeat: 0 };
  }
}
