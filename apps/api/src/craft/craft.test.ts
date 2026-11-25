import { HttpException } from '@nestjs/common';
import { demoGame, MAKE_COST, NOVEL_CHAPTERS_PER_DAY, spellEdit, spellFrom, spellKey, spellOfAnswers, type JobView, type MakeConfirm } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db/db';
import { books, games } from '../db/schema';
import { startConfirmed } from '../wallet/confirmed';
import { LedgerService, type ManaEntryInput, type Tx } from '../wallet/ledger.service';
import { checkGameCode, GameService, wordsInCode, type GameJobInput } from './game.service';
import { NovelService } from './novel.service';

/** a tiny stand-in for the drizzle chains these services use (one member: the where() is not evaluated) */
function fakeDb() {
  const tables = new Map<unknown, Record<string, unknown>[]>([
    [books, []],
    [games, []],
  ]);
  let n = 0;
  const rows = (t: unknown) => tables.get(t)!;
  const chain = (get: () => Promise<unknown>) => {
    const p: Record<string, unknown> = {};
    for (const k of ['where', 'orderBy', 'limit', 'for']) p[k] = () => p;
    p.then = (ok: (v: unknown) => unknown, no: (e: unknown) => unknown) => get().then(ok, no);
    return p;
  };
  const api = {
    select: () => ({ from: (t: unknown) => chain(async () => rows(t).filter((r) => !r.deletedAt)) }),
    insert: (t: unknown) => ({
      values: (v: Record<string, unknown>) => ({
        returning: async () => {
          const at = new Date(Date.now() + n);
          const row = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, coverUrl: null, done: false, active: 0, homePlanet: t === books ? 'pluto' : 'neptune', flownAt: null, createdAt: at, updatedAt: at, deletedAt: null, ...v };
          rows(t).push(row);
          return [row];
        },
      }),
    }),
    update: (t: unknown) => ({
      set: (s: Record<string, unknown>) => {
        const run = async () => {
          for (const r of rows(t)) Object.assign(r, s);
          return rows(t);
        };
        const w = { returning: run, then: (ok: (v: unknown) => unknown) => run().then(ok) };
        return { where: () => w };
      },
    }),
  };
  const db = { read: api, write: { ...api, transaction: <T,>(fn: (tx: Tx) => Promise<T>) => fn({} as Tx) } } as unknown as Database;
  return { db, tables };
}
const kv = () => {
  const m = new Map<string, number>();
  return { incr: async (k: string) => (m.set(k, (m.get(k) ?? 0) + 1), m.get(k)!), get: async () => null, set: async () => undefined } as never;
};
const mock = { name: 'mock', chat: async () => 'OK' };
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof HttpException ? (e.getResponse() as { error: { code: string } }).error.code : String(e);
  }
};

class MemLedger extends LedgerService {
  balance = 40;
  rows: ManaEntryInput[] = [];
  protected override async lockedBalance() {
    return this.balance;
  }
  protected override async applied(_tx: Tx, key: string) {
    return this.rows.some((r) => r.idempotencyKey === key);
  }
  protected override async deltaOf(_tx: Tx, key: string) {
    return this.rows.find((r) => r.idempotencyKey === key)?.delta;
  }
  override async applyMana(_tx: Tx, e: ManaEntryInput) {
    if (this.rows.some((r) => r.idempotencyKey === e.idempotencyKey)) return {} as never;
    this.balance += e.delta;
    this.rows.push(e);
    return {} as never;
  }
}

