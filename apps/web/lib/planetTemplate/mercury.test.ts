import { describe, expect, it } from 'vitest';
import { templateConfig } from './config';
import { seat } from './layout';
import {
  HOME_SEA,
  LAND_SEA,
  laneOf,
  lyricAt,
  MERCURY_MAX,
  MSLOT,
  MSLOT_X,
  rowOnSea,
  sailMotion,
  sailSpeed,
  sailStep,
  sampleSongOf,
  SAMPLE_LYRICS,
  seaOnly,
  titleStyle,
  WRAP_PX,
  letterKind,
  TITLE_MS,
  titleVoiceInTime,
} from './mercury';
import { driftMotion } from './motion';
import { peopleOf } from './people';
import { templateSample } from './sample';

const W = 390;
const H = 844;

describe('02 §1 Mercury’s ships: the sea lanes of MSLOT (back 2, middle 3, front 2 = 7)', () => {
  it('seven lanes, rows 2 / 3 / 2, smaller toward the back, all on the sea (below the horizon)', () => {
    expect(MSLOT).toHaveLength(7);
    expect(MERCURY_MAX).toBe(7);
    expect(MSLOT.map((l) => l[2])).toEqual([0, 0, 1, 1, 1, 2, 2]);
    const size = (r: number) => MSLOT.filter((l) => l[2] === r).map((l) => l[1]);
    expect(Math.max(...size(0))).toBeLessThan(Math.min(...size(1)));
    expect(Math.max(...size(1))).toBeLessThan(Math.min(...size(2)));
    // the backdrop's horizon is at about 55%: every lane is on the water, never in the sky
    for (const [y] of MSLOT) {
      expect(y).toBeGreaterThanOrEqual(HOME_SEA.top);
      expect(y).toBeLessThanOrEqual(HOME_SEA.bottom);
    }
    // a lane's height says its row (the rows a drop gives)
    for (const [y, , row] of MSLOT) expect(rowOnSea(y)).toBe(row);
    expect(laneOf(9)).toBe(MSLOT[2]);
  });

  it('Mercury’s config: the sail layout, seven at once, the rest wait', () => {
    const cfg = templateConfig('mercury');
    expect(cfg.motion.kind).toBe('sail');
    expect(cfg.motion.max).toBe(7);
    expect(templateConfig('jupiter').motion).toBe(driftMotion);
    const people = peopleOf(templateSample('mercury'));
    // KIMORIN⭐︎ and the 18 oshi (MIKIE⭐︎DRILL has no works yet: M-R344)
    expect(people.length).toBe(19);
    const c = seat(people, cfg.motion.max);
    expect(c.seats).toHaveLength(7);
    expect(c.queue).toHaveLength(12);
  });

  it('a ship starts in its lane at the prototype’s place, sails left or right (odd slots left), faster when nearer', () => {
    const m = sailMotion();
    for (let slot = 0; slot < 7; slot++) {
      const b = m.spawn(slot, slot, W, H);
      expect(b.x).toBeCloseTo(MSLOT_X[slot] * W);
      expect(b.y).toBeCloseTo(MSLOT[slot][0] * H);
      expect(b.size).toBe(MSLOT[slot][1]);
      expect(b.row).toBe(MSLOT[slot][2]);
      expect(Math.sign(b.v)).toBe(slot % 2 ? -1 : 1);
      expect(b.flip).toBe(slot % 2 === 1);
    }
    // the prototype's formula: (10 + ((i·7) mod 4)·4) · ±1 · (0.6 + size·0.5)
    expect(sailSpeed(0, 0)).toBeCloseTo(10 * (0.6 + 0.5 * 0.5));
    expect(sailSpeed(1, 1)).toBeCloseTo(-(10 + 3 * 4) * (0.6 + 0.5 * 0.5));
    expect(Math.abs(sailSpeed(0, 6))).toBeGreaterThan(Math.abs(sailSpeed(0, 0)));
  });

  it('sailing: it moves at its speed, bobs on the waves around its lane and tilts a little', () => {
    const m = sailMotion();
    const b = m.spawn(2, 2, W, H);
    const x0 = b.x;
    for (let k = 0; k < 20; k++) m.step(b, 0.05, W, H);
    expect(b.x - x0).toBeCloseTo(b.v * 1, 5);
    expect(Math.abs(b.y - b.lane * H)).toBeLessThanOrEqual(4);
    expect(Math.abs(b.rot)).toBeLessThanOrEqual(4);
    // while a song is open the others sail slower (pace)
    const c = m.spawn(2, 2, W, H);
    m.step(c, 1, W, H, 0.6);
    expect(c.x - x0).toBeCloseTo(c.v * 0.6, 5);
  });

  it('at an edge a ship goes round to the other side and keeps its way (the sea goes round, 02 §1)', () => {
    const right = { x: W + WRAP_PX - 1, y: 0, t: 0, i: 0, v: 20, lane: 0.7, rot: 0, flip: false };
    sailStep(right, 0.1, W, H);
    expect(right.x).toBe(-WRAP_PX);
    expect(right.flip).toBe(false);
    const left = { x: -WRAP_PX + 1, y: 0, t: 0, i: 1, v: -20, lane: 0.7, rot: 0, flip: true };
    sailStep(left, 0.1, W, H);
    expect(left.x).toBe(W + WRAP_PX);
    expect(left.flip).toBe(true);
    // a long run never leaves the screen's band
    const b = sailMotion().spawn(5, 5, W, H);
    for (let k = 0; k < 2000; k++) {
      sailStep(b, 0.05, W, H);
      expect(b.x).toBeGreaterThanOrEqual(-WRAP_PX);
      expect(b.x).toBeLessThanOrEqual(W + WRAP_PX);
    }
  });

  it('dragged: it stays on the sea only — dropped in the sky it goes down to the water; higher = smaller, further back', () => {
    const m = sailMotion();
    const cfg = templateConfig('mercury');
    const b = m.spawn(0, 0, W, H);
    // dropped high in the sky
    b.x = 200;
    b.y = 0.2 * H;
    m.drop(b, W, H, cfg.allowed);
    expect(b.lane).toBe(HOME_SEA.top);
    expect(b.y).toBeCloseTo(HOME_SEA.top * H);
    expect(b.row).toBe(0);
    expect(b.size).toBe(0.5);
    // dropped near the bottom: big, in front
    b.y = 0.86 * H;
    m.drop(b, W, H, cfg.allowed);
    expect(b.lane).toBeCloseTo(0.86);
    expect(b.row).toBe(2);
    expect(b.size).toBeCloseTo(1.08);
    // below the sea's bottom: back up onto it
    b.y = 0.99 * H;
    m.drop(b, W, H, cfg.allowed);
    expect(b.lane).toBe(HOME_SEA.bottom);
    // the middle: between the sizes
    b.y = 0.7 * H;
    m.drop(b, W, H, cfg.allowed);
    expect(b.row).toBe(1);
    expect(b.size).toBeGreaterThan(0.78);
    expect(b.size).toBeLessThan(1.08);
    // far off the side: kept near the screen
    b.x = W + 300;
    m.drop(b, W, H);
    expect(b.x).toBe(W + 40);
    // and it sails on from there, in its new lane
    m.step(b, 0.05, W, H);
    expect(Math.abs(b.y - 0.7 * H)).toBeLessThanOrEqual(4);
    // the hook itself: only the height is kept to the sea
    expect(seaOnly()(0.3, 0.1)).toEqual({ x: 0.3, y: HOME_SEA.top });
  });

  it('a continent’s sea starts higher up (seen from lower down)', () => {
    const m = sailMotion(LAND_SEA);
    const b = m.spawn(0, 0, W, H);
    b.y = 0.1 * H;
    m.drop(b, W, H);
    expect(b.lane).toBe(0.42);
    expect(b.size).toBe(0.5);
  });
});

