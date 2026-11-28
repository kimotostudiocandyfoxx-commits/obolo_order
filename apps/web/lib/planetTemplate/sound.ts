import type { HomePlanet } from '@obolo/shared';
import { isFivePlanet } from './five';

/**
 * The planet homes' sounds (story session 2026-11-25: one sound pass for all the new planet homes; M-R275 / M-R276 /
 * M-R277 / M-R282 / M-R289 / M-R319「効果音は全惑星まとめて」). Everything is made in the browser (Web Audio), as in the
 * prototype design/home/template.html: chime (鈴), popSound (シャボン玉のポッ), splash (ザバッ), whoosh (シュッ), chip
 * (ピコピコ), the fireworks' thump, the club music on Saturn's ▶ and the forest festival on Jupiter's ▶. This file is
 * the pure part (which event plays what, the music's patterns, the ducking rules); lib/planetTemplate/sfx.ts plays them.
 */

export type Sfx =
  | 'chime'
  | 'pop'
  | 'splash'
  | 'whoosh'
  | 'chip'
  | 'thump'
  // M-R337 (handoff planets-08 chapter 4, the prototype's SFX): each scene its own sound, no more one chime for everything
  | 'page' // a page turned (paper)
  | 'tick' // the reading-speed buttons (カチッ)
  | 'bookFly' // the book flies away (wind and sparkles)
  | 'bookOpen' // Pluto: a book opened
  | 'projector' // Mars: a film projector
  | 'tuning' // Venus: a radio tuned in
  | 'bell' // Uranus: the shop's bell
  | 'cup' // a mug set down
  | 'bubble' // Neptune: bubbles
  | 'flutter' // Jupiter: wings
  | 'heart' // ♡: two gentle notes
  // the cast's tap games (the prototype's poyo / kidSfx)
  | 'poyo'
  | 'puff'
  | 'jump'
  | 'spin'
  | 'ink'
  | 'scatter'
  | 'snap';
/** a sound `at` ms after the event */
export interface Cue {
  sfx: Sfx;
  at: number;
}

/**
 * What happens on a planet home that has a sound (the prototype's call sites):
 * - tap: a figure tapped on the home, its work opens (pop / popBf / popSh / popG5)
 * - playDance: ▶ — you jump out of your place (popOut), on Saturn you fall onto the needle (play's landing)
 * - playTurn: ▶ — the view from your place comes (hvOn)
 * - playVisit: ▶ — the next ダチ comes in (playJ / playG5 `one`)
 * - playOpen: ▶ — their work opens (the scroll / the ship at the pier / the viewer)
 * - groovePop: Saturn ▶ — a kororin pops on the groove (popOrb)
 * - profile: a profile opens (openProfS); profileWork: a work opened there (profArt / pastPop / the five's viewer)
 * - sky*: the sky (06) — up to the sky (expOpen), down onto a continent (expLand), travel (tripGo) and back, the shore
 *   on ▶ (autoStart), a stranger reaching the shore (autoNext's bob), a stranger's work opening (expShow + SKYV.show),
 *   ☆ / an island added or swapped (chime), ♡ (skyOshi: the two gentle notes, M-R337)
 */
export type SoundEvent =
  | 'tap'
  | 'playDance'
  | 'playTurn'
  | 'playVisit'
  | 'playOpen'
  | 'groovePop'
  | 'profile'
  | 'profileWork'
  | 'skyOpen'
  | 'skyLand'
  | 'skyTrip'
  | 'skyTripBack'
  | 'skyShore'
  | 'skyArrive'
  | 'skyShow'
  | 'skyKeep'
  | 'skyOshi';

/** the eight planets with the new homes */
export const SOUND_PLANETS: HomePlanet[] = ['saturn', 'jupiter', 'mercury', 'mars', 'venus', 'uranus', 'pluto', 'neptune'];
const hasHome = (p: HomePlanet) => SOUND_PLANETS.includes(p);

/** Jupiter: the scroll opens 0.12 s after the butterfly is tapped (popBf: openArt + popSound at 120 ms) */
export const JUPITER_ART_POP_MS = 120;
/** Saturn ▶: you land on the needle 0.56 s into the fall (play: the squash + popSound) */
export const SATURN_LAND_MS = 560;

const c = (sfx: Sfx, at = 0): Cue => ({ sfx, at });

/** M-R337: the five's own sound when a work opens — Mars the projector, Venus the radio tuning in, Uranus the shop's bell, Pluto a book opening, Neptune bubbles */
export const SCENE_SFX: Readonly<Partial<Record<HomePlanet, Sfx>>> = { mars: 'projector', venus: 'tuning', uranus: 'bell', pluto: 'bookOpen', neptune: 'bubble' };
/** a mug's own sound comes a moment after the shop's bell (the prototype's 420 ms) */
export const CUP_MS = 420;

