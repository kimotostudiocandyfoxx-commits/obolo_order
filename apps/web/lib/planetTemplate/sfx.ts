import type { HomePlanet } from '@obolo/shared';
import { audioCtx, masterBus } from '@/lib/onboarding/audio';
import {
  clubNotes,
  cuesFor,
  duckOf,
  festNotes,
  gridOf,
  levelsOf,
  MASTER_LEVEL,
  MIX_KEY,
  MUSIC_LEVEL,
  MUTE_KEY,
  pickClub,
  pickFestBpm,
  thumpLevel,
  workSoundOf,
  beatAt,
  type ClubStyle,
  type MusicKind,
  type Note,
  type Sfx,
  type SoundEvent,
  type WorkSound,
} from './sound';

/**
 * The planet homes' sounds, played (the pure rules are ./sound.ts). One AudioContext — the app's own
 * (lib/onboarding/audio: the silent switch is respected, the first tap anywhere lets it out) — touched only once the
 * visitor has tapped (never a sound on page load), one master gain for the planets with an effects bus and a music bus
 * under it, both following the device's settings (the talk's 声を消す mutes; the story mixer's music / sounds levels).
 * The music on ▶ ducks under a work's own voice and goes quiet under a song / MV / radio (any <audio> / <video> on
 * the page, and the Audio() objects handed to trackMedia), so the works are always clearly heard.
 */

let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;

let gestured = false;
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;
function onGesture() {
  gestured = true;
  for (const e of GESTURES) window.removeEventListener(e, onGesture, true);
}
/** the visitor has tapped (a sound before that never plays) */
function hasGesture(): boolean {
  if (gestured) return true;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (ua?.hasBeenActive) gestured = true;
  return gestured;
}

function storageGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** the context, ready to play (null: no Web Audio, no tap yet, or muted) — the buses at the device's levels */
function ready(): AudioContext | null {
  if (typeof window === 'undefined' || !hasGesture()) return null;
  const lv = levelsOf(storageGet(MUTE_KEY), storageGet(MIX_KEY));
  const c = audioCtx();
  if (!c) return null;
  if (c.state !== 'running') void c.resume().catch(() => undefined);
  if (!master || master.context !== c) {
    master = c.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(masterBus(c));
    sfxBus = c.createGain();
    musicBus = c.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
  }
  sfxBus!.gain.value = lv.sfx;
  musicBus!.gain.value = lv.music;
  return lv.sfx > 0 || lv.music > 0 ? c : null;
}

function noise(c: AudioContext, seconds: number, shape: (x: number) => number): AudioBufferSourceNode {
  const n = c.createBufferSource();
  const bf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const d = bf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * shape(i / d.length);
  n.buffer = bf;
  return n;
}

// --- the effects (the prototype's functions, as they were) ------------------------------------------------------

/** chime(): three bright sines, a bell (鈴の音) */
function chime(c: AudioContext, out: AudioNode) {
  const t0 = c.currentTime + 0.005;
  [1318.5, 1975.5, 2637].forEach((f, k) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t = t0 + k * 0.035;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 / (k + 1), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.6);
  });
}
/** popSound(): a soap bubble — a tiny rising plip and a soft click (シャボン玉がはじける) */
function pop(c: AudioContext, out: AudioNode) {
  const t0 = c.currentTime + 0.005;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(520, t0);
  o.frequency.exponentialRampToValueAtTime(1900, t0 + 0.045);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
  o.connect(g);
  g.connect(out);
  o.start(t0);
  o.stop(t0 + 0.13);
  const n = noise(c, 0.03, (x) => Math.pow(1 - x, 3));
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 4200;
  f.Q.value = 0.8;
  const g2 = c.createGain();
  g2.gain.value = 0.35;
  n.connect(f);
  f.connect(g2);
  g2.connect(out);
  n.start(t0);
}
/** splash(): a burst of noise through a closing low-pass (水しぶき、ザバッ) */
function splash(c: AudioContext, out: AudioNode) {
  const t0 = c.currentTime + 0.005;
  const n = noise(c, 0.45, (x) => Math.pow(1 - x, 2.2));
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3800, t0);
  f.frequency.exponentialRampToValueAtTime(500, t0 + 0.4);
  const g = c.createGain();
  g.gain.value = 0.5;
  n.connect(f);
  f.connect(g);
  g.connect(out);
  n.start(t0);
}
/** whoosh(): noise swelling through a rising band-pass (シュッ) */
function whoosh(c: AudioContext, out: AudioNode) {
  const t0 = c.currentTime + 0.01;
  const n = noise(c, 0.6, (x) => Math.sin(Math.PI * x) * 0.8);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(400, t0);
  f.frequency.exponentialRampToValueAtTime(3200, t0 + 0.5);
  const g = c.createGain();
  g.gain.value = 0.35;
  n.connect(f);
  f.connect(g);
  g.connect(out);
  n.start(t0);
}
/** chip(): six square-wave notes (ピコピコ, the game case) */
function chip(c: AudioContext, out: AudioNode) {
  const t0 = c.currentTime + 0.02;
  [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = f;
    const t = t0 + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.1);
  });
}
/** firework()'s thump: low noise, softer while a song plays */
function thump(c: AudioContext, out: AudioNode) {
  const t0 = c.currentTime + 0.01;
  const n = noise(c, 0.7, (x) => Math.pow(1 - x, 3));
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 380;
  const g = c.createGain();
  g.gain.value = thumpLevel(playingWorks().includes('long'));
  n.connect(f);
  f.connect(g);
  g.connect(out);
  n.start(t0);
}
const SFX: Record<Sfx, (c: AudioContext, out: AudioNode) => void> = { chime, pop, splash, whoosh, chip, thump };

