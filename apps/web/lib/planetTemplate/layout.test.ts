import { describe, expect, it } from 'vitest';
import { HOME_PLANETS } from '@obolo/shared';
import { templateConfig } from './config';
import { DRAG_START_PX, dropAt, HOME_MAX, isDrag, JSLOT, planetAtSlide, pressEnd, replace, rowAt, seat, sizeAt, slotOf } from './layout';
import { figureOfAuthor, peopleOf } from './people';
import { templateSample } from './sample';

describe('3-1 the rows: back 2, middle 4, front 2 — smaller toward the back', () => {
  it('the prototype’s JSLOT', () => {
    expect(JSLOT).toHaveLength(HOME_MAX);
    expect(JSLOT.map((s) => s[5])).toEqual([0, 0, 1, 1, 1, 1, 2, 2]);
    const size = (r: number) => JSLOT.filter((s) => s[5] === r).map((s) => s[2]);
    expect(Math.max(...size(0))).toBeLessThan(Math.min(...size(1)));
    expect(Math.max(...size(1))).toBeLessThan(Math.min(...size(2)));
    // the back row is higher up the screen than the front
    expect(Math.max(...JSLOT.filter((s) => s[5] === 0).map((s) => s[1]))).toBeLessThan(Math.min(...JSLOT.filter((s) => s[5] === 2).map((s) => s[1])));
    expect(slotOf(9)).toBe(JSLOT[1]);
  });
  it('every slot sits in the row its height says', () => {
    for (const s of JSLOT) expect(rowAt(s[1])).toBe(s[5]);
  });
});

describe('3-2 a drop: higher = smaller and further, lower = bigger and nearer (the row changes)', () => {
  it('size by height, piecewise between the rows', () => {
    expect(sizeAt(0.3)).toBe(0.5);
    expect(sizeAt(0.44)).toBe(0.5);
    expect(sizeAt(0.53)).toBeCloseTo(0.66, 2);
    expect(sizeAt(0.62)).toBe(0.82);
    expect(sizeAt(0.9)).toBe(1.22);
    expect(sizeAt(0.7)).toBeGreaterThan(sizeAt(0.6));
  });
  it('the figure stays where dropped (kept inside the box), in the row of that height', () => {
    expect(dropAt(0.5, 0.42)).toEqual({ x: 0.5, y: 0.42, size: 0.5, row: 0 });
    expect(dropAt(0.5, 0.7).row).toBe(1);
    expect(dropAt(0.5, 0.8)).toMatchObject({ row: 2 });
    // off the edges and the sky: clamped
    expect(dropAt(-1, 0.1)).toMatchObject({ x: 0.06, y: 0.36, row: 0 });
    expect(dropAt(2, 2)).toMatchObject({ x: 0.94, y: 0.9, size: 1.22, row: 2 });
  });
  it('a planet’s allowed area moves the drop (Mercury: the sea only)', () => {
    const sea = (x: number, y: number) => ({ x, y: Math.max(y, 0.62) });
    expect(dropAt(0.4, 0.45, sea)).toMatchObject({ y: 0.62, row: 1, size: 0.82 });
  });
});

describe('3-2 tap or drag', () => {
  it('9 px decides', () => {
    expect(DRAG_START_PX).toBe(9);
    expect(isDrag(6, 6)).toBe(false); // 8.5 px
    expect(isDrag(9, 0)).toBe(false);
    expect(isDrag(7, 7)).toBe(true); // 9.9 px
  });
  it('released short = tap, moved = drag, a second finger = no drag (the pinch wins)', () => {
    expect(pressEnd(3, 1, true)).toBe('tap');
    expect(pressEnd(20, 1, true)).toBe('drag');
    expect(pressEnd(20, 1, false)).toBeNull();
    expect(pressEnd(20, 2, false)).toBe('cancel');
    expect(pressEnd(0, 2, true)).toBe('cancel');
  });
});

