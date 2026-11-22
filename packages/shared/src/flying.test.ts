import { describe, expect, it } from 'vitest';
import { backHomeAt, flyingSince, hoursLeft, isFlying, PLANET_FLY_HOURS, splitFlying } from './flying';

describe('M-R208: 88 hours flying, then home', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  const h = (n: number) => new Date(now - n * 3600_000).toISOString();
  it('flies for 88 hours, then is home', () => {
    expect(PLANET_FLY_HOURS).toBe(88);
    expect(isFlying(h(1), now)).toBe(true);
    expect(isFlying(h(87.9), now)).toBe(true);
    expect(isFlying(h(88), now)).toBe(false);
    expect(isFlying(null, now)).toBe(false);
    expect(backHomeAt(h(0)).getTime()).toBe(now + 88 * 3600_000);
    expect(flyingSince(now).getTime()).toBe(now - 88 * 3600_000);
    expect(hoursLeft(h(80), now)).toBe(8);
    expect(hoursLeft(h(100), now)).toBe(0);
  });
  it('splits keeping order', () => {
    const r = splitFlying([{ t: h(2) }, { t: h(90) }, { t: h(10) }], (x) => x.t, now);
    expect(r.flying.map((x) => x.t)).toEqual([h(2), h(10)]);
    expect(r.home.map((x) => x.t)).toEqual([h(90)]);
  });
});
