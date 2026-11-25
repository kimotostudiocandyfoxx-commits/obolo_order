import { z } from 'zod';
import { isTenthMana, MAKE_COST, manaTenths, type MakeKind, type ManaPrices } from './manaPrice';
import { JOURNEY_DONE } from './journey';
import { gameMakeKind, type GameTier } from './gameTemplates';

/**
 * R11 (client 2026-11-24): nothing that spends mana is made on one vague line. {bati} first asks what it should be or
 * proposes a plan, shows what it costs (and the mana you have), and only your yes (〔これで作って〕, 「OK」「いいよ」「作って」)
 * starts it. The yes travels with the request as `confirm`: a fresh id for that one yes and the price that was shown.
 * The server charges only with it (from the Moon atelier), only that price, and only once per id (a double tap is the
 * same yes: no second charge, no second job).
 */
export const MakeConfirm = z.object({
  id: z.string().uuid(),
  /** R17: the price shown, to the tenth of a mana (0.3 is a price) */
  price: z.number().min(0).max(100_000).refine(isTenthMana, 'a tenth of a mana at most'),
  /** the spell said yes to (spellKey of its tags): the work is made from exactly those tags */
  spell: z.string().max(64).optional(),
});
export type MakeConfirm = z.infer<typeof MakeConfirm>;

/**
 * What a making in the Moon atelier costs (MAKE_COST), or null when it is free. Free: the kororin (a voice), the radio
 * show, lookups, pictures found. The look and {bati}'s dress-up are free during the first journey (the API's rule).
 */
export function atelierMakeCost(
  kind: string,
  journeyDay: number | null | undefined,
  /** a game recast / tweaked (not its first build) */ recast = false,
  /** the live prices (GET /mana/prices); the price rule's fallback until they arrive */ prices: Readonly<ManaPrices> = MAKE_COST,
  /** R17: a game's tier (the trial from a template, the cheap chain, the full one) — cheap when not given */ gameTier: GameTier = 'cheap',
): { kind: MakeKind; mana: number } | null {
  const done = (journeyDay ?? JOURNEY_DONE) >= JOURNEY_DONE;
  // client 2026-11-25: a game spends mana (its first build, then each tweak); a book's chapters are free ('novel': null)
  const k: MakeKind | null = kind === 'song' ? 'song' : kind === 'art' ? 'jacketArt' : kind === 'video' ? 'mv' : kind === 'game' ? gameMakeKind(recast, gameTier) : (kind === 'look' || kind === 'bati') && done ? 'look' : null;
  return k ? { kind: k, mana: prices[k] ?? MAKE_COST[k] } : null;
}

/** the ledger's idempotency key for one yes (the same yes twice is one charge) */
export function confirmKey(userId: string, kind: MakeKind, confirm: MakeConfirm): string {
  return `make:${kind}:${userId}:ok:${confirm.id}`;
}

export type ChargeError = 'CONFIRM_REQUIRED' | 'PRICE_CHANGED' | 'SPELL_CHANGED' | 'NO_MANA';
export type ChargeDecision = { do: 'charge'; amount: number } | { do: 'repeat' } | { error: ChargeError };

/**
 * The one rule both ledgers follow (the API's LedgerService and the browser demo): no confirm where one is required →
 * nothing is charged; a price other than the one shown → nothing is charged; a yes already charged → a repeat (no new
 * charge); not enough mana → nothing is charged; else exactly the price shown is taken.
 */
export function decideCharge(o: {
  kind: MakeKind;
  confirm?: MakeConfirm | null;
  required: boolean;
  balance: number;
  applied: boolean;
  /** spellKey of the spell the request carries (none: null) */ spell?: string | null;
  /** the kind's price now (the API's live price list); the fallback price when not given */ price?: number;
}): ChargeDecision {
  const amount = o.price ?? MAKE_COST[o.kind];
  if (o.required && !o.confirm) return { error: 'CONFIRM_REQUIRED' };
  if (o.confirm && manaTenths(o.confirm.price) !== manaTenths(amount)) return { error: 'PRICE_CHANGED' };
  // the spell carried must be the one said yes to (and one said yes to must be carried)
  if (o.confirm && (o.confirm.spell ?? null) !== (o.spell ?? null)) return { error: 'SPELL_CHANGED' };
  if (o.confirm && o.applied) return { do: 'repeat' };
  if (o.balance < amount) return { error: 'NO_MANA' };
  return { do: 'charge', amount };
}

/** {bati}'s words for a refused charge (no codes on screen) */
export const CHARGE_ERROR_WORDS: Record<ChargeError, string> = {
  CONFIRM_REQUIRED: 'まだ、OKをもらってないよ。',
  PRICE_CHANGED: 'マナの数が変わったみたい。もう一回、たしかめてね。',
  SPELL_CHANGED: 'スペルが変わったみたい。もう一回、たしかめてね。',
  NO_MANA: 'マナジェムが、光らなくなった',
};
