import { createHash } from 'node:crypto';

/**
 * The mana ledger's hash chain (client decision 2026-11-21, docs/工房とブルーナ_設計.md §15).
 * Mana is an ordinary point (no blockchain, no coin). The ledger is append-only; to notice a row that was
 * changed, removed or slipped in afterwards, each user's rows are chained: hash = SHA-256 of the row's content
 * and the previous row's hash. A check walks every chain (and compares the wallet's cached balance).
 * Not published anywhere for now.
 */

export interface ChainRow {
  id: string;
  userId: string;
  seq: number | null;
  delta: number;
  balanceAfter: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  prevHash: string | null;
  hash: string | null;
}

/** the first row of every chain links to this */
export const GENESIS = '0'.repeat(64);

/** SHA-256 over the row's content, one field per line, in a fixed order (any change gives another hash) */
export function manaRowHash(r: Omit<ChainRow, 'id' | 'hash' | 'prevHash'>, prevHash: string): string {
  const body = ['mana/v1', r.userId, String(r.seq), String(r.delta), String(r.balanceAfter), r.reason, r.refType ?? '', r.refId ?? '', r.idempotencyKey, r.createdAt.toISOString(), prevHash].join('\n');
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export type ChainProblem =
  | { kind: 'unsealed'; seq: number | null }
  | { kind: 'seq_gap'; seq: number | null; expected: number }
  | { kind: 'link_broken'; seq: number }
  | { kind: 'hash_mismatch'; seq: number }
  | { kind: 'balance_mismatch'; seq: number }
  | { kind: 'wallet_mismatch'; wallet: number; ledger: number };

/**
 * Checks one user's chain, rows in seq order. Finds rows that were changed (hash), removed or inserted (seq / link),
 * running balances that do not add up, and a wallet balance that differs from the last row.
 */
export function verifyChain(rows: ChainRow[], walletBalance: number | null): ChainProblem[] {
  const out: ChainProblem[] = [];
  let prev = GENESIS;
  let balance = 0;
  rows.forEach((r, i) => {
    const expected = i + 1;
    if (r.seq !== expected) out.push({ kind: 'seq_gap', seq: r.seq, expected });
    if (!r.hash || !r.prevHash) {
      out.push({ kind: 'unsealed', seq: r.seq });
    } else {
      if (r.prevHash !== prev) out.push({ kind: 'link_broken', seq: expected });
      if (manaRowHash(r, r.prevHash) !== r.hash) out.push({ kind: 'hash_mismatch', seq: expected });
    }
    if (balance + r.delta !== r.balanceAfter) out.push({ kind: 'balance_mismatch', seq: expected });
    balance = r.balanceAfter;
    prev = r.hash ?? prev;
  });
  if (walletBalance !== null && walletBalance !== balance) out.push({ kind: 'wallet_mismatch', wallet: walletBalance, ledger: balance });
  return out;
}