/** play one effect now (nothing before the first tap, when muted, or without Web Audio) */
export function playSfx(s: Sfx): void {
  const c = ready();
  if (!c || !sfxBus || sfxBus.gain.value <= 0) return;
  try {
    SFX[s](c, sfxBus);
  } catch {
    // a node the browser does not have: no sound
  }
}

// --- the music on ▶ ------------------------------------------------------------------------------------------------

interface Music {
  kind: MusicKind;
  out: GainNode;
  timer: ReturnType<typeof setInterval>;
  t0: number;
  bpm: number;
}
let music: Music | null = null;

function playNote(c: AudioContext, out: AudioNode, n: Note, t0: number, spb: number) {
  if (n.kind === 'kick') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
    g.gain.setValueAtTime(1, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + 0.32);
  } else if (n.kind === 'hat' || n.kind === 'shaker') {
    const hat = n.kind === 'hat';
    const src = noise(c, hat ? 0.05 : 0.04, (x) => (hat ? 1 : 1 - x));
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hat ? 7000 : 6000;
    const g = c.createGain();
    if (hat) {
      g.gain.setValueAtTime(n.v, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    } else g.gain.value = n.v;
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t0);
  } else if (n.kind === 'bass') {
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = n.f;
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
  } else if (n.kind === 'pad') {
    for (const fr of [220, 277.2, 329.6]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = fr * n.k;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.035, t0 + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t0 + spb * 15.5);
      o.connect(g);
      g.connect(out);
      o.start(t0);
      o.stop(t0 + spb * 16);
    }
  } else if (n.kind === 'taiko') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.18);
    g.gain.setValueAtTime(n.v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + 0.42);
  } else if (n.kind === 'pluck') {
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const fl = c.createBiquadFilter();
    o.type = 'triangle';
    o2.type = 'sine';
    o.frequency.value = n.f;
    o2.frequency.value = n.f * 2;
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(3200, t0);
    fl.frequency.exponentialRampToValueAtTime(600, t0 + 0.35);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(n.v, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    o.connect(fl);
    o2.connect(fl);
    fl.connect(g);
    g.connect(out);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 0.62);
    o2.stop(t0 + 0.62);
  }
}

/** start ▶'s music (clubStart / festStart: a style picked at random, scheduled 0.2 s ahead every 50 ms) */
export function startMusic(kind: MusicKind): void {
  stopMusic();
  const c = ready();
  if (!c || !musicBus) return;
  const out = c.createGain();
  out.gain.value = MUSIC_LEVEL * duckOf(playingWorks());
  out.connect(musicBus);
  const style: ClubStyle | null = kind === 'club' ? pickClub(Math.random()) : null;
  const bpm = style ? style.bpm : pickFestBpm(Math.random());
  const grid = gridOf(kind, bpm);
  const t0 = c.currentTime + 0.05;
  let step = 0;
  let next = t0;
  const tick = () => {
    prune();
    while (next < c.currentTime + 0.2) {
      const notes = style ? clubNotes(step, style) : festNotes(step);
      for (const n of notes) {
        try {
          playNote(c, out, n, next, grid.spb);
        } catch {
          // a node the browser does not have
        }
      }
      next += grid.step;
      step++;
    }
  };
  tick();
  music = { kind, out, timer: setInterval(tick, 50), t0, bpm };
}

/** stop the music (a short fade, as clubStop / festStop) */
export function stopMusic(): void {
  if (!music) return;
  const m = music;
  music = null;
  clearInterval(m.timer);
  try {
    m.out.gain.cancelScheduledValues(m.out.context.currentTime);
    m.out.gain.setTargetAtTime(0, m.out.context.currentTime, 0.2);
  } catch {
    // closed
  }
  setTimeout(() => {
    try {
      m.out.disconnect();
    } catch {
      // gone
    }
  }, 1500);
}