/** the sounds of `event` on `planet` (none: no sound) */
export function cuesFor(planet: HomePlanet, event: SoundEvent): Cue[] {
  if (!hasHome(planet)) return [];
  const five = isFivePlanet(planet);
  const game = planet === 'neptune';
  switch (event) {
    case 'tap':
      if (planet === 'saturn') return [c('pop')];
      // M-R337: Jupiter the wings (then the scroll's pop), the five each their own scene
      if (planet === 'jupiter') return [c('flutter'), c('pop', JUPITER_ART_POP_MS)];
      if (planet === 'mercury') return [c('splash')];
      return [c(SCENE_SFX[planet] ?? 'chime')];
    case 'playDance':
      return [c('pop', planet === 'saturn' ? SATURN_LAND_MS : 0)];
    case 'playTurn':
      return [c('whoosh')];
    case 'playVisit':
      return planet === 'jupiter' || five ? [c('chime')] : [];
    case 'playOpen':
      if (planet === 'jupiter') return [c('pop')];
      if (planet === 'mercury') return [c('splash')];
      return SCENE_SFX[planet] ? [c(SCENE_SFX[planet]!)] : [];
    case 'groovePop':
      return planet === 'saturn' ? [c('pop')] : [];
    case 'profile':
      return [c('whoosh')];
    case 'profileWork':
      if (planet === 'saturn' || planet === 'jupiter') return [c('pop')];
      return SCENE_SFX[planet] ? [c(SCENE_SFX[planet]!)] : [];
    case 'skyOpen':
    case 'skyLand':
    case 'skyTrip':
    case 'skyTripBack':
    case 'skyShore':
      return [c('whoosh')];
    case 'skyArrive':
      return [c('splash')];
    case 'skyShow':
      // expShow's splash, then the planet's own (SKYV.saturn.show: popSound; jupiter: chime; the game: chip)
      if (planet === 'saturn') return [c('splash'), c('pop')];
      if (planet === 'jupiter') return [c('splash'), c('chime')];
      return game ? [c('splash'), c('chip')] : [c('splash')];
    case 'skyKeep':
      return [c('chime')];
    case 'skyOshi':
      return [c('heart')];
  }
}

// --- the music on ▶ ----------------------------------------------------------------------------------------------

export type MusicKind = 'club' | 'festival';
/** ▶'s music: Saturn's club (M-R275 / M-R289: the lasers and the club music stay), Jupiter's forest festival (M-R276) */
export function musicOf(planet: HomePlanet): MusicKind | null {
  if (planet === 'saturn') return 'club';
  if (planet === 'jupiter') return 'festival';
  return null;
}

/** the club's three styles (clubStart): tempo and the four bass notes (Hz), one picked at random each ▶ */
export const CLUB_STYLES = [
  { bpm: 124, bass: [55, 55, 65.4, 49] },
  { bpm: 128, bass: [61.7, 61.7, 73.4, 55] },
  { bpm: 120, bass: [49, 58.3, 65.4, 43.7] },
] as const;
export type ClubStyle = (typeof CLUB_STYLES)[number];
/** the festival's tempi (festStart) and its pentatonic-ish scale (D major without the 4th and 7th … the prototype's) */
export const FEST_BPMS = [92, 96, 100] as const;
export const FEST_SCALE = [293.7, 329.6, 370, 440, 493.9, 587.3, 659.3, 740] as const;
const FEST_MELODY = [0, 2, 4, 5, 4, 2, 3, 4, 5, 7, 5, 4, 2, 1, 2, 0] as const;

export type Note =
  | { kind: 'kick' }
  | { kind: 'hat'; v: number }
  | { kind: 'bass'; f: number }
  | { kind: 'pad'; k: number }
  | { kind: 'taiko'; v: number }
  | { kind: 'shaker'; v: number }
  | { kind: 'pluck'; f: number; v: number };

/** the club, one sixteenth (spb / 4) at a time: kick on the beat, an open hat between, a bass on the off sixteenths, a pad every 4 bars */
export function clubNotes(step: number, style: ClubStyle): Note[] {
  const q = step % 16;
  const out: Note[] = [];
  if (q % 4 === 0) out.push({ kind: 'kick' });
  out.push({ kind: 'hat', v: q % 4 === 2 ? 0.18 : 0.05 });
  if (q % 2 === 1) out.push({ kind: 'bass', f: style.bass[Math.floor(step / 16) % 4] });
  if (q === 0 && step % 64 === 0) out.push({ kind: 'pad', k: style.bass[0] / 55 });
  return out;
}

