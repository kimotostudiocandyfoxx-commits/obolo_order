import { HttpStatus, Injectable } from '@nestjs/common';
import { applyDelta, assertInteger, LedgerError, ManaReason } from '@obolo/ledger';
import { CHARGE_ERROR_WORDS, confirmKey, decideCharge, MAKE_COST, type ChargeError, type MakeConfirm, type MakeKind } from '@obolo/shared';
import { randomUUID } from 'node:crypto';
import { apiError } from '../common/errors';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Database, Db } from '../db/db';
import { manaLedger, users, wallets } from '../db/schema';
import { GENESIS, manaRowHash } from './mana-chain';

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

  /** the member's balance, the wallet row locked for this transaction (serialises a double tap) */
  protected async lockedBalance(tx: Tx, userId: string): Promise<number> {
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for('update');
    if (!wallet) throw new Error(`wallet missing for ${userId}`);
    return wallet.manaBalance;
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
  async charge(db: Database, userId: string, kind: MakeKind, refId?: string, opts: { confirm?: MakeConfirm; required?: boolean } = {}): Promise<{ refund: () => Promise<void>; repeat: boolean }> {
    const amount = MAKE_COST[kind];
    const key = opts.confirm ? confirmKey(userId, kind, opts.confirm) : `make:${kind}:${userId}:${randomUUID()}`;
    let repeat = false;
    try {
      await db.write.transaction(async (tx) => {
        const balance = await this.lockedBalance(tx, userId);
        const d = decideCharge({ kind, confirm: opts.confirm, required: !!opts.required, balance, applied: !!opts.confirm && (await this.applied(tx, key)) });
        if ('error' in d) throw chargeRefused(d.error);
        if (d.do === 'repeat') {
          repeat = true;
          return;
        }
        await this.applyMana(tx, { userId, delta: -d.amount, reason: 'generation', idempotencyKey: key, refType: kind, refId });
      });
    } catch (e) {
      if (e instanceof LedgerError) throw chargeRefused('NO_MANA');
      throw e;
    }
    return {
      repeat,
      refund: async () => {
        if (repeat) return;
        await db.write.transaction((tx) => this.applyMana(tx, { userId, delta: amount, reason: 'refund', idempotencyKey: `${key}:refund`, refType: kind, refId }));
      },
    };
  }
}

/** a charge refused, as the API's error (no codes on screen: the words are {bati}'s) */
export function chargeRefused(code: ChargeError) {
  const status = code === 'NO_MANA' ? HttpStatus.PAYMENT_REQUIRED : code === 'CONFIRM_REQUIRED' ? HttpStatus.PRECONDITION_REQUIRED : HttpStatus.CONFLICT;
  return apiError(status, code, CHARGE_ERROR_WORDS[code]);
}