describe('本: a book chapter by chapter (free, capped a day, checked words)', () => {
  const book = spellOfAnswers('novel', [{ group: 'world', said: '魔法の森' }, { group: 'hero', said: '猫' }]);
  it('the first spell makes the book and chapter 1; each chapter spell adds the next; the final one ends it', async () => {
    const { db } = fakeDb();
    const s = new NovelService(mock as never, mock as never, db, kv());
    const b1 = await s.chapter('u1', { tags: book });
    expect(b1.chapters).toHaveLength(1);
    expect(b1.chapters[0].text).toContain('魔法の森');
    expect(b1.tags).toEqual(book);
    const b2 = await s.chapter('u1', { bookId: b1.id, tags: spellFrom('chapter', '新しい仲間') });
    expect(b2.chapters.map((c) => c.n)).toEqual([1, 2]);
    expect(b2.chapters[1].tags.map((t) => t.ja)).toEqual(['新しい仲間']);
    const b3 = await s.chapter('u1', { bookId: b1.id, tags: spellFrom('chapter', '最後の章にして') });
    expect(b3.done).toBe(true);
    expect(await code(s.chapter('u1', { bookId: b1.id, tags: spellFrom('chapter', 'おまかせ') }))).toBe('BOOK_FULL');
    // no summaries leak out (they are the writer's notes)
    expect(JSON.stringify(b3)).not.toContain('summary');
  });
  it(`${NOVEL_CHAPTERS_PER_DAY} chapters a day, then {bati}'s 「また明日」`, async () => {
    const { db } = fakeDb();
    const s = new NovelService(mock as never, mock as never, db, kv());
    for (let i = 0; i < NOVEL_CHAPTERS_PER_DAY; i++) await s.chapter('u1', { tags: book });
    expect(await code(s.chapter('u1', { tags: book }))).toBe('CHAPTER_LIMIT');
  });
  it('words that are not allowed stop it before anything is written', async () => {
    const { db, tables } = fakeDb();
    let asked = 0;
    const s = new NovelService({ name: 'x', chat: async () => (asked++, '{}') } as never, mock as never, db, kv());
    expect(await code(s.chapter('u1', { tags: [{ ja: '殺す', en: 'kill', group: 'theme' }] }))).toBe('MODERATION');
    expect(asked).toBe(0);
    expect(tables.get(books)).toHaveLength(0);
  });
  it("the model's chapter is used; one too short is written again; the output is checked too", async () => {
    const { db } = fakeDb();
    const answers = [JSON.stringify({ text: '短い' }), JSON.stringify({ title: '森の鈴', chapterTitle: 'はじまり', text: 'あ'.repeat(1800), summary: '猫が鈴を見つける' })];
    const s = new NovelService({ name: 'gemini', chat: async () => answers.shift()! } as never, mock as never, db, kv());
    const b = await s.chapter('u1', { tags: book });
    expect(b.title).toBe('森の鈴');
    expect(b.home).toBe('pluto');
    expect(b.chapters[0].title).toBe('はじまり');
    const bad = new NovelService({ name: 'gemini', chat: async () => JSON.stringify({ title: 'x', chapterTitle: '殺す', text: 'あ'.repeat(900) }) } as never, mock as never, fakeDb().db, kv());
    expect(await code(bad.chapter('u1', { tags: book }))).toBe('MODERATION');
  });
});

