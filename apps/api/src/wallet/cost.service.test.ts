import { applyDelta, LedgerError } from '@obolo/ledger';
import { meterGemini, meterRunware } from '@obolo/ai';
import { accrueUsage, costCoveredBy, fxMonth, geminiCostUsd, MAKE_COST, manaFor, manaFor10, type AccrualStep, type MakeKind, type PriceRule } from '@obolo/shared';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config';
import type { Database } from '../db/db';
import type { KvStore } from '../infra/kv';
import { costScope } from './cost-scope';
import { CostService, parseFxRates, type CostRow, type CostStore, type ReportData } from './cost.service';
import type { LedgerService } from './ledger.service';
import { livePrices } from './price-book';

/** the database side in memory: the wallet never below 0 (applyDelta), usage rows like the ledger's */
class MemStore implements CostStore {
  rows: CostRow[] = [];
  fx: Record<string, number> = {};
  est: Partial<Record<MakeKind, number>> = {};
  saved: { kind: MakeKind; costJpy: number; samples: number }[] = [];
  balance = new Map<string, number>();
  pending = new Map<string, number>();
  usage: { userId: string; delta: number; refType: string; key: string }[] = [];
  data: ReportData = { charged: [], costs: [], jobs: [], usageMana: 0, absorbed: { mana: 0, jpy: 0 } };
  async insert(row: CostRow) {
    this.rows.push(row);
  }
  async fxRates() {
    return this.fx;
  }
  async setFx(month: string, usdJpy: number) {
    this.fx[month] = usdJpy;
  }
  async estimates() {
    return this.est;
  }
  async saveEstimate(kind: MakeKind, costJpy: number, samples: number) {
    this.saved.push({ kind, costJpy, samples });
    this.est[kind] = costJpy;
  }
  async jobCosts(kind: MakeKind) {
    const by = new Map<string, number>();
    for (const r of this.rows) if (r.paid && r.kind === kind && r.job) by.set(r.job, (by.get(r.job) ?? 0) + r.costJpy);
    return [...by.values()];
  }
  async accrue(userId: string, feature: string, addJpy: number, rule: PriceRule): Promise<AccrualStep> {
    const bal = this.balance.get(userId) ?? 0;
    const step = accrueUsage(this.pending.get(userId) ?? 0, addJpy, bal, rule);
    if (step.take > 0) {
      this.balance.set(userId, applyDelta(bal, -step.take));
      this.usage.push({ userId, delta: -step.take, refType: feature, key: `usage:${userId}:${this.usage.length + 1}` });
    }
    this.pending.set(userId, step.pendingJpy);
    return step;
  }
  async report() {
    return this.data;
  }
}

const cfg = {
  STRIPE_FEE_RATE: 0.036,
  STRIPE_FEE_FIXED_JPY: 0,
  STRIPE_FEE_BASE_JPY: 88,
  MANA_MARGIN: 0.08,
  FX_USD_JPY: 160,
  GPU_SECOND_JPY: 0.05,
  CPU_SECOND_JPY: 0.01,
  COST_REFINE_MIN_SAMPLES: 3,
  COST_RECORDING: true,
} as AppConfig;
const kv = { get: async () => null, set: async () => undefined, incr: async () => 1 } as unknown as KvStore;

function service(store = new MemStore(), c: Partial<AppConfig> = {}) {
  const s = new CostService({} as Database, {} as LedgerService, { ...cfg, ...c } as AppConfig, kv).useStore(store);
  s.onModuleInit();
  return { s, store };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('actual cost per job', () => {
  it('a Runware result’s cost (USD) is recorded at this month’s FX, filed under the paid making — not taken again', async () => {
    const { s, store } = service();
    store.balance.set('u1', 50);
    await costScope.run({ userId: 'u1', feature: 'videoEdit', kind: 'mv', job: 'make:mv:u1:ok:1', paid: true }, async () => meterRunware('runware:400@4', [{ cost: 0.0012 }, { cost: 0.0012 }]));
    await s.settle();
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ userId: 'u1', kind: 'mv', paid: true, job: 'make:mv:u1:ok:1', provider: 'runware', exact: true, fx: 160 });
    expect(store.rows[0].costJpy).toBeCloseTo(0.0024 * 160, 9);
    expect(store.usage).toHaveLength(0);
    s.onModuleDestroy();
  });
  it('Gemini usage tokens × the model price, our GPU seconds × GPU_SECOND_JPY', async () => {
    const { s, store } = service();
    await costScope.run({ feature: 'other' }, async () => meterGemini('gemini-2.5-pro', { promptTokenCount: 10_000, candidatesTokenCount: 20_000 }));
    await s.settle();
    expect(store.rows[0].costJpy).toBeCloseTo(geminiCostUsd('gemini-2.5-pro', { promptTokenCount: 10_000, candidatesTokenCount: 20_000 }) * 160, 9);
    expect(s.jpyOf({ provider: 'gpu', model: 'music', seconds: 100, exact: false }, { usdJpy: 160, gpuSecondJpy: 0.05, cpuSecondJpy: 0.01 })).toBeCloseTo(5, 9);
    s.onModuleDestroy();
  });
});

