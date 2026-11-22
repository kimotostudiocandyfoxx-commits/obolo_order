import { flyingSince, isFlying, PLANET_FLY_HOURS, SATURN_LIFETIME_HOURS, JUPITER_FLY_HOURS, splitFlying } from '@obolo/shared';
import { describe, expect, it } from 'vitest';

/** M-R208: every planet's works fly for 88 hours (everyone's place), then go back to their maker's own place. */
describe('88 hours flying, then home', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  const ago = (h: number) => new Date(now - h * 3600_000);
  it('one number for every planet', () => {
    expect(PLANET_FLY_HOURS).toBe(88);
    expect(SATURN_LIFETIME_HOURS).toBe(PLANET_FLY_HOURS);
    expect(JUPITER_FLY_HOURS).toBe(PLANET_FLY_HOURS);
  });
  it('splits rows the way the profile / tree / island queries do', () => {
    const rows = [
      { id: 'a', createdAt: ago(1).toISOString() },
      { id: 'b', createdAt: ago(88.01).toISOString() },
      { id: 'c', createdAt: ago(87.99).toISOString() },
      { id: 'd', createdAt: ago(400).toISOString() },
    ];
    const { flying, home } = splitFlying(rows, (r) => r.createdAt, now);
    expect(flying.map((r) => r.id)).toEqual(['a', 'c']);
    expect(home.map((r) => r.id)).toEqual(['b', 'd']);
    // the SQL cut (`createdAt > flyingSince()`) agrees with isFlying
    for (const r of rows) expect(new Date(r.createdAt) > flyingSince(now)).toBe(isFlying(r.createdAt, now));
  });
  it('a radio show that was never published is not on the air', () => {
    expect(isFlying(null, now)).toBe(false);
  });
});
