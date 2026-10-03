import { Controller, Get, UseGuards } from '@nestjs/common';
import { manaExpiryDate } from '@obolo/ledger';
import type { LedgerEntryView, WalletView } from '@obolo/shared';
import { desc, eq } from 'drizzle-orm';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { Database } from '../db/db';
import { earningsLedger, manaLedger, users, wallets } from '../db/schema';

/**
 * Earth wallet. 10/10 demo: DISPLAY ONLY — no top-up, no Stripe, no withdrawals (P-BILL-1).
 */
@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly db: Database) {}

  @Get()
  async get(@UserId() userId: string): Promise<WalletView> {
    // Primary, not replica: balances must reflect the user's own latest action.
    const db = this.db.write;
    const [[w], [u], mana, earnings] = await Promise.all([
      db.select().from(wallets).where(eq(wallets.userId, userId)),
      db.select({ lastActivityAt: users.lastActivityAt }).from(users).where(eq(users.id, userId)),
      db.select().from(manaLedger).where(eq(manaLedger.userId, userId)).orderBy(desc(manaLedger.createdAt)).limit(20),
      db.select().from(earningsLedger).where(eq(earningsLedger.userId, userId)).orderBy(desc(earningsLedger.createdAt)).limit(20),
    ]);
    const recent: LedgerEntryView[] = [
      ...mana.map((r) => ({ id: r.id, ledger: 'mana' as const, delta: r.delta, reason: r.reason, createdAt: r.createdAt.toISOString() })),
      ...earnings.map((r) => ({
        id: r.id,
        ledger: 'earnings' as const,
        delta: r.deltaJpy,
        reason: r.source,
        createdAt: r.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
    const manaBalance = w?.manaBalance ?? 0;
    return {
      manaBalance,
      earningsBalanceJpy: w?.earningsBalanceJpy ?? 0,
      manaExpiresAt: manaBalance > 0 && u ? manaExpiryDate(u.lastActivityAt).toISOString() : null,
      recent,
    };
  }
}
