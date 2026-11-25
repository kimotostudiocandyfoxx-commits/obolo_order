import { BATI_NO_MANA_LINES, BATI_TIRED_LINES, type SpendState } from '@obolo/shared';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BuddyService } from '../buddy/buddy.service';
import type { AppConfig } from '../config';
import { buddyMessages, buddyProfiles, users, wallets } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { AccessService, SpendGate } from './access.service';

/** the API error's code and status */
const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? null);
const status = (e: unknown) => (e as { getStatus?: () => number }).getStatus?.() ?? null;
async function caught(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected a refusal');
}

function memKv(): KvStore & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return {
    m,
    get: async (k: string) => m.get(k) ?? null,
    set: async (k: string, v: string) => void m.set(k, v),
    incr: async (k: string) => {
      const n = Number(m.get(k) ?? 0) + 1;
      m.set(k, String(n));
      return n;
    },
  } as unknown as KvStore & { m: Map<string, string> };
}

/** a little database: select … from(table).where() → the table's rows; inserts kept */
function memDb(tables: Map<unknown, Record<string, unknown>[]>) {
  const inserted: { table: unknown; row: Record<string, unknown> }[] = [];
  const select = () => ({ from: (t: unknown) => ({ where: () => Promise.resolve(tables.get(t) ?? []) }) });
  const insert = (t: unknown) => ({
    values: (v: Record<string, unknown>) => {
      const row = { id: `r${inserted.length}`, createdAt: new Date(), ...v };
      inserted.push({ table: t, row });
      return { returning: async () => [row], onConflictDoNothing: async () => undefined };
    },
  });
  const db = { write: { select, insert, transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({ select, insert }) }, read: { select } };
  return { db, inserted };
}

const user = { id: 'u1', email: 'a@b.c', locale: 'ja', batiName: 'ポポ', displayName: 'ネオ', batiFood: null, orderedAt: null, subscriptionStatus: 'none', journeyDay: 9, journeyCompletedAt: null };
const cfg = { BUDDY_FREE_DAILY: 30, BUDDY_OVERAGE_ENABLED: false, BATI_DAILY_CAP_MEMBER: 300, DACHI_DAILY_CAP_FREE: 200, BUDDY_SEARCH_DAILY: 30, BUDDY_SEARCH_GLOBAL_DAILY: 5000, BUDDY_DRAW_DAILY: 10 } as AppConfig;
/** {bati}'s model: down (a reply that reaches it shows the gate let it through) */
const llm = { name: 'down', chat: async () => Promise.reject(new Error('down')), stream: async () => Promise.reject(new Error('down')) };

function buddy(st: SpendState) {
  const kv = memKv();
  const { db, inserted } = memDb(
    new Map<unknown, Record<string, unknown>[]>([
      [buddyProfiles, [{ userId: 'u1', buddyName: 'バティ', personaJson: {}, memorySummary: null }]],
      [users, [user]],
      [wallets, [{ manaBalance: st.balance }]],
    ]),
  );
  const access = { state: async () => st } as unknown as AccessService;
  const s = new BuddyService(cfg, kv, llm as never, { register: () => undefined, enqueue: async () => undefined } as never, db as never, {} as never, llm as never, {} as never, {} as never, undefined, access);
  return { s, kv, inserted };
}

const resident: SpendState = { member: false, journeyDay: 9, journeyCompletedAt: null, balance: 0 };
const member: SpendState = { member: true, journeyDay: 9, journeyCompletedAt: null, balance: 0 };

