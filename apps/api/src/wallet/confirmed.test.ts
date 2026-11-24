import { MAKE_COST, type JobView, type MakeConfirm } from '@obolo/shared';
import { LedgerError } from '@obolo/ledger';
import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db/db';
import { startConfirmed } from './confirmed';
import { LedgerService, type ManaEntryInput, type Tx } from './ledger.service';

/** the ledger's rules over an in-memory wallet (the DB primitives replaced; charge() itself is the real one) */
class MemLedger extends LedgerService {
  balance = 10;
  rows: ManaEntryInput[] = [];
  protected override async lockedBalance() {
    return this.balance;
  }
  protected override async applied(_tx: Tx, key: string) {
    return this.rows.some((r) => r.idempotencyKey === key);
  }
  override async applyMana(_tx: Tx, e: ManaEntryInput) {
    if (this.rows.some((r) => r.idempotencyKey === e.idempotencyKey)) return {} as never;
    if (this.balance + e.delta < 0) throw new LedgerError('INSUFFICIENT_BALANCE', 'negative');
    this.balance += e.delta;
    this.rows.push(e);
    return {} as never;
  }
}
const db = { write: { transaction: <T,>(fn: (tx: Tx) => Promise<T>) => fn({} as Tx) } } as unknown as Database;
const yes = (price: number = MAKE_COST.song): MakeConfirm => ({ id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f', price });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof HttpException ? `${e.getStatus()} ${(e.getResponse() as { error: { code: string } }).error.code}` : String(e);
  }
};

function fakes() {
  const kv = new Map<string, string>();
  let n = 0;
  const made: string[] = [];
  const job = (id: string) => ({ id, kind: 'song', status: 'queued' }) as JobView;
  return {
    made,
    kv: { get: async (k: string) => kv.get(k) ?? null, set: async (k: string, v: string) => void kv.set(k, v) },
    jobs: { get: async (_u: string, id: string) => job(id) },
    create: async () => {
      const id = `job${++n}`;
      made.push(id);
      return job(id);
    },
  };
}

describe('R11: a paid making from the Moon atelier is charged only with the yes', () => {
  it('no confirm: 428, nothing charged, no job', async () => {
    const l = new MemLedger();
    const f = fakes();
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', required: true }))).toBe('428 CONFIRM_REQUIRED');
    expect(l.rows).toHaveLength(0);
    expect(l.balance).toBe(10);
    expect(f.made).toHaveLength(0);
  });
  it('the price charged is the price shown; another price is refused', async () => {
    const l = new MemLedger();
    const f = fakes();
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(1), required: true }))).toBe('409 PRICE_CHANGED');
    expect(l.rows).toHaveLength(0);
    const job = await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true });
    expect(job.id).toBe('job1');
    expect(l.rows.map((r) => r.delta)).toEqual([-MAKE_COST.song]);
    expect(l.balance).toBe(10 - MAKE_COST.song);
  });
  it('the same yes twice (a double tap) is one charge and one job', async () => {
    const l = new MemLedger();
    const f = fakes();
    const a = await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true });
    const b = await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true });
    expect(b.id).toBe(a.id);
    expect(f.made).toEqual(['job1']);
    expect(l.rows).toHaveLength(1);
    expect(l.balance).toBe(10 - MAKE_COST.song);
  });
  it('not enough mana: 402, nothing charged, no job', async () => {
    const l = new MemLedger();
    l.balance = MAKE_COST.song - 1;
    const f = fakes();
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true }))).toBe('402 NO_MANA');
    expect(l.rows).toHaveLength(0);
    expect(f.made).toHaveLength(0);
  });
  it('a job that cannot be queued gives the mana back', async () => {
    const l = new MemLedger();
    const f = fakes();
    const r = await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'mv', confirm: yes(MAKE_COST.mv), required: true, create: async () => Promise.reject(new Error('queue down')) }));
    expect(r).toContain('queue down');
    expect(l.balance).toBe(10);
    expect(l.rows.map((x) => x.reason)).toEqual(['generation', 'refund']);
  });
  it('the planets’ own studios (not the atelier) keep charging as before', async () => {
    const l = new MemLedger();
    const fee = await l.charge(db, 'u1', 'song');
    expect(fee.repeat).toBe(false);
    expect(l.balance).toBe(10 - MAKE_COST.song);
  });
});
