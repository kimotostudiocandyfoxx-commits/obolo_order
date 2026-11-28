import { MockProvider } from '@obolo/ai';
import { HOME_PLANETS, KIND_HOME_PLANET, MADE_ON_MOON, PLANET_FLY_HOURS, type HomePlanet, type PlanetWorkKind } from '@obolo/shared';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AppConfig } from '../config';
import { GameService } from '../craft/game.service';
import { GoodsService } from '../craft/goods.service';
import { NovelService } from '../craft/novel.service';
import { Database } from '../db/db';
import { JupiterService } from '../jupiter/jupiter.service';
import { MoonWorksService } from '../moon/moon-works.service';
import { RadioService } from '../radio/radio.service';
import { SaturnService } from '../saturn/saturn.service';
import { moonOnly, planetIsMoonOnly } from './moon-only';
import { PlanetHomeService } from './planet-home.service';
import { PlanetPostsService } from './planet-posts.service';
import { PlanetWorksService } from './planet-works.service';

/**
 * 月で作る → 星, WITH THE SWITCH ON (PLANET_HOMES=new — docs/planets.md 「スイッチを入れる時の確認表」): all eight kinds, one
 * after the other, on a real Postgres. For each: the planet is Moon-only (the posting door of before answers 403
 * MADE_ON_MOON where the planet had one, the Moon's own call passes), the work flown from the Moon is in the maker's own
 * place on the planet's new home and in a ダチ's home, flying it again does not make a second one (one work = one post),
 * after 88 hours it has left the ダチ's home and stays in the maker's place, and the homecoming report tells it.
 * The switch itself changes no data and no feed: the same flights must give the same homes with it off (the last test).
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/obolo npx vitest run src/planets/moon-to-planet-switch.pg.test.ts
 */
const URL = process.env.TEST_DATABASE_URL;
const of = <T>(cls: { prototype: T }, deps: Record<string, unknown>): T => Object.assign(Object.create(cls.prototype as object), deps) as T;
const SWITCH = ['PLANET_HOMES', 'PLANET_HOMES_NEW', 'PLANET_HOMES_OLD'] as const;

interface Flight {
  /** the Moon's name of the kind (KIND_HOME_PLANET) */
  moon: keyof typeof KIND_HOME_PLANET;
  planet: HomePlanet;
  kind: PlanetWorkKind;
  /** the planet had a posting door of its own before (closed by the switch) */
  door: boolean;
  /** make it on the Moon and fly it: the id on the home, how to fly it again, where its 88 hours are kept */
  make: () => Promise<{ id: string; again: () => Promise<string>; table: string; col: string }>;
}

