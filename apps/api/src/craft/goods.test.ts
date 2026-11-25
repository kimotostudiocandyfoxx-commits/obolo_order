import { HttpException } from '@nestjs/common';
import { GOODS_PER_DAY, spellFrom } from '@obolo/shared';
import { PgDialect } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../db/db';
import { runMigrations } from '../db/migrate';
import { books, follows, games, goods, jupiterRoots, planetWorkMeta, users } from '../db/schema';
import { PlanetHomeService } from '../planets/planet-home.service';
import { workSeenWhere } from '../planets/planet-songs.service';
import { goodsFacts } from './craft.store';
import { GameService } from './game.service';
import { GoodsService } from './goods.service';
import { NovelService } from './novel.service';

/**
 * Story session 2026-11-25: グッズ (a kind + one of your arts, free, Uranus' store), a game's case picture, and item 6 —
 * a book / a game kept 'dachi' is never opened by a stranger it has not drifted to (GET /moon/books/:id, /moon/games/:id).
 */
const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(q);
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof HttpException ? (e.getResponse() as { error: { code: string } }).error.code : String(e);
  }
};
const mock = { name: 'mock', chat: async () => 'OK' };
const kv = () => {
  const m = new Map<string, number>();
  return { incr: async (k: string) => (m.set(k, (m.get(k) ?? 0) + 1), m.get(k)!), get: async () => null, set: async () => undefined } as never;
};

describe('グッズ: its tags and who may open a book / a game / a goods item from the planet (always run: the SQL)', () => {
  it('a goods item is tagged with its kind, then its art’s style and moods', () => {
    const f = goodsFacts({ userId: 'u', kind: 'マグカップ', title: '夕焼けマグカップ' }, spellFrom('art', '水彩の夕焼け、やさしい'));
    expect(f).toMatchObject({ planet: 'uranus', tags: { main: 'マグカップ' }, words: '夕焼けマグカップ' });
    expect(f.tags.moods.length).toBeGreaterThan(0);
  });
  it('item 6: a stranger reaches a flown work only through a continent, and a continent reads public works only', () => {
    for (const planet of ['pluto', 'neptune', 'uranus'] as const) {
      const q = render(workSeenWhere('stranger', planet));
      // three ways in: the maker; dachi / 推し (the viewer follows the maker); the continents (public, check passed)
      const own = q.sql.indexOf('"user_id" = $');
      const reach = q.sql.indexOf('JOIN follows g ON g.follower_id = f.followee_id');
      const cont = q.sql.indexOf(`= 'public' AND "planet_work_meta"."check_state" = 'ok'`);
      expect(own, planet).toBeGreaterThan(-1);
      expect(reach, planet).toBeGreaterThan(own);
      expect(cont, planet).toBeGreaterThan(reach);
      expect(q.sql.match(/ OR /g)?.length, planet).toBeGreaterThanOrEqual(2);
    }
  });
});

