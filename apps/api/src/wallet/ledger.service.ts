import { Injectable } from '@nestjs/common';
import { applyDelta, assertInteger, ManaReason } from '@obolo/ledger';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/db';
import { manaLedger, users, wallets } from '../db/schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

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
 *  3. checks the balance never goes negative (applyDelta), then appends the ledger row.
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
    await tx.update(wallets).set({ manaBalance: balanceAfter, updatedAt: now }).where(eq(wallets.userId, e.userId));
    const [row] = await tx
      .insert(manaLedger)
      .values({
        userId: e.userId,
        delta: e.delta,
        balanceAfter,
        reason: e.reason,
        refType: e.refType,
        refId: e.refId,
        idempotencyKey: e.idempotencyKey,
      })
      .returning();
    // Any purchase / earn / spend resets the 1-year expiry clock (spec §3.1.1).
    await tx.update(users).set({ lastActivityAt: now }).where(eq(users.id, e.userId));
    return row;
  }
}
