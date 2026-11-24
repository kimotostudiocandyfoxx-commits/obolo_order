import { describe, expect, it } from 'vitest';
import { isActiveMember, membershipEnded } from './membership';

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
