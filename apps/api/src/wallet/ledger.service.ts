import { HttpStatus, Injectable } from '@nestjs/common';
import { applyDelta, assertInteger, LedgerError, ManaReason } from '@obolo/ledger';
import { CHARGE_ERROR_WORDS, confirmKey, decideCharge, splitMana, type ChargeError, type MakeConfirm, type MakeKind } from '@obolo/shared';
import { randomUUID } from 'node:crypto';
import { apiError } from '../common/errors';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Database, Db } from '../db/db';
import { manaLedger, usageAccruals, users, wallets } from '../db/schema';
import { costScope } from './cost-scope';
import { GENESIS, manaRowHash } from './mana-chain';
import { livePrice } from './price-book';
import { checkRoom } from '../storage/storage-gate';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface ManaEntryInput {
  userId: string;
  delta: number;
  reason: ManaReason;
  idempotencyKey: string;
  refType?: string;
  refId?: string;
}

/**
 * DB-side application of @obolo/ledger rules. Every write:
 *  1. locks the wallet row (SELECT … FOR UPDATE) — serialises concurrent writes per user,
 *  2. returns the existing row if the idempotency key was already applied,
 *  3. checks the balance never goes negative (applyDelta), then appends the ledger row,
 *  4. chains the row to the user's previous one (seq + SHA-256, src/wallet/mana-chain.ts).
 * NOTE: there is intentionally no method to move MANA to JPY or to another user (spec §3.2).
 */
