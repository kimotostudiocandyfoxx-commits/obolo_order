import { z } from 'zod';
import { MAKE_COST, type MakeKind } from './config';
import { JOURNEY_DONE } from './journey';

/**
 * R11 (client 2026-11-24): nothing that spends mana is made on one vague line. {bati} first asks what it should be or
 * proposes a plan, shows what it costs (and the mana you have), and only your yes (〔これで作って〕, 「OK」「いいよ」「作って」)
 * starts it. The yes travels with the request as `confirm`: a fresh id for that one yes and the price that was shown.
 * The server charges only with it (from the Moon atelier), only that price, and only once per id (a double tap is the
 * same yes: no second charge, no second job).
 */
export const MakeConfirm = z.object({ id: z.string().uuid(), price: z.number().int().min(0).max(100_000) });
export type MakeConfirm = z.infer<typeof MakeConfirm>;

/**
 * What a making in the Moon atelier costs (MAKE_COST), or null when it is free. Free: the kororin (a voice), the radio
 * show, lookups, pictures found. The look and {bati}'s dress-up are free during the first journey (the API's rule).
 */
export function atelierMakeCost(kind: string, journeyDay: number | null | undefined): { kind: MakeKind; mana: number } | null {
  const done = (journeyDay ?? JOURNEY_DONE) >= JOURNEY_DONE;
  const k: MakeKind | null = kind === 'song' ? 'song' : kind === 'art' ? 'jacketArt' : kind === 'video' ? 'mv' : (kind === 'look' || kind === 'bati') && done ? 'look' : null;
  return k ? { kind: k, mana: MAKE_COST[k] } : null;
}

/** the ledger's idempotency key for one yes (the same yes twice is one charge) */
export function confirmKey(userId: string, kind: MakeKind, confirm: MakeConfirm): string {
  return `make:${kind}:${userId}:ok:${confirm.id}`;
}

export type ChargeError = 'CONFIRM_REQUIRED' | 'PRICE_CHANGED' | 'NO_MANA';
export type ChargeDecision = { do: 'charge'; amount: number } | { do: 'repeat' } | { error: ChargeError };

/**
 * The one rule both ledgers follow (the API's LedgerService and the browser demo): no confirm where one is required →
 * nothing is charged; a price other than the one shown → nothing is charged; a yes already charged → a repeat (no new
 * charge); not enough mana → nothing is charged; else exactly the price shown is taken.
 */
export function decideCharge(o: { kind: MakeKind; confirm?: MakeConfirm | null; required: boolean; balance: number; applied: boolean }): ChargeDecision {
  const amount = MAKE_COST[o.kind];
  if (o.required && !o.confirm) return { error: 'CONFIRM_REQUIRED' };
  if (o.confirm && o.confirm.price !== amount) return { error: 'PRICE_CHANGED' };
  if (o.confirm && o.applied) return { do: 'repeat' };
  if (o.balance < amount) return { error: 'NO_MANA' };
  return { do: 'charge', amount };
}

/** {bati}'s words for a refused charge (no codes on screen) */
export const CHARGE_ERROR_WORDS: Record<ChargeError, string> = {
  CONFIRM_REQUIRED: 'まだ、OKをもらってないよ。',
  PRICE_CHANGED: 'マナの数が変わったみたい。もう一回、たしかめてね。',
  NO_MANA: 'マナジェムが、光らなくなった',
};
