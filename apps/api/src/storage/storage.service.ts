import { CallHandler, ExecutionContext, HttpStatus, Inject, Injectable, Logger, NestInterceptor, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { LedgerError } from '@obolo/ledger';
import {
  afterRenewal,
  baseQuotaBytes,
  CHARGE_ERROR_WORDS,
  fxMonth,
  GIB,
  manaTenths,
  NO_PLAN,
  planExtraGb,
  quotaBytes,
  renewalDue,
  splitMana,
  STORAGE_LINES,
  STORAGE_NEAR_RESET,
  storageBuyKey,
  storageLevel,
  storageRenewKey,
  storageWrite,
  tierPrices,
  type PriceRule,
  type StorageExpandBody,
  type StorageExpandResult,
  type StoragePlanState,
  type StorageRule,
  type StorageSay,
  type StorageTierPrice,
  type StorageView,
} from '@obolo/shared';
import { and, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { Observable } from 'rxjs';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { manaLedger, storagePlans, users, wallets } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { activeMember } from '../users/tester';
import { CostService } from '../wallet/cost.service';
import { LedgerService } from '../wallet/ledger.service';
import { setStorageGate } from './storage-gate';

const DAY = 86400_000;

export type Told = { near?: boolean; grace?: string; lapsed?: string };
export type PlanRow = StoragePlanState & { told: Told };
export type TakeResult = 'charged' | 'repeat' | 'short';

/** where the room, the plans and the mana are kept (Postgres; tests use a store in memory) */
export interface StorageStore {
  /** every byte the member owns that we store: their files (media_objects) + the text of their books and games */
  used(userId: string): Promise<number>;
  member(userId: string): Promise<boolean>;
  plan(userId: string): Promise<PlanRow | null>;
  savePlan(userId: string, p: Partial<PlanRow>): Promise<void>;
  /** the members whose plan was not paid for `month` yet */
  due(month: string): Promise<string[]>;
  /** take `mana` (to the tenth) once for `key`: charged / the same key again / too little mana (nothing taken) */
  take(userId: string, key: string, mana: number, gb: number): Promise<TakeResult>;
}

/** the room is full (or the file does not fit): the words are {bati}'s (no codes on screen) */
export const storageFull = () => apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'STORAGE_QUOTA', STORAGE_LINES.full);

/**
 * R18 (client 2026-11-25, docs/マナの値段.md 13., docs/media.md): Bluena's room and 保存の魔法.
 *  - the room: STORAGE_MEMBER_GB for a member, STORAGE_FREE_GB for everyone else, + the tier in effect; every stored
 *    file of the member and the text of their books / games count (used());
 *  - 保存の魔法: a tier bought with a yes (a full month, at the price {bati} said), renewed at the start of each month by
 *    the daily run (and when the member looks), 7 days of grace when the mana is short, then the tier lapses — no file
 *    is ever deleted; 「やめて」 ends it at the month's end;
 *  - over the room, new files and makings stop (STORAGE_QUOTA) until the member is under it;
 *  - {bati}'s notices (80%, the grace, the lapse) are said once (say / told).
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Storage');
  protected store: StorageStore;
  private timer: ReturnType<typeof setInterval> | null = null;
  private first: ReturnType<typeof setTimeout> | null = null;

  constructor(
    db: Database,
    ledger: LedgerService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
    @Optional() private readonly cost?: CostService,
  ) {
    this.store = new PgStorageStore(db, ledger, cfg);
  }

  /** tests: another store */
  useStore(store: StorageStore): this {
    this.store = store;
    return this;
  }

  onModuleInit() {
    setStorageGate((userId) => this.assertRoom(userId));
    if (process.env.NODE_ENV === 'test') return;
    this.first = setTimeout(() => void this.daily(), 150_000);
    this.timer = setInterval(() => void this.daily(), DAY / 4);
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
    setStorageGate(null);
  }

  rule(): StorageRule {
    const c = this.cfg;
    return { memberGb: c.STORAGE_MEMBER_GB, freeGb: c.STORAGE_FREE_GB, gbMonthUsd: c.STORAGE_GB_MONTH_USD, classAPerGb: c.STORAGE_CLASS_A_PER_GB, classBPerGb: c.STORAGE_CLASS_B_PER_GB, graceDays: c.STORAGE_GRACE_DAYS };
  }

  private priceRule(): PriceRule {
    return this.cost?.rule() ?? { feeRate: this.cfg.STRIPE_FEE_RATE, feeFixedJpy: this.cfg.STRIPE_FEE_FIXED_JPY, feeBaseJpy: this.cfg.STRIPE_FEE_BASE_JPY, margin: this.cfg.MANA_MARGIN };
  }

  /** the tiers' mana a month at this month's FX (the price rule of their R2 cost) */
  async prices(): Promise<StorageTierPrice[]> {
    const usdJpy = this.cost ? (await this.cost.rates().catch(() => null))?.usdJpy : undefined;
    return tierPrices(usdJpy ?? this.cfg.FX_USD_JPY, this.priceRule(), this.rule());
  }

  /** the member's room now (bytes) */
  async quota(userId: string, now = new Date()): Promise<{ used: number; quota: number; member: boolean; extraGb: number; plan: PlanRow | null }> {
    let [used, member, plan] = await Promise.all([this.store.used(userId), this.store.member(userId), this.store.plan(userId)]);
    // a new month not renewed yet (before the daily run): renewed now, so a paid tier never blinks out on the 1st
    if (renewalDue(plan, now) !== 'none' && !plan?.graceUntil) {
      await this.renew(userId, now).catch((e) => this.log.warn(`renew ${userId}: ${String(e)}`));
      plan = await this.store.plan(userId);
    }
    const extraGb = planExtraGb(plan, now);
    return { used, quota: quotaBytes(member, extraGb, this.rule()), member, extraGb, plan };
  }

  /** STORAGE_QUOTA unless `addBytes` more fit (0: unless there is any room left) */
  async assertRoom(userId: string, addBytes = 0): Promise<void> {
    const q = await this.quota(userId);
    const fits = addBytes > 0 ? q.used + addBytes <= q.quota : q.used < q.quota;
    if (!fits) throw storageFull();
  }

  /** GET /storage: the calm bar's numbers, the tiers, the plan, a notice not said yet (the month renewed first) */
  async status(userId: string, now = new Date()): Promise<StorageView> {
    await this.renew(userId, now).catch((e) => this.log.warn(`renew ${userId}: ${String(e)}`));
    const q = await this.quota(userId, now);
    const level = storageLevel(q.used, q.quota);
    const plan = q.plan;
    let told: Told = plan?.told ?? {};
    // the 80% notice is said again once the member went well below it
    if (told.near && q.used < q.quota * STORAGE_NEAR_RESET) {
      told = { ...told, near: false };
      await this.store.savePlan(userId, { told });
    }
    let say: StorageSay | null = null;
    if (plan?.lapsedAt && told.lapsed !== plan.lapsedAt.toISOString()) say = 'lapsed';
    else if (plan?.graceUntil && now < plan.graceUntil && told.grace !== plan.graceUntil.toISOString()) say = 'grace';
    else if (level === 'near' && !told.near) say = 'near';
    return {
      usedBytes: q.used,
      quotaBytes: q.quota,
      baseGb: baseQuotaBytes(q.member, this.rule()) / GIB,
      extraGb: q.extraGb,
      member: q.member,
      level,
      plan: plan?.tierGb ? { gb: plan.tierGb, cancelled: plan.cancelled, paidMonth: plan.paidMonth, graceUntil: plan.graceUntil?.toISOString() ?? null } : null,
      tiers: await this.prices(),
      say,
    };
  }

  /** POST /storage/told: {bati} said it (once) */
  async told(userId: string, what: StorageSay): Promise<void> {
    const plan = await this.store.plan(userId);
    const t: Told = { ...(plan?.told ?? {}) };
    if (what === 'near') t.near = true;
    if (what === 'grace' && plan?.graceUntil) t.grace = plan.graceUntil.toISOString();
    if (what === 'lapsed' && plan?.lapsedAt) t.lapsed = plan.lapsedAt.toISOString();
    await this.store.savePlan(userId, { told: t });
  }

  /**
   * POST /storage/expand: the yes to a tier at the price {bati} said — a full month now (no pro-rating), then at the
   * start of each month. The same tier already paid for this month: nothing is charged (a 「やめて」 is taken back).
   */
  async expand(userId: string, b: StorageExpandBody, now = new Date()): Promise<StorageExpandResult> {
    const price = (await this.prices()).find((t) => t.gb === b.gb)?.mana;
    if (price == null) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'No such tier');
    if (manaTenths(b.confirm.price) !== manaTenths(price)) throw apiError(HttpStatus.CONFLICT, 'PRICE_CHANGED', CHARGE_ERROR_WORDS.PRICE_CHANGED);
    const plan = (await this.store.plan(userId)) ?? { ...NO_PLAN, told: {} };
    const month = fxMonth(now);
    if (plan.tierGb === b.gb && plan.paidMonth && plan.paidMonth >= month) {
      if (plan.cancelled) await this.store.savePlan(userId, { cancelled: false });
      return { status: 'already', view: await this.status(userId, now) };
    }
    const r = await this.store.take(userId, storageBuyKey(userId, b.confirm.id), price, b.gb);
    if (r === 'short') throw apiError(HttpStatus.PAYMENT_REQUIRED, 'NO_MANA', CHARGE_ERROR_WORDS.NO_MANA);
    if (r === 'charged') await this.store.savePlan(userId, { tierGb: b.gb, paidMonth: month, cancelled: false, graceUntil: null });
    return { status: r, view: await this.status(userId, now) };
  }

  /** POST /storage/cancel: 「保存の魔法をやめて」 — the tier stays to the month's end, then lapses (no charge) */
  async cancel(userId: string, now = new Date()): Promise<{ cancelled: boolean; view: StorageView }> {
    const plan = await this.store.plan(userId);
    if (!plan?.tierGb) return { cancelled: false, view: await this.status(userId, now) };
    await this.store.savePlan(userId, { cancelled: true });
    return { cancelled: true, view: await this.status(userId, now) };
  }

  /** one member's month: charge the tier (once a month), keep it in grace, or let it lapse */
  async renew(userId: string, now = new Date()) {
    const plan = await this.store.plan(userId);
    const due = renewalDue(plan, now);
    if (!plan || due === 'none') return null;
    let paid: boolean | 'lapse' = 'lapse';
    if (due === 'charge') {
      const mana = (await this.prices()).find((t) => t.gb === plan.tierGb)?.mana ?? 0;
      paid = mana > 0 ? (await this.store.take(userId, storageRenewKey(userId, fxMonth(now), plan.tierGb!), mana, plan.tierGb!)) !== 'short' : false;
    }
    const r = afterRenewal(plan, now, paid, this.rule());
    if (r.event !== 'waiting') await this.store.savePlan(userId, { ...r.plan });
    if (r.event === 'grace' || r.event === 'lapsed') this.log.log(`storage plan ${userId}: ${r.event}`);
    return r.event;
  }

  /** every plan due this month (the daily run: on the 1st they are all due; the grace goes on day by day) */
  async renewAll(now = new Date()): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const userId of await this.store.due(fxMonth(now))) {
      const e = await this.renew(userId, now).catch((err) => {
        this.log.error(`storage renew ${userId}: ${String(err)}`);
        return 'error';
      });
      if (e) out[e] = (out[e] ?? 0) + 1;
    }
    return out;
  }

  private async daily() {
    try {
      const day = new Date().toISOString().slice(0, 13);
      // four times a day, one instance each time (a key per 6 hours)
      if ((await this.kv.incr(`storage-renew:${day.slice(0, 11)}${Math.floor(Number(day.slice(11)) / 6)}`, 2 * 86400)) !== 1) return;
      const r = await this.renewAll();
      if (Object.keys(r).length) this.log.log(`storage renewals: ${JSON.stringify(r)}`);
    } catch (e) {
      this.log.error(`storage renewals failed: ${String(e)}`);
    }
  }
}

