import { describe, expect, it } from 'vitest';
import {
  accrueUsage,
  claudeCostUsd,
  costCoveredBy,
  DEFAULT_PRICE_RULE,
  effectiveFeeRate,
  fishCostUsd,
  fxFor,
  fxMonth,
  geminiCostUsd,
  MAKE_COST,
  MAKE_KINDS,
  manaFor,
  manaPrices,
  marginRow,
  percentile,
  quoteMana,
  manaFor10,
  isTenthMana,
  splitMana,
  formatMana,
  makeCostEstimates,
  DEFAULT_MAKE_SETUP,
  MAKE_COST_ESTIMATE,
  RUNWARE_REF_PRICES,
  pictureUsd,
  profileLookParts,
  estimateJpy,
  DEFAULT_COST_RATES,
} from './manaPrice';

describe('manaFor: ceil(cost / (1 − Stripe fee) × 1.08)', () => {
  it('the worked example of docs/マナの値段.md', () => {
    // ¥10 of cost: 10 / 0.964 = 10.373… (the fee share 0.373…), × 1.08 = 11.203… → 12 mana
    expect(manaFor(10)).toBe(12);
    // ¥100 → 100 / 0.964 × 1.08 = 112.03… → 113
    expect(manaFor(100)).toBe(113);
  });
  it('rounds up, never down; no cost is no mana', () => {
    expect(manaFor(0)).toBe(0);
    expect(manaFor(-3)).toBe(0);
    expect(manaFor(0.0001)).toBe(1);
    // exactly a whole mana stays that mana (float noise does not push it up)
    const one = costCoveredBy(1);
    expect(manaFor(one)).toBe(1);
    expect(manaFor(costCoveredBy(37))).toBe(37);
  });
  it('the fee and the margin are both in it', () => {
    expect(manaFor(100, { ...DEFAULT_PRICE_RULE, feeRate: 0, margin: 0 })).toBe(100);
    expect(manaFor(100, { ...DEFAULT_PRICE_RULE, feeRate: 0 })).toBe(108);
    expect(manaFor(100, { ...DEFAULT_PRICE_RULE, margin: 0 })).toBe(104); // 100 / 0.964 = 103.7…
    // a fixed fee per charge is spread over the typical charge (¥40 on ¥88 would be absurd; ¥4.4 on ¥88 = +5%)
    expect(effectiveFeeRate({ ...DEFAULT_PRICE_RULE, feeFixedJpy: 4.4 })).toBeCloseTo(0.086, 6);
    expect(manaFor(100, { ...DEFAULT_PRICE_RULE, feeFixedJpy: 4.4 })).toBe(119); // 100 / 0.914 × 1.08 = 118.16…
  });
  it('the mana brings in the cost plus 8% after the fee', () => {
    for (const c of [0.5, 3, 12.48, 56, 1234.5]) {
      const m = manaFor(c);
      expect(m * (1 - DEFAULT_PRICE_RULE.feeRate)).toBeGreaterThanOrEqual(c * 1.08 - 1e-9);
      expect((m - 1) * (1 - DEFAULT_PRICE_RULE.feeRate)).toBeLessThan(c * 1.08);
    }
  });
});

describe('FX per month', () => {
  const rates = { '2026-10': 150, '2026-11': 155, '2027-01': 158 };
  it('the month in Japan time', () => {
    expect(fxMonth(new Date('2026-11-30T15:30:00Z'))).toBe('2026-12');
    expect(fxMonth(new Date('2026-11-30T14:00:00Z'))).toBe('2026-11');
  });
  it("the month's own rate", () => {
    expect(fxFor(rates, '2026-11')).toEqual({ usdJpy: 155, month: '2026-11', stale: false });
  });
  it('missing: the last known rate before it (stale, to log)', () => {
    expect(fxFor(rates, '2026-12')).toEqual({ usdJpy: 155, month: '2026-11', stale: true });
    expect(fxFor(rates, '2027-05')).toEqual({ usdJpy: 158, month: '2027-01', stale: true });
  });
  it('nothing before: the latest set; nothing at all: the fallback', () => {
    expect(fxFor(rates, '2026-01')).toEqual({ usdJpy: 158, month: '2027-01', stale: true });
    expect(fxFor({}, '2026-12', 162)).toEqual({ usdJpy: 162, month: null, stale: true });
    expect(fxFor({}, '2026-12')).toEqual({ usdJpy: 160, month: null, stale: true });
    expect(fxFor({ '2026-12': 0, bad: 150 }, '2026-12', 161).usdJpy).toBe(161);
  });
});

