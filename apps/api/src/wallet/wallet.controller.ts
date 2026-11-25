import { Controller, Get, UseGuards } from '@nestjs/common';
import { manaExpiryDate } from '@obolo/ledger';
import { usageLineOf, type LedgerEntryView, type WalletView } from '@obolo/shared';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
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
      // R17: a 0 row only marks a yes to a price below 1 mana (its tenths come in the monthly line)
      db.select().from(manaLedger).where(and(eq(manaLedger.userId, userId), ne(manaLedger.reason, 'usage'), ne(manaLedger.delta, 0))).orderBy(desc(manaLedger.createdAt)).limit(20),
      db.select().from(earningsLedger).where(eq(earningsLedger.userId, userId)).orderBy(desc(earningsLedger.createdAt)).limit(20),
    ]);
    // client 2026-11-25: the small costs of the free features are many tiny rows — shown as one calm line a month
    // (「つかったマナ（おしゃべり・声など）」), never one per chat
    const month = sql<string>`to_char(${manaLedger.createdAt} at time zone 'Asia/Tokyo', 'YYYY-MM')`;
    const usage = await db
      .select({ month, refType: manaLedger.refType, delta: sql<number>`sum(${manaLedger.delta})`, last: sql<Date>`max(${manaLedger.createdAt})` })
      .from(manaLedger)
      .where(and(eq(manaLedger.userId, userId), eq(manaLedger.reason, 'usage')))
      .groupBy(month, manaLedger.refType)
      .orderBy(desc(month))
      .limit(60);
    // R17: one line a month per what it was for (「つかったマナ（絵）」, the free features' 「（おしゃべり・声など）」)
    const lines = new Map<string, { month: string; line: string; delta: number; last: Date }>();
    for (const u of usage) {
      const line = usageLineOf(u.refType);
      const k = `${u.month}:${line}`;
      const was = lines.get(k);
      const last = new Date(u.last);
      lines.set(k, { month: u.month, line, delta: (was?.delta ?? 0) + Number(u.delta), last: was && was.last > last ? was.last : last });
    }
    const months = [...new Set([...lines.values()].map((l) => l.month))].sort().reverse().slice(0, 3);
    const recent: LedgerEntryView[] = [
      ...mana.map((r) => ({ id: r.id, ledger: 'mana' as const, delta: r.delta, reason: r.reason, createdAt: r.createdAt.toISOString() })),
      ...[...lines.values()].filter((u) => months.includes(u.month)).map((u) => ({ id: `${u.line}-${u.month}`, ledger: 'mana' as const, delta: u.delta, reason: u.line, createdAt: u.last.toISOString() })),
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