describe('small costs of the free features', () => {
  it('chat replies add up; crossing one mana takes exactly one usage row', async () => {
    const { s, store } = service();
    store.balance.set('u1', 10);
    const reply = 0.035; // ≈ a Haiku reply in yen
    const replies = Math.ceil(costCoveredBy(1) / reply);
    for (let i = 0; i < replies - 1; i++) await s.recordNow({ provider: 'claude', model: 'claude-haiku-5-5', usd: reply / 160, exact: true }, { userId: 'u1', feature: 'chat' });
    expect(store.usage).toHaveLength(0);
    expect(store.balance.get('u1')).toBe(10);
    await s.recordNow({ provider: 'claude', model: 'claude-haiku-5-5', usd: reply / 160, exact: true }, { userId: 'u1', feature: 'chat' });
    expect(store.usage).toEqual([{ userId: 'u1', delta: -1, refType: 'chat', key: 'usage:u1:1' }]);
    expect(store.balance.get('u1')).toBe(9);
    s.onModuleDestroy();
  });
  it('at 0 mana the feature still runs: the cost is absorbed and logged, the balance never goes negative', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { s, store } = service();
    store.balance.set('u0', 0);
    const step = await s.accrue('u0', 'voice', 3);
    expect(step.take).toBe(0);
    expect(step.absorbedMana).toBe(manaFor(3) - 1);
    expect(store.balance.get('u0')).toBe(0);
    expect(store.usage).toHaveLength(0);
    expect(warn.mock.calls.some(([m]) => String(m).includes('unrecovered small cost'))).toBe(true);
    // a wallet can never be taken below 0 by the store either
    expect(() => applyDelta(0, -1)).toThrow(LedgerError);
    s.onModuleDestroy();
  });
  it('R18: the ダチ talk is recorded but never taken (even with mana): an unrecovered marketing cost in the report', async () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const { s, store } = service();
    store.balance.set('u2', 50);
    // a moderation call of a ダチ text, many times over: more than a mana's worth
    for (let i = 0; i < 400; i++) await s.recordNow({ provider: 'gemini', model: 'gemini-2.5-flash-lite', usd: 0.0036 / 160, exact: true }, { userId: 'u2', feature: 'dachi' });
    expect(store.rows).toHaveLength(400);
    expect(store.rows[0]).toMatchObject({ userId: 'u2', kind: 'dachi', paid: false });
    expect(store.usage).toHaveLength(0);
    expect(store.balance.get('u2')).toBe(50);
    expect(debug.mock.calls.some(([m]) => String(m).includes('unrecovered marketing cost (dachi)'))).toBe(true);
    store.data = { charged: [], costs: [{ kind: 'dachi', paid: false, costJpy: 1.44 }, { kind: 'chat', paid: false, costJpy: 2 }], jobs: [], usageMana: 2, absorbed: { mana: 0, jpy: 0 } };
    const r = await s.report(1);
    expect(r.marketing).toEqual({ kind: 'dachi', costJpy: 1.44 });
    expect(r.usage.features).toEqual([{ kind: 'chat', costJpy: 2 }]);
    expect(r.lines.some((l) => l.includes('ダチの原価') && l.includes('¥1.44'))).toBe(true);
    s.onModuleDestroy();
  });
  it('a cost with no member (story assets, admin) is recorded, not accrued', async () => {
    const { s, store } = service();
    await s.recordNow({ provider: 'gemini', model: 'gemini-2.5-flash', usd: 0.01, exact: true }, undefined);
    expect(store.rows[0]).toMatchObject({ userId: null, kind: 'other', paid: false });
    expect(store.usage).toHaveLength(0);
    s.onModuleDestroy();
  });
});

