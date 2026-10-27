import { detectBeat } from './engine';

/**
 * The easy DJ's sound (Venus, first journey — docs/story-rewrite/画面設計/venus.md V-2): two decks and one
 * crossfader on plain Web Audio. Unlike the full console (DjEngine) there is no time-stretch worklet: 〔SYNC〕
 * changes the waiting deck's playback rate (the pitch moves a little, which nobody minds in a two-record
 * mix), so it starts on any phone and in the story previews.
 */
export class EasyDeck {
  buffer: AudioBuffer | null = null;
  bpm: number | null = null;
  firstBeat = 0;
  rate = 1;
  cue = 0;
  playing = false;
  readonly gain: GainNode;
  private src: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private offset = 0;

  constructor(private readonly ctx: AudioContext) {
    this.gain = ctx.createGain();
  }

  async load(url: string, knownBpm: number | null = null) {
    this.stop();
    const data = await (await fetch(url)).arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(data);
    const b = await detectBeat(this.buffer, knownBpm);
    this.bpm = b.bpm;
    this.firstBeat = b.firstBeat;
    this.rate = 1;
    this.cue = 0;
    this.offset = 0;
  }

  get duration() {
    return this.buffer?.duration ?? 0;
  }
  position() {
    if (!this.playing) return this.offset;
    return (this.offset + (this.ctx.currentTime - this.startedAt) * this.rate) % Math.max(1, this.duration);
  }
  /** where in the beat we are, 0–1 */
  phase() {
    if (!this.bpm) return 0;
    const beat = 60 / this.bpm;
    return ((((this.position() - this.firstBeat) / beat) % 1) + 1) % 1;
  }

  play(at = this.offset) {
    if (!this.buffer) return;
    this.stop();
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer;
    s.loop = true;
    s.playbackRate.value = this.rate;
    s.connect(this.gain);
    s.start(0, Math.max(0, Math.min(at, this.duration - 0.05)));
    this.src = s;
    this.offset = at;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
  }
  stop() {
    if (this.src) {
      this.offset = this.position();
      try {
        this.src.stop();
      } catch {
        /* already stopped */
      }
      this.src.disconnect();
      this.src = null;
    }
    this.playing = false;
  }
  setRate(r: number) {
    if (this.playing) this.offset = this.position();
    this.startedAt = this.ctx.currentTime;
    this.rate = r;
    if (this.src) this.src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.05);
  }
}

export class EasyDj {
  readonly ctx: AudioContext;
  readonly decks: [EasyDeck, EasyDeck];
  private readonly master: GainNode;
  fader = 0;

  constructor() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    void this.ctx.resume();
    this.master = this.ctx.createGain();
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.ratio.value = 20;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.decks = [new EasyDeck(this.ctx), new EasyDeck(this.ctx)];
    this.decks.forEach((d) => d.gain.connect(this.master));
    this.setFader(0);
  }

  /** 0 = only the left deck … 1 = only the right, equal power between */
  setFader(x: number) {
    this.fader = Math.max(0, Math.min(1, x));
    const t = this.ctx.currentTime;
    this.decks[0].gain.gain.setTargetAtTime(Math.cos((this.fader * Math.PI) / 2), t, 0.01);
    this.decks[1].gain.gain.setTargetAtTime(Math.sin((this.fader * Math.PI) / 2), t, 0.01);
  }

  /** the right deck follows the left's tempo (half / double time when closer) and lines up its beat */
  sync(): boolean {
    const [a, b] = this.decks;
    if (!a.bpm || !b.bpm) return false;
    let target = a.bpm * a.rate;
    const r = (t: number) => t / b.bpm!;
    if (Math.abs(r(target * 2) - 1) < Math.abs(r(target) - 1)) target *= 2;
    else if (Math.abs(r(target / 2) - 1) < Math.abs(r(target) - 1)) target /= 2;
    b.setRate(Math.max(0.7, Math.min(1.4, r(target))));
    if (a.playing && b.playing) {
      let d = a.phase() - b.phase();
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      b.play(b.position() + d * (60 / (b.bpm * b.rate)));
    }
    return true;
  }

  /** the music fades away (the set is over) */
  fadeOut(sec = 2.5) {
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, sec / 4);
  }

  close() {
    this.decks.forEach((d) => d.stop());
    void this.ctx.close();
  }
}
