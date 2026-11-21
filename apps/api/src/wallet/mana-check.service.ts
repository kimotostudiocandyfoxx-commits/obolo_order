import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { asc, eq, isNull } from 'drizzle-orm';
import { Database } from '../db/db';
import { manaLedger, wallets } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { LedgerService } from './ledger.service';
import { type ChainProblem, verifyChain } from './mana-chain';

export interface ManaCheckResult {
  checkedAt: string;
  users: number;
  rows: number;
  sealed: number;
  problems: { userId: string; problem: ChainProblem }[];
}

const DAY = 86400_000;

/**
 * The regular check of the mana ledger's hash chain (docs/工房とブルーナ_設計.md §15): once a day (one instance
 * only, by a day key in Redis) it first seals rows written before the chain, then walks every user's chain.
 * A problem is logged as an error for the team; nothing is repaired automatically. The team can also run it with
 * the admin token (POST /admin/mana/check).
 */
@Injectable()
export class ManaCheckService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('ManaCheck');
  private timer: ReturnType<typeof setInterval> | null = null;
  private first: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly db: Database,
    private readonly ledger: LedgerService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.first = setTimeout(() => void this.daily(), 90_000);
    this.timer = setInterval(() => void this.daily(), DAY / 4);
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  private async daily() {
    try {
      const day = new Date().toISOString().slice(0, 10);
      if ((await this.kv.incr(`mana-check:${day}`, 2 * 86400)) !== 1) return;
      const r = await this.run();
      if (r.problems.length) this.log.error(`mana ledger: ${r.problems.length} problem(s) in ${r.users} users — ${JSON.stringify(r.problems.slice(0, 20))}`);
      else this.log.log(`mana ledger ok: ${r.users} users, ${r.rows} rows (${r.sealed} sealed now)`);
    } catch (e) {
      this.log.error(`mana ledger check failed: ${String(e)}`);
    }
  }

  async run(): Promise<ManaCheckResult> {
    // 1. seal the rows written before the chain (per user, with the wallet locked like any ledger write)
    const open = await this.db.read.selectDistinct({ userId: manaLedger.userId }).from(manaLedger).where(isNull(manaLedger.hash));
    let sealed = 0;
    for (const { userId } of open) {
      await this.db.write.transaction(async (tx) => {
        await tx.select().from(wallets).where(eq(wallets.userId, userId)).for('update');
        await this.ledger.sealUser(tx, userId);
      });
      sealed++;
    }
    // 2. walk every chain
    const rows = await this.db.read.select().from(manaLedger).orderBy(asc(manaLedger.userId), asc(manaLedger.seq));
    const balances = new Map((await this.db.read.select({ userId: wallets.userId, mana: wallets.manaBalance }).from(wallets)).map((w) => [w.userId, w.mana]));
    const byUser = new Map<string, typeof rows>();
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    const problems: ManaCheckResult['problems'] = [];
    for (const [userId, list] of byUser) for (const problem of verifyChain(list, balances.get(userId) ?? null)) problems.push({ userId, problem });
    // a wallet with mana but no ledger rows at all
    for (const [userId, mana] of balances) if (!byUser.has(userId) && mana !== 0) problems.push({ userId, problem: { kind: 'wallet_mismatch', wallet: mana, ledger: 0 } });
    return { checkedAt: new Date().toISOString(), users: byUser.size, rows: rows.length, sealed, problems };
  }
}
