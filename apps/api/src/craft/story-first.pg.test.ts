import { HttpException } from '@nestjs/common';
import { ABSORBED_FEATURES, CAST_OSHI_KEYS, CastSaveBody, PLANET_FLY_HOURS } from '@obolo/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppConfig } from '../config';
import { StoryService } from '../buddy/story.service';
import { Database } from '../db/db';
import { runMigrations } from '../db/migrate';
import { MoonWorksService } from '../moon/moon-works.service';
import { CastChoicesService } from '../planets/cast-choices.service';
import { PlanetHomeService } from '../planets/planet-home.service';
import { PlanetWorksService } from '../planets/planet-works.service';
import { featureOfPath } from '../wallet/cost-scope';
import { LedgerService } from '../wallet/ledger.service';
import { GameService } from './game.service';
import { NovelService } from './novel.service';
import { StoryFirstService } from './story-first.service';

/**
 * Client 2026-11-28: the first journey's own book (day 8) and game (day 9) made real — free, once per member and kind,
 * only on their own day — and flown from the Moon like any Moon-made work (the member's own place, a ダチ's home for 88
 * hours, the homecoming report). And the cast choices: ♡ off / on for a resident, ☆ a cast work, kept apart from the
 * members' bluena_saves (the homecoming report and the ★ counters do not see them).
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/obolo npx vitest run src/craft/story-first.pg.test.ts
 */
const URL = process.env.TEST_DATABASE_URL;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof HttpException ? (e.getResponse() as { error: { code: string } }).error.code : String(e);
  }
};

describe('the story-first book and game, and the cast choices (always run: the cost rules)', () => {
  it('what they cost is filed under storyFirst, which the operator absorbs', () => {
    expect(featureOfPath('/moon/story-first/book')).toBe('storyFirst');
    expect(featureOfPath('/moon/story-first/game')).toBe('storyFirst');
    expect(ABSORBED_FEATURES).toContain('storyFirst');
  });
  it('the residents are the eighteen oshi (not the two ダチ); only a cast work’s home id can be ☆-saved', () => {
    expect(CAST_OSHI_KEYS).toHaveLength(18);
    expect(CAST_OSHI_KEYS).not.toContain('kimorin');
    expect(CastSaveBody.safeParse({ id: 'cast-croco-pluto', on: true }).success).toBe(true);
    expect(CastSaveBody.safeParse({ id: 'cast-kimorin-saturn', on: true }).success).toBe(true);
    for (const id of ['cast-nobody-pluto', 'cast-croco-earth', '00000000-0000-4000-8000-000000000001']) expect(CastSaveBody.safeParse({ id, on: true }).success, id).toBe(false);
  });
});

