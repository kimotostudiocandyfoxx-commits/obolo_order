'use client';

/**
 * Tiny generative music engine (WebAudio) so Mercury / Jupiter sample tracks actually make sound
 * in the demo without shipping audio files. PLACEHOLDER (P-DEMO-1): real tracks stream from Bunny CDN.
 */
export interface SynthPreset {
  bpm: number;
  root: number;
  mode: 'major' | 'minor';
  progression: number[];
  wave: OscillatorType;
  /** optional sung melody (one note per mora), looped over its own length */
  melody?: { midi: number | null; beats: number }[];
}

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Engine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private preset: SynthPreset | null = null;
  private step = 0;
  private nextTime = 0;
  private onLoop: (() => void) | null = null;
  private melodyAt = new Map<number, { midi: number; len: number }>();
  private melodyLen = 0;

  /** Must be called from a user gesture the first time (iOS). */
  unlock(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  get unlocked() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  play(p: SynthPreset, onLoop?: () => void) {
    if (!this.unlock() || !this.ctx) return;
    this.stop();
    this.preset = p;
    this.onLoop = onLoop ?? null;
    this.step = 0;
    this.melodyAt.clear();
    this.melodyLen = 0;
    for (const n of p.melody ?? []) {
      const len = Math.max(1, Math.round(n.beats * 4));
      if (n.midi !== null) this.melodyAt.set(this.melodyLen, { midi: n.midi, len });
      this.melodyLen += len;
    }
    this.nextTime = this.ctx.currentTime + 0.05;
    this.master!.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master!.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.master!.gain.exponentialRampToValueAtTime(0.32, this.ctx.currentTime + 0.4);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.preset = null;
  }

  private schedule() {
    const ctx = this.ctx!;
    const p = this.preset;
    if (!p) return;
    const sixteenth = 60 / p.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.tick(p, this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
      if (this.step % (16 * p.progression.length) === 0) this.onLoop?.();
    }
  }

  private chord(p: SynthPreset, bar: number): number[] {
    const scale = SCALES[p.mode];
    const deg = p.progression[bar % p.progression.length];
    return [0, 2, 4].map((k) => {
      const i = deg + k;
      return p.root + scale[i % 7] + 12 * Math.floor(i / 7);
    });
  }

  private tick(p: SynthPreset, step: number, t: number, s16: number) {
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const notes = this.chord(p, bar);
    if (inBar === 0) for (const n of notes) this.tone(midiHz(n), t, s16 * 15, 'triangle', 0.05, 0.3); // pad
    if (inBar % 4 === 0) this.kick(t);
    if (inBar % 4 === 2) this.hat(t);
    if (inBar === 0 || inBar === 8 || inBar === 11) this.tone(midiHz(notes[0] - 24), t, s16 * 3, 'sine', 0.22, 0.01); // bass
    if (this.melodyLen) {
      const n = this.melodyAt.get(step % this.melodyLen);
      if (n) this.tone(midiHz(n.midi), t, s16 * n.len * 0.92, 'triangle', 0.16, 0.01);
      return; // the melody replaces the arpeggio
    }
    if (inBar % 2 === 0) {
      const arp = notes[(inBar / 2) % 3] + 12 * (inBar % 8 < 4 ? 1 : 2) - 12;
      this.tone(midiHz(arp), t, s16 * 1.6, p.wave, p.wave === 'sine' ? 0.09 : 0.035, 0.005, 2400);
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, attack: number, cutoff?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      node = o.connect(f);
    }
    node.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.3);
  }

  private hat(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.06);
  }
}

export const synth = new Engine();
