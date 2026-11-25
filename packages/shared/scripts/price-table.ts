/**
 * The price table at the default rates (160 JPY/USD, Stripe 3.6%, 8%), for docs/マナの値段.md:
 *   npx --yes tsx@4.19.2 packages/shared/scripts/price-table.ts [AIR id for every picture use]
 * With an AIR id the picture uses are priced on that model instead (the comparison's pick).
 */
import { DEFAULT_MAKE_SETUP, estimateJpy, MAKE_KINDS, makeCostEstimates, manaPrices } from '../src/manaPrice';

const pick = process.argv[2];
const base = makeCostEstimates();
const alt = pick ? makeCostEstimates({ ...DEFAULT_MAKE_SETUP, artModel: pick, lookModel: pick, batiModel: pick, kororinModel: pick }) : null;
const p0 = manaPrices();
const p1 = alt ? manaPrices(undefined, undefined, {}, alt) : null;
for (const k of MAKE_KINDS) {
  const row = [k.padEnd(14), `¥${estimateJpy(base[k]).toFixed(2)}`.padStart(9), String(p0[k]).padStart(6)];
  if (alt && p1) row.push('|', `¥${estimateJpy(alt[k]).toFixed(2)}`.padStart(9), String(p1[k]).padStart(6));
  row.push(' ', base[k].note);
  console.log(row.join(' '));
}
