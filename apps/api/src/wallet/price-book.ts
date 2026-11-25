import { MAKE_COST, type MakeKind, type ManaPrices } from '@obolo/shared';

/**
 * Where the ledger reads a making's price when it charges (the live price list of CostService, registered when the
 * app starts). Without it — unit tests, scripts — the price rule's fallback list (MAKE_COST). A failure to read the live
 * list also falls back: the charge then compares the yes with the fallback, and a different price is refused
 * (PRICE_CHANGED), never charged.
 */
let source: (() => Promise<ManaPrices>) | null = null;

export function setPriceSource(fn: (() => Promise<ManaPrices>) | null): void {
  source = fn;
}

export async function livePrices(): Promise<ManaPrices> {
  if (!source) return { ...MAKE_COST };
  try {
    return await source();
  } catch {
    return { ...MAKE_COST };
  }
}

export async function livePrice(kind: MakeKind): Promise<number> {
  return (await livePrices())[kind] ?? MAKE_COST[kind];
}