describe('provider costs', () => {
  it('Gemini: tokens × the model price (thinking billed as output; cached cheaper)', () => {
    // 2.5 Flash: 1,000 in × $0.30/M + (500 out + 1,500 thinking) × $2.50/M = $0.0003 + $0.005
    expect(geminiCostUsd('gemini-2.5-flash', { promptTokenCount: 1000, candidatesTokenCount: 500, thoughtsTokenCount: 1500 })).toBeCloseTo(0.0053, 8);
    // flash-lite is matched before flash (the longest prefix)
    expect(geminiCostUsd('gemini-2.5-flash-lite', { promptTokenCount: 1e6 })).toBeCloseTo(0.1, 8);
    expect(geminiCostUsd('models/gemini-2.5-pro', { promptTokenCount: 1e6, candidatesTokenCount: 1e6 })).toBeCloseTo(11.25, 8);
    expect(geminiCostUsd('gemini-2.5-flash', { promptTokenCount: 1e6, cachedContentTokenCount: 1e6 })).toBeCloseTo(0.075, 8);
    // a search adds its grounding price; an unknown model is never priced at zero
    expect(geminiCostUsd('gemini-2.5-flash', {}, 1)).toBeCloseTo(0.035, 8);
    expect(geminiCostUsd('gemini-9-ultra', { promptTokenCount: 1e6 })).toBeGreaterThan(0);
    expect(geminiCostUsd('gemini-2.5-flash', undefined)).toBe(0);
  });
  it('Claude: tokens, cache and web searches', () => {
    expect(claudeCostUsd('claude-haiku-5-5', { input_tokens: 2000, output_tokens: 400 })).toBeCloseTo(0.0004, 8);
    expect(claudeCostUsd('claude-haiku-5-5', { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 2 } })).toBeCloseTo(0.02, 8);
  });
  it('Fish: UTF-8 bytes × price', () => {
    expect(fishCostUsd('あいう')).toBeCloseTo((9 * 15) / 1e6, 10);
  });
});