/** the club's beat now (null: no club music) — Saturn's kororins hop on it */
export function clubBeat(): number | null {
  if (!music || music.kind !== 'club') return null;
  return beatAt(music.out.context.currentTime - music.t0, music.bpm);
}

// --- ducking under the works' own sound ----------------------------------------------------------------------------

const works = new Map<HTMLMediaElement, WorkSound>();
const kindOf = (el: HTMLMediaElement): WorkSound => workSoundOf({ video: typeof HTMLVideoElement !== 'undefined' && el instanceof HTMLVideoElement, loop: el.loop, duration: el.duration });
const audible = (el: HTMLMediaElement) => !el.muted && el.volume > 0 && !el.paused && !el.ended;
function playingWorks(): WorkSound[] {
  return [...works.values()];
}
/** forget the works that have stopped without telling (removed from the page while playing) */
function prune() {
  let changed = false;
  for (const el of works.keys())
    if (!audible(el)) {
      works.delete(el);
      changed = true;
    }
  if (changed) duck();
}
function duck() {
  if (!music) return;
  const g = music.out.gain;
  const now = music.out.context.currentTime;
  const target = MUSIC_LEVEL * duckOf(playingWorks());
  try {
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    // down quickly (0.04 s) under a voice, back up gently (0.25 s) — playVoice's ramps
    g.setTargetAtTime(target, now, target < g.value ? 0.04 : 0.25);
  } catch {
    g.value = target;
  }
}
function mediaEvent(e: Event) {
  const el = e.target;
  if (typeof HTMLMediaElement === 'undefined' || !(el instanceof HTMLMediaElement)) return;
  watch(el);
  if (e.type === 'playing' && audible(el)) works.set(el, kindOf(el));
  else if (e.type === 'durationchange' || e.type === 'volumechange') {
    if (audible(el)) works.set(el, kindOf(el));
    else works.delete(el);
  } else if (e.type !== 'playing') works.delete(el);
  duck();
}
const MEDIA_EVENTS = ['playing', 'pause', 'ended', 'emptied', 'error', 'durationchange', 'volumechange'] as const;
const watched = new WeakSet<HTMLMediaElement>();
function watch(el: HTMLMediaElement) {
  if (watched.has(el)) return;
  watched.add(el);
  for (const t of MEDIA_EVENTS) el.addEventListener(t, mediaEvent);
}
/** a work's sound made with `new Audio()` (not on the page): the music ducks under it too */
export function trackMedia<T extends HTMLMediaElement | null>(el: T): T {
  if (el) watch(el);
  return el;
}

// --- scopes: what a screen starts, it stops ------------------------------------------------------------------------

/** a screen's sounds: its pending cues and its music end with it (unmount / ■) */
export interface SoundScope {
  /** the sounds of `event` on `planet` (./sound.ts cuesFor), the later ones on timers this scope clears */
  cue(planet: HomePlanet, event: SoundEvent): void;
  /** one effect, `ms` from now */
  sfx(s: Sfx, ms?: number): void;
  music(kind: MusicKind | null): void;
  stop(): void;
}
export function soundScope(): SoundScope {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let own = false;
  const later = (s: Sfx, ms = 0) => {
    if (ms <= 0) return playSfx(s);
    const id = setTimeout(() => {
      timers.delete(id);
      playSfx(s);
    }, ms);
    timers.add(id);
  };
  return {
    cue(planet, event) {
      for (const q of cuesFor(planet, event)) later(q.sfx, q.at);
    },
    sfx: later,
    music(kind) {
      if (kind) {
        startMusic(kind);
        own = true;
      } else if (own) {
        stopMusic();
        own = false;
      }
    },
    stop() {
      timers.forEach(clearTimeout);
      timers.clear();
      if (own) stopMusic();
      own = false;
    },
  };
}

let armed = 0;
/**
 * The planet home's sound for as long as it is open: the first-tap check, the page's <audio> / <video> for the
 * ducking. Returns the clean-up (everything stops).
 */
export function armPlanetSound(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (!armed++) {
    for (const e of GESTURES) window.addEventListener(e, onGesture, { capture: true, passive: true });
    for (const t of MEDIA_EVENTS) document.addEventListener(t, mediaEvent, true);
  }
  return () => {
    if (--armed) return;
    for (const e of GESTURES) window.removeEventListener(e, onGesture, true);
    for (const t of MEDIA_EVENTS) document.removeEventListener(t, mediaEvent, true);
    stopMusic();
    works.clear();
  };
}

/** for the tests: forget the state */
export function resetSoundForTest(): void {
  stopMusic();
  works.clear();
  master = sfxBus = musicBus = null;
  gestured = false;
  armed = 0;
}