describe.skipIf(!URL)('the story-first book and game, and the cast choices (Postgres)', () => {
  let db: Database;
  let me = '';
  let dachi = '';
  let other = '';
  /** the short story's writer and the words check: canned (a page per sentence), its calls counted */
  const calls: string[] = [];
  const llm = {
    name: 'fake',
    chat: async (r: { system?: string; json?: boolean }) => {
      calls.push(r.system?.slice(0, 20) ?? '');
      if (r.json) return JSON.stringify({ title: 'たこ焼きの旅', pages: [{ text: 'たこ焼きが、屋台から転がり落ちた。', scene: 'yatai' }, { text: '宇宙の果てまで、旅をした。', scene: 'space' }], chapterTitle: 'x', text: '' });
      return 'OK';
    },
  };
  let first: StoryFirstService;
  let games: GameService;
  let home: PlanetHomeService;
  const q = async <T = Record<string, unknown>>(s: ReturnType<typeof sql>) => ((await db.write.execute(s)) as unknown as { rows: T[] }).rows;
  const user = async (name: string, day: number) =>
    (await q<{ id: string }>(sql`INSERT INTO users (email, handle, display_name, journey_day, onboarding_json) VALUES (${`${name}@sf.test`}, ${`sf_${name}`}, ${name}, ${day}, '{"birthYear":1990}'::jsonb) RETURNING id`))[0].id;
  const wipe = async () => {
    const mine = sql`(SELECT id FROM users WHERE email LIKE '%@sf.test')`;
    for (const t of ['story_first_works', 'cast_choices', 'bluena_saves', 'work_homecomings', 'planet_work_meta', 'books', 'games', 'mana_ledger', 'gen_costs', 'wallets', 'planet_homes'])
      await db.write.execute(sql`DELETE FROM ${sql.raw(t)} WHERE user_id IN ${mine}`);
    await db.write.execute(sql`DELETE FROM follows WHERE follower_id IN ${mine} OR followee_id IN ${mine}`);
    await db.write.execute(sql`DELETE FROM users WHERE email LIKE '%@sf.test'`);
  };
  const ledgerRows = async (id: string) => Number((await q<{ n: string }>(sql`SELECT count(*)::text AS n FROM mana_ledger WHERE user_id = ${id}`))[0].n);
  const setDay = (id: string, day: number) => db.write.execute(sql`UPDATE users SET journey_day = ${day} WHERE id = ${id}`);

  beforeAll(async () => {
    db = new Database({ DATABASE_URL: URL!, DB_POOL_MAX: 4 } as AppConfig);
    await runMigrations(db.primaryPool);
    await wipe();
    me = await user('me', 8);
    dachi = await user('dachi', 12);
    other = await user('other', 7);
    await db.write.execute(sql`INSERT INTO follows (follower_id, followee_id) VALUES (${me}, ${dachi}), (${dachi}, ${me})`);
    const works = new PlanetWorksService(db, llm as never);
    const ledger = new LedgerService();
    // the trial chain's values: none (the catch template's own words)
    games = new GameService(llm as never, llm as never, db, ledger, {} as never, undefined, { name: 'mock', chat: async () => '' } as never, works);
    first = new StoryFirstService(db, new StoryService(llm as never, db, ledger), games, works);
    home = new PlanetHomeService(db);
  });
  afterAll(async () => {
    await wipe();
    await db.close();
  });

  it('day 8: the story’s book is a real book of the member — free (no ledger row), once; asked again it is the same book', async () => {
    expect(await code(first.book(other, { cards: ['たこ焼き'] })), 'not on day 8').toBe('NOT_STORY_DAY');
    expect(await code(first.game(me, { cards: ['音符'] })), 'the game is day 9').toBe('NOT_STORY_DAY');
    const b = await first.book(me, { cards: ['たこ焼き', '宇宙'], said: 'たこ焼きが宇宙を旅する話' });
    expect(b.again).toBe(false);
    expect(b.book).toMatchObject({ title: 'たこ焼きの旅', home: 'pluto' });
    expect(b.book.chapters).toHaveLength(1);
    expect(b.pages.map((p) => p.text)).toEqual(['たこ焼きが、屋台から転がり落ちた。', '宇宙の果てまで、旅をした。']);
    expect(await ledgerRows(me), 'never charged').toBe(0);
    const n = calls.length;
    const again = await first.book(me, { cards: ['ちがう話'] });
    expect(again).toMatchObject({ again: true, book: { id: b.book.id } });
    expect(again.pages).toHaveLength(2);
    expect(calls.length, 'nothing written again').toBe(n);
    expect((await q(sql`SELECT * FROM books WHERE user_id = ${me}`)).length).toBe(1);
  });

  it('the book flies from the Moon to Pluto: the member’s own place, a ダチ’s home for 88 hours, the homecoming report', async () => {
    const [{ work_id: id }] = await q<{ work_id: string }>(sql`SELECT work_id FROM story_first_works WHERE user_id = ${me} AND kind = 'book'`);
    const novels = new NovelService(llm as never, llm as never, db, {} as never, new PlanetWorksService(db, llm as never));
    await novels.fly(me, id, true);
    await novels.fly(me, id, true);
    expect((await home.feed(me, 'pluto')).own.map((w) => w.id), 'one work = one post').toEqual([id]);
    expect((await home.feed(dachi, 'pluto')).around.filter((w) => w.id === id)).toHaveLength(1);
    await db.write.execute(sql`UPDATE books SET flown_at = now() - make_interval(hours => ${PLANET_FLY_HOURS + 1}) WHERE id = ${id}`);
    expect((await home.feed(dachi, 'pluto')).around.filter((w) => w.id === id)).toHaveLength(0);
    expect((await new MoonWorksService(db).homecomings(me)).filter((h) => h.planet === 'pluto')).toHaveLength(1);
  });

  it('day 9: the story’s game is a real catch game — free, once, not the Moon’s trial; thrown away it is not made again', async () => {
    await setDay(me, 9);
    expect(await code(first.book(me, { cards: ['x'] })), 'the book made on day 8 comes back, nothing new').toBe('ok');
    expect(await games.firstGame(me)).toBe(true);
    const g = await first.game(me, { cards: ['音符', 'コロリン'], title: '音符のゲーム' });
    expect(g.again).toBe(false);
    expect(g.game).toMatchObject({ title: '音符のゲーム', home: 'neptune' });
    expect(g.game.code.length).toBeGreaterThan(100);
    expect(await ledgerRows(me)).toBe(0);
    // the Moon's trial is still the member's (the story's game does not use it up)
    expect(await games.firstGame(me)).toBe(true);
    expect((await first.game(me, { cards: ['別'] })).game.id).toBe(g.game.id);
    await games.fly(me, g.game.id, true);
    expect((await home.feed(me, 'neptune')).own.map((w) => w.id)).toEqual([g.game.id]);
    expect((await home.feed(dachi, 'neptune')).around.map((w) => w.id)).toContain(g.game.id);
    // thrown away: the free path is not taken twice
    await db.write.execute(sql`UPDATE games SET deleted_at = now() WHERE id = ${g.game.id}`);
    expect(await code(first.game(me, { cards: ['もう一回'] }))).toBe('STORY_FIRST_USED');
    expect((await q(sql`SELECT * FROM games WHERE user_id = ${me}`)).length).toBe(1);
  });

  it('two at once make one; a making that fails lets the claim go (the member can try again on the day)', async () => {
    await setDay(other, 8);
    const both = await Promise.allSettled([first.book(other, { cards: ['a'] }), first.book(other, { cards: ['b'] })]);
    const ok = both.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect((await q(sql`SELECT * FROM books WHERE user_id = ${other}`)).length).toBe(1);
    await setDay(other, 9);
    const broken = new StoryFirstService(db, new StoryService(llm as never, db, new LedgerService()), { makeStoryFirst: async () => Promise.reject(new Error('down')) } as never);
    expect(await code(broken.game(other, { cards: ['x'] }))).toBe('Error: down');
    expect((await q(sql`SELECT * FROM story_first_works WHERE user_id = ${other} AND kind = 'game'`)).length).toBe(0);
    expect((await first.game(other, { cards: ['x'] })).again).toBe(false);
  });

  it('the cast: every resident is oshi until ♡ is taken off; ☆ keeps a cast work apart from the members’ saves', async () => {
    const cast = new CastChoicesService(db);
    expect(await cast.view(me)).toEqual({ unoshi: [], saved: [] });
    expect((await cast.oshi(me, { key: 'croco', on: false })).unoshi).toEqual(['croco']);
    expect((await cast.oshi(me, { key: 'croco', on: false })).unoshi, 'twice: still one').toEqual(['croco']);
    expect((await cast.oshi(me, { key: 'croco', on: true })).unoshi).toEqual([]);
    await cast.oshi(me, { key: 'sapon', on: false });
    const saved = await cast.save(me, { id: 'cast-croco-pluto', on: true });
    expect(saved.saved.map((s) => s.id)).toEqual(['cast-croco-pluto']);
    expect((await cast.view(dachi)).saved, 'per member').toEqual([]);
    expect((await q(sql`SELECT * FROM bluena_saves WHERE user_id = ${me}`)).length, 'not a member’s work: not in bluena_saves').toBe(0);
    expect((await new MoonWorksService(db).homecomings(me)).every((h) => !String(h.key).includes('cast-'))).toBe(true);
    expect((await cast.save(me, { id: 'cast-croco-pluto', on: false })).saved).toEqual([]);
    expect((await cast.view(me)).unoshi).toEqual(['sapon']);
  });
});