describe('3-1 the queue: the ones opened leave, the next comes into their slot', () => {
  const ten = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  it('eight seated in slot order, two waiting', () => {
    const c = seat(ten);
    expect(c.seats.map((s) => [s.person, s.slot])).toEqual(ten.slice(0, 8).map((p, i) => [p, i]));
    expect(c.queue).toEqual(['i', 'j']);
  });
  it('opened → replaced in the same slot; queue empty → the slot stays empty; unknown → nothing', () => {
    let c = seat(ten);
    c = replace(c, (p) => p === 'c');
    expect(c.seats.find((s) => s.slot === 2)).toMatchObject({ person: 'i', n: 8 });
    expect(c.seats).toHaveLength(8);
    c = replace(c, (p) => p === 'h');
    expect(c.seats.find((s) => s.slot === 7)?.person).toBe('j');
    c = replace(c, (p) => p === 'a');
    expect(c.seats).toHaveLength(7);
    expect(c.seats.some((s) => s.slot === 0)).toBe(false);
    expect(replace(c, (p) => p === 'zz')).toBe(c);
  });
  it('fewer than eight: no queue', () => {
    expect(seat(['a', 'b'])).toMatchObject({ queue: [], next: 2 });
  });
});

describe('3-4 the planet switch: the planet under the strip’s middle when the finger is released', () => {
  const W = 64;
  it('a touch without a slide stays', () => {
    expect(planetAtSlide('mercury', 0, W)).toBe('mercury');
    expect(planetAtSlide('mercury', 5, W)).toBe('mercury');
  });
  it('finger left → the planets after, right → before, 1.6× the finger, ends clamped', () => {
    expect(HOME_PLANETS.indexOf('mercury')).toBe(2);
    expect(planetAtSlide('mercury', -40, W)).toBe('mars'); // 64 px of strip
    expect(planetAtSlide('mercury', -80, W)).toBe('venus');
    expect(planetAtSlide('mercury', 40, W)).toBe('jupiter');
    expect(planetAtSlide('mercury', 2000, W)).toBe('saturn');
    // M-R341: the row is in the visiting order — its last planet is Uranus (day 10)
    expect(planetAtSlide('mercury', -2000, W)).toBe('uranus');
  });
});

describe('the people: one figure each, from figureFor (author.figure / Saturn’s ball)', () => {
  it('grouped by maker, newest first, their works kept', () => {
    const v = templateSample('jupiter', Date.parse('2026-11-25T00:00:00Z'));
    v.around.push({ ...v.around[0], id: 'x2', flownAt: '2026-11-25T00:00:00Z' });
    const ps = peopleOf(v);
    // M-R341 / M-R342 / M-R344: the story's cast only — KIMORIN⭐︎ (ダチ) and the 18 oshi (MIKIE⭐︎DRILL has no works yet)
    expect(ps).toHaveLength(19);
    expect(ps[0]).toMatchObject({ name: 'KIMORIN⭐︎', figure: '/planets/sample/fig-jupiter-kimorin.webp' });
    expect(ps[0].works.map((w) => w.id)).toEqual(['x2', 'cast-kimorin-jupiter']);
  });
  it('Saturn rides the ball; others their figure', () => {
    expect(figureOfAuthor({ id: 'a', name: 'a', figure: 'chibi', ball: 'ball' }, 'saturn')).toBe('ball');
    expect(figureOfAuthor({ id: 'a', name: 'a', figure: 'ship', ball: null }, 'mercury')).toBe('ship');
    expect(figureOfAuthor({ id: 'a', name: 'a' }, 'mercury')).toBeNull();
  });
  it('per planet: the colour, the place back right, Saturn’s 2.3 s intro', () => {
    for (const p of HOME_PLANETS) expect(templateConfig(p).place.x).toBeGreaterThan(0.6);
    expect(Math.abs(templateConfig('saturn').introMs - 2300)).toBeLessThan(50);
    expect(templateConfig('jupiter').accent).toBe('#b6e36b');
  });
});
