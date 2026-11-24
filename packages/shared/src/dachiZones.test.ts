import { describe, expect, it } from 'vitest';
import { DACHI_HALL_MAX, dachiZones, rankDachi } from './dachiVoice';

const at = (min: number) => new Date(Date.UTC(2026, 10, 24, 12, 0) - min * 60_000).toISOString();

describe('R9: the Moon temple zones — ranking the ダチ', () => {
  it('orders by the 7-day count, both ways counted by the server', () => {
    const r = rankDachi([
      { id: 'a', recent: 1, lastAt: at(1) },
      { id: 'b', recent: 9, lastAt: at(50) },
      { id: 'c', recent: 4, lastAt: at(5) },
    ]);
    expect(r.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('ties go to the most recent message; no messages at all go last', () => {
    const r = rankDachi([
      { id: 'old', recent: 3, lastAt: at(60) },
      { id: 'new', recent: 3, lastAt: at(2) },
      { id: 'never', recent: 0, lastAt: null },
      { id: 'quiet', recent: 0, lastAt: at(9000) },
    ]);
    expect(r.map((x) => x.id)).toEqual(['new', 'old', 'quiet', 'never']);
  });
  it('KIMORIN takes no place ahead of a ダチ who talked more', () => {
    const r = rankDachi([
      { id: 'kimorin', recent: 2, lastAt: at(1) },
      { id: 'friend', recent: 5, lastAt: at(100) },
    ]);
    expect(r[0].id).toBe('friend');
  });
  it('the hall holds at most 8; the rest go outside, in rank order', () => {
    const list = Array.from({ length: 13 }, (_, k) => ({ id: `d${k}`, recent: 13 - k, lastAt: at(k) }));
    const z = dachiZones(list);
    expect(DACHI_HALL_MAX).toBe(8);
    expect(z.hall.map((x) => x.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']);
    expect(z.outside.map((x) => x.id)).toEqual(['d8', 'd9', 'd10', 'd11', 'd12']);
    // fewer than 8: everyone in the hall, nobody outside
    expect(dachiZones(list.slice(0, 6))).toMatchObject({ hall: { length: 6 }, outside: [] });
  });
});