describe('ゲーム: code checked, one repair round, mana back when it fails', () => {
  const tags = spellOfAnswers('game', [{ group: 'genre', said: '集める' }, { group: 'hero', said: '猫' }]);
  const yes: MakeConfirm = { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f', price: MAKE_COST.game, spell: spellKey('game', tags) };
  const input: GameJobInput = { tags, confirm: yes, kind: 'game', from: 'atelier' };
  const good = demoGame(tags).code;

  it('network code and code that does not parse are refused (the sandbox is the real guard)', () => {
    expect(checkGameCode(good).ok).toBe(true);
    expect(checkGameCode(good.replace('var p, things', "fetch('//x'); var p, things"))).toEqual({ ok: false, reason: 'network access' });
    expect(checkGameCode(good.replace('var p, things', 'new WebSocket(1); var p, things'))).toEqual({ ok: false, reason: 'network access' });
    expect(checkGameCode('function game(G) { return { update: function ( { } }; }').ok).toBe(false);
    expect(wordsInCode(good)).toContain('ゲームオーバー');
  });
  it('a refused answer goes back once with the reason; the second answer is kept', async () => {
    const { db, tables } = fakeDb();
    const seen: string[] = [];
    const answers = [JSON.stringify({ title: 'x', howTo: 'y', code: "function game(G) { fetch('/a'); return {}; }" }), JSON.stringify({ title: 'ねこキャッチ', howTo: '星を集めよう', code: good })];
    const llm = { name: 'gemini', chat: async (r: { history: { text: string }[] }) => (seen.push(r.history.at(-1)!.text), answers.shift()!) };
    const s = new GameService(llm as never, mock as never, db, new MemLedger(), kv());
    const g = await s.make('u1', input);
    expect(g.home).toBe('neptune');
    expect(g.title).toBe('ねこキャッチ');
    expect(g.code).toBe(good);
    expect(seen[1]).toMatch(/rejected: network access/);
    expect(tables.get(games)).toHaveLength(1);
    // refused twice: VALIDATION (the job does not try again; it gives the mana back)
    const bad = new GameService({ name: 'gemini', chat: async () => JSON.stringify({ code: 'alert(1)' }) } as never, mock as never, fakeDb().db, new MemLedger(), kv());
    expect(await code(bad.make('u1', input))).toBe('VALIDATION');
  });
  it('a tweak is a new version made from the previous code; the face is the newest', async () => {
    const { db } = fakeDb();
    let prompt = '';
    const s = new GameService({ name: 'gemini', chat: async (r: { history: { text: string }[] }) => ((prompt = r.history[0].text), JSON.stringify({ title: 't', howTo: 'h', code: good })) } as never, mock as never, db, new MemLedger(), kv());
    const g = await s.make('u1', input);
    const harder = spellEdit('game', tags, 'もっと難しく').tags;
    const g2 = await s.make('u1', { ...input, gameId: g.id, tags: harder, kind: 'gameTweak', confirm: { ...yes, price: MAKE_COST.gameTweak } });
    expect(g2.version).toBe(1);
    expect(prompt).toContain('Previous code:');
    expect(g2.tags.find((t) => t.group === 'level')?.ja).toBe('むずかしい');
  });
  it('charged once per yes (12 first, 3 a tweak); a failed build and a game that does not run give the mana back, once', async () => {
    const l = new MemLedger();
    const { db } = fakeDb();
    const job = { id: 'j1', kind: 'game', status: 'queued' } as JobView;
    const f = { kv: { get: async () => null, set: async () => undefined }, jobs: { get: async () => job }, create: async () => job };
    // the tweak's price on a first build: nothing charged
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'game', confirm: { ...yes, price: MAKE_COST.gameTweak }, spell: yes.spell, required: true }))).toBe('PRICE_CHANGED');
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'game', confirm: yes, spell: 'another-spell', required: true }))).toBe('SPELL_CHANGED');
    await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'game', confirm: yes, spell: yes.spell, required: true });
    // the same yes again (a double tap): no second charge
    expect(await code(startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'game', confirm: yes, spell: yes.spell, required: true }))).toBe('ALREADY_STARTED');
    expect(l.balance).toBe(40 - MAKE_COST.game);
    const s = new GameService(mock as never, mock as never, db, l, kv());
    expect(await s.refundJob('u1', input)).toBe(MAKE_COST.game);
    expect(await s.refundJob('u1', input)).toBe(0);
    expect(l.balance).toBe(40);
    // a yes never charged gives nothing back
    expect(await s.refundJob('u1', { ...input, confirm: { ...yes, id: '00000000-0000-4000-8000-000000000001' } })).toBe(0);
  });
  it("「動かなかった」: the version's mana back (soon after, once), the face back to the one that ran", async () => {
    const l = new MemLedger();
    const { db, tables } = fakeDb();
    const s = new GameService(mock as never, mock as never, db, l, kv());
    const job = { id: 'j1', kind: 'game', status: 'queued' } as JobView;
    const f = { kv: { get: async () => null, set: async () => undefined }, jobs: { get: async () => job }, create: async () => job };
    await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'game', confirm: yes, spell: yes.spell, required: true });
    const g = await s.make('u1', input);
    const tweak = { id: '11111111-2b4c-4d5e-8f90-1a2b3c4d5e6f', price: MAKE_COST.gameTweak };
    await startConfirmed({ ledger: l, db, ...f, userId: 'u1', kind: 'gameTweak', confirm: tweak, spell: null, required: false });
    await s.make('u1', { ...input, gameId: g.id, kind: 'gameTweak', confirm: tweak });
    expect(l.balance).toBe(40 - MAKE_COST.game - MAKE_COST.gameTweak);
    expect(await s.broken('u1', g.id, { version: 1, reason: 'TypeError' })).toEqual({ refunded: MAKE_COST.gameTweak });
    expect(await s.broken('u1', g.id, { version: 1, reason: 'TypeError' })).toEqual({ refunded: 0 });
    expect((tables.get(games)![0] as { active: number }).active).toBe(0);
    // long after it was built: no refund
    const row = tables.get(games)![0] as { versionsJson: { at: string }[] };
    row.versionsJson[0].at = new Date(Date.now() - 3600_000).toISOString();
    expect(await s.broken('u1', g.id, { version: 0, reason: 'x' })).toEqual({ refunded: 0 });
  });
});
