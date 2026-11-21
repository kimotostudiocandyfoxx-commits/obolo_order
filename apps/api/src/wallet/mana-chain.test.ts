import { describe, expect, it } from 'vitest';
import { type ChainRow, GENESIS, manaRowHash, verifyChain } from './mana-chain';

/** a well-formed chain of the given deltas for one user */
function chain(deltas: number[]): ChainRow[] {
  let prev = GENESIS;
  let bal = 0;
  return deltas.map((delta, i) => {
    bal += delta;
    const c = {
      userId: 'u1',
      seq: i + 1,
      delta,
      balanceAfter: bal,
      reason: delta > 0 ? 'monthly_grant' : 'generation',
      refType: null,
      refId: null,
      idempotencyKey: `k${i}`,
      createdAt: new Date(Date.UTC(2026, 10, 21, 0, i)),
    };
    const hash = manaRowHash(c, prev);
    const row = { id: `r${i}`, ...c, prevHash: prev, hash };
    prev = hash;
    return row;
  });
}

describe('mana ledger hash chain', () => {
  it('a chain written by the rules checks clean, wallet included', () => {
    expect(verifyChain(chain([88, -5, -10, 88]), 161)).toEqual([]);
  });

  it('the hash covers every field (changing any gives another hash)', () => {
    const [r] = chain([88]);
    const base = manaRowHash(r, GENESIS);
    for (const change of [{ delta: 89 }, { balanceAfter: 1 }, { reason: 'refund' }, { refId: 'x' }, { idempotencyKey: 'z' }, { createdAt: new Date(0) }, { seq: 2 }, { userId: 'u2' }])
      expect(manaRowHash({ ...r, ...change }, GENESIS)).not.toBe(base);
    expect(manaRowHash(r, 'f'.repeat(64))).not.toBe(base);
  });

  it('notices a changed amount', () => {
    const rows = chain([88, -5, -10]);
    rows[1] = { ...rows[1], delta: -1, balanceAfter: 87 };
    const kinds = verifyChain(rows, 73).map((p) => p.kind);
    expect(kinds).toContain('hash_mismatch');
  });

  it('notices a removed row', () => {
    const rows = chain([88, -5, -10]);
    rows.splice(1, 1);
    const kinds = verifyChain(rows, 73).map((p) => p.kind);
    expect(kinds).toEqual(expect.arrayContaining(['seq_gap', 'link_broken', 'balance_mismatch']));
  });

  it('notices a row slipped in with a recomputed hash (the next link breaks)', () => {
    const rows = chain([88, -5]);
    const fake = { ...rows[1], id: 'fake', seq: 2, delta: 100, balanceAfter: 188, idempotencyKey: 'fake' };
    fake.hash = manaRowHash(fake, rows[0].hash!);
    const tampered = [rows[0], fake, { ...rows[1], seq: 3 }];
    expect(verifyChain(tampered, 183).map((p) => p.kind)).toContain('link_broken');
  });

  it('notices a wallet that differs from the ledger', () => {
    expect(verifyChain(chain([88]), 500)).toEqual([{ kind: 'wallet_mismatch', wallet: 500, ledger: 88 }]);
  });

  it('reports rows not sealed yet', () => {
    const rows = chain([88]);
    rows[0] = { ...rows[0], hash: null, prevHash: null };
    expect(verifyChain(rows, 88)).toEqual([{ kind: 'unsealed', seq: 1 }]);
  });
});
