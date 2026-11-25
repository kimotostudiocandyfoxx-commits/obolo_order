import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { setCostSink, type CostEvent } from '@obolo/ai';
import {
  accrueUsage,
  effectiveFeeRate,
  fxFor,
  fxMonth,
  isMakeKind,
  MAKE_KINDS,
  manaPrices,
  makeCostEstimates as costTableOf,
  marginRow,
  percentile,
  SONG_VOICE_GPU_MODELS,
  type AccrualStep,
  type SongVoiceSeconds,
  type CostRates,
  type MakeKind,
  type ManaPrices,
  type MarginRow,
  type PriceRule,
} from '@obolo/shared';
import { and, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { AppConfig, CONFIG, makeSetupOf } from '../config';
import { Database } from '../db/db';
import { fxRates, genCosts, makeCostEstimates, manaLedger, usageAccruals, wallets } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { costScope, type CostCtx } from './cost-scope';
import { LedgerService } from './ledger.service';
import { setPriceSource } from './price-book';

const DAY = 86400_000;
/** R18: the feature whose costs are never charged (the ダチ talk): an unrecovered marketing cost */
export const MARKETING_FEATURE = 'dachi';

/** one recorded cost (gen_costs) */
export interface CostRow {
  userId: string | null;
  kind: string;
  paid: boolean;
  job: string | null;
  provider: string;
  model: string;
  costUsd: number;
  seconds: number;
  costJpy: number;
  fx: number;
  exact: boolean;
  units: Record<string, number> | null;
}

/** what the margin report reads from the database for a window */
export interface ReportData {
  /** charges minus refunds per making (mana) and the number of charges */
  charged: { kind: string; count: number; mana: number }[];
  /** recorded cost per kind (yen), paid makings and free features apart */
  costs: { kind: string; paid: boolean; costJpy: number }[];
  /** recorded cost per paid making (yen), for the p90 */
  jobs: { kind: string; costJpy: number }[];
  /** mana taken as small costs (usage rows) */
  usageMana: number;
  /** all-time: small costs the operator absorbed (members at 0 mana) */
  absorbed: { mana: number; jpy: number };
}

/** The database side of CostService (a fake in tests). */
export interface CostStore {
  insert(row: CostRow): Promise<void>;
  fxRates(): Promise<Record<string, number>>;
  setFx(month: string, usdJpy: number, note: string | null): Promise<void>;
  /** the refined estimates saved since `since` (older ones are a model switched since: not used) */
  estimates(since?: Date): Promise<Partial<Record<MakeKind, number>>>;
  saveEstimate(kind: MakeKind, costJpy: number, samples: number): Promise<void>;
  /** the per-making costs of the last `days` days (yen, one number per making) */
  jobCosts(kind: MakeKind, since: Date): Promise<number[]>;
  /** R18: the recorded GPU seconds of one part of our GPU's work (gen_costs.model), one number per job */
  gpuSeconds?(model: string, since: Date): Promise<number[]>;
  /** add a small cost to the member's waiting yen and take whole mana (one transaction with the wallet locked) */
  accrue(userId: string, feature: string, addJpy: number, rule: PriceRule): Promise<AccrualStep>;
  report(since: Date): Promise<ReportData>;
}

export interface MarginReport {
  at: string;
  days: number;
  fx: { usdJpy: number; month: string | null; stale: boolean };
  rule: PriceRule & { effectiveFeeRate: number };
  prices: ManaPrices;
  makings: MarginRow[];
  usage: MarginRow & { features: { kind: string; costJpy: number }[]; absorbedAllTime: { mana: number; jpy: number } };
  /** R18: the ダチ talk's recorded cost in the window (never charged: an unrecovered marketing cost) */
  marketing: { kind: string; costJpy: number };
  /** the kinds whose margin was below the rule (with the price their recorded costs call for) */
  low: { kind: string; margin: number | null; currentMana: number | null; suggestedMana: number | null }[];
  /** report lines for the admin report / the log */
  lines: string[];
}

/**
 * Client 2026-11-25 (docs/マナの値段.md): the price of every mana.
 *  - records the real cost of every provider call (the sink of @obolo/ai's meter, scoped by cost-scope.ts),
 *  - takes the small costs of the free features a whole mana at a time (never below 0; absorbed and logged at 0),
 *  - quotes the makings: manaFor(estimated cost) at this month's FX — the seed table, refined daily from the recorded
 *    p90 of each making,
 *  - checks every day that the mana taken covers cost + Stripe's fee + 8% per kind, and logs the kinds that do not
 *    with the price they call for (GET /admin/mana/margins).
 */
@Injectable()
export class CostService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('ManaCost');
  protected store: CostStore;
  private fxCache: { at: number; pick: ReturnType<typeof fxFor> } | null = null;
  private priceCache: { at: number; prices: ManaPrices } | null = null;
  private voiceCache: { at: number; p90: Partial<SongVoiceSeconds> } | null = null;
  private warnedMonth: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private first: ReturnType<typeof setTimeout> | null = null;
  /** recordings in flight (tests wait for them) */
  private readonly pending = new Set<Promise<void>>();

  constructor(
    db: Database,
    ledger: LedgerService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {
    this.store = new PgCostStore(db, ledger);
  }

  /** tests: another store */
  useStore(store: CostStore): this {
    this.store = store;
    this.fxCache = null;
    this.priceCache = null;
    return this;
  }

  onModuleInit() {
    setPriceSource(() => this.prices());
    if (this.cfg.COST_RECORDING) setCostSink((e) => this.record(e, costScope.get()));
    if (process.env.NODE_ENV === 'test') return;
    this.first = setTimeout(() => void this.daily(), 120_000);
    this.timer = setInterval(() => void this.daily(), DAY / 4);
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
    setCostSink(null);
    setPriceSource(null);
  }

  rule(): PriceRule {
    return { feeRate: this.cfg.STRIPE_FEE_RATE, feeFixedJpy: this.cfg.STRIPE_FEE_FIXED_JPY, feeBaseJpy: this.cfg.STRIPE_FEE_BASE_JPY, margin: this.cfg.MANA_MARGIN };
  }

  /** this month's USD→JPY (fx_rates; the last known month, or FX_USD_JPY, with a warning when the month has none) */
  async fx(now = new Date()): Promise<ReturnType<typeof fxFor>> {
    if (this.fxCache && Date.now() - this.fxCache.at < 10 * 60_000) return this.fxCache.pick;
    const month = fxMonth(now);
    const rates = {
      ...parseFxRates(this.cfg.FX_RATES ?? ''),
      ...(await this.store.fxRates().catch((e) => {
        this.log.warn(`fx rates unreadable: ${String(e)}`);
        return {};
      })),
    };
    const pick = fxFor(rates, month, this.cfg.FX_USD_JPY);
    if (pick.stale && this.warnedMonth !== month) {
      this.warnedMonth = month;
      this.log.warn(`no USD→JPY rate for ${month}: using ${pick.usdJpy} (${pick.month ?? 'FX_USD_JPY'}) — set it with PUT /admin/mana/fx`);
    }
    this.fxCache = { at: Date.now(), pick };
    return pick;
  }

  async rates(): Promise<CostRates> {
    return { usdJpy: (await this.fx()).usdJpy, gpuSecondJpy: this.cfg.GPU_SECOND_JPY, cpuSecondJpy: this.cfg.CPU_SECOND_JPY, storageGbMonthUsd: this.cfg.STORAGE_GB_MONTH_USD, storageMonths: this.cfg.STORAGE_PRICE_MONTHS };
  }

  /** the live mana of every making (what the confirm card shows and what is charged) */
  async prices(): Promise<ManaPrices> {
    if (this.priceCache && Date.now() - this.priceCache.at < 60_000) return this.priceCache.prices;
    const est = await this.store.estimates(this.refineSince()).catch(() => ({}));
    const prices = manaPrices(await this.rates(), this.rule(), est, this.table());
    this.priceCache = { at: Date.now(), prices };
    return prices;
  }

  /** R17: the seed table of this setup (the picture models and counts, the game chains from the config) */
  table() {
    return (this.seed ??= costTableOf(makeSetupOf(this.cfg)));
  }
  private seed: ReturnType<typeof costTableOf> | null = null;

  /** R17: recorded costs from before COST_REFINE_SINCE (a model switched) do not refine the prices */
  refineSince(now = new Date()): Date {
    const month = new Date(now.getTime() - 30 * DAY);
    const set = this.cfg.COST_REFINE_SINCE ? new Date(this.cfg.COST_REFINE_SINCE) : null;
    return set && Number.isFinite(set.getTime()) && set > month ? set : month;
  }

  /**
   * R18 (君の声にする魔法): the p90 of our GPU's recorded seconds per part (waking up, the split, the conversion) over 30
   * days, for the parts with enough recordings (COST_REFINE_MIN_SAMPLES) — the voice spell's quote uses them instead of
   * the seeds (songVoiceQuote).
   */
  async voiceSeconds(now = new Date()): Promise<Partial<SongVoiceSeconds>> {
    if (this.voiceCache && Date.now() - this.voiceCache.at < 10 * 60_000) return this.voiceCache.p90;
    const since = this.refineSince(now);
    const p90: Partial<SongVoiceSeconds> = {};
    if (this.store.gpuSeconds)
      for (const [part, model] of Object.entries(SONG_VOICE_GPU_MODELS) as [keyof SongVoiceSeconds, string][]) {
        const xs = await this.store.gpuSeconds(model, since).catch(() => [] as number[]);
        if (xs.length >= this.cfg.COST_REFINE_MIN_SAMPLES) p90[part] = percentile(xs, 0.9);
      }
    this.voiceCache = { at: Date.now(), p90 };
    return p90;
  }

  /** the yen of one reported cost */
  jpyOf(e: CostEvent, r: CostRates): number {
    const machine = e.provider === 'gpu' ? r.gpuSecondJpy : e.provider === 'cpu' ? r.cpuSecondJpy : 0;
    return (e.usd ?? 0) * r.usdJpy + (e.seconds ?? 0) * machine;
  }

  /** the meter's sink: records the cost (never throws, never waits the caller) */
  record(e: CostEvent, ctx: CostCtx | undefined): void {
    const p = this.recordNow(e, ctx).catch((err) => this.log.warn(`cost not recorded (${e.provider} ${e.model}): ${String(err)}`));
    this.pending.add(p);
    void p.finally(() => this.pending.delete(p));
  }

  /** tests: wait for the recordings in flight */
  async settle(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  async recordNow(e: CostEvent, ctx: CostCtx | undefined): Promise<void> {
    const r = await this.rates();
    const costJpy = this.jpyOf(e, r);
    if (!(costJpy > 0)) return;
    const paid = !!ctx?.paid && !!ctx.kind;
    const kind = ctx?.kind ?? ctx?.feature ?? 'other';
    await this.store.insert({
      userId: ctx?.userId ?? null,
      kind,
      paid,
      job: ctx?.job ?? null,
      provider: e.provider,
      model: e.model.slice(0, 120),
      costUsd: e.usd ?? 0,
      seconds: e.seconds ?? 0,
      costJpy,
      fx: r.usdJpy,
      exact: e.exact,
      units: e.units ?? null,
    });
    // R18: the ダチ talk is free for everyone — its cost is recorded (kind 'dachi') and absorbed as marketing, never taken
    if (!paid && kind === MARKETING_FEATURE) {
      this.log.debug(`unrecovered marketing cost (dachi): ${ctx?.userId ?? '-'} ${e.provider} ¥${costJpy.toFixed(4)}`);
      return;
    }
    // a free feature's cost: added up and taken a whole mana at a time
    if (!paid && ctx?.userId) await this.accrue(ctx.userId, kind, costJpy);
  }

  /**
   * a small cost of a free feature (never below 0: what the balance cannot cover is absorbed and logged). R18: a
   * non-member past the first journey is stopped before the call at 0 mana (AccessService), so what is absorbed here is
   * a member's (covered by the ¥88), the first journey's, or a race at the last mana.
   */
  async accrue(userId: string, feature: string, jpy: number): Promise<AccrualStep> {
    const step = await this.store.accrue(userId, feature, jpy, this.rule());
    if (step.absorbedMana > 0) this.log.warn(`unrecovered small cost: ${userId} ${feature} ${step.absorbedMana} mana (¥${step.absorbedJpy.toFixed(2)}) absorbed at 0 mana`);
    return step;
  }

  /** PUT /admin/mana/fx: the rate of a month (normally next month's, set before it starts) */
  async setFx(month: string, usdJpy: number, note: string | null = null): Promise<{ month: string; usdJpy: number }> {
    await this.store.setFx(month, usdJpy, note);
    this.fxCache = null;
    this.priceCache = null;
    return { month, usdJpy };
  }

  /** the daily refinement: a making with enough recorded makings is quoted from their p90 */
  async refine(now = new Date()): Promise<Partial<Record<MakeKind, number>>> {
    const since = this.refineSince(now);
    const out: Partial<Record<MakeKind, number>> = {};
    for (const k of MAKE_KINDS) {
      const costs = await this.store.jobCosts(k, since);
      if (costs.length < this.cfg.COST_REFINE_MIN_SAMPLES) continue;
      const p90 = percentile(costs, 0.9);
      await this.store.saveEstimate(k, p90, costs.length);
      out[k] = p90;
    }
    this.priceCache = null;
    return out;
  }

  /** the margin report of the last `days` days (GET /admin/mana/margins) */
  async report(days = 1, now = new Date()): Promise<MarginReport> {
    const since = new Date(now.getTime() - days * DAY);
    const [d, prices, fx] = await Promise.all([this.store.report(since), this.prices(), this.fx(now)]);
    const rule = this.rule();
    const makings: MarginRow[] = [];
    const kinds = new Set<string>([...d.charged.map((c) => c.kind), ...d.costs.filter((c) => c.paid).map((c) => c.kind)]);
    for (const kind of [...kinds].sort()) {
      const ch = d.charged.find((c) => c.kind === kind);
      const costJpy = d.costs.filter((c) => c.paid && c.kind === kind).reduce((a, c) => a + c.costJpy, 0);
      const jobs = d.jobs.filter((j) => j.kind === kind).map((j) => j.costJpy);
      makings.push(marginRow({ kind, count: ch?.count ?? jobs.length, chargedMana: ch?.mana ?? 0, costJpy, perJobCostsJpy: jobs, currentMana: isMakeKind(kind) ? prices[kind] : null }, rule));
    }
    const free = d.costs.filter((c) => !c.paid && c.kind !== MARKETING_FEATURE);
    const marketingJpy = Math.round(d.costs.filter((c) => !c.paid && c.kind === MARKETING_FEATURE).reduce((a, c) => a + c.costJpy, 0) * 100) / 100;
    const usageRow = marginRow({ kind: 'usage', count: free.length, chargedMana: d.usageMana, costJpy: free.reduce((a, c) => a + c.costJpy, 0) }, rule);
    const features = Object.entries(free.reduce<Record<string, number>>((m, c) => ({ ...m, [c.kind]: (m[c.kind] ?? 0) + c.costJpy }), {}))
      .map(([kind, costJpy]) => ({ kind, costJpy: Math.round(costJpy * 100) / 100 }))
      .sort((a, b) => b.costJpy - a.costJpy);
    const low = [...makings, usageRow].filter((r) => r.low).map((r) => ({ kind: r.kind, margin: r.margin, currentMana: r.currentMana, suggestedMana: r.suggestedMana }));
    const pct = (m: number | null) => (m == null ? '—' : `${(m * 100).toFixed(1)}%`);
    const lines = [
      `マナの取り分（${days}日・為替 ${fx.usdJpy}円/ドル${fx.stale ? '・今月のレート未設定' : ''}）`,
      ...makings.map((r) => `${r.kind}: ${r.count}回 ${r.chargedMana}マナ／原価 ¥${r.costJpy}（手数料込み ¥${r.costWithFeeJpy}）→ 取り分 ${pct(r.margin)}${r.low ? ` ⚠ 8%未満。いま ${r.currentMana ?? '—'} → 提案 ${r.suggestedMana ?? '—'} マナ` : ''}`),
      `つかったマナ（小さな原価）: ${usageRow.chargedMana}マナ／原価 ¥${usageRow.costJpy} → 取り分 ${pct(usageRow.margin)}${usageRow.low ? ' ⚠ 8%未満（0マナで吸収した分・まだ1マナにならない分を含む）' : ''}`,
      `吸収した小さな原価（これまで）: ${d.absorbed.mana}マナ（¥${d.absorbed.jpy.toFixed(2)}）`,
      `ダチの原価（宣伝費として吸収・引かない）: ¥${marketingJpy.toFixed(2)}`,
    ];
    return {
      at: now.toISOString(),
      days,
      fx,
      rule: { ...rule, effectiveFeeRate: effectiveFeeRate(rule) },
      prices,
      makings,
      usage: { ...usageRow, features, absorbedAllTime: d.absorbed },
      marketing: { kind: MARKETING_FEATURE, costJpy: marketingJpy },
      low,
      lines,
    };
  }

  /** once a day (one instance, by a day key): refine the prices, then check the margins of the day and the week */
  private async daily() {
    try {
      const day = new Date().toISOString().slice(0, 10);
      if ((await this.kv.incr(`mana-cost:${day}`, 2 * 86400)) !== 1) return;
      const refined = await this.refine();
      if (Object.keys(refined).length) this.log.log(`mana prices refined from recorded costs (p90 yen): ${JSON.stringify(refined)}`);
      for (const days of [1, 7]) {
        const r = await this.report(days);
        await this.kv.set(`mana-margins:${days}`, JSON.stringify(r), 3 * 86400);
        if (r.low.length) this.log.error(`mana margin below ${(this.rule().margin * 100).toFixed(0)}% (${days}d): ${JSON.stringify(r.low)}`);
        else this.log.log(r.lines.join(' / '));
      }
    } catch (e) {
      this.log.error(`mana cost check failed: ${String(e)}`);
    }
  }
}

/** FX_RATES ("2026-12=158;2027-01=160", commas / spaces too) → month → rate */
export function parseFxRates(spec: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of spec.split(/[;,\s]+/)) {
    const m = part.match(/^(\d{4}-(?:0[1-9]|1[0-2]))[=:](\d+(?:\.\d+)?)$/);
    if (m && Number(m[2]) >= 50 && Number(m[2]) <= 500) out[m[1]] = Number(m[2]);
  }
  return out;
}

/** CostStore on Postgres */
export class PgCostStore implements CostStore {
  constructor(
    private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  async insert(row: CostRow) {
    await this.db.write.insert(genCosts).values(row);
  }

  async fxRates() {
    const rows = await this.db.read.select().from(fxRates);
    return Object.fromEntries(rows.map((r) => [r.month, r.usdJpy]));
  }

  async setFx(month: string, usdJpy: number, note: string | null) {
    await this.db.write
      .insert(fxRates)
      .values({ month, usdJpy, note })
      .onConflictDoUpdate({ target: fxRates.month, set: { usdJpy, note, setAt: new Date() } });
  }

  async estimates(since?: Date) {
    const rows = await this.db.read.select().from(makeCostEstimates);
    return Object.fromEntries(rows.filter((r) => isMakeKind(r.kind) && (!since || r.updatedAt >= since)).map((r) => [r.kind, r.costJpy])) as Partial<Record<MakeKind, number>>;
  }

  async saveEstimate(kind: MakeKind, costJpy: number, samples: number) {
    await this.db.write
      .insert(makeCostEstimates)
      .values({ kind, costJpy, samples })
      .onConflictDoUpdate({ target: makeCostEstimates.kind, set: { costJpy, samples, updatedAt: new Date() } });
  }

  async jobCosts(kind: MakeKind, since: Date) {
    const rows = await this.db.read
      .select({ c: sql<number>`sum(${genCosts.costJpy})` })
      .from(genCosts)
      .where(and(eq(genCosts.kind, kind), eq(genCosts.paid, true), isNotNull(genCosts.job), gte(genCosts.createdAt, since)))
      .groupBy(genCosts.job);
    return rows.map((r) => Number(r.c));
  }

  async gpuSeconds(model: string, since: Date) {
    const rows = await this.db.read
      .select({ s: sql<number>`sum(${genCosts.seconds})` })
      .from(genCosts)
      .where(and(eq(genCosts.provider, 'gpu'), eq(genCosts.model, model), gte(genCosts.createdAt, since)))
      .groupBy(sql`coalesce(${genCosts.job}, ${genCosts.id}::text)`);
    return rows.map((r) => Number(r.s)).filter((x) => x > 0);
  }

  async accrue(userId: string, feature: string, addJpy: number, rule: PriceRule): Promise<AccrualStep> {
    return this.db.write.transaction(async (tx) => {
      const [w] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for('update');
      await tx.insert(usageAccruals).values({ userId }).onConflictDoNothing();
      const [a] = await tx.select().from(usageAccruals).where(eq(usageAccruals.userId, userId)).for('update');
      const step = accrueUsage(a.pendingJpy, addJpy, w?.manaBalance ?? 0, rule);
      let rows = a.rows;
      if (step.take > 0) {
        rows++;
        await this.ledger.applyMana(tx, { userId, delta: -step.take, reason: 'usage', idempotencyKey: `usage:${userId}:${rows}`, refType: feature.slice(0, 40) });
      }
      await tx
        .update(usageAccruals)
        .set({ pendingJpy: step.pendingJpy, takenMana: a.takenMana + step.take, absorbedMana: a.absorbedMana + step.absorbedMana, absorbedJpy: a.absorbedJpy + step.absorbedJpy, rows, updatedAt: new Date() })
        .where(eq(usageAccruals.userId, userId));
      return step;
    });
  }

  async report(since: Date): Promise<ReportData> {
    const kinds = [...MAKE_KINDS] as string[];
    const charged = await this.db.read
      .select({
        kind: manaLedger.refType,
        count: sql<number>`count(*) filter (where ${manaLedger.reason} = 'generation')`,
        mana: sql<number>`coalesce(sum(-${manaLedger.delta}), 0)`,
      })
      .from(manaLedger)
      // R17: the tenths of a price are taken later as 'usage' rows labelled with the making (counted with it here)
      .where(and(inArray(manaLedger.reason, ['generation', 'refund', 'usage']), inArray(manaLedger.refType, kinds), gte(manaLedger.createdAt, since)))
      .groupBy(manaLedger.refType);
    const costs = await this.db.read
      .select({ kind: genCosts.kind, paid: genCosts.paid, costJpy: sql<number>`sum(${genCosts.costJpy})` })
      .from(genCosts)
      .where(gte(genCosts.createdAt, since))
      .groupBy(genCosts.kind, genCosts.paid);
    const jobs = await this.db.read
      .select({ kind: genCosts.kind, costJpy: sql<number>`sum(${genCosts.costJpy})` })
      .from(genCosts)
      .where(and(eq(genCosts.paid, true), isNotNull(genCosts.job), gte(genCosts.createdAt, since)))
      .groupBy(genCosts.kind, genCosts.job);
    const [usage] = await this.db.read
      .select({ mana: sql<number>`coalesce(sum(-${manaLedger.delta}), 0)` })
      .from(manaLedger)
      .where(and(eq(manaLedger.reason, 'usage'), sql`${manaLedger.refType} is null or not (${inArray(manaLedger.refType, kinds)})`, gte(manaLedger.createdAt, since)));
    const [abs] = await this.db.read.select({ mana: sql<number>`coalesce(sum(${usageAccruals.absorbedMana}), 0)`, jpy: sql<number>`coalesce(sum(${usageAccruals.absorbedJpy}), 0)` }).from(usageAccruals);
    return {
      charged: charged.map((c) => ({ kind: c.kind ?? 'other', count: Number(c.count), mana: Number(c.mana) })),
      costs: costs.map((c) => ({ kind: c.kind, paid: c.paid, costJpy: Number(c.costJpy) })),
      jobs: jobs.map((j) => ({ kind: j.kind, costJpy: Number(j.costJpy) })),
      usageMana: Number(usage?.mana ?? 0),
      absorbed: { mana: Number(abs?.mana ?? 0), jpy: Number(abs?.jpy ?? 0) },
    };
  }
}
