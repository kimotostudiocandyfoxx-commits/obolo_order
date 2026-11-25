import { GIB, STORAGE_LINES, tierPrices } from '@obolo/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../config';
import type { Database } from '../db/db';
import type { KvStore } from '../infra/kv';
import { LedgerService } from '../wallet/ledger.service';
import { checkRoom, setStorageGate } from './storage-gate';
import { triesOf, urlsIn } from './storage-works.service';
import { PgStorageStore, StorageService, type PlanRow, type StorageStore, type TakeResult } from './storage.service';

const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string; message?: string } } }).getResponse?.().error?.code ?? null);
async function caught(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected a refusal');
}

const cfg = {
  STORAGE_MEMBER_GB: 5,
  STORAGE_FREE_GB: 1,
  STORAGE_GB_MONTH_USD: 0.015,
  STORAGE_CLASS_A_PER_GB: 100,
  STORAGE_CLASS_B_PER_GB: 1000,
  STORAGE_GRACE_DAYS: 7,
  STORAGE_PRICE_MONTHS: 12,
  STRIPE_FEE_RATE: 0.036,
  STRIPE_FEE_FIXED_JPY: 0,
  STRIPE_FEE_BASE_JPY: 88,
  MANA_MARGIN: 0.08,
  FX_USD_JPY: 160,
} as AppConfig;

/** a store in memory: the bytes, the member, the plan, a wallet with its ledger keys */
class MemStore implements StorageStore {
  usedBytes = 0;
  isMember = true;
  row: PlanRow | null = null;
  balance = 100;
  keys = new Map<string, number>();
  async used() {
    return this.usedBytes;
  }
  async member() {
    return this.isMember;
  }
  async plan() {
    return this.row ? { ...this.row } : null;
  }
  async savePlan(_u: string, p: Partial<PlanRow>) {
    this.row = { ...(this.row ?? { tierGb: null, paidMonth: null, cancelled: false, graceUntil: null, lapsedAt: null, told: {} }), ...p };
  }
  async due(month: string) {
    return this.row?.tierGb && (!this.row.paidMonth || this.row.paidMonth < month) ? ['u1'] : [];
  }
  async take(_u: string, key: string, mana: number): Promise<TakeResult> {
    if (this.keys.has(key)) return 'repeat';
    if (this.balance < mana) return 'short';
    this.balance -= mana;
    this.keys.set(key, mana);
    return 'charged';
  }
}

function service() {
  const store = new MemStore();
  const s = new StorageService({} as Database, new LedgerService(), cfg, {} as KvStore).useStore(store);
  return { s, store };
}
const NOV = new Date('2026-11-20T03:00:00Z');
const DEC1 = new Date('2026-12-01T01:00:00Z');
const PRICES = tierPrices();
const p10 = PRICES.find((t) => t.gb === 10)!.mana;
const yes = (price: number, id = '00000000-0000-4000-8000-000000000001') => ({ id, price });

afterEach(() => setStorageGate(null));

describe('R18: the room (member / non-member / expanded)', () => {
  it('member 5 GB, non-member 1 GB, expanded +10 GB', async () => {
    const { s, store } = service();
    expect((await s.status('u1', NOV)).quotaBytes).toBe(5 * GIB);
    store.isMember = false;
    expect((await s.status('u1', NOV)).quotaBytes).toBe(1 * GIB);
    await s.expand('u1', { gb: 10, confirm: yes(p10) }, NOV);
    const v = await s.status('u1', NOV);
    expect(v.quotaBytes).toBe(11 * GIB);
    expect(v.extraGb).toBe(10);
    expect(v.tiers).toEqual(PRICES);
  });

  it('100%: a file that does not fit and a paid making are refused with the full line; a DELETE is never stopped', async () => {
    const { s, store } = service();
    store.usedBytes = 5 * GIB - 100;
    await s.assertRoom('u1', 50);
    const e = await caught(s.assertRoom('u1', 200));
    expect(code(e)).toBe('STORAGE_QUOTA');
    expect((e as { getResponse: () => { error: { message: string } } }).getResponse().error.message).toBe(STORAGE_LINES.full);
    store.usedBytes = 5 * GIB;
    s.onModuleInit();
    expect(code(await caught(checkRoom('u1')))).toBe('STORAGE_QUOTA');
    // the ledger asks before charging a making
    expect(code(await caught(new LedgerService().charge({} as Database, 'u1', 'song')))).toBe('STORAGE_QUOTA');
    s.onModuleDestroy();
    await checkRoom('u1');
  });

  it('80%: said once, again only after going well below it', async () => {
    const { s, store } = service();
    store.usedBytes = 4.2 * GIB;
    expect((await s.status('u1', NOV)).say).toBe('near');
    await s.told('u1', 'near');
    expect((await s.status('u1', NOV)).say).toBeNull();
    expect((await s.status('u1', NOV)).level).toBe('near');
    store.usedBytes = 3 * GIB;
    expect((await s.status('u1', NOV)).say).toBeNull();
    store.usedBytes = 4.5 * GIB;
    expect((await s.status('u1', NOV)).say).toBe('near');
  });
});