/** Postgres */
export class PgStorageStore implements StorageStore {
  constructor(
    private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly cfg?: AppConfig,
  ) {}

  async used(userId: string): Promise<number> {
    const r = await this.db.write.execute<{ used: string | number | null }>(sql`
      SELECT
        (SELECT COALESCE(SUM(size_bytes), 0) FROM media_objects WHERE user_id = ${userId} AND deleted_at IS NULL)
        + (SELECT COALESCE(SUM(octet_length(chapters_json::text) + octet_length(spell_json::text) + octet_length(title)), 0) FROM books WHERE user_id = ${userId} AND deleted_at IS NULL)
        + (SELECT COALESCE(SUM(octet_length(versions_json::text)), 0) FROM games WHERE user_id = ${userId} AND deleted_at IS NULL)
        AS used`);
    return Number(r.rows[0]?.used ?? 0);
  }

  async member(userId: string): Promise<boolean> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    return activeMember(u, this.cfg);
  }

  async plan(userId: string): Promise<PlanRow | null> {
    const [p] = await this.db.write.select().from(storagePlans).where(eq(storagePlans.userId, userId));
    return p ? { tierGb: p.tierGb, paidMonth: p.paidMonth, cancelled: p.cancelled, graceUntil: p.graceUntil, lapsedAt: p.lapsedAt, told: p.toldJson ?? {} } : null;
  }

  async savePlan(userId: string, p: Partial<PlanRow>): Promise<void> {
    const { told, ...rest } = p;
    const set = { ...rest, ...(told ? { toldJson: told } : {}), updatedAt: new Date() };
    await this.db.write.insert(storagePlans).values({ userId, ...set }).onConflictDoUpdate({ target: storagePlans.userId, set });
  }

  async due(month: string): Promise<string[]> {
    const rows = await this.db.read
      .select({ userId: storagePlans.userId })
      .from(storagePlans)
      .where(and(isNotNull(storagePlans.tierGb), or(isNull(storagePlans.paidMonth), lt(storagePlans.paidMonth, month))))
      .limit(10_000);
    return rows.map((r) => r.userId);
  }

  async take(userId: string, key: string, mana: number, gb: number): Promise<TakeResult> {
    try {
      return await this.db.write.transaction(async (tx) => {
        const [w] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for('update');
        if (!w) return 'short';
        const [dupe] = await tx.select({ id: manaLedger.id }).from(manaLedger).where(eq(manaLedger.idempotencyKey, key)).limit(1);
        if (dupe) return 'repeat';
        if (w.manaBalance < mana) return 'short';
        // the whole mana as a row (it marks the month / the yes), the tenths with the waiting ones (as a making's price)
        const { whole, tenths } = splitMana(mana);
        await this.ledger.applyMana(tx, { userId, delta: -whole, reason: 'storage', idempotencyKey: key, refType: 'storage', refId: String(gb) });
        await this.ledger.addTenths(tx, userId, 'storage', tenths);
        return 'charged';
      });
    } catch (e) {
      if (e instanceof LedgerError) return 'short';
      throw e;
    }
  }
}

/**
 * R18: the making-side writes that store something but are not charged through the ledger (a book's chapter, a game's
 * build, a 📎 upload started — shared STORAGE_WRITES) stop on a full Bluena (STORAGE_QUOTA). Never a DELETE.
 */
@Injectable()
export class StorageGate implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}
  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<{ method: string; path: string; userId?: string }>();
    if (req.userId && storageWrite(req.method, req.path)) await this.storage.assertRoom(req.userId);
    return next.handle();
  }
}
