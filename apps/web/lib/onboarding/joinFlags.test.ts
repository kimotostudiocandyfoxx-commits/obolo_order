import { describe, expect, it } from 'vitest';
import { canJoinEarly, joinFlags } from './joinFlags';

describe('M-R274: becoming Obolo Order early', () => {
  const me = (journeyDay: number, done: boolean, orderedAt: string | null = null) => ({ journeyDay, journeyCompletedAt: done ? '2026-11-24T00:00:00Z' : null, orderedAt });
  it('the settings offer it from the end of day 4 (after Jupiter) to day 7, never to a member', () => {
    expect(canJoinEarly(me(3, true))).toBe(false);
    expect(canJoinEarly(me(4, false))).toBe(false);
    expect(canJoinEarly(me(4, true))).toBe(true);
    expect(canJoinEarly(me(7, true))).toBe(true);
    expect(canJoinEarly(me(8, false))).toBe(false);
    expect(canJoinEarly(me(5, false, '2026-11-20T00:00:00Z'))).toBe(false);
  });
  it('day 8 still knows who paid early (from the settings; an old day-3 choice too)', () => {
    expect(joinFlags({ 'sys.f_join_early_now': 'early' })).toMatchObject({ f_join_early: 'true' });
    expect(joinFlags({ 'd3.f_join_early_now': 'early' })).toMatchObject({ f_join_early: 'true' });
    expect(joinFlags({})).toEqual({});
  });
});