describe.skipIf(!URL)('月で作る → 星 with the switch on: all eight kinds (Postgres)', () => {
  let db: Database;
  let me = '';
  let dachi = '';
  const llm = new MockProvider();
  let works: PlanetWorksService;
  let home: PlanetHomeService;
  const before: Record<string, string | undefined> = {};

  const q = async <T = Record<string, unknown>>(s: ReturnType<typeof sql>) => ((await db.write.execute(s)) as unknown as { rows: T[] }).rows;
  const user = async (name: string) =>
    (await q<{ id: string }>(sql`INSERT INTO users (email, handle, display_name, onboarding_json) VALUES (${`${name}@m2ps.test`}, ${`m2ps_${name}`}, ${name}, '{"birthYear":1990}'::jsonb) RETURNING id`))[0].id;
  const wipe = async () => {
    const mine = sql`(SELECT id FROM users WHERE email LIKE '%@m2ps.test')`;
    for (const t of ['work_homecomings', 'planet_work_meta', 'planet_posts', 'jupiter_posts', 'jupiter_roots', 'saturn_posts', 'radio_shows', 'goods', 'books', 'games', 'mv_projects', 'mars_backstage', 'songs', 'planet_homes'])
      await db.write.execute(sql`DELETE FROM ${sql.raw(t)} WHERE user_id IN ${mine}`);
    await db.write.execute(sql`DELETE FROM follows WHERE follower_id IN ${mine} OR followee_id IN ${mine}`);
    await db.write.execute(sql`DELETE FROM users WHERE email LIKE '%@m2ps.test'`);
  };
  const setSwitch = (v: Partial<Record<(typeof SWITCH)[number], string>>) => {
    for (const k of SWITCH) {
      if (v[k] === undefined) delete process.env[k];
      else process.env[k] = v[k];
    }
  };

  beforeAll(async () => {
    for (const k of SWITCH) before[k] = process.env[k];
    db = new Database({ DATABASE_URL: URL!, DB_POOL_MAX: 4 } as AppConfig);
    await wipe();
    me = await user('me');
    dachi = await user('dachi');
    await db.write.execute(sql`INSERT INTO follows (follower_id, followee_id) VALUES (${me}, ${dachi}), (${dachi}, ${me})`);
    works = new PlanetWorksService(db, llm);
    home = new PlanetHomeService(db);
  });
  afterEach(() => setSwitch({}));
  afterAll(async () => {
    for (const k of SWITCH) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
    await wipe();
    await db.close();
  });

  const FLIGHTS: Flight[] = [
    {
      moon: 'voice',
      planet: 'saturn',
      kind: 'saturn_post',
      door: true,
      make: async () => {
        const [{ id }] = await q<{ id: string }>(sql`INSERT INTO saturn_posts (user_id, text, voice_audio_url, voice_duration_sec, room) VALUES (${me}, 'スイッチの こえ', 'https://x/sv.m4a', 5, 1) RETURNING id`);
        const saturn = of(SaturnService, { db });
        await saturn.publish(me, id);
        // a kororin already out cannot be flown a second time (it is not in the room any more): 404, and still one post
        const again = async () => {
          await expect(saturn.publish(me, id)).rejects.toMatchObject({ status: 404 });
          return id;
        };
        return { id, again, table: 'saturn_posts', col: 'created_at' };
      },
    },
    {
      moon: 'art',
      planet: 'jupiter',
      kind: 'jupiter_post',
      door: true,
      make: async () => {
        const [{ id: rootId }] = await q<{ id: string }>(sql`INSERT INTO jupiter_roots (user_id, kind, url, title) VALUES (${me}, 'photo', 'https://x/s-art.png', 'スイッチの絵') RETURNING id`);
        const jupiter = of(JupiterService, { db, llm, works });
        const fly = async () => (await jupiter.create(me, { rootId, text: '', filter: 'none', branch: 0 } as never)).id;
        return { id: await fly(), again: fly, table: 'jupiter_posts', col: 'created_at' };
      },
    },
    {
      moon: 'song',
      planet: 'mercury',
      kind: 'planet_post',
      door: true,
      make: async () => {
        const [{ id: songId }] = await q<{ id: string }>(
          sql`INSERT INTO songs (user_id, title, phrases_json, mix_json, direction_json, mix_url, seconds, design_json, instrumental_url, saved_at) VALUES (${me}, 'スイッチのうた', '[]', '{}', '{}', 'https://x/s-mix.m4a', 30, '{"bpm":120}', 'https://x/s-inst.m4a', now()) RETURNING id`,
        );
        const posts = new PlanetPostsService(db, {} as never, llm, works);
        const fly = async () => (await posts.create(me, 'mercury', { sourceId: songId, title: 'スイッチのうた', text: '' } as never, 'https://api')).id;
        return { id: await fly(), again: fly, table: 'planet_posts', col: 'created_at' };
      },
    },
    {
      moon: 'video',
      planet: 'mars',
      kind: 'planet_post',
      door: true,
      make: async () => {
        const [{ id: songId }] = await q<{ id: string }>(
          sql`INSERT INTO songs (user_id, title, phrases_json, mix_json, direction_json, mix_url, seconds, design_json, instrumental_url) VALUES (${me}, 'スイッチのMVのうた', '[]', '{}', '{}', 'https://x/s-mv-mix.m4a', 30, '{}', 'https://x/s-i.m4a') RETURNING id`,
        );
        const [{ id: backstageId }] = await q<{ id: string }>(sql`INSERT INTO mars_backstage (user_id, url, poster_url, title, seconds) VALUES (${me}, 'https://x/s-mv.mp4', 'https://x/s-mv.jpg', 'スイッチのMV', 30) RETURNING id`);
        await db.write.execute(sql`INSERT INTO mv_projects (user_id, song_id, backstage_id, video_url, poster_url, status) VALUES (${me}, ${songId}, ${backstageId}, 'https://x/s-mv.mp4', 'https://x/s-mv.jpg', 'done')`);
        const posts = new PlanetPostsService(db, {} as never, llm, works);
        const fly = async () => (await posts.create(me, 'mars', { sourceId: backstageId, title: '', text: '' } as never, 'https://api')).id;
        return { id: await fly(), again: fly, table: 'planet_posts', col: 'created_at' };
      },
    },
    {
      moon: 'radio',
      planet: 'venus',
      kind: 'radio_show',
      door: true,
      make: async () => {
        const [{ id }] = await q<{ id: string }>(
          sql`INSERT INTO radio_shows (user_id, audio_url, seconds, cues_json, title, thumb_url, status) VALUES (${me}, 'https://x/s-show.m4a', 60, '[]', 'スイッチのラジオ', 'https://x/s-show.jpg', 'private') RETURNING id`,
        );
        await works.tag('radio_show', id, { userId: me, planet: 'venus', tags: { main: null, moods: [] }, words: 'スイッチのラジオ' });
        const radio = of(RadioService, { db, showView: async (rows: unknown[]) => rows });
        await radio.publishShow(me, id, true);
        return { id, again: async () => (await radio.publishShow(me, id, true), id), table: 'radio_shows', col: 'published_at' };
      },
    },
    {
      moon: 'novel',
      planet: 'pluto',
      kind: 'book',
      door: false,
      make: async () => {
        const ch = { n: 1, title: '第1章', text: 'スイッチが、入った。', tags: [], at: new Date().toISOString(), summary: '' };
        const [{ id }] = await q<{ id: string }>(sql`INSERT INTO books (user_id, title, spell_json, chapters_json) VALUES (${me}, 'スイッチの本', '[]', ${JSON.stringify([ch])}::jsonb) RETURNING id`);
        const novel = of(NovelService, { db, works });
        await novel.fly(me, id, true);
        return { id, again: async () => (await novel.fly(me, id, true), id), table: 'books', col: 'flown_at' };
      },
    },
    {
      moon: 'game',
      planet: 'neptune',
      kind: 'game',
      door: false,
      make: async () => {
        const v = { code: 'game.v1()', title: 'スイッチのゲーム', howTo: 'タップ', tags: [], at: new Date().toISOString(), confirmId: 'c', kind: 'gameCheap' };
        const [{ id }] = await q<{ id: string }>(sql`INSERT INTO games (user_id, title, versions_json, active) VALUES (${me}, 'スイッチのゲーム', ${JSON.stringify([v])}::jsonb, 0) RETURNING id`);
        const game = of(GameService, { db, works });
        await game.fly(me, id, true);
        return { id, again: async () => (await game.fly(me, id, true), id), table: 'games', col: 'flown_at' };
      },
    },
    {
      moon: 'goods',
      planet: 'uranus',
      kind: 'goods',
      door: false,
      make: async () => {
        const [{ id: rootId }] = await q<{ id: string }>(sql`INSERT INTO jupiter_roots (user_id, kind, url, title) VALUES (${me}, 'photo', 'https://x/s-goods.png', 'スイッチ') RETURNING id`);
        const [{ id }] = await q<{ id: string }>(sql`INSERT INTO goods (user_id, kind, title, art_url, root_id) VALUES (${me}, 'マグカップ', 'スイッチマグカップ', 'https://x/s-goods.png', ${rootId}) RETURNING id`);
        const goods = of(GoodsService, { db, works });
        await goods.fly(me, id, true);
        return { id, again: async () => (await goods.fly(me, id, true), id), table: 'goods', col: 'flown_at' };
      },
    },
  ];

  it('the eight kinds are the eight planets, each once (the day table of handoff 09)', () => {
    expect(FLIGHTS.map((f) => f.planet).sort()).toEqual([...HOME_PLANETS].sort());
    for (const f of FLIGHTS) expect(KIND_HOME_PLANET[f.moon], f.moon).toBe(f.planet);
  });

  for (const f of FLIGHTS) {
    it(`PLANET_HOMES=new — ${f.moon} → ${f.planet}: the door of before is closed, the Moon's flight lands in the maker's own place, once; home after 88 hours and told`, async () => {
      setSwitch({ PLANET_HOMES: 'new' });
      expect(planetIsMoonOnly(f.planet)).toBe(true);
      // the posting door of the screen of before: 403 MADE_ON_MOON; the Moon's own call (via: 'moon') passes
      let refused: { status?: number; code?: string } | null = null;
      try {
        moonOnly(f.planet);
      } catch (e) {
        const err = e as { getStatus?: () => number; getResponse?: () => unknown };
        refused = { status: err.getStatus?.(), code: JSON.stringify(err.getResponse?.()).includes(MADE_ON_MOON) ? MADE_ON_MOON : undefined };
      }
      expect(refused, `${f.planet}: the door of before`).toEqual({ status: 403, code: MADE_ON_MOON });
      expect(() => moonOnly(f.planet, true)).not.toThrow();

      const w = await f.make();
      const mine = (await home.feed(me, f.planet)).own.filter((x) => x.id === w.id);
      expect(mine, `${f.planet}: in the maker's own place`).toHaveLength(1);
      expect(mine[0]).toMatchObject({ kind: f.kind, rel: 'own' });
      const theirs = (await home.feed(dachi, f.planet)).around.filter((x) => x.id === w.id);
      expect(theirs, `${f.planet}: in the ダチ's home`).toHaveLength(1);
      expect(theirs[0].rel).toBe('dachi');

      // flown again: the same post, not a second one (M-R331)
      const again = await w.again();
      expect(again).toBe(w.id);
      const own = (await home.feed(me, f.planet)).own;
      expect(own.filter((x) => x.id === w.id)).toHaveLength(1);
      expect(own, `${f.planet}: one work = one post`).toHaveLength(1);
      expect((await home.feed(dachi, f.planet)).around).toHaveLength(1);

      // 88 hours later: gone from the ダチ's home, still in the maker's place, and {bati} tells it came home
      await db.write.execute(sql`UPDATE ${sql.raw(w.table)} SET ${sql.raw(w.col)} = now() - make_interval(hours => ${PLANET_FLY_HOURS + 1}) WHERE id = ${w.id}`);
      expect((await home.feed(dachi, f.planet)).around).toHaveLength(0);
      expect((await home.feed(me, f.planet)).own.map((x) => x.id)).toEqual([w.id]);
      const moon = new MoonWorksService(db);
      const told = await moon.homecomings(me);
      expect(told.filter((h) => h.planet === f.planet), `${f.planet}: the homecoming report`).toHaveLength(1);
      // said once ({bati} tells a few at a time: the next kind's report must not wait behind this one)
      await moon.markTold(me, told.map((h) => h.key));
      expect((await moon.homecomings(me)).filter((h) => h.planet === f.planet)).toHaveLength(0);
    });
  }

  it('per planet: PLANET_HOMES_NEW opens the planets named (with the code’s Pluto), PLANET_HOMES_OLD keeps one back; nothing set: no door is closed', () => {
    setSwitch({ PLANET_HOMES_NEW: 'pluto,neptune,uranus' });
    for (const p of HOME_PLANETS) expect(planetIsMoonOnly(p), p).toBe(['pluto', 'neptune', 'uranus'].includes(p));
    expect(() => moonOnly('saturn')).not.toThrow();
    setSwitch({ PLANET_HOMES: 'new', PLANET_HOMES_OLD: 'venus' });
    for (const p of HOME_PLANETS) expect(planetIsMoonOnly(p), p).toBe(p !== 'venus');
    // nothing set (client 2026-11-28): only the code's list, PLANET_HOMES_ON_BY_DEFAULT — Pluto, which has no door of before
    setSwitch({});
    for (const p of HOME_PLANETS) expect(planetIsMoonOnly(p), p).toBe(p === 'pluto');
    for (const p of HOME_PLANETS.filter((x) => x !== 'pluto')) expect(() => moonOnly(p)).not.toThrow();
    setSwitch({ PLANET_HOMES_OLD: 'pluto' });
    for (const p of HOME_PLANETS) expect(() => moonOnly(p), p).not.toThrow();
  });

  it('the switch changes no data: with it off again, every home still shows the eight works in their makers’ places', async () => {
    setSwitch({});
    for (const f of FLIGHTS) expect((await home.feed(me, f.planet)).own, f.planet).toHaveLength(1);
  });
});
