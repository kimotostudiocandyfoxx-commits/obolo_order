#!/usr/bin/env node
/**
 * The ダチ voice messages' sound library (client 2026-11-27, the trial): made ONCE, here, in code — no paid generation.
 *
 *   node apps/api/scripts/make-voice-sounds.mjs            → apps/api/assets/voice-sounds/*.mp3 (committed)
 *
 * Direction "Moon atelier": clear glass / bell tones and a soft lo-fi; the client's word is that most people find BGM
 * noisy, so: no melody that competes with the words, few notes, soft attacks, no drums, no bass. Every file begins and
 * ends in silence (a bed is looped by ffmpeg: the seam falls in the silence). The levels under the voice are set at
 * the mix (apps/api/src/voice/voice-mix.ts), not here: each file is written at the same peak (−6 dBFS).
 *
 * Files (packages/shared/src/voiceSound.ts VOICE_SOUND_PARTS names them):
 *   <mood>-a.mp3    a short accent as the message starts
 *   <mood>-z.mp3    a shorter one as it ends
 *   <mood>-bed.mp3  a sparse bed, looped for the length of the voice
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/voice-sounds');
const TAU = Math.PI * 2;

const buf = (sec) => new Float32Array(Math.round(sec * SR));
/** a soft attack (never a click) and an exponential ring-out */
const env = (t, attack, decay) => (t < 0 ? 0 : (1 - Math.exp(-t / attack)) * Math.exp(-t / decay));

/** one note of partials added into `out` at `at` seconds; `bend(t)` multiplies the pitch */
function note(out, at, hz, amp, { partials = [[1, 1, 1]], attack = 0.012, decay = 0.5, len = decay * 7, bend = null, vibrato = null } = {}) {
  const from = Math.round(at * SR);
  const n = Math.min(out.length - from, Math.round(len * SR));
  const phase = partials.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let f = hz * (bend ? bend(t) : 1);
    if (vibrato) f *= 1 + vibrato[1] * Math.sin(TAU * vibrato[0] * t);
    let s = 0;
    for (let p = 0; p < partials.length; p++) {
      const [ratio, a, d] = partials[p];
      phase[p] += (TAU * f * ratio) / SR;
      s += a * Math.sin(phase[p]) * env(t, attack, decay * d);
    }
    out[from + i] += amp * s;
  }
}

/** glass / bell: a pure fundamental with two quiet inharmonic partials that die sooner */
const GLASS = [[1, 1, 1], [2.76, 0.22, 0.45], [5.4, 0.07, 0.25]];
/** music box: the tine and a little of its high ring */
const BOX = [[1, 1, 1], [3.0, 0.18, 0.35], [6.3, 0.05, 0.2]];
/** a felt piano, far away: a few harmonics, each shorter than the one below */
const FELT = [[1, 1, 1], [2, 0.32, 0.6], [3, 0.12, 0.4], [4, 0.05, 0.3]];
/** a round synth blip */
const ROUND = [[1, 1, 1], [2, 0.18, 0.7], [3, 0.1, 0.5]];

/** lo-fi: a one-pole low-pass, a gentle saturation, a very slow flutter in level */
function lofi(x, cutoff = 4200, flutter = 0.03) {
  const k = 1 - Math.exp((-TAU * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += k * (x[i] - y);
    const f = 1 + flutter * Math.sin((TAU * 0.6 * i) / SR);
    x[i] = Math.tanh(y * 1.4 * f) / 1.4;
  }
  return x;
}

/** to a peak of −6 dBFS, the last 30 ms faded (the files end in silence anyway) */
function finish(x) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.5 / peak : 1;
  const fade = Math.round(0.03 * SR);
  for (let i = 0; i < x.length; i++) x[i] *= g * Math.min(1, (x.length - i) / fade);
  return x;
}

