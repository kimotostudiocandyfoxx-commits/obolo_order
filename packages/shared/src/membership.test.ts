import { describe, expect, it } from 'vitest';
import { isActiveMember, lookConfirmed, membershipEnded, profileLookLocked } from './membership';

describe('isActiveMember', () => {
  const at = '2026-11-26T00:00:00Z';
  it('needs orderedAt', () => {
    expect(isActiveMember({ orderedAt: null, subscriptionStatus: 'active' })).toBe(false);
    expect(isActiveMember(null)).toBe(false);
  });
  it('active, past_due (still retrying) and demo stay open', () => {
    for (const s of ['active', 'past_due', 'demo', 'trialing']) expect(isActiveMember({ orderedAt: at, subscriptionStatus: s })).toBe(true);
  });
  it('canceled, unpaid, incomplete_expired and paused close the member features', () => {
    for (const s of ['canceled', 'unpaid', 'incomplete_expired', 'paused']) {
      expect(isActiveMember({ orderedAt: at, subscriptionStatus: s })).toBe(false);
      expect(membershipEnded({ orderedAt: at, subscriptionStatus: s })).toBe(true);
    }
  });
  it('testers stay members once joined', () => {
    expect(isActiveMember({ orderedAt: at, subscriptionStatus: 'canceled', tester: true })).toBe(true);
    expect(isActiveMember({ orderedAt: null, subscriptionStatus: 'active', tester: true })).toBe(false);
  });
});

describe('profileLookLocked (client 2026-11-25)', () => {
  it('open on day 2 until the day is finished, locked for a resident after it', () => {
    expect(profileLookLocked({ journeyDay: 2, hasLook: true, member: false })).toBe(false);
    expect(profileLookLocked({ journeyDay: 2, journeyCompletedAt: '2026-11-25T10:00:00Z', hasLook: true, member: false })).toBe(true);
    expect(profileLookLocked({ journeyDay: 2, confirmed: true, hasLook: true, member: false })).toBe(true);
    for (const d of [3, 5, 8, 10]) expect(profileLookLocked({ journeyDay: d, hasLook: true, member: false })).toBe(true);
  });
  it('members change it (charged); no own look (removed, a preset form) can be made again', () => {
    expect(profileLookLocked({ journeyDay: 5, hasLook: true, member: true })).toBe(false);
    expect(profileLookLocked({ journeyDay: 5, hasLook: false, member: false })).toBe(false);
    expect(lookConfirmed({ journeyDay: 1 })).toBe(false);
  });
});