describe('the quoted mana', () => {
  it('every making has a price of at least a tenth of a mana, from the cost table, to the tenth', () => {
    for (const k of MAKE_KINDS) {
      expect(MAKE_COST[k]).toBeGreaterThanOrEqual(0.1);
      expect(isTenthMana(MAKE_COST[k])).toBe(true);
    }
    expect(quoteMana(0)).toBe(0.1);
  });
  it('R17: a cheap making shows its real price below 1 mana, rounded UP to the tenth', () => {
    // ¥0.2 of picture: 0.2 / 0.964 × 1.08 = 0.224… → 0.3
    expect(manaFor10(0.2)).toBe(0.3);
    expect(quoteMana(0.2)).toBe(0.3);
    // ¥10: 11.203… → 11.3 (manaFor rounds the same to 12)
    expect(manaFor10(10)).toBe(11.3);
    expect(manaFor10(costCoveredBy(0.7))).toBe(0.7);
    expect(manaFor10(0)).toBe(0);
    for (const c of [0.05, 0.3, 2.4, 13.7, 99.99]) {
      const m = manaFor10(c);
      expect(m * (1 - DEFAULT_PRICE_RULE.feeRate)).toBeGreaterThanOrEqual(c * 1.08 - 1e-9);
      expect((m - 0.1) * (1 - DEFAULT_PRICE_RULE.feeRate)).toBeLessThan(c * 1.08);
    }
    expect(splitMana(0.3)).toEqual({ whole: 0, tenths: 3 });
    expect(splitMana(12.5)).toEqual({ whole: 12, tenths: 5 });
    expect(formatMana(0.3)).toBe('0.3');
    expect(formatMana(3)).toBe('3');
    expect(formatMana(12.5)).toBe('12.5');
  });
  it('R17: the pictures follow the model of each use (cheap anime models make the art cost a tenth of a mana or so)', () => {
    const klein = makeCostEstimates({ ...DEFAULT_MAKE_SETUP, artModel: 'runware:400@4', lookModel: 'runware:400@4', batiModel: 'runware:400@4', kororinModel: 'runware:400@4' });
    const p = manaPrices(undefined, undefined, {}, klein);
    expect(p.jacketArt).toBeLessThanOrEqual(0.5);
    expect(p.look).toBeLessThanOrEqual(1);
    const pro = manaPrices(undefined, undefined, {}, makeCostEstimates({ ...DEFAULT_MAKE_SETUP, lookModel: 'bytedance:seedream@5.0-pro', batiModel: 'bytedance:seedream@5.0-pro', kororinModel: 'bytedance:seedream@5.0-pro' }));
    expect(p.kororinDesign).toBeLessThan(pro.kororinDesign);
    // the paid look round paints 2 (a row to pick from), not 4; R17 defaults: klein for the look, Seedream 5.0 Flash for {bati}
    expect(MAKE_COST_ESTIMATE.look.usd).toBeCloseTo(Math.max(2 * pictureUsd('runware:400@4', true), 2 * pictureUsd('bytedance:seedream@5.0-flash', true)) + 0.0005, 6);
    expect(pictureUsd('gemini-2.5-flash-image')).toBe(0.039);
    expect(pictureUsd('civitai:123@456')).toBeLessThan(0.01);
    expect(pictureUsd('someone:new@1')).toBeGreaterThanOrEqual(0.05);
  });
  it('client 2026-11-25: the profile look covers everything painted for a look ≈ 25.7 mana', () => {
    const e = MAKE_COST_ESTIMATE.profileLook;
    // 13 × FLUX.2 klein 4B with a reference (2 candidates, the standee, the chibi, 3 expressions, 4 blink / mouth parts,
    // the back view, the Saturn chibi) + 8 × Qwen-Image 2.1 Turbo (costs.json: $0.01413) + the words check
    expect(pictureUsd('alibaba:qwen-image@2.1-turbo', true)).toBe(0.01413);
    expect(profileLookParts().reduce((a, p) => a + p.count, 0)).toBe(21);
    expect(e.usd).toBeCloseTo(13 * pictureUsd('runware:400@4', true) + 8 * 0.01413 + 0.0005, 6);
    // 18 pictures (2 candidates, 7 of the look's own set with the round icon, 9 figures) and 4 small patches, kept 12 months
    expect(e.storedBytes).toBe(18 * 1.5 * 1024 ** 2 + 4 * 0.125 * 1024 ** 2);
    const yen = estimateJpy(e, DEFAULT_COST_RATES);
    expect(yen).toBeGreaterThan(22.5);
    expect(yen).toBeLessThan(23.5);
    expect(MAKE_COST.profileLook).toBe(manaFor10(yen));
    expect(MAKE_COST.profileLook).toBe(25.7);
    // {bati}'s dress-up keeps its own price
    expect(MAKE_COST.look).toBeLessThan(MAKE_COST.profileLook);
    // the figures follow their models (SATURN_CHIBI_MODEL / SATURN_BALL_MODEL / PLANET_CHIBI_MODEL)
    const cheap = makeCostEstimates({ ...DEFAULT_MAKE_SETUP, saturnBallModel: 'runware:400@4', planetChibiModel: 'runware:400@4' });
    expect(cheap.profileLook.usd).toBeLessThan(e.usd / 3);
  });
  it('R17: a song on Runware is about 2–3 mana', () => {
    expect(MAKE_COST.song).toBeLessThanOrEqual(3);
  });
  it('the default price list at 160 JPY/USD', () => {
    expect(MAKE_COST).toEqual(manaPrices());
    // pictures by Seedream cost more than a small FLUX picture; a game more than a story
    expect(MAKE_COST.look).toBeGreaterThan(MAKE_COST.jacketArt);
    expect(MAKE_COST.game).toBeGreaterThan(MAKE_COST.story);
    expect(MAKE_COST.songPremium).toBeGreaterThan(MAKE_COST.song);
  });
  it('a refined cost (recorded p90) and the FX move the price', () => {
    expect(manaPrices(undefined, undefined, { song: 10 }).song).toBe(manaFor10(10));
    const cheapYen = manaPrices({ usdJpy: 200, gpuSecondJpy: 0.05, cpuSecondJpy: 0.01 });
    expect(cheapYen.game).toBeGreaterThan(MAKE_COST.game);
  });
});