const SOUNDS = {
  // うれしい — a sparkly bell: three glass notes, quick, rising, then left to ring
  'ureshii-a': () => {
    const x = buf(1.7);
    note(x, 0.02, 1318.5, 0.8, { partials: GLASS, decay: 0.32 });
    note(x, 0.11, 1661.2, 0.7, { partials: GLASS, decay: 0.34 });
    note(x, 0.2, 1975.5, 0.75, { partials: GLASS, decay: 0.42 });
    note(x, 0.34, 2637.0, 0.3, { partials: GLASS, decay: 0.3 });
    return lofi(x, 6500, 0.02);
  },
  'ureshii-z': () => {
    const x = buf(1.5);
    note(x, 0.02, 1975.5, 0.6, { partials: GLASS, decay: 0.36 });
    note(x, 0.14, 2637.0, 0.5, { partials: GLASS, decay: 0.4 });
    return lofi(x, 6500, 0.02);
  },
  // わくわく — a bouncy short synth phrase: four round blips, each sliding up into its pitch
  'wakuwaku-a': () => {
    const x = buf(1.3);
    const hop = (t) => 1 - 0.06 * Math.exp(-t / 0.03);
    [523.25, 659.25, 783.99, 1046.5].forEach((hz, k) => note(x, 0.02 + k * 0.13, hz, 0.8 - k * 0.05, { partials: ROUND, attack: 0.008, decay: k === 3 ? 0.22 : 0.09, bend: hop }));
    return lofi(x, 5200, 0.03);
  },
  'wakuwaku-z': () => {
    const x = buf(1.1);
    const hop = (t) => 1 - 0.06 * Math.exp(-t / 0.03);
    note(x, 0.02, 783.99, 0.7, { partials: ROUND, attack: 0.008, decay: 0.09, bend: hop });
    note(x, 0.15, 1046.5, 0.7, { partials: ROUND, attack: 0.008, decay: 0.24, bend: hop });
    return lofi(x, 5200, 0.03);
  },
  // おつかれ — a soft piano: one felt note every three seconds or so
  'otsukare-bed': () => {
    const x = buf(9.6);
    note(x, 0.25, 349.23, 0.8, { partials: FELT, attack: 0.02, decay: 0.75 });
    note(x, 0.31, 523.25, 0.35, { partials: FELT, attack: 0.02, decay: 0.7 });
    note(x, 3.45, 440.0, 0.7, { partials: FELT, attack: 0.02, decay: 0.75 });
    note(x, 6.6, 392.0, 0.7, { partials: FELT, attack: 0.02, decay: 0.8 });
    note(x, 6.67, 587.33, 0.3, { partials: FELT, attack: 0.02, decay: 0.7 });
    return lofi(x, 2600, 0.04);
  },
  // びっくり — a "poko" (a pitch that drops like a drop of water) and a small "!" of two glass notes at once
  'bikkuri-a': () => {
    const x = buf(1.1);
    note(x, 0.02, 520, 0.9, { attack: 0.004, decay: 0.07, bend: (t) => 1 + 0.9 * Math.exp(-t / 0.025) });
    note(x, 0.24, 1760.0, 0.55, { partials: GLASS, attack: 0.006, decay: 0.13 });
    note(x, 0.24, 2637.0, 0.4, { partials: GLASS, attack: 0.006, decay: 0.11 });
    return lofi(x, 6000, 0.02);
  },
  // しんみり — a quiet pad that breathes in and out (it swells, holds, goes; a second of nothing before it comes again)
  'shinmiri-bed': () => {
    const sec = 12;
    const x = buf(sec);
    const voices = [329.63, 330.6, 493.88, 495.1, 659.25];
    const amps = [1, 0.8, 0.7, 0.55, 0.22];
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      // 0 → 3.5 s in, held, 7.5 → 11 s out, silent to 12
      const swell = t < 3.5 ? 0.5 - 0.5 * Math.cos((Math.PI * t) / 3.5) : t < 7.5 ? 1 : t < 11 ? 0.5 + 0.5 * Math.cos((Math.PI * (t - 7.5)) / 3.5) : 0;
      let s = 0;
      for (let v = 0; v < voices.length; v++) s += amps[v] * Math.sin(TAU * voices[v] * t);
      x[i] = s * swell;
    }
    return lofi(x, 2200, 0.05);
  },
  // おもしろ — squishy and comical: a "boing" that wobbles down, and a small "pyu" up after it
  'omoshiro-a': () => {
    const x = buf(1.3);
    note(x, 0.02, 300, 0.9, { partials: ROUND, attack: 0.006, decay: 0.16, bend: (t) => 1 + 0.7 * Math.exp(-t / 0.05) - 0.25 * Math.min(1, t / 0.4), vibrato: [17, 0.06] });
    note(x, 0.5, 520, 0.6, { partials: ROUND, attack: 0.008, decay: 0.07, bend: (t) => 1 + 0.8 * Math.min(1, t / 0.12) });
    return lofi(x, 4500, 0.03);
  },
  'omoshiro-z': () => {
    const x = buf(0.9);
    note(x, 0.02, 420, 0.8, { partials: ROUND, attack: 0.006, decay: 0.09, bend: (t) => 1 + 0.5 * Math.exp(-t / 0.04), vibrato: [17, 0.05] });
    return lofi(x, 4500, 0.03);
  },
  // おやすみ — a music box, wound almost down: one tine every three seconds
  'oyasumi-bed': () => {
    const x = buf(9.6);
    note(x, 0.3, 783.99, 0.8, { partials: BOX, attack: 0.006, decay: 0.55 });
    note(x, 3.5, 659.25, 0.75, { partials: BOX, attack: 0.006, decay: 0.55 });
    note(x, 3.72, 987.77, 0.35, { partials: BOX, attack: 0.006, decay: 0.45 });
    note(x, 6.7, 523.25, 0.75, { partials: BOX, attack: 0.006, decay: 0.6 });
    return lofi(x, 5000, 0.04);
  },
};

function wav(x) {
  const pcm = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'voice-sounds-'));
try {
  for (const [name, make] of Object.entries(SOUNDS)) {
    const src = join(tmp, `${name}.wav`);
    writeFileSync(src, wav(finish(make())));
    // -bitexact / no metadata: the same bytes on every run
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', String(SR), '-b:a', '96k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', join(OUT, `${name}.mp3`)], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${name}: ${r.stderr}`);
    console.log(`${name}.mp3`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
