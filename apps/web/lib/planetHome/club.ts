/**
 * M-R268 (design/home/template.html clubStart / clubStop): Saturn's club music for 〔▶ 全部流す〕 — one of three tracks
 * at random (124 / 128 / 120 BPM), made with WebAudio in the browser (kick on the beat, hats, a filtered saw bass line,
 * a soft triangle pad every 16 bars). Started only from a tap (browsers allow sound then), stopped with a short fade.
 * M-R275: on the app's one AudioContext (lib/onboarding/audio.ts), at 0.5, dipping while a voice plays (saturnSound).
 */
import { audioCtx, masterBus, unlockAudio } from '@/lib/onboarding/audio';
import { MUSIC_GAIN } from './saturnSoundCore';

export interface ClubTrack {
  bpm: number;
  bass: number[];
}
export const CLUB_TRACKS: ClubTrack[] = [
  { bpm: 124, bass: [55, 55, 65.4, 49] },
  { bpm: 128, bass: [61.7, 61.7, 73.4, 55] },
  { bpm: 120, bass: [49, 58.3, 65.4, 43.7] },
];

let playing: { out: GainNode; timer: ReturnType<typeof setInterval> } | null = null;

/** starts a random track (from a tap); returns its BPM, or null when there is no sound here */
export function clubStart(pick = Math.random()): number | null {
  clubStop();
  const a = unlockAudio();
  if (!a) return null;
  const S = CLUB_TRACKS[Math.floor(pick * CLUB_TRACKS.length) % CLUB_TRACKS.length];
  const out = a.createGain();
  out.gain.value = MUSIC_GAIN;
  out.connect(masterBus(a));
  const spb = 60 / S.bpm;
  let step = 0;
  let next = a.currentTime + 0.05;
  const kick = (t0: number) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
    g.gain.setValueAtTime(1, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + 0.32);
  };
  const noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.05), a.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const hat = (t0: number, v: number) => {
    const n = a.createBufferSource();
    n.buffer = noise;
    const f = a.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = a.createGain();
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    n.start(t0);
  };
  const bass = (t0: number, fr: number) => {
    const o = a.createOscillator();
    const f = a.createBiquadFilter();
    const g = a.createGain();
    o.type = 'sawtooth';
    o.frequency.value = fr;
    f.type = 'lowpass';
    f.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + spb * 0.45);
    o.connect(f);
    f.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + spb * 0.5);
  };
  const pad = (t0: number) => {
    for (const fr of [220, 277.2, 329.6]) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'triangle';
      o.frequency.value = fr * (S.bass[0] / 55);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.035, t0 + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t0 + spb * 15.5);
      o.connect(g);
      g.connect(out);
      o.start(t0);
      o.stop(t0 + spb * 16);
    }
  };
  const timer = setInterval(() => {
    while (next < a.currentTime + 0.2) {
      const q = step % 16;
      if (q % 4 === 0) kick(next);
      hat(next, q % 4 === 2 ? 0.18 : 0.05);
      if (q % 2 === 1) bass(next, S.bass[Math.floor(step / 16) % 4]);
      if (q === 0 && step % 64 === 0) pad(next);
      next += spb / 4;
      step++;
    }
  }, 50);
  playing = { out, timer };
  return S.bpm;
}

/** a short fade, then quiet (nothing left scheduled past it) */
export function clubStop() {
  const ac = audioCtx();
  if (!playing || !ac) return;
  clearInterval(playing.timer);
  const out = playing.out;
  try {
    out.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    setTimeout(() => out.disconnect(), 1500);
  } catch {
    out.disconnect();
  }
  playing = null;
}

export const clubPlaying = () => !!playing;
/** the music's gain while it plays (a voice dips it) */
export const clubGain = () => playing?.out.gain ?? null;