describe('small costs of the free features', () => {
  it('waits below one mana, then takes the whole mana', () => {
    let pending = 0;
    let taken = 0;
    // a chat reply ≈ ¥0.035: about 25 replies before the first mana
    let n = 0;
    while (taken === 0) {
      const s = accrueUsage(pending, 0.035, 50);
      pending = s.pendingJpy;
      taken += s.take;
      n++;
    }
    expect(taken).toBe(1);
    expect(n).toBe(Math.ceil(costCoveredBy(1) / 0.035 - 1e-9));
    expect(pending).toBeLessThan(costCoveredBy(1));
  });
  it('a big one takes several mana at once, the remainder waits', () => {
    const s = accrueUsage(0.5, 5, 50);
    expect(s.take).toBe(Math.floor((5.5 / 0.964) * 1.08));
    expect(s.pendingJpy).toBeCloseTo(5.5 - costCoveredBy(s.take), 9);
    expect(s.absorbedMana).toBe(0);
  });
  it('never more than the balance (never negative): the rest is absorbed, not carried', () => {
    const s = accrueUsage(0, 5, 2);
    expect(s.take).toBe(2);
    expect(s.absorbedMana).toBe(Math.floor((5 / 0.964) * 1.08) - 2);
    expect(s.absorbedJpy).toBeCloseTo(costCoveredBy(s.absorbedMana), 9);
    const zero = accrueUsage(0.8, 0.2, 0);
    expect(zero.take).toBe(0);
    expect(zero.absorbedMana).toBe(1);
    expect(zero.pendingJpy).toBeLessThan(costCoveredBy(1));
  });
});

describe('the daily margin check', () => {
  it('8% or more is fine; less is flagged with the price the costs call for', () => {
    const ok = marginRow({ kind: 'song', count: 10, chargedMana: 10 * manaFor(12), costJpy: 120, perJobCostsJpy: Array(10).fill(12), currentMana: manaFor(12) });
    expect(ok.low).toBe(false);
    expect(ok.margin!).toBeGreaterThanOrEqual(0.08);
    const low = marginRow({ kind: 'game', count: 2, chargedMana: 2 * 50, costJpy: 2 * 60, perJobCostsJpy: [55, 65], currentMana: 50 });
    expect(low.low).toBe(true);
    expect(low.margin!).toBeLessThan(0);
    expect(low.suggestedMana).toBe(manaFor10(65));
    expect(low.costWithFeeJpy).toBeCloseTo(120 / 0.964, 2);
    expect(marginRow({ kind: 'x', count: 0, chargedMana: 0, costJpy: 0 }).margin).toBeNull();
  });
  it('percentile (nearest rank)', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(percentile([5], 0.9)).toBe(5);
  });
});
