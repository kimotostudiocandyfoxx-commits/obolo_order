/**
 * A check of the mana cost tables on a real Postgres (client 2026-11-25, docs/マナの値段.md): migrations, the small
 * costs taken a whole mana at a time inside the ledger's chain, absorbed at 0, FX per month and the margin report.
 * Writes test rows — run it only against a scratch database:
 *   DATABASE_URL=postgres://… npx --yes tsx@4.19.2 apps/api/scripts/check-mana-costs.ts
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { loadConfig } from '../src/config';
import { Database } from '../src/db/db';
import { runMigrations } from '../src/db/migrate';
import { manaLedger, users, wallets } from '../src/db/schema';
import { CostService } from '../src/wallet/cost.service';
import { LedgerService } from '../src/wallet/ledger.service';
import { verifyChain } from '../src/wallet/mana-chain';

async function main() {
  const cfg = loadConfig();
  const db = new Database(cfg);
  await runMigrations(db.primaryPool);
  const ledger = new LedgerService();
  const kv = { get: async () => null, set: async () => undefined, incr: async () => 1, close: async () => undefined };
  const costs = new CostService(db, ledger, cfg, kv);
  const id = randomUUID();
  await db.write.insert(users).values({ id, email: `${id}@test`, handle: id.slice(0, 12), displayName: 't' });
  await db.write.insert(wallets).values({ userId: id, manaBalance: 0 });
  await db.write.transaction((tx) => ledger.applyMana(tx, { userId: id, delta: 3, reason: 'admin_adjust', idempotencyKey: `t:${id}` }));

  // 100 chat replies of ¥0.035: ¥3.5 → 3 whole mana taken (3.5 / 0.964 × 1.08 = 3.92), the rest waits
  for (let i = 0; i < 100; i++) await costs.recordNow({ provider: 'claude', model: 'claude-haiku-5-5', usd: 0.035 / 160, exact: true }, { userId: id, feature: 'chat' });
  const [w] = await db.read.select().from(wallets).where(eq(wallets.userId, id));
  const rows = await db.read.select().from(manaLedger).where(eq(manaLedger.userId, id));
  console.log('balance after small costs', w.manaBalance, 'usage rows', rows.filter((r) => r.reason === 'usage').map((r) => r.delta));
  if (w.manaBalance !== 0) throw new Error('expected 0');
  // at 0 mana: still recorded, absorbed, never negative
  const step = await costs.accrue(id, 'voice', 5);
  console.log('at 0 mana', step);
  if (step.take !== 0 || step.absorbedMana < 1) throw new Error('expected absorbed');
  const problems = verifyChain(await db.read.select().from(manaLedger).where(eq(manaLedger.userId, id)).orderBy(manaLedger.seq), 0);
  console.log('chain problems', problems.length);
  if (problems.length) throw new Error(JSON.stringify(problems));

  await costs.setFx('2099-01', 155, 'test');
  console.log('fx now', await costs.fx());
  await costs.recordNow({ provider: 'runware', model: 'runware:400@4', usd: 0.0144, exact: true }, { userId: id, feature: 'videoEdit', kind: 'mv', job: `job:${id}`, paid: true });
  console.log('prices', await costs.prices());
  const r = await costs.report(1);
  console.log(r.lines.join('\n'));
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
