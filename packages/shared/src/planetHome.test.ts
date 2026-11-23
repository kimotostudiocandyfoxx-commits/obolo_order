import { describe, expect, it } from 'vitest';
import { PLANET_FLY_MS } from './flying';
import { dropPlan, homeRelOf, isNewSince, orderOwn, splitHome, type HomeCandidate } from './planetHome';
import { HOME_PLANETS, PLANET_HOMES } from './planetHomeConfig';

const now = Date.parse('2026-11-23T12:00:00Z');
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();
const c = (id: string, authorId: string, h: number, x: Partial<HomeCandidate> = {}): HomeCandidate => ({ id, authorId, flownAt: ago(h), dachi: false, oshi: false, ...x });

describe('星のホーム: the feed rules (M-R258 / M-R257)', () => {
  it('own works stay forever, however old', () => {
    expect(homeRelOf('me', c('a', 'me', 24 * 365), false, now)).toBe('own');
    expect(homeRelOf('me', c('a', 'me', 24 * 365), true, now)).toBe('own');
  });
  it('dachi and 推し works stay 88 hours, then leave', () => {
    expect(homeRelOf('me', c('a', 'd', 87.9, { dachi: true }), false, now)).toBe('dachi');
    expect(homeRelOf('me', c('a', 'd', 88, { dachi: true }), false, now)).toBeNull();
    expect(homeRelOf('me', c('a', 'o', 10, { oshi: true }), false, now)).toBe('oshi');
    expect(homeRelOf('me', { ...c('a', 'o', 0, { oshi: true }), flownAt: now - PLANET_FLY_MS - 1 }, false, now)).toBeNull();
  });
  it('under 15 (or no birth year): own and dachi only — no 推し strangers, no far scenery', () => {
    expect(homeRelOf('me', c('a', 'd', 1, { dachi: true }), true, now)).toBe('dachi');
    expect(homeRelOf('me', c('a', 'o', 1, { oshi: true }), true, now)).toBeNull();
    expect(homeRelOf('me', c('a', 's', 1), true, now)).toBeNull();
    const items = [c('1', 'me', 500), c('2', 'd', 1, { dachi: true }), c('3', 'o', 1, { oshi: true }), c('4', 's', 1)];
    for (const by of [2014, null]) {
      const r = splitHome('me', items, by, new Date(now));
      expect(r.young).toBe(true);
      expect(r.own.map((x) => x.id)).toEqual(['1']);
      expect(r.around.map((x) => x.id)).toEqual(['2']);
      expect(r.far).toEqual([]);
    }
    const adult = splitHome('me', items, 1999, new Date(now));
    expect(adult.around.map((x) => x.id)).toEqual(['2', '3']);
    expect(adult.far.map((x) => x.id)).toEqual(['4']);
  });
  it('a young maker never reaches strangers; hidden works never come back', () => {
    expect(homeRelOf('me', c('a', 's', 1, { authorYoung: true }), false, now)).toBeNull();
    expect(homeRelOf('me', c('a', 'd', 1, { dachi: true, authorYoung: true }), false, now)).toBe('dachi');
    expect(homeRelOf('me', c('a', 'o', 1, { oshi: true, hidden: true }), false, now)).toBeNull();
  });
  it('your order first; works flown after it come in front, newest first', () => {
    const own = [c('a', 'me', 1), c('b', 'me', 2), c('c', 'me', 3), c('d', 'me', 0.5)];
    expect(orderOwn(own, null).map((x) => x.id)).toEqual(['d', 'a', 'b', 'c']);
    expect(orderOwn(own, ['c', 'a', 'gone', 'b']).map((x) => x.id)).toEqual(['d', 'c', 'a', 'b']);
  });
  it('new since the last visit; at most five fall one by one, the rest as one 「＋」', () => {
    expect(isNewSince(ago(1), null)).toBe(true);
    expect(isNewSince(ago(1), ago(2))).toBe(true);
    expect(isNewSince(ago(3), ago(2))).toBe(false);
    const p = dropPlan([1, 2, 3, 4, 5, 6, 7]);
    expect(p.drops).toEqual([1, 2, 3, 4, 5]);
    expect(p.plus).toEqual([6, 7]);
    expect(dropPlan([1]).plus).toEqual([]);
  });
  it('one config for all eight planets; Saturn has no far scenery and plays in place', () => {
    expect(HOME_PLANETS).toHaveLength(8);
    for (const p of HOME_PLANETS) expect(PLANET_HOMES[p].planet).toBe(p);
    expect(PLANET_HOMES.saturn.far).toBeNull();
    expect(PLANET_HOMES.saturn.placeTap).toBe('play');
    expect(PLANET_HOMES.saturn.flown).toBe('{neo}のレコードと、ダチ・推してくれている人のレコードに降ったよ');
  });
});
