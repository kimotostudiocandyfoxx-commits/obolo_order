import { MAKE_COST, type ManaPrices } from '@obolo/shared';
import { getApi } from '@/lib/api';

/**
 * Client 2026-11-25 (docs/マナの値段.md): the mana each making costs comes from the server's price rule (cost + Stripe's
 * fee + 8%, at this month's FX) — GET /mana/prices. The confirm card shows exactly these and the yes carries them; the
 * server charges only that price. Until the list arrives (or offline / the demo) the rule's fallback list (MAKE_COST).
 */
let current: ManaPrices = { ...MAKE_COST };
let loadedAt = 0;
let loading: Promise<ManaPrices> | null = null;

/** the prices known now (never waits) */
export function manaPricesNow(): ManaPrices {
  return current;
}

/** fetch the live prices (at most once a minute unless `force`); the known ones when it fails */
export function loadManaPrices(force = false): Promise<ManaPrices> {
  if (!force && Date.now() - loadedAt < 60_000) return Promise.resolve(current);
  loading ??= getApi()
    .manaPrices()
    .then((p) => {
      current = { ...MAKE_COST, ...p };
      loadedAt = Date.now();
      return current;
    })
    .catch(() => current)
    .finally(() => {
      loading = null;
    });
  return loading;
}
