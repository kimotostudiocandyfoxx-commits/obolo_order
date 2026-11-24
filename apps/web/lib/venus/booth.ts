import { EasyDeck } from '@/lib/dj/easy';
import { openMic as openMicStream, quietMic } from '@/lib/micStream';

/**
 * The Venus broadcast booth's sound (docs/工房とブルーナ_設計.md §10): two decks and a crossfader on
 * plain Web Audio (the easy DJ's decks — they start on any phone), a microphone, and the mix the
 * show is recorded from.
 *
 *   deck A ─┐                                  ┌─▶ speakers (the host hears the music, not their own voice)
 *   deck B ─┴─▶ music ─▶ duck ─▶ musicOut ─────┤
 *   mic ─▶ voice (+ level meter) ──────────────┴─▶ show (MediaStream → MediaRecorder)
 *
 * 〔話すと曲を小さく〕: while the mic hears speech the music is ducked to DUCK_LEVEL, and comes back
 * DUCK_RELEASE seconds after the voice stops.
 */
const DUCK_LEVEL = 0.28;
const DUCK_RELEASE = 0.45;
const SPEECH_RMS = 0.035;

export class BoothMixer {
  readonly ctx: AudioContext;
  readonly decks: [EasyDeck, EasyDeck];
  fader = 0;
  musicLevel = 0.9;
  voiceLevel = 1;
  autoDuck = true;
  /** 0–1, the mic's loudness for the meter */
  micLevel = 0;
  speaking = false;
  private readonly music: GainNode;
  private readonly duck: GainNode;
  private readonly voice: GainNode;
  private readonly show: MediaStreamAudioDestinationNode;
  private mic: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private readonly meter: AnalyserNode;
  private raf = 0;
  private lastSpeech = 0;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recStarted = 0;

  constructor() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    // play-and-record keeps the music playing while the microphone is open (iOS)
    if (nav.audioSession) nav.audioSession.type = 'play-and-record';
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    void this.ctx.resume();
    this.decks = [new EasyDeck(this.ctx), new EasyDeck(this.ctx)];
    this.music = this.ctx.createGain();
    this.duck = this.ctx.createGain();
    this.voice = this.ctx.createGain();
    this.meter = this.ctx.createAnalyser();
    this.meter.fftSize = 1024;
    this.show = this.ctx.createMediaStreamDestination();
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.ratio.value = 20;
    this.decks.forEach((d) => d.gain.connect(this.music));
    this.music.connect(this.duck).connect(limiter);
    limiter.connect(this.ctx.destination);
    limiter.connect(this.show);
    this.voice.connect(this.show);
    this.setFader(0);
    this.setMusicLevel(this.musicLevel);
    this.tick();
  }

  setFader(x: number) {
    this.fader = Math.max(0, Math.min(1, x));
    const t = this.ctx.currentTime;
    this.decks[0].gain.gain.setTargetAtTime(Math.cos((this.fader * Math.PI) / 2), t, 0.01);
    this.decks[1].gain.gain.setTargetAtTime(Math.sin((this.fader * Math.PI) / 2), t, 0.01);
  }

  setMusicLevel(v: number) {
    this.musicLevel = v;
    this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setVoiceLevel(v: number) {
    this.voiceLevel = v;
    this.voice.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  /** which deck the listeners mostly hear (null = no music) */
  audibleDeck(): 0 | 1 | null {
    const [a, b] = this.decks;
    const ga = a.playing ? Math.cos((this.fader * Math.PI) / 2) : 0;
    const gb = b.playing ? Math.sin((this.fader * Math.PI) / 2) : 0;
    if (Math.max(ga, gb) < 0.2) return null;
    return ga >= gb ? 0 : 1;
  }

  /** the right deck follows the left's tempo (or the other way round) and lines up the beat */
  sync(follower: 0 | 1 = 1): boolean {
    const lead = this.decks[follower === 1 ? 0 : 1];
    const b = this.decks[follower];
    if (!lead.bpm || !b.bpm) return false;
    let target = lead.bpm * lead.rate;
    const r = (t: number) => t / b.bpm!;
    if (Math.abs(r(target * 2) - 1) < Math.abs(r(target) - 1)) target *= 2;
    else if (Math.abs(r(target / 2) - 1) < Math.abs(r(target) - 1)) target /= 2;
    b.setRate(Math.max(0.7, Math.min(1.4, r(target))));
    if (lead.playing && b.playing) {
      let d = lead.phase() - b.phase();
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      b.play(b.position() + d * (60 / (b.bpm * b.rate)));
    }
    return true;
  }

  get micOn() {
    return !!this.mic;
  }

  async openMic(): Promise<void> {
    if (this.mic) return;
    // client 2026-11-24: the page's one mic stream (asked once)
    this.mic = await openMicStream();
    this.micNode = this.ctx.createMediaStreamSource(this.mic);
    this.micNode.connect(this.voice);
    this.micNode.connect(this.meter);
    this.setVoiceLevel(this.voiceLevel);
  }

  closeMic() {
    this.micNode?.disconnect();
    this.micNode = null;
    if (this.mic) quietMic();
    this.mic = null;
    this.micLevel = 0;
    this.speaking = false;
  }

  private readonly buf = new Float32Array(1024);
  private tick = () => {
    if (this.micNode) {
      this.meter.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      const rms = Math.sqrt(sum / this.buf.length);
      this.micLevel = Math.min(1, rms * 8);
      const t = this.ctx.currentTime;
      if (rms > SPEECH_RMS) this.lastSpeech = t;
      this.speaking = t - this.lastSpeech < DUCK_RELEASE;
    }
    const target = this.autoDuck && this.speaking ? DUCK_LEVEL : 1;
    this.duck.gain.setTargetAtTime(target, this.ctx.currentTime, target < 1 ? 0.06 : 0.25);
    this.raf = requestAnimationFrame(this.tick);
  };

  // --- recording the show ------------------------------------------------------------------------

  get recording() {
    return !!this.rec;
  }

  /** seconds since 〔収録〕 / 〔生配信〕 started */
  elapsed() {
    return this.rec ? (performance.now() - this.recStarted) / 1000 : 0;
  }

  startRecording() {
    if (this.rec) return;
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
    this.rec = new MediaRecorder(this.show.stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 96_000 });
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(1000);
    this.recStarted = performance.now();
  }

  stopRecording(): Promise<{ blob: Blob; seconds: number }> {
    const rec = this.rec;
    if (!rec) return Promise.reject(new Error('not recording'));
    const seconds = this.elapsed();
    return new Promise((resolve) => {
      rec.onstop = () => {
        const type = (rec.mimeType || 'audio/webm').split(';')[0];
        resolve({ blob: new Blob(this.chunks, { type }), seconds });
        this.rec = null;
        this.chunks = [];
      };
      rec.stop();
    });
  }

  close() {
    cancelAnimationFrame(this.raf);
    this.decks.forEach((d) => d.stop());
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    this.rec = null;
    this.closeMic();
    void this.ctx.close();
  }
}