@Injectable()
export class LedgerService {
  async applyMana(tx: Tx, e: ManaEntryInput) {
    assertInteger(e.delta, 'delta');
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, e.userId)).for('update');
    if (!wallet) throw new Error(`wallet missing for ${e.userId}`);

    const [dupe] = await tx.select().from(manaLedger).where(eq(manaLedger.idempotencyKey, e.idempotencyKey)).limit(1);
    if (dupe) return dupe;

    const balanceAfter = applyDelta(wallet.manaBalance, e.delta);
    const now = new Date();
    const last = await this.sealUser(tx, e.userId);
    const content = {
      userId: e.userId,
      seq: (last?.seq ?? 0) + 1,
      delta: e.delta,
      balanceAfter,
      reason: e.reason,
      refType: e.refType ?? null,
      refId: e.refId ?? null,
      idempotencyKey: e.idempotencyKey,
      createdAt: now,
    };
    const prevHash = last?.hash ?? GENESIS;
    await tx.update(wallets).set({ manaBalance: balanceAfter, updatedAt: now }).where(eq(wallets.userId, e.userId));
    const [row] = await tx
      .insert(manaLedger)
      .values({ ...content, prevHash, hash: manaRowHash(content, prevHash) })
      .returning();
    // Any purchase / earn / spend resets the 1-year expiry clock (spec §3.1.1).
    await tx.update(users).set({ lastActivityAt: now }).where(eq(users.id, e.userId));
    return row;
  }

  /**
   * Gives a hash to this user's rows written before the chain existed (oldest first) and returns the last row.
   * Call with the wallet row locked. Only the chain columns of unsealed rows are filled in; nothing else changes.
   */
  async sealUser(tx: Tx, userId: string) {
    const [last] = await tx.select().from(manaLedger).where(eq(manaLedger.userId, userId)).orderBy(sql`${manaLedger.seq} desc nulls last`).limit(1);
    if (!last || last.hash) return last;
    const open = await tx
      .select()
      .from(manaLedger)
      .where(and(eq(manaLedger.userId, userId), isNull(manaLedger.hash)))
      .orderBy(asc(manaLedger.seq));
    const firstSeq = open[0]?.seq ?? 1;
    const [before] = firstSeq > 1 ? await tx.select().from(manaLedger).where(and(eq(manaLedger.userId, userId), eq(manaLedger.seq, firstSeq - 1))).limit(1) : [];
    let prev = before?.hash ?? GENESIS;
    let tail = last;
    for (const r of open) {
      const hash = manaRowHash(r, prev);
      [tail] = await tx.update(manaLedger).set({ prevHash: prev, hash }).where(eq(manaLedger.id, r.id)).returning();
      prev = hash;
    }
    return tail;
  }

  /** the delta of the ledger row with this idempotency key (none: undefined) */
  protected async deltaOf(tx: Tx, key: string): Promise<number | undefined> {
    const [row] = await tx.select({ delta: manaLedger.delta }).from(manaLedger).where(eq(manaLedger.idempotencyKey, key)).limit(1);
    return row?.delta;
  }

  /**
   * Client 2026-11-25 (ゲーム): the mana of one yes given back later (a background game build that failed, a game that
   * does not run): only if that yes was charged, and only once (the refund row has its own idempotency key). Returns the
   * mana given back (0: nothing to give back).
   */
  async refundYes(db: Database, userId: string, kind: MakeKind, confirm: MakeConfirm, refId?: string): Promise<number> {
    const key = confirmKey(userId, kind, confirm);
    return db.write.transaction(async (tx) => {
      const charged = await this.deltaOf(tx, key);
      if (charged == null || charged > 0) return 0;
      if ((await this.deltaOf(tx, `${key}:refund`)) != null) return 0;
      // R17: the whole mana as a row (a 0 row for a price below 1, so it is given back once), the tenths to the waiting ones
      const { whole, tenths } = splitMana(confirm.price);
      const back = whole === -charged ? tenths : 0;
      await this.applyMana(tx, { userId, delta: -charged, reason: 'refund', idempotencyKey: `${key}:refund`, refType: kind, refId });
      await this.addTenths(tx, userId, kind, -back);
      return -charged + back / 10;
    });
  }

  /**
   * R17 (client 2026-11-25: a price below 1 mana is shown as it is, 「使うマナ 0.3」): the tenths of a paid making wait
   * with the member's small costs and are taken a whole mana at a time as they reach 10 (a 'usage' row labelled with the
   * kind, at most the balance; the rest keeps waiting). Negative tenths (a refund) are given back the same way: the next
   * tenths use them up first. Call inside the transaction.
   */
  async addTenths(tx: Tx, userId: string, kind: string, tenths: number): Promise<{ taken: number; pending: number }> {
    if (!tenths) return { taken: 0, pending: 0 };
    const a = await this.tenthsRow(tx, userId);
    let pending = a.pendingTenths + tenths;
    let rows = a.rows;
    let taken = 0;
    if (pending >= 10) {
      const balance = await this.lockedBalance(tx, userId);
      taken = Math.min(Math.floor(pending / 10), balance);
      if (taken > 0) {
        rows++;
        await this.applyMana(tx, { userId, delta: -taken, reason: 'usage', idempotencyKey: `usage:${userId}:${rows}`, refType: kind.slice(0, 40) });
        pending -= taken * 10;
      }
    }
    await this.saveTenths(tx, userId, { pendingTenths: pending, rows, takenMana: a.takenMana + taken });
    return { taken, pending };
  }

  /** the member's waiting tenths (and the small costs' row counter), the row locked */
  protected async tenthsRow(tx: Tx, userId: string): Promise<{ pendingTenths: number; rows: number; takenMana: number }> {
    await tx.insert(usageAccruals).values({ userId }).onConflictDoNothing();
    const [a] = await tx.select().from(usageAccruals).where(eq(usageAccruals.userId, userId)).for('update');
    return a;
  }

  protected async saveTenths(tx: Tx, userId: string, v: { pendingTenths: number; rows: number; takenMana: number }): Promise<void> {
    await tx.update(usageAccruals).set({ ...v, updatedAt: new Date() }).where(eq(usageAccruals.userId, userId));
  }

  /** the member's balance, the wallet row locked for this transaction (serialises a double tap) */
  protected async lockedBalance(tx: Tx, userId: string): Promise<number> {
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for('update');
    if (!wallet) throw new Error(`wallet missing for ${userId}`);
    return wallet.manaBalance;
  }

  /** a making's price now (the live price list; its fallback without one) */
  protected async priceOf(kind: MakeKind): Promise<number> {
    return livePrice(kind);
  }

  /** a ledger row with this idempotency key is there already */
  protected async applied(tx: Tx, key: string): Promise<boolean> {
    const [dupe] = await tx.select({ id: manaLedger.id }).from(manaLedger).where(eq(manaLedger.idempotencyKey, key)).limit(1);
    return !!dupe;
  }

  /**
   * Making with mana (story M-R132, D08-S002's table): takes the cost from the gem / the month's mana before
   * the work is made. Not enough → 402 NO_MANA (「マナジェムが、光らなくなった」; a resident is then offered the
   * Eclipse). Returns `refund`, to give it back when the making fails.
   * R11: `confirm` is the member's yes to the plan and the price shown (MakeConfirm). With `required` (a request from the
   * Moon atelier) nothing is charged without it (428 CONFIRM_REQUIRED) or at another price (409 PRICE_CHANGED); the same
   * yes again is no new charge (`repeat`: the caller hands back what the first one started, never a second making).
   */
  async charge(db: Database, userId: string, kind: MakeKind, refId?: string, opts: { confirm?: MakeConfirm; required?: boolean; /** spellKey of the spell the request carries */ spell?: string | null; /** R18: a making quoted per work (the voice spell: its GPU seconds) — the server's own quote, never the client's */ price?: number } = {}): Promise<{ refund: () => Promise<void>; repeat: boolean }> {
    // client 2026-11-25: the live price (manaFor of the making's estimated cost at this month's FX) — the same list the
    // confirm card showed; a yes to another price is refused (PRICE_CHANGED), never charged at a new one
    // R18: a full Bluena stops the making before anything is charged (STORAGE_QUOTA; the room is checked again per file)
    await checkRoom(userId);
    const price = opts.price ?? (await this.priceOf(kind));
    const key = opts.confirm ? confirmKey(userId, kind, opts.confirm) : `make:${kind}:${userId}:${randomUUID()}`;
    let repeat = false;
    let amount = 0;
    try {
      await db.write.transaction(async (tx) => {
        const balance = await this.lockedBalance(tx, userId);
        const d = decideCharge({ kind, price, confirm: opts.confirm, required: !!opts.required, spell: opts.spell ?? null, balance, applied: !!opts.confirm && (await this.applied(tx, key)) });
        if ('error' in d) throw chargeRefused(d.error);
        if (d.do === 'repeat') {
          repeat = true;
          return;
        }
        amount = d.amount;
        // R17: the whole mana now (a 0 row for a price below 1: it marks the yes), the tenths with the waiting ones
        const { whole, tenths } = splitMana(d.amount);
        await this.applyMana(tx, { userId, delta: -whole, reason: 'generation', idempotencyKey: key, refType: kind, refId });
        await this.addTenths(tx, userId, kind, tenths);
      });
    } catch (e) {
      if (e instanceof LedgerError) throw chargeRefused('NO_MANA');
      throw e;
    }
    // the work this request does next (and the job it queues) is this paid making: its costs are compared with its mana
    if (!repeat) costScope.tag({ kind, job: key, paid: true });
    return {
      repeat,
      refund: async () => {
        if (repeat || !amount) return;
        const { whole, tenths } = splitMana(amount);
        await db.write.transaction(async (tx) => {
          if ((await this.deltaOf(tx, `${key}:refund`)) != null) return;
          await this.applyMana(tx, { userId, delta: whole, reason: 'refund', idempotencyKey: `${key}:refund`, refType: kind, refId });
          await this.addTenths(tx, userId, kind, -tenths);
        });
      },
    };
  }

  /**
   * Client 2026-11-25 (the first profile look, confirmed at the end of day 2): a making's full price taken without a
   * yes card and without stopping the journey — a normal 'generation' row under `key` (idempotent: the same key never
   * takes twice; a retry returns the first one's numbers). When the balance is short, the whole mana it holds are taken
   * now and the rest waits with the tenths (addTenths), taken a whole mana at a time from the next mana — never absorbed,
   * never below 0. Returns the price, the mana taken now and the mana still waiting.
   */
  async chargeWhole(db: Database, userId: string, kind: MakeKind, key: string, refId?: string): Promise<{ price: number; taken: number; waiting: number; repeat: boolean }> {
    const price = await this.priceOf(kind);
    let out = { price, taken: 0, waiting: 0, repeat: false };
    await db.write.transaction(async (tx) => {
      const before = await this.deltaOf(tx, key);
      if (before != null) {
        out = { price, taken: -before, waiting: 0, repeat: true };
        return;
      }
      const balance = await this.lockedBalance(tx, userId);
      const { whole, tenths } = splitMana(price);
      const taken = Math.max(0, Math.min(whole, balance));
      await this.applyMana(tx, { userId, delta: -taken, reason: 'generation', idempotencyKey: key, refType: kind, refId });
      const r = await this.addTenths(tx, userId, kind, tenths + (whole - taken) * 10);
      out = { price, taken: taken + r.taken, waiting: Math.max(0, whole - taken - r.taken), repeat: false };
    });
    if (!out.repeat) costScope.tag({ kind, job: key, paid: true });
    return out;
  }
}

/** a charge refused, as the API's error (no codes on screen: the words are {bati}'s) */
export function chargeRefused(code: ChargeError) {
  const status = code === 'NO_MANA' ? HttpStatus.PAYMENT_REQUIRED : code === 'CONFIRM_REQUIRED' ? HttpStatus.PRECONDITION_REQUIRED : HttpStatus.CONFLICT;
  return apiError(status, code, CHARGE_ERROR_WORDS[code]);
}
