/**
 * @obolo/ledger — pure, side-effect-free rules for the MANA / EARNINGS two-ledger system.
 *
 * Spec §3.2 (DECIDED, legal architecture):
 *  - Ledger A "MANA": spend-only, NON-REDEEMABLE, non-transferable between users.
 *  - Ledger B "EARNINGS": JPY revenue (royalties, sales, 92% shares, tips).
 *  - MANA → JPY is FORBIDDEN. MANA → another user is FORBIDDEN. Never implement either.
 *    (Keeps MANA a 自家型前払式支払手段 under the Payment Services Act and avoids the
 *    資金移動業 licence.)
 *  - All money values are integers (yen / mana). Never floats.
 *  - Ledger rows are append-only with idempotency keys; the DB layer (apps/api) applies
 *    these rules inside a transaction with SELECT … FOR UPDATE on the wallet row.
 */

export type LedgerKind = 'mana' | 'earnings';

export const MANA_REASONS = [
  'monthly_grant',
  'demo_grant',
  'topup',
  'buddy_overage',
  'generation',
  'purchase',
  'tip_sent',
  'earnings_conversion',
  'conversion_bonus',
  'expiry',
  'admin_adjust',
  'refund',
] as const;
export type ManaReason = (typeof MANA_REASONS)[number];

export const EARNINGS_SOURCES = [
  'labelgrid_royalty',
  'youtube_revenue',
  'uranus_sale',
  'neptune_share',
  'tip_received',
  'mars_series',
  'withdrawal',
  'conversion_to_mana',
  'admin_adjust',
] as const;
export type EarningsSource = (typeof EARNINGS_SOURCES)[number];

/** Value "endpoints" that money can move between. */
export type FlowNode = 'jpy' | 'mana' | 'earnings' | 'bank' | 'other_user_mana';

export class LedgerError extends Error {
  constructor(
    public readonly code: 'FORBIDDEN_FLOW' | 'INSUFFICIENT_BALANCE' | 'NON_INTEGER' | 'INVALID_AMOUNT',
    message: string,
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}

/** Spec §3.2 flow table. Anything not listed here is forbidden. */
const ALLOWED_FLOWS: ReadonlyArray<readonly [FlowNode, FlowNode]> = [
  ['jpy', 'mana'], // top-up / subscription grant
  ['earnings', 'mana'], // optional one-way conversion (+bonus, v1.7)
  ['earnings', 'bank'], // withdrawal to the user's own verified account
];

export function isFlowAllowed(from: FlowNode, to: FlowNode): boolean {
  return ALLOWED_FLOWS.some(([f, t]) => f === from && t === to);
}

export function assertFlowAllowed(from: FlowNode, to: FlowNode): void {
  if (!isFlowAllowed(from, to)) {
    // MANA → JPY / bank / another user must never exist (spec §3.2).
    throw new LedgerError('FORBIDDEN_FLOW', `Flow ${from} → ${to} is forbidden by the two-ledger design`);
  }
}

export function assertInteger(n: number, label = 'amount'): void {
  if (!Number.isSafeInteger(n)) throw new LedgerError('NON_INTEGER', `${label} must be a safe integer, got ${n}`);
}

/** Returns the new balance or throws if it would go negative. */
export function applyDelta(balance: number, delta: number): number {
  assertInteger(balance, 'balance');
  assertInteger(delta, 'delta');
  const next = balance + delta;
  if (next < 0) throw new LedgerError('INSUFFICIENT_BALANCE', `Balance ${balance} cannot absorb ${delta}`);
  return next;
}

/** Basis points: 800 = 8%. */
export const PLATFORM_FEE_BPS = 800;

/**
 * 92/8 split used everywhere (obolo records, Neptune, tips, Mars series — spec §3.4 rule 3).
 * The platform share is floored; the remainder goes to the creator, so rounding always
 * favours the creator. (Rounding direction is PLACEHOLDER P-LEDGER-1 pending accountant review.)
 */
export function splitRevenue(amountJpy: number, feeBps = PLATFORM_FEE_BPS): { creator: number; platform: number } {
  assertInteger(amountJpy);
  if (amountJpy < 0) throw new LedgerError('INVALID_AMOUNT', 'amount must be >= 0');
  const platform = Math.floor((amountJpy * feeBps) / 10_000);
  return { creator: amountJpy - platform, platform };
}

/** Spec v1.7: EARNINGS → MANA conversion grants +10% bonus MANA (admin-tunable). */
export const CONVERSION_BONUS_BPS = 1000;

export interface PlannedEntry {
  ledger: LedgerKind;
  delta: number;
  reason: ManaReason | EarningsSource;
}

/** Entries for converting `jpy` of EARNINGS into MANA (1 MANA = ¥1, plus bonus). */
export function planEarningsConversion(jpy: number, bonusBps = CONVERSION_BONUS_BPS): PlannedEntry[] {
  assertInteger(jpy);
  if (jpy <= 0) throw new LedgerError('INVALID_AMOUNT', 'conversion amount must be > 0');
  assertFlowAllowed('earnings', 'mana');
  const bonus = Math.floor((jpy * bonusBps) / 10_000);
  const entries: PlannedEntry[] = [
    { ledger: 'earnings', delta: -jpy, reason: 'conversion_to_mana' },
    { ledger: 'mana', delta: jpy, reason: 'earnings_conversion' },
  ];
  if (bonus > 0) entries.push({ ledger: 'mana', delta: bonus, reason: 'conversion_bonus' });
  return entries;
}

export interface QuotaDecision {
  allowed: boolean;
  /** MANA to debit for this message (0 when inside the free quota). */
  chargeMana: number;
  reason: 'free' | 'overage' | 'quota_exceeded';
}

/**
 * Spec §2.2: N free Buddy messages/day, then 1 MANA each.
 * `overageEnabled=false` (10/10 demo: no billing) blocks instead of charging.
 * `usedToday` is the count BEFORE this message.
 */
export function buddyQuotaDecision(opts: {
  usedToday: number;
  freeDaily: number;
  overageEnabled: boolean;
  overageCost: number;
  manaBalance: number;
}): QuotaDecision {
  if (opts.usedToday < opts.freeDaily) return { allowed: true, chargeMana: 0, reason: 'free' };
  if (!opts.overageEnabled || opts.manaBalance < opts.overageCost) {
    return { allowed: false, chargeMana: 0, reason: 'quota_exceeded' };
  }
  return { allowed: true, chargeMana: opts.overageCost, reason: 'overage' };
}

/** Spec §3.1.1: MANA expires 1 year after the last activity. */
export function manaExpiryDate(lastActivity: Date): Date {
  const d = new Date(lastActivity.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/**
 * Spec §3.2: filing is required when unused balance exceeds ¥10M at a base date
 * (Mar 31 / Sep 30). Alert at ¥8M.
 */
export const PREPAID_FILING_THRESHOLD_JPY = 10_000_000;
export const PREPAID_ALERT_THRESHOLD_JPY = 8_000_000;
export function prepaidThresholdStatus(totalUnusedMana: number): 'ok' | 'alert' | 'filing_required' {
  if (totalUnusedMana > PREPAID_FILING_THRESHOLD_JPY) return 'filing_required';
  if (totalUnusedMana >= PREPAID_ALERT_THRESHOLD_JPY) return 'alert';
  return 'ok';
}

/** Deterministic idempotency key: `<scope>:<userId>:<ref>` */
export function idempotencyKey(scope: string, userId: string, ref: string): string {
  return `${scope}:${userId}:${ref}`;
}