/** the festival, one eighth (spb / 2) at a time: taiko on 1 and 3, a shaker between, the koto-like melody on the beats */
export function festNotes(step: number): Note[] {
  const q = step % 8;
  const out: Note[] = [];
  if (q === 0) out.push({ kind: 'taiko', v: 0.9 });
  if (q === 4) out.push({ kind: 'taiko', v: 0.5 });
  if (q % 2 === 1) out.push({ kind: 'shaker', v: 0.12 });
  if (q % 2 === 0) {
    const m = FEST_MELODY[Math.floor(step / 2) % 16] + (Math.floor(step / 32) % 2 ? 1 : 0);
    out.push({ kind: 'pluck', f: FEST_SCALE[Math.min(7, m)], v: 0.16 });
  }
  if (q === 0 && step % 16 === 0) out.push({ kind: 'pluck', f: FEST_SCALE[0] / 2, v: 0.12 });
  return out;
}

/** a music's tempo and grid: seconds per beat and per step (club: sixteenths; festival: eighths) */
export function gridOf(kind: MusicKind, bpm: number): { spb: number; step: number } {
  const spb = 60 / bpm;
  return { spb, step: kind === 'club' ? spb / 4 : spb / 2 };
}
/** a style / tempo picked with `r` in 0…1 (Math.random) */
export const pickClub = (r: number): ClubStyle => CLUB_STYLES[Math.min(CLUB_STYLES.length - 1, Math.floor(r * CLUB_STYLES.length))];
export const pickFestBpm = (r: number): number => FEST_BPMS[Math.min(FEST_BPMS.length - 1, Math.floor(r * FEST_BPMS.length))];

/** the beat the music is on `t` seconds after it started (null before it starts) — Saturn's kororins hop on it */
export function beatAt(t: number, bpm: number): number | null {
  if (!(t >= 0)) return null;
  return Math.floor(t / (60 / bpm));
}

// --- the works are always clearly heard: ducking -----------------------------------------------------------------

/** a work's own sound: a short voice (a kororin's words, a title read out) or a long one (a song, an MV, a radio show) */
export type WorkSound = 'voice' | 'long';
/** the music's level (the prototype's out gain, .5) */
export const MUSIC_LEVEL = 0.5;
/** under a voice the music dips to this share (playVoice: .5 → .16) */
export const DUCK_VOICE = 0.32;
/** under a song / MV / radio the music goes quiet (it comes back when the work stops) */
export const DUCK_LONG = 0;

/** the share of the music's level while these works sound (the quietest wins) */
export function duckOf(playing: Iterable<WorkSound>): number {
  let k = 1;
  for (const w of playing) k = Math.min(k, w === 'long' ? DUCK_LONG : DUCK_VOICE);
  return k;
}
/** the fireworks' thump is softer while a song plays (firework: SONG ? .18 : .4) */
export const thumpLevel = (songPlaying: boolean) => (songPlaying ? 0.18 : 0.4);

/** a media element's kind of sound: a video, a looping one or one longer than 20 s is a long work; else a voice */
export function workSoundOf(m: { video: boolean; loop: boolean; duration: number }): WorkSound {
  return m.video || m.loop || (Number.isFinite(m.duration) && m.duration > 20) ? 'long' : 'voice';
}

// --- the device's sound settings -----------------------------------------------------------------------------------

/** the app's own sound switch on this device (the talk's 声を消す, TalkScene) and the story's mixer (music / sounds) */
export const MUTE_KEY = 'obolo.talk.muted';
export const MIX_KEY = 'obolo.story.mix';
const MIX_DEFAULT = { bgm: 0.8, se: 0.8 };

/** the levels for the effects and the music from the stored settings (muted: both 0; the mixer's defaults: 1) */
export function levelsOf(muted: string | null, mix: string | null): { sfx: number; music: number } {
  if (muted === '1') return { sfx: 0, music: 0 };
  let m = MIX_DEFAULT;
  try {
    if (mix) m = { ...MIX_DEFAULT, ...(JSON.parse(mix) as Partial<typeof MIX_DEFAULT>) };
  } catch {
    // a broken value: the defaults
  }
  const k = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1.25, v / d)) : 1);
  return { sfx: k(m.se, MIX_DEFAULT.se), music: k(m.bgm, MIX_DEFAULT.bgm) };
}
/** the planets' master level: gentle (the prototype played straight to the speakers) */
export const MASTER_LEVEL = 0.6;
