import { describe, expect, it } from 'vitest';
import {
  applyDelta,
  assertFlowAllowed,
  buddyQuotaDecision,
  isFlowAllowed,
  LedgerError,
  manaExpiryDate,
  planEarningsConversion,
  prepaidThresholdStatus,
  splitRevenue,
} from './index';

describe('flow rules (spec §3.2)', () => {
  it('allows JPY→MANA, EARNINGS→MANA, EARNINGS→bank', () => {
    expect(isFlowAllowed('jpy', 'mana')).toBe(true);
    expect(isFlowAllowed('earnings', 'mana')).toBe(true);
    expect(isFlowAllowed('earnings', 'bank')).toBe(true);
  });
  it('forbids MANA→JPY, MANA→bank, MANA→another user, MANA→EARNINGS', () => {
    for (const to of ['jpy', 'bank', 'other_user_mana', 'earnings'] as const) {
      expect(isFlowAllowed('mana', to)).toBe(false);
      expect(() => assertFlowAllowed('mana', to)).toThrow(LedgerError);
    }
  });
});

describe('applyDelta', () => {
  it('adds and subtracts integers', () => {
    expect(applyDelta(88, -10)).toBe(78);
    expect(applyDelta(0, 88)).toBe(88);
  });
  it('never goes negative', () => {
    expect(() => applyDelta(5, -6)).toThrow(/cannot absorb/);
  });
  it('rejects floats', () => {
    expect(() => applyDelta(10, 0.5)).toThrow(LedgerError);
    expect(() => applyDelta(10.1, 1)).toThrow(LedgerError);
  });
});

describe('splitRevenue 92/8', () => {
  it('splits exactly when divisible', () => {
    expect(splitRevenue(10_000)).toEqual({ creator: 9_200, platform: 800 });
  });
  it('rounds in favour of the creator', () => {
    expect(splitRevenue(1)).toEqual({ creator: 1, platform: 0 });
    expect(splitRevenue(99)).toEqual({ creator: 92, platform: 7 });
  });
  it('creator + platform always equals the amount', () => {
    for (const n of [0, 1, 7, 13, 88, 500, 12345, 9_999_999]) {
      const s = splitRevenue(n);
      expect(s.creator + s.platform).toBe(n);
    }
  });
});

describe('EARNINGS → MANA conversion (+10% bonus, v1.7)', () => {
  it('debits earnings and credits mana + bonus', () => {
    expect(planEarningsConversion(1000)).toEqual([
      { ledger: 'earnings', delta: -1000, reason: 'conversion_to_mana' },
      { ledger: 'mana', delta: 1000, reason: 'earnings_conversion' },
      { ledger: 'mana', delta: 100, reason: 'conversion_bonus' },
    ]);
  });
  it('omits a zero bonus', () => {
    expect(planEarningsConversion(5)).toHaveLength(2);
  });
  it('rejects non-positive amounts', () => {
    expect(() => planEarningsConversion(0)).toThrow(LedgerError);
  });
});

describe('buddy quota (spec §2.2)', () => {
  const base = { freeDaily: 30, overageCost: 1, manaBalance: 88 };
  it('is free within the quota', () => {
    expect(buddyQuotaDecision({ ...base, usedToday: 29, overageEnabled: true })).toEqual({
      allowed: true,
      chargeMana: 0,
      reason: 'free',
    });
  });
  it('charges 1 MANA beyond the quota when overage is enabled', () => {
    expect(buddyQuotaDecision({ ...base, usedToday: 30, overageEnabled: true }).chargeMana).toBe(1);
  });
  it('blocks beyond the quota when overage is disabled (demo)', () => {
    expect(buddyQuotaDecision({ ...base, usedToday: 30, overageEnabled: false }).allowed).toBe(false);
  });
  it('blocks when MANA is insufficient', () => {
    expect(buddyQuotaDecision({ ...base, usedToday: 30, overageEnabled: true, manaBalance: 0 }).allowed).toBe(false);
  });
});

describe('expiry + prepaid threshold', () => {
  it('expires one year after last activity', () => {
    expect(manaExpiryDate(new Date('2026-10-10T00:00:00Z')).toISOString()).toBe('2027-10-10T00:00:00.000Z');
  });
  it('flags the ¥8M alert and ¥10M filing thresholds', () => {
    expect(prepaidThresholdStatus(7_999_999)).toBe('ok');
    expect(prepaidThresholdStatus(8_000_000)).toBe('alert');
    expect(prepaidThresholdStatus(10_000_000)).toBe('alert');
    expect(prepaidThresholdStatus(10_000_001)).toBe('filing_required');
  });
});