describe('02 §2 the lyrics follow the song (M-R288)', () => {
  const L = SAMPLE_LYRICS[1];
  it('the line sung now, how much of it is coloured, the next line', () => {
    expect(lyricAt(L, 0.2)).toMatchObject({ i: -1, progress: 0, next: L[0].text });
    const a = lyricAt(L, 0.6);
    expect(a).toMatchObject({ i: 0, progress: 0, next: L[1].text });
    // the colour fills over the first 80% of the line's time
    const mid = lyricAt(L, 0.6 + (4.4 - 0.6) * 0.4);
    expect(mid.i).toBe(0);
    expect(mid.progress).toBeCloseTo(50);
    expect(lyricAt(L, 4.3).progress).toBe(100);
    expect(lyricAt(L, 9).i).toBe(2);
    // the last line runs to the end of the song, then round to the first (the song loops at home)
    expect(lyricAt(L, 13, 60)).toMatchObject({ i: 3, next: L[0].text });
  });
  it('no lyrics: nothing', () => {
    expect(lyricAt([], 3)).toEqual({ i: -1, progress: 0, next: '' });
  });
});

describe('02 §2 the title: its own font and entrance (M-R283 / M-R284)', () => {
  it('the prototype’s songs keep their pairs; others by genre; always one of them', () => {
    expect(titleStyle('パーティー')).toMatchObject({ font: 'Rampart One', motion: 'glitch' });
    expect(titleStyle('夜のバラード').motion).toBe('float');
    expect(titleStyle('どこかの曲', { main: 'ロック', moods: [], bpm: 170 })).toMatchObject({ motion: 'slam' });
    expect(titleStyle('どこかの曲')).toEqual(titleStyle('どこかの曲'));
  });
  it('letters by kind (kanji bigger, hiragana smaller)', () => {
    expect([...'夏のパA'].map(letterKind)).toEqual(['kj', 'hr', 'kt', 'lt']);
  });
});

