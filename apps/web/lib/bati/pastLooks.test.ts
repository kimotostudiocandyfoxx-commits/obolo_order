import type { Me } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { pastLookRows, showPastLooks } from './pastLooks';

const me = (o: Partial<Me>) => ({ journeyDay: 3, story: { 'd3.f_d04_bluena': '1' }, orderedAt: null, subscriptionStatus: 'none', ...o }) as Me;

describe('the looks worn before on Bluena’s first shelf', () => {
  it('shown from day 3 (Bluena received)', () => {
    expect(showPastLooks(me({}))).toBe(true);
    expect(showPastLooks(me({ journeyDay: 2, story: {} }))).toBe(false);
  });

  it('a resident: {bati}’s row is not offered (the API refuses every tap: BATI_LOOK_LOCKED)', () => {
    expect(pastLookRows(me({})).bati).toBe(false);
    expect(pastLookRows(me({ orderedAt: '2026-11-01T00:00:00.000Z', subscriptionStatus: 'canceled' })).bati).toBe(false);
  });

  it('a resident whose own look is confirmed: their own row is not offered either (LOOK_LOCKED)', () => {
    expect(pastLookRows(me({ lookLocked: true }))).toEqual({ own: false, bati: false });
    expect(pastLookRows(me({ lookLocked: false })).own).toBe(true);
  });

  it('an Obolo Order member: both rows', () => {
    expect(pastLookRows(me({ orderedAt: '2026-11-01T00:00:00.000Z', subscriptionStatus: 'active' }))).toEqual({ own: true, bati: true });
  });
});