describe("R18: {bati}'s chat at 0 mana", () => {
  it('a non-member at 0: the gentle line once a day (kept in the talk, nothing spent), then a calm refusal', async () => {
    const { s, inserted, kv } = buddy(resident);
    expect((await s.getQuota('u1')).rest).toBeNull();
    const r = await s.chat('u1', 'あそぼう');
    expect(r.rest).toBe('noMana');
    expect(r.reply.text).toBe(BATI_NO_MANA_LINES.genki);
    expect(inserted.filter((i) => i.table === buddyMessages).map((i) => i.row.role)).toEqual(['user', 'buddy']);
    // the day's count is not used up by a refusal
    expect([...kv.m.keys()].some((k) => k.startsWith('buddy-q:'))).toBe(false);
    const e = await caught(s.chat('u1', 'ねえ'));
    expect(code(e)).toBe('BATI_NO_MANA');
    expect(status(e)).toBe(402);
    expect((await s.getQuota('u1')).rest).toBe('noMana');
  });
  it('a non-member with mana, or still on the first journey at 0, is not stopped', async () => {
    for (const st of [{ ...resident, balance: 3 }, { ...resident, journeyDay: 5 }]) {
      const { s } = buddy(st);
      expect(code(await caught(s.chat('u1', 'やあ', 'ja', undefined, '', { history: [] })))).toBe('BUDDY_UNAVAILABLE');
    }
  });
  it('a member at 0 is never stopped by mana, nor by the old 30 a day; past the cap {bati} is tired', async () => {
    const { s, kv } = buddy(member);
    const day = (k: string) => [...kv.m.keys()].find((x) => x.startsWith(k));
    // 40 replies today already (over BUDDY_FREE_DAILY): still answered (the model is reached)
    await caught(s.chat('u1', 'a', 'ja', undefined, '', { history: [] }));
    kv.m.set(day('buddy-q:')!, '40');
    expect(code(await caught(s.chat('u1', 'b', 'ja', undefined, '', { history: [] })))).toBe('BUDDY_UNAVAILABLE');
    expect((await s.getQuota('u1')).freeDaily).toBe(300);
    // at the cap: the tired line once, then a calm refusal
    kv.m.set(day('buddy-q:')!, '300');
    const r = await s.chat('u1', 'c');
    expect(r.rest).toBe('tired');
    expect(r.reply.text).toBe(BATI_TIRED_LINES.genki);
    const e = await caught(s.chat('u1', 'd'));
    expect(code(e)).toBe('BATI_TIRED');
    expect((await s.getQuota('u1')).rest).toBe('tired');
  });
});

describe('R18: what else stops, and ダチ', () => {
  function access(st: SpendState) {
    const kv = memKv();
    const u = { ...user, orderedAt: st.member ? new Date() : null, subscriptionStatus: st.member ? 'active' : 'none', journeyDay: st.journeyDay };
    const { db } = memDb(new Map<unknown, Record<string, unknown>[]>([[users, [u]], [wallets, [{ b: st.balance }]]]));
    return { a: new AccessService(db as never, kv, { DACHI_DAILY_CAP_FREE: 3 }), kv };
  }
  const ctx = (method: string, path: string) => ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({ method, path, userId: 'u1' }) }) }) as unknown as ExecutionContext;
  const next = { handle: () => 'handled' as never };

  it('a non-member at 0: making-side writes get NO_MANA; viewing, listening and ダチ pass', async () => {
    const gate = new SpendGate(access(resident).a);
    expect(code(await caught(gate.intercept(ctx('POST', '/compose/songs/s1/edit'), next)))).toBe('NO_MANA');
    expect(code(await caught(gate.intercept(ctx('POST', '/moon/spell'), next)))).toBe('NO_MANA');
    for (const [m, p] of [['GET', '/compose/songs/s1'], ['GET', '/mars/mv/v1'], ['GET', '/moon/works'], ['GET', '/buddy/messages'], ['POST', '/dachi/threads/x/messages'], ['GET', '/dachi/history']])
      expect(await gate.intercept(ctx(m, p), next)).toBe('handled');
  });
  it('a member at 0 passes everything', async () => {
    const gate = new SpendGate(access(member).a);
    expect(await gate.intercept(ctx('POST', '/compose/songs/s1/edit'), next)).toBe('handled');
  });
  it('ダチ: free at 0 mana; a non-member has a soft daily cap, a member none', async () => {
    const free = access(resident).a;
    for (let i = 0; i < 3; i++) await free.dachiSend('u1');
    const e = await caught(free.dachiSend('u1'));
    expect(code(e)).toBe('DACHI_DAILY_CAP');
    expect(status(e)).toBe(429);
    const paid = access(member).a;
    for (let i = 0; i < 10; i++) await paid.dachiSend('u1');
  });
});
