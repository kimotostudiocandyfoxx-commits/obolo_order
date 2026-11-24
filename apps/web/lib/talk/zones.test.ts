import { describe, expect, it } from 'vitest';
import { HALL_ROWS, strollSlots } from './zones';

describe('strollSlots', () => {
  it('puts the hall in three depths by rank: 2 in front, 4 in the middle, 2 at the back', () => {
    const s = strollSlots(8, HALL_ROWS);
    expect(s.map((x) => x.r)).toEqual([0, 0, 1, 1, 1, 1, 2, 2]);
    expect(s.map((x) => x.k)).toEqual([0, 1, 0, 1, 2, 3, 0, 1]);
  });
  it('fills the hall front first, then the middle', () => {
    expect(strollSlots(1, HALL_ROWS).map((x) => x.r)).toEqual([0]);
    expect(strollSlots(3, HALL_ROWS).map((x) => x.r)).toEqual([0, 0, 1]);
    expect(strollSlots(6, HALL_ROWS).map((x) => x.r)).toEqual([0, 0, 1, 1, 1, 1]);
    expect(strollSlots(7, HALL_ROWS).map((x) => x.r)).toEqual([0, 0, 1, 1, 1, 1, 2]);
  });
  it('deals the plain into up to three rows', () => {
    expect(strollSlots(4, null).every((x) => x.r === 0)).toBe(true);
    expect(new Set(strollSlots(8, null).map((x) => x.r)).size).toBe(2);
    expect(new Set(strollSlots(12, null).map((x) => x.r)).size).toBe(3);
  });
});