/**
 * The same, against a real Postgres (the migrations applied, the services' own queries): run with TEST_DATABASE_URL
 * (CI sets it to its Postgres service; locally e.g. postgres://postgres:postgres@localhost:5432/obolo_test).
 */
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('on Postgres: goods, a game case, and a dachi work never opened by a stranger', () => {
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    db = new Database({ DATABASE_URL: url!, DB_POOL_MAX: 3 } as never);
    await runMigrations(db.primaryPool);
    for (const who of ['maker', 'dachi', 'stranger', 'fan']) {
      const [u] = await db.write
        .insert(users)
        .values({ email: `${who}-${run}@test.invalid`, handle: `${who}${run}`, displayName: who, onboardingJson: { birthYear: '1995' } })
        .returning({ id: users.id });
      ids[who] = u.id;
    }
    // maker ⇄ dachi (mutual); fan → maker (the maker is the fan's 推し); the stranger follows nobody
    await db.write.insert(follows).values([
      { followerId: ids.maker, followeeId: ids.dachi },
      { followerId: ids.dachi, followeeId: ids.maker },
      { followerId: ids.fan, followeeId: ids.maker },
    ]);
    const [root] = await db.write.insert(jupiterRoots).values({ userId: ids.maker, kind: 'photo', url: `https://cdn.test/${run}/art.png`, title: '星の森', spellJson: spellFrom('art', '水彩の森') }).returning();
    const [other] = await db.write.insert(jupiterRoots).values({ userId: ids.stranger, kind: 'photo', url: `https://cdn.test/${run}/x.png`, title: 'よその絵' }).returning();
    ids.root = root.id;
    ids.otherRoot = other.id;
  });
  afterAll(async () => {
    await db?.close();
  });

  const svcs = () => ({
    novels: new NovelService(mock as never, mock as never, db, kv()),
    games: new GameService(mock as never, mock as never, db, {} as never, kv()),
    goods: new GoodsService(db, kv(), mock as never),
  });
  const flownDachiWork = async () => {
    const at = new Date();
    const [b] = await db.write.insert(books).values({ userId: ids.maker, title: '夜の学校', spellJson: [], chaptersJson: [{ n: 1, title: '第1章', text: 'はじまり', tags: [], at: at.toISOString(), summary: '' }], flownAt: at }).returning();
    const [g] = await db.write.insert(games).values({ userId: ids.maker, title: 'ねこパズル', versionsJson: [{ code: 'x', title: 'ねこパズル', howTo: '', tags: [], at: at.toISOString(), confirmId: 'c', kind: 'game' }], flownAt: at }).returning();
    // kept dachi by its maker (the check passed): no continent carries it
    await db.write.insert(planetWorkMeta).values([
      { kind: 'book', workId: b.id, userId: ids.maker, planet: 'pluto', visibility: 'dachi', checkState: 'ok' },
      { kind: 'game', workId: g.id, userId: ids.maker, planet: 'neptune', visibility: 'dachi', checkState: 'ok' },
    ]);
    return { book: b.id, game: g.id };
  };

  it('item 6: a dachi book / game flown — the maker, a dachi and a 推し fan open it; a stranger gets 404', async () => {
    const s = svcs();
    const w = await flownDachiWork();
    for (const who of ['maker', 'dachi', 'fan']) {
      expect(await code(s.novels.read(ids[who], w.book)), who).toBe('ok');
      expect(await code(s.games.play(ids[who], w.game)), who).toBe('ok');
    }
    expect(await code(s.novels.read(ids.stranger, w.book))).toBe('NOT_FOUND');
    expect(await code(s.games.play(ids.stranger, w.game))).toBe('NOT_FOUND');
  });

  it('item 2: a flown book is read live — a chapter written after it flew is there for the dachi, its home row is not a copy', async () => {
    const s = svcs();
    const b = await s.novels.chapter(ids.maker, { tags: spellFrom('novel', '魔法の森の猫') });
    await s.novels.fly(ids.maker, b.id);
    expect((await s.novels.read(ids.dachi, b.id)).chapters).toHaveLength(1);
    await s.novels.chapter(ids.maker, { bookId: b.id, tags: spellFrom('chapter', '新しい仲間') });
    expect((await s.novels.read(ids.dachi, b.id)).chapters).toHaveLength(2);
    const home = await new PlanetHomeService(db).feed(ids.dachi, 'pluto');
    expect(home.around.find((x) => x.id === b.id)).toMatchObject({ title: b.title });
  });

  it('item 6: not flown (kept on the Moon) — only the maker; the dachi too gets 404', async () => {
    const s = svcs();
    const [b] = await db.write.insert(books).values({ userId: ids.maker, title: '月の本', spellJson: [], chaptersJson: [] }).returning();
    expect(await code(s.novels.read(ids.maker, b.id))).toBe('ok');
    expect(await code(s.novels.read(ids.dachi, b.id))).toBe('NOT_FOUND');
    expect(await code(s.novels.read(ids.stranger, b.id))).toBe('NOT_FOUND');
  });

  it('goods: made from your own art only (free, at once), named from the art, tagged; flown it is on Uranus for your dachi', async () => {
    const s = svcs();
    expect(await code(s.goods.make(ids.maker, { kind: 'トート', rootId: ids.otherRoot }))).toBe('NOT_FOUND');
    const g = await s.goods.make(ids.maker, { kind: 'トート', rootId: ids.root });
    expect(g).toMatchObject({ kind: 'トート', title: '星の森トート', artUrl: `https://cdn.test/${run}/art.png`, flownAt: null, home: 'uranus' });
    // not flown: only the maker
    expect(await code(s.goods.read(ids.dachi, g.id))).toBe('NOT_FOUND');
    expect((await s.goods.fly(ids.maker, g.id)).flownAt).not.toBeNull();
    expect(await code(s.goods.read(ids.dachi, g.id))).toBe('ok');
    expect(await code(s.goods.read(ids.stranger, g.id))).toBe('NOT_FOUND');
    const home = await new PlanetHomeService(db).feed(ids.dachi, 'uranus');
    expect(home.live).toBe(true);
    expect(home.around.find((x) => x.id === g.id)).toMatchObject({ text: 'トート', title: '星の森トート', thumbUrl: `https://cdn.test/${run}/art.png` });
    // 外す: back to the Moon
    await new PlanetHomeService(db).takeOut(ids.maker, 'uranus', g.id);
    expect(await code(s.goods.read(ids.dachi, g.id))).toBe('NOT_FOUND');
    // someone else cannot fly yours
    expect(await code(s.goods.fly(ids.stranger, g.id))).toBe('NOT_FOUND');
  });

  it(`goods: ${GOODS_PER_DAY} a day, then GOODS_LIMIT`, async () => {
    const s = new GoodsService(db, kv(), mock as never);
    for (let i = 0; i < GOODS_PER_DAY; i++) await s.make(ids.maker, { kind: 'ステッカー', rootId: ids.root });
    expect(await code(s.make(ids.maker, { kind: 'ステッカー', rootId: ids.root }))).toBe('GOODS_LIMIT');
    const rows = await db.read.select({ id: goods.id }).from(goods);
    expect(rows.length).toBeGreaterThanOrEqual(GOODS_PER_DAY);
  });

  it('a game case: one of your own arts (not someone else’s), or null for the neon face; Neptune shows it', async () => {
    const s = svcs();
    const w = await flownDachiWork();
    expect(await code(s.games.cover(ids.maker, w.game, ids.otherRoot))).toBe('NOT_FOUND');
    expect(await code(s.games.cover(ids.stranger, w.game, ids.root))).toBe('NOT_FOUND');
    expect((await s.games.cover(ids.maker, w.game, ids.root)).cover).toBe(`https://cdn.test/${run}/art.png`);
    const home = await new PlanetHomeService(db).feed(ids.dachi, 'neptune');
    expect(home.around.find((x) => x.id === w.game)?.thumbUrl).toBe(`https://cdn.test/${run}/art.png`);
    expect((await s.games.cover(ids.maker, w.game, null)).cover).toBeNull();
  });
});