describe('the preview’s own records play the prototype’s songs; the cast sail with their own', () => {
  it('each of your sample records carries one of the five songs and its jacket; a cast ship its own song (M-R344)', () => {
    const v = templateSample('mercury');
    for (const w of v.own) {
      expect(sampleSongOf(w.url)).toBeGreaterThan(0);
      expect(w.thumbUrl).toMatch(/art-\d\.webp$/);
      expect(w.title).toBeTruthy();
    }
    expect(v.own).toHaveLength(8);
    for (const w of v.around) {
      expect(sampleSongOf(w.url)).toBeNull();
      expect(w.url).toMatch(/^\/planets\/cast\/[a-z]+\/song\.mp3$/);
      expect(w.title).toBeTruthy();
    }
  });
});

describe('02 §2 the title read in its maker\'s voice', () => {
  it('plays with the title (2.2 s) even when the song came a little after it, never long after', () => {
    expect(TITLE_MS).toBe(2200);
    expect(titleVoiceInTime(2200)).toBe(true);
    expect(titleVoiceInTime(3600)).toBe(true);
    expect(titleVoiceInTime(3800)).toBe(false);
    // a stage that shows the title at once (titleMs 0)
    expect(titleVoiceInTime(1000, 0)).toBe(true);
    expect(titleVoiceInTime(1600, 0)).toBe(false);
  });
});

import { DUCK, rampAt } from './mercury';
describe('the song dips while the title is read (story chat 2026-11-25)', () => {
  it('down to 60% over 0.2 s, back over 0.4 s', () => {
    expect(DUCK).toEqual({ level: 0.6, downMs: 200, upMs: 400 });
    expect(rampAt(1, DUCK.level, DUCK.downMs, 0)).toBe(1);
    expect(rampAt(1, DUCK.level, DUCK.downMs, 100)).toBeCloseTo(0.8, 6);
    expect(rampAt(1, DUCK.level, DUCK.downMs, 200)).toBe(0.6);
    expect(rampAt(0.6, 1, DUCK.upMs, 200)).toBeCloseTo(0.8, 6);
    expect(rampAt(0.6, 1, DUCK.upMs, 999)).toBe(1);
  });
});
