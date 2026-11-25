import { lyricsEdit, lyricsFallback, MAKE_COST, songSpellKey, spellFrom, spellEdit, spellKey, type JobView, type MakeConfirm } from '@obolo/shared';
import { LedgerError } from '@obolo/ledger';
import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db/db';
import { startConfirmed } from './confirmed';
import { costScope } from './cost-scope';
import { setPriceSource } from './price-book';
import { LedgerService, type ManaEntryInput, type Tx } from './ledger.service';

/** the ledger's rules over an in-memory wallet (the DB primitives replaced; charge() itself is the real one) */
class MemLedger extends LedgerService {
  balance = 100;
  rows: ManaEntryInput[] = [];
  tenths = { pendingTenths: 0, rows: 0, takenMana: 0 };
  protected override async lockedBalance() {
    return this.balance;
  }
  protected override async tenthsRow() {
    return { ...this.tenths };
  }
  protected override async saveTenths(_tx: Tx, _u: string, v: { pendingTenths: number; rows: number; takenMana: number }) {
    this.tenths = v;
  }
  protected override async deltaOf(_tx: Tx, key: string) {
    return this.rows.find((r) => r.idempotencyKey === key)?.delta;
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
/** R17: what a member has spent, the waiting tenths counted (the quoted price is what is accounted) */
const spent = (l: MemLedger) => 100 - l.balance + l.tenths.pendingTenths / 10;
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

describe('R17: a price below 1 mana (to the tenth) is charged exactly', () => {
  it('0.3 three times, then 0.3 again: the whole mana is taken when the tenths reach 10, labelled with the kind', async () => {
    const l = new MemLedger();
    setPriceSource(async () => ({ ...MAKE_COST, jacketArt: 0.3 }));
    try {
      for (let k = 0; k < 4; k++) {
        const f = fakes();
        await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'jacketArt', confirm: { id: `7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6${k}`, price: 0.3 }, required: true });
      }
      // each yes is marked with a 0 row; the fourth 0.3 crosses 1.0 → one 'usage' row of 1 mana
      expect(l.rows.filter((r) => r.reason === 'generation').map((r) => r.delta)).toEqual([-0, -0, -0, -0]);
      expect(l.rows.filter((r) => r.reason === 'usage')).toMatchObject([{ delta: -1, refType: 'jacketArt' }]);
      expect(l.balance).toBe(99);
      expect(l.tenths.pendingTenths).toBe(2);
      expect(spent(l)).toBeCloseTo(1.2, 9);
    } finally {
      setPriceSource(null);
    }
  });
  it('12.5: 12 now, the .5 waits; a refund gives back exactly 12.5', async () => {
    const l = new MemLedger();
    setPriceSource(async () => ({ ...MAKE_COST, mv: 12.5 }));
    try {
      const fee = await l.charge(db, 'u1', 'mv', undefined, { confirm: { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e70', price: 12.5 }, required: true });
      expect(l.balance).toBe(88);
      expect(l.tenths.pendingTenths).toBe(5);
      await fee.refund();
      expect(l.balance).toBe(100);
      expect(l.tenths.pendingTenths).toBe(0);
      expect(spent(l)).toBeCloseTo(0, 9);
      // a later refund of a yes (a job that failed for good) is given back once, tenths too
      await l.charge(db, 'u1', 'mv', undefined, { confirm: { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e71', price: 12.5 }, required: true });
      expect(await l.refundYes(db, 'u1', 'mv', { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e71', price: 12.5 })).toBe(12.5);
      expect(await l.refundYes(db, 'u1', 'mv', { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e71', price: 12.5 })).toBe(0);
      expect(spent(l)).toBeCloseTo(0, 9);
    } finally {
      setPriceSource(null);
    }
  });
  it('a price below 1 needs at least one mana in the gem; refunded tenths below 0 are used up first', async () => {
    const l = new MemLedger();
    l.balance = 0;
    setPriceSource(async () => ({ ...MAKE_COST, story: 0.3 }));
    try {
      expect(await code(l.charge(db, 'u1', 'story', undefined, { confirm: { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e72', price: 0.3 }, required: true }))).toBe('402 NO_MANA');
      l.balance = 5;
      const a = await l.charge(db, 'u1', 'story', undefined, { confirm: { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e73', price: 0.3 }, required: true });
      await a.refund();
      expect(l.tenths.pendingTenths).toBe(0);
      await l.addTenths({} as Tx, 'u1', 'story', -3);
      expect(l.tenths.pendingTenths).toBe(-3);
      await l.addTenths({} as Tx, 'u1', 'story', 9);
      expect(l.tenths.pendingTenths).toBe(6);
      expect(l.balance).toBe(5);
    } finally {
      setPriceSource(null);
    }
  });
});

describe('R11: a paid making from the Moon atelier is charged only with the yes', () => {
  it('no confirm: 428, nothing charged, no job', async () => {
    const l = new MemLedger();
    const f = fakes();
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', required: true }))).toBe('428 CONFIRM_REQUIRED');
    expect(l.rows).toHaveLength(0);
    expect(l.balance).toBe(100);
    expect(f.made).toHaveLength(0);
  });
  it('the price charged is the price shown; another price is refused', async () => {
    const l = new MemLedger();
    const f = fakes();
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(1), required: true }))).toBe('409 PRICE_CHANGED');
    expect(l.rows).toHaveLength(0);
    const job = await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true });
    expect(job.id).toBe('job1');
    expect(l.rows.map((r) => r.delta)).toEqual([-Math.floor(MAKE_COST.song)]);
    expect(spent(l)).toBeCloseTo(MAKE_COST.song, 6);
  });
  it('the same yes twice (a double tap) is one charge and one job', async () => {
    const l = new MemLedger();
    const f = fakes();
    const a = await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true });
    const b = await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true });
    expect(b.id).toBe(a.id);
    expect(f.made).toEqual(['job1']);
    expect(l.rows).toHaveLength(1);
    expect(spent(l)).toBeCloseTo(MAKE_COST.song, 6);
  });
  it('not enough mana: 402, nothing charged, no job', async () => {
    const l = new MemLedger();
    l.balance = Math.ceil(MAKE_COST.song) - 1;
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
    expect(l.balance).toBe(100);
    expect(l.rows.map((x) => x.reason)).toEqual(['generation', 'refund']);
  });
  it('the yes is tied to the spell: the work is charged only with exactly that tag set', async () => {
    const l = new MemLedger();
    const f = fakes();
    const tags = spellFrom('song', '夏の海の明るい曲');
    const ok = { ...yes(), spell: spellKey('song', tags) };
    const changed = spellEdit('song', tags, 'ピアノは外して').tags;
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: ok, spell: spellKey('song', changed), required: true }))).toBe('409 SPELL_CHANGED');
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: ok, spell: null, required: true }))).toBe('409 SPELL_CHANGED');
    expect(l.rows).toHaveLength(0);
    await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: ok, spell: spellKey('song', tags), required: true });
    expect(l.rows).toHaveLength(1);
  });
  it('R13: a song’s yes covers its lyrics too — changed lyrics (even one tag) is another spell; price unchanged', async () => {
    const l = new MemLedger();
    const f = fakes();
    const tags = spellFrom('song', '夏の海の明るい曲');
    const lyrics = lyricsFallback(tags, 'Cメロも');
    const ok = { ...yes(), spell: songSpellKey(tags, lyrics)! };
    const other = lyricsEdit(lyrics, 'ささやきを外して')!.lyrics;
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: ok, spell: songSpellKey(tags, other), required: true }))).toBe('409 SPELL_CHANGED');
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: ok, spell: songSpellKey(tags, null), required: true }))).toBe('409 SPELL_CHANGED');
    expect(l.rows).toHaveLength(0);
    await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: ok, spell: songSpellKey(tags, lyrics), required: true });
    expect(l.rows).toHaveLength(1);
    expect(spent(l)).toBeCloseTo(MAKE_COST.song, 6);
  });
  it('client 2026-11-25: the live price (cost + fee + 8%) is what the yes must carry and what is charged', async () => {
    const l = new MemLedger();
    setPriceSource(async () => ({ ...MAKE_COST, song: 17 }));
    try {
      const f = fakes();
      // the fallback price is not the price now: refused, nothing taken
      if (MAKE_COST.song !== 17) expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(), required: true }))).toBe('409 PRICE_CHANGED');
      await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'song', confirm: yes(17), required: true });
      expect(l.rows.map((r) => r.delta)).toEqual([-17]);
      // and a refund gives back exactly what was taken
      const fee = await l.charge(db, 'u1', 'song');
      await fee.refund();
      expect(l.rows.map((r) => r.delta)).toEqual([-17, -17, 17]);
    } finally {
      setPriceSource(null);
    }
  });
  it('the charge marks the scope as that paid making (its costs are not small costs)', async () => {
    const l = new MemLedger();
    const seen = await costScope.run({ feature: 'songEdit', userId: 'u1' }, async () => {
      await l.charge(db, 'u1', 'song');
      return costScope.get();
    });
    expect(seen).toMatchObject({ kind: 'song', paid: true, userId: 'u1' });
    expect(seen?.job).toMatch(/^make:song:u1:/);
  });
  it('the planets’ own studios (not the atelier) keep charging as before', async () => {
    const l = new MemLedger();
    const fee = await l.charge(db, 'u1', 'song');
    expect(fee.repeat).toBe(false);
    expect(spent(l)).toBeCloseTo(MAKE_COST.song, 6);
  });
});