describe('R18: 保存の魔法 — purchase, renewal, grace, lapse, cancel', () => {
  it('a yes charges a full month at the price said, once', async () => {
    const { s, store } = service();
    const r = await s.expand('u1', { gb: 10, confirm: yes(p10) }, NOV);
    expect(r.status).toBe('charged');
    expect(store.balance).toBeCloseTo(100 - p10, 6);
    expect(store.row).toMatchObject({ tierGb: 10, paidMonth: '2026-11' });
    // the same tier this month: nothing more
    expect((await s.expand('u1', { gb: 10, confirm: yes(p10, '00000000-0000-4000-8000-000000000002') }, NOV)).status).toBe('already');
    expect(store.balance).toBeCloseTo(100 - p10, 6);
  });

  it('another price than the live one, or too little mana: nothing is charged', async () => {
    const { s, store } = service();
    expect(code(await caught(s.expand('u1', { gb: 10, confirm: yes(p10 + 1) }, NOV)))).toBe('PRICE_CHANGED');
    store.balance = 5;
    expect(code(await caught(s.expand('u1', { gb: 10, confirm: yes(p10) }, NOV)))).toBe('NO_MANA');
    expect(store.row?.tierGb ?? null).toBeNull();
  });

  it('renewed at the start of the month (the daily run)', async () => {
    const { s, store } = service();
    await s.expand('u1', { gb: 10, confirm: yes(p10) }, NOV);
    expect(await s.renewAll(NOV)).toEqual({});
    expect(await s.renewAll(DEC1)).toEqual({ renewed: 1 });
    expect(store.row?.paidMonth).toBe('2026-12');
    expect(store.balance).toBeCloseTo(100 - 2 * p10, 6);
    // once a month
    expect(await s.renewAll(new Date('2026-12-02T01:00:00Z'))).toEqual({});
  });

  it('mana short: 7 days of grace with the notice once, then the tier lapses (files kept; over the room, new saves stop)', async () => {
    const { s, store } = service();
    store.isMember = false;
    await s.expand('u1', { gb: 10, confirm: yes(p10) }, NOV);
    store.usedBytes = 3 * GIB;
    store.balance = 1;
    expect(await s.renewAll(DEC1)).toEqual({ grace: 1 });
    const g = await s.status('u1', new Date('2026-12-02T00:00:00Z'));
    expect(g.say).toBe('grace');
    expect(g.extraGb).toBe(10);
    await s.told('u1', 'grace');
    expect((await s.status('u1', new Date('2026-12-03T00:00:00Z'))).say).toBeNull();
    // still waiting within the grace
    expect(await s.renewAll(new Date('2026-12-05T00:00:00Z'))).toEqual({ waiting: 1 });
    expect(await s.renewAll(new Date('2026-12-08T02:00:00Z'))).toEqual({ lapsed: 1 });
    const l = await s.status('u1', new Date('2026-12-08T03:00:00Z'));
    expect(l.say).toBe('lapsed');
    expect(l.quotaBytes).toBe(1 * GIB);
    expect(l.level).toBe('full');
    expect(code(await caught(s.assertRoom('u1', 10)))).toBe('STORAGE_QUOTA');
    await s.told('u1', 'lapsed');
    expect((await s.status('u1', new Date('2026-12-09T00:00:00Z'))).say).toBeNull();
  });

  it('mana bought within the grace: renewed', async () => {
    const { s, store } = service();
    await s.expand('u1', { gb: 10, confirm: yes(p10) }, NOV);
    store.balance = 1;
    await s.renewAll(DEC1);
    store.balance = 50;
    expect(await s.renewAll(new Date('2026-12-04T00:00:00Z'))).toEqual({ renewed: 1 });
    expect(store.row).toMatchObject({ paidMonth: '2026-12', graceUntil: null, tierGb: 10 });
  });

  it('「保存の魔法をやめて」: the month stays, the next month lapses without a charge', async () => {
    const { s, store } = service();
    expect((await s.cancel('u1', NOV)).cancelled).toBe(false);
    await s.expand('u1', { gb: 30, confirm: yes(PRICES[1].mana) }, NOV);
    const before = store.balance;
    expect((await s.cancel('u1', NOV)).cancelled).toBe(true);
    expect((await s.status('u1', NOV)).extraGb).toBe(30);
    expect(await s.renewAll(DEC1)).toEqual({ lapsed: 1 });
    expect(store.balance).toBe(before);
    expect((await s.status('u1', DEC1)).quotaBytes).toBe(5 * GIB);
  });
});

describe('R18: counting and freeing', () => {
  it('counts every stored file of the member and the text of their books and games (deleted ones not)', async () => {
    let q = '';
    const db = { write: { execute: async (x: { queryChunks?: unknown[] }) => ((q = JSON.stringify(x)), { rows: [{ used: '1234' }] }) } } as unknown as Database;
    expect(await new PgStorageStore(db, new LedgerService()).used('u1')).toBe(1234);
    for (const t of ['media_objects', 'size_bytes', 'books', 'chapters_json', 'games', 'versions_json', 'deleted_at IS NULL']) expect(q).toContain(t);
  });
  it('the files a thrown-away work points at, and its other tries', () => {
    expect(urlsIn('{"mix_url":"https://cdn.x/a.m4a","phrases":[{"url":"https://cdn.x/b.mp3"}],"x":"https://cdn.x/a.m4a"}')).toEqual(['https://cdn.x/a.m4a', 'https://cdn.x/b.mp3']);
    expect(triesOf([{ ref: { kind: 'song', id: 'a' } }, { ref: { kind: 'song', id: 'b' } }, { ref: null }, { ref: { kind: 'local', id: 'c' } }, { ref: { kind: 'song', id: 'b' } }], { kind: 'song', id: 'a' })).toEqual([{ kind: 'song', id: 'b' }]);
  });
});