describe('FX and the quoted prices', () => {
  it("this month's rate; a missing month uses the last known one and warns", async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const store = new MemStore();
    store.fx = { '2020-01': 150 };
    const { s } = service(store);
    expect((await s.fx()).usdJpy).toBe(150);
    expect((await s.fx()).stale).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    await s.setFx(fxMonth(), 170);
    expect(await s.fx()).toEqual({ usdJpy: 170, month: fxMonth(), stale: false });
    s.onModuleDestroy();
  });
  it('the GitHub variable FX_RATES gives month rates; the table wins for the same month', async () => {
    expect(parseFxRates('2026-12=158; 2027-01=160,bad=1,2027-02=9999')).toEqual({ '2026-12': 158, '2027-01': 160 });
    const store = new MemStore();
    const m = fxMonth();
    const { s } = service(store, { FX_RATES: `${m}=150` } as Partial<AppConfig>);
    expect(await s.fx()).toEqual({ usdJpy: 150, month: m, stale: false });
    await s.setFx(m, 158);
    expect((await s.fx()).usdJpy).toBe(158);
    s.onModuleDestroy();
  });
  it('quote = manaFor(estimated cost); the live list is what the ledger reads', async () => {
    const store = new MemStore();
    store.fx = { [fxMonth()]: 160 };
    const { s } = service(store);
    expect(await s.prices()).toEqual(MAKE_COST);
    expect(await livePrices()).toEqual(MAKE_COST);
    s.onModuleDestroy();
    expect(await livePrices()).toEqual(MAKE_COST);
  });
  it('the daily refinement: enough recorded makings → their p90 is the cost', async () => {
    const store = new MemStore();
    store.fx = { [fxMonth()]: 160 };
    const { s } = service(store);
    for (const [job, jpy] of [['a', 20], ['b', 22], ['c', 30], ['d', 21]] as const) store.rows.push({ userId: 'u', kind: 'song', paid: true, job, provider: 'gpu', model: 'music', costUsd: 0, seconds: 0, costJpy: jpy, fx: 160, exact: false, units: null });
    const r = await s.refine();
    expect(r.song).toBe(30);
    expect(store.saved).toEqual([{ kind: 'song', costJpy: 30, samples: 4 }]);
    expect((await s.prices()).song).toBe(manaFor10(30));
    s.onModuleDestroy();
  });
});

describe('R17: the price follows the configured models', () => {
  it('a cheap anime model for every picture use quotes the pictures below a mana or so; the game tiers by their chains', async () => {
    const store = new MemStore();
    store.fx = { [fxMonth()]: 160 };
    const now = await service(store).s.prices();
    const cheap = await service(store, { ART_MODEL: 'runware:400@4', LOOK_MODEL: 'runware:400@4', BATI_MODEL: 'runware:400@4', KORORIN_MODEL: 'runware:400@4' }).s.prices();
    expect(cheap.jacketArt).toBeLessThan(now.jacketArt);
    expect(cheap.jacketArt).toBeLessThanOrEqual(0.5);
    expect(cheap.look).toBeLessThanOrEqual(1);
    expect(cheap.kororinDesign).toBeLessThanOrEqual(2);
    expect(now.gameTrial).toBeLessThan(now.game);
    expect(now.game).toBeLessThan(now.gamePro);
    // four pictures in a paid round cost twice the two of the default
    const four = await service(store, { PAID_LOOK_CANDIDATES: 4 }).s.prices();
    expect(four.look).toBeGreaterThan(now.look * 1.8);
  });
  it('COST_REFINE_SINCE: costs recorded before a model switch do not refine the price', async () => {
    const { s } = service(new MemStore(), { COST_REFINE_SINCE: new Date(Date.now() - 86400_000).toISOString() });
    expect(s.refineSince().getTime()).toBeGreaterThan(Date.now() - 2 * 86400_000);
    expect(service(new MemStore()).s.refineSince().getTime()).toBeLessThan(Date.now() - 29 * 86400_000);
  });
});

describe('the daily margin report', () => {
  it('flags a kind under 8% with the price its costs call for', async () => {
    const store = new MemStore();
    store.fx = { [fxMonth()]: 160 };
    store.data = {
      charged: [
        { kind: 'song', count: 10, mana: 10 * MAKE_COST.song },
        { kind: 'game', count: 2, mana: 2 * MAKE_COST.game },
      ],
      costs: [
        { kind: 'song', paid: true, costJpy: 10 * 2 },
        { kind: 'game', paid: true, costJpy: 2 * 90 },
        { kind: 'chat', paid: false, costJpy: 3 },
      ],
      jobs: [...Array(10).fill({ kind: 'song', costJpy: 2 }), { kind: 'game', costJpy: 85 }, { kind: 'game', costJpy: 95 }],
      usageMana: 4,
      absorbed: { mana: 1, jpy: 0.89 },
    };
    const { s } = service(store);
    const r = await s.report(1);
    const song = r.makings.find((m) => m.kind === 'song')!;
    const game = r.makings.find((m) => m.kind === 'game')!;
    expect(song.low).toBe(false);
    expect(game.low).toBe(true);
    expect(game.suggestedMana).toBe(manaFor10(95));
    expect(r.low.map((l) => l.kind)).toEqual(['game']);
    expect(r.usage.chargedMana).toBe(4);
    expect(r.usage.features).toEqual([{ kind: 'chat', costJpy: 3 }]);
    expect(r.lines.some((l) => l.includes('game') && l.includes('8%未満'))).toBe(true);
    s.onModuleDestroy();
  });
});
