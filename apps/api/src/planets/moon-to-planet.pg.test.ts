import { MockProvider } from '@obolo/ai';
import { KIND_HOME_PLANET, PLANET_FIGURE_OF, PLANET_FLY_HOURS, type HomePlanet, type HomeWork, type PlanetWorkKind } from '@obolo/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SongRetitleService } from '../compose/song-retitle.service';
import { SongTweakService } from '../compose/song-tweak.service';
import { MoonWorksService } from '../moon/moon-works.service';
import { followMv } from './mv-follow';
import type { AppConfig } from '../config';
import { GameService } from '../craft/game.service';
import { GoodsService } from '../craft/goods.service';
import { NovelService } from '../craft/novel.service';
import { Database } from '../db/db';
import { FindsService } from '../finds/finds.service';
import { JupiterService } from '../jupiter/jupiter.service';
import { RadioService } from '../radio/radio.service';
import { SaturnService } from '../saturn/saturn.service';
import { StorageWorksService } from '../storage/storage-works.service';
import { ContinentsService } from './continents.service';
import { PlanetHomeService } from './planet-home.service';
import { PlanetPostsService } from './planet-posts.service';
import { PlanetSongsService } from './planet-songs.service';
import { PlanetWorksService } from './planet-works.service';

/**
 * 月で作る → 星 (client request with M-R326, docs/planets.md "月で作る → 星"): for each of the eight kinds a work made on the
 * Moon is flown with the endpoint 〔星へ飛ばす〕 calls, and must then be on the NEW home of its planet (GET
 * /planet-home/:planet) — in the maker's own place, in a ダチ's home with the maker's figure and what the opener needs,
 * and, once public and checked, among the planet's continents' works — follow a change made on the Moon afterwards,
 * leave everyone's place after 88 hours, and be gone when taken out (外す) or thrown away.
 *
 * The feed is SQL, so this runs on a real Postgres with every migration applied (the query-builder stand-ins of the other
 * tests cannot show that a row appears). Skipped without one:
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/obolo npx vitest run src/planets/moon-to-planet.pg.test.ts
 */
const URL = process.env.TEST_DATABASE_URL;
const of = <T>(cls: { prototype: T }, deps: Record<string, unknown>): T => Object.assign(Object.create(cls.prototype as object), deps) as T;

describe.skipIf(!URL)('月で作る → 星: each kind made, flown, shown, changed, taken out (Postgres)', () => {
  let db: Database;
  let me = '';
  let dachi = '';
  let stranger = '';
  const LOOK = 'https://x/look-me.png';
  const FIGURES = { saturnChibi: 'https://x/f-chibi.png', saturnBall: 'https://x/f-ball.png', jupiter: 'https://x/f-jupiter.png', 'jupiter#wings': '20,76', mercury: 'https://x/f-mercury.png', mars: 'https://x/f-mars.png', venus: 'https://x/f-venus.png', uranus: 'https://x/f-uranus.png', pluto: 'https://x/f-pluto.png', neptune: 'https://x/f-neptune.png' };

  const llm = new MockProvider();
  let works: PlanetWorksService;
  let home: PlanetHomeService;
  let continents: ContinentsService;
  let finds: FindsService;
  let storage: StorageWorksService;

  const q = async <T = Record<string, unknown>>(s: ReturnType<typeof sql>) => ((await db.write.execute(s)) as unknown as { rows: T[] }).rows;
  const user = async (name: string) =>
    (
      await q<{ id: string }>(
        sql`INSERT INTO users (email, handle, display_name, avatar_url, planet_figures, onboarding_json) VALUES (${`${name}@m2p.test`}, ${`m2p_${name}`}, ${name}, ${LOOK}, ${JSON.stringify({ [LOOK]: FIGURES })}::jsonb, '{"birthYear":1990}'::jsonb) RETURNING id`,
      )
    )[0].id;
  const wipe = async () => {
    const mine = sql`(SELECT id FROM users WHERE email LIKE '%@m2p.test')`;
    for (const t of ['planet_work_meta', 'planet_posts', 'jupiter_posts', 'jupiter_roots', 'saturn_posts', 'radio_shows', 'goods', 'books', 'games', 'mv_projects', 'mars_backstage', 'songs', 'planet_homes'])
      await db.write.execute(sql`DELETE FROM ${sql.raw(t)} WHERE user_id IN ${mine}`);
    await db.write.execute(sql`DELETE FROM follows WHERE follower_id IN ${mine} OR followee_id IN ${mine}`);
    await db.write.execute(sql`DELETE FROM users WHERE email LIKE '%@m2p.test'`);
  };

  beforeAll(async () => {
    db = new Database({ DATABASE_URL: URL!, DB_POOL_MAX: 4 } as AppConfig);
    await wipe();
    me = await user('me');
    dachi = await user('dachi');
    stranger = await user('stranger');
    await db.write.execute(sql`INSERT INTO follows (follower_id, followee_id) VALUES (${me}, ${dachi}), (${dachi}, ${me})`);
    works = new PlanetWorksService(db, llm);
    home = new PlanetHomeService(db);
    continents = new ContinentsService(db);
    finds = of(FindsService, { db, dachi: {}, moon: undefined });
    storage = of(StorageWorksService, { db, media: { removeByUrl: async () => undefined }, storage: { status: async () => ({}) } });
  });
  afterAll(async () => {
    await wipe();
    await db.close();
  });

  const own = async (planet: HomePlanet, id: string) => (await home.feed(me, planet)).own.find((w) => w.id === id);
  const around = async (planet: HomePlanet, id: string) => (await home.feed(dachi, planet)).around.find((w) => w.id === id);
  const far = async (planet: HomePlanet, id: string) => ((await (continents as unknown as { works(v: string, p: HomePlanet, r: null): Promise<{ id: string }[]> }).works(stranger, planet, null)) ?? []).some((w) => w.id === id);
  const flownInBluena = async (planet: HomePlanet, id: string) => (await finds.works(me, { planet } as never)).find((w) => w.id === id)?.flown;

  /**
   * what every kind must do once flown: in the maker's place (with tags and its visibility), in the ダチ's home with the
   * maker's figure, not among the continents until public (the default is ダチ only), there once public and checked
   */
  async function shown(planet: HomePlanet, kind: PlanetWorkKind, id: string): Promise<{ mine: HomeWork; theirs: HomeWork }> {
    const mine = await own(planet, id);
    expect(mine, `${planet}: in the maker's own place`).toBeTruthy();
    expect(mine!.kind).toBe(kind);
    expect(mine!.rel).toBe('own');
    expect(mine!.tags, `${planet}: tagged`).toBeTruthy();
    expect(mine!.visibility).toBe('dachi');
    const theirs = await around(planet, id);
    expect(theirs, `${planet}: in a ダチ's home`).toBeTruthy();
    expect(theirs!.rel).toBe('dachi');
    expect(theirs!.author.figure, `${planet}: the maker's figure`).toBe(FIGURES[PLANET_FIGURE_OF[planet] as keyof typeof FIGURES]);
    expect(await far(planet, id), `${planet}: not public yet`).toBe(false);
    await works.setVisibility(me, kind, id, 'public');
    expect(await far(planet, id), `${planet}: on the continents once public and checked`).toBe(true);
    expect((await own(planet, id))!.visibility).toBe('public');
    return { mine: mine!, theirs: theirs! };
  }
  /** M-R208: after 88 hours it leaves everyone's place and stays in the maker's own */
  async function comesHome(planet: HomePlanet, id: string, table: string, col: string) {
    await db.write.execute(sql`UPDATE ${sql.raw(table)} SET ${sql.raw(col)} = now() - make_interval(hours => ${PLANET_FLY_HOURS + 1}) WHERE id = ${id}`);
    expect(await around(planet, id), `${planet}: home after 88 hours`).toBeUndefined();
    expect(await own(planet, id), `${planet}: still in the maker's place`).toBeTruthy();
    await db.write.execute(sql`UPDATE ${sql.raw(table)} SET ${sql.raw(col)} = now() WHERE id = ${id}`);
  }
  async function gone(planet: HomePlanet, id: string) {
    expect(await own(planet, id), `${planet}: gone from the maker's place`).toBeUndefined();
    expect(await around(planet, id), `${planet}: gone from the ダチ's home`).toBeUndefined();
    expect(await far(planet, id), `${planet}: gone from the continents`).toBe(false);
  }

  it('声コロリン → 土星: POST /saturn/posts/:id/publish (saturn_posts, room 1 → 0)', async () => {
    expect(KIND_HOME_PLANET.voice).toBe('saturn');
    const [{ id }] = await q<{ id: string }>(sql`INSERT INTO saturn_posts (user_id, text, voice_audio_url, voice_duration_sec, room, created_at) VALUES (${me}, 'きょうは たのしかった', 'https://x/v.m4a', 7, 1, now() - interval '5 days') RETURNING id`);
    await works.tag('saturn_post', id, { userId: me, planet: 'saturn', tags: { main: null, moods: [] }, words: 'きょうは たのしかった' });
    // kept in the room: not on the planet
    await gone('saturn', id);
    expect(await flownInBluena('saturn', id)).toBe(false);
    await of(SaturnService, { db }).publish(me, id);
    const { theirs } = await shown('saturn', 'saturn_post', id);
    // the opener: the voice and its words; the maker's ball
    expect(theirs).toMatchObject({ text: 'きょうは たのしかった', url: 'https://x/v.m4a', seconds: 7 });
    expect(theirs.author.ball).toBe(FIGURES.saturnBall);
    // its 88 hours started when it flew, not when it was made (5 days ago)
    expect(Date.now() - Date.parse(theirs.flownAt)).toBeLessThan(60_000);
    expect(await flownInBluena('saturn', id)).toBe(true);
    await comesHome('saturn', id, 'saturn_posts', 'created_at');
    // 外す: back to the room, on both sides
    await home.takeOut(me, 'saturn', id);
    await gone('saturn', id);
    expect(await flownInBluena('saturn', id)).toBe(false);
    // flown again, then thrown away on the Moon
    await of(SaturnService, { db }).publish(me, id);
    expect(await own('saturn', id)).toBeTruthy();
    await storage.remove(me, 'saturn_post', id);
    await gone('saturn', id);
  });

  it('アート → 木星: POST /jupiter/posts { rootId } (jupiter_posts from a jupiter_roots art)', async () => {
    expect(KIND_HOME_PLANET.art).toBe('jupiter');
    const [{ id: rootId }] = await q<{ id: string }>(sql`INSERT INTO jupiter_roots (user_id, kind, url, title) VALUES (${me}, 'photo', 'https://x/art.png', 'ゆうやけ') RETURNING id`);
    expect(await flownInBluena('jupiter', rootId)).toBe(false);
    const jupiter = of(JupiterService, { db, llm, works });
    const post = await jupiter.create(me, { rootId, text: '', filter: 'none', branch: 0 } as never);
    const { theirs } = await shown('jupiter', 'jupiter_post', post.id);
    // the opener: the picture and its title; the butterfly's wing cut
    expect(theirs).toMatchObject({ url: 'https://x/art.png', title: 'ゆうやけ' });
    expect(theirs.author.wings).toEqual({ l: 20, r: 76 });
    expect(await flownInBluena('jupiter', rootId)).toBe(true);
    // the title changed on the Moon afterwards
    await jupiter.setRootTitle(me, rootId, 'あさやけ');
    expect((await around('jupiter', post.id))!.title).toBe('あさやけ');
    await comesHome('jupiter', post.id, 'jupiter_posts', 'created_at');
    // 外す: the post is taken down, the art stays in Bluena and can fly again
    await home.takeOut(me, 'jupiter', post.id);
    await gone('jupiter', post.id);
    expect(await flownInBluena('jupiter', rootId)).toBe(false);
    const again = await jupiter.create(me, { rootId, text: '', filter: 'none', branch: 0 } as never);
    expect(await own('jupiter', again.id)).toBeTruthy();
    // story 2026-11-27 — one work = one post: flown again it is the SAME post (never a second one), its 88 hours from now
    expect(again.id).toBe(post.id);
    await db.write.execute(sql`UPDATE jupiter_posts SET created_at = now() - interval '50 hours' WHERE id = ${post.id}`);
    const third = await jupiter.create(me, { rootId, text: '', filter: 'none', branch: 0 } as never);
    expect(third.id).toBe(post.id);
    expect(Date.now() - Date.parse((await own('jupiter', post.id))!.flownAt)).toBeLessThan(60_000);
    expect((await q(sql`SELECT id FROM jupiter_posts WHERE root_id = ${rootId}`)).length).toBe(1);
    // an art flown twice BEFORE the rule (two live posts): the home shows it once (the newest), 外す takes both out
    const [{ id: twin }] = await q<{ id: string }>(sql`INSERT INTO jupiter_posts (user_id, root_id, kind, url, title, created_at) VALUES (${me}, ${rootId}, 'photo', 'https://x/art.png', 'あさやけ', now() - interval '3 hours') RETURNING id`);
    expect((await home.feed(me, 'jupiter')).own.filter((w) => w.id === twin || w.id === post.id).map((w) => w.id)).toEqual([post.id]);
    expect(await around('jupiter', twin)).toBeUndefined();
    await home.takeOut(me, 'jupiter', post.id);
    await gone('jupiter', post.id);
    await gone('jupiter', twin);
    expect((await jupiter.create(me, { rootId, text: '', filter: 'none', branch: 0 } as never)).id).toBe(post.id);
    // the art thrown away on the Moon: its post goes with it
    await storage.remove(me, 'jupiter_root', rootId);
    await gone('jupiter', again.id);
  });

  it('曲 → 水星: POST /planets/mercury/posts { sourceId: songId } (planet_posts from a song)', async () => {
    expect(KIND_HOME_PLANET.song).toBe('mercury');
    const phrases = [{ text: 'ほしの うみを', beats: 8, startBeat: 0 }, { text: 'わたってく', beats: 8, startBeat: 8 }];
    const design = { bpm: 120, titleVoice: { text: 'ほしのうた', url: 'https://x/title.m4a' } };
    const [{ id: songId }] = await q<{ id: string }>(
      sql`INSERT INTO songs (user_id, title, phrases_json, mix_json, direction_json, mix_url, seconds, design_json, instrumental_url, saved_at) VALUES (${me}, 'ほしのうた', ${JSON.stringify(phrases)}::jsonb, '{}', '{}', 'https://x/mix-1.m4a', 60, ${JSON.stringify(design)}::jsonb, 'https://x/inst.m4a', now()) RETURNING id`,
    );
    await db.write.execute(sql`UPDATE users SET voice_self_id = 'voice-me' WHERE id = ${me}`);
    expect(await flownInBluena('mercury', songId)).toBe(false);
    const posts = new PlanetPostsService(db, {} as never, llm, works);
    const post = await posts.create(me, 'mercury', { sourceId: songId, title: 'ほしのうた', text: '' } as never, 'https://api');
    const { theirs } = await shown('mercury', 'planet_post', post.id);
    expect(theirs).toMatchObject({ title: 'ほしのうた', url: 'https://x/mix-1.m4a', seconds: 60 });
    // the opener (GET /planet-songs/:id): the sound, the lyrics with their times, the title in the maker's voice
    const songs = new PlanetSongsService(db);
    const opened = await songs.song(dachi, post.id);
    expect(opened).toMatchObject({ title: 'ほしのうた', url: 'https://x/mix-1.m4a', titleVoice: 'https://x/title.m4a' });
    expect(opened.lyrics.map((l) => l.text)).toEqual(['ほしの うみを', 'わたってく']);
    expect(await flownInBluena('mercury', songId)).toBe(true);
    // the song changed on the Moon afterwards (a tweak's new sound): the planet plays the song of now
    await (of(SongTweakService, { db }) as unknown as { save(u: string, id: string, v: unknown): Promise<void> }).save(me, songId, { mixUrl: 'https://x/mix-2.m4a', seconds: 58, phrases, design });
    expect(await around('mercury', post.id)).toMatchObject({ url: 'https://x/mix-2.m4a', seconds: 58 });
    expect((await songs.song(dachi, post.id)).url).toBe('https://x/mix-2.m4a');
    await comesHome('mercury', post.id, 'planet_posts', 'created_at');
    await home.takeOut(me, 'mercury', post.id);
    await gone('mercury', post.id);
    expect(await flownInBluena('mercury', songId)).toBe(false);
    // flown again, then the song thrown away on the Moon
    const again = await posts.create(me, 'mercury', { sourceId: songId, title: '', text: '' } as never, 'https://api');
    expect(await own('mercury', again.id)).toBeTruthy();
    // story 2026-11-27 — one work = one post: the same post again, its 88 hours from now
    expect(again.id).toBe(post.id);
    expect((await q(sql`SELECT id FROM planet_posts WHERE source_id = ${songId}`)).length).toBe(1);
    expect(Date.now() - Date.parse((await own('mercury', post.id))!.flownAt)).toBeLessThan(60_000);
    // story 2026-11-27: the song's title changed by words on the Moon — the song, its Mercury post, and the reading asked again
    const asked: string[] = [];
    const retitle = new SongRetitleService(db, llm, { later: async (_u: string, id: string) => (asked.push(id), true) } as never);
    expect(await retitle.retitle(me, songId, '「よるのうた」', 'https://api')).toMatchObject({ title: 'よるのうた' });
    expect((await around('mercury', post.id))!.title).toBe('よるのうた');
    expect((await songs.song(dachi, post.id)).title).toBe('よるのうた');
    expect(asked).toEqual([songId]);
    await expect(retitle.retitle(dachi, songId, 'ぬすんだうた', 'https://api')).rejects.toThrow();
    await storage.remove(me, 'song', songId);
    await gone('mercury', again.id);
    await expect(songs.song(dachi, again.id)).rejects.toThrow();
  });

  it('動画・MV → 火星: POST /planets/mars/posts { sourceId: backstageId } (planet_posts from the 裏スタジオ)', async () => {
    expect(KIND_HOME_PLANET.video).toBe('mars');
    const [{ id: songId }] = await q<{ id: string }>(
      sql`INSERT INTO songs (user_id, title, phrases_json, mix_json, direction_json, mix_url, seconds, design_json, instrumental_url) VALUES (${me}, 'MVのうた', '[]', '{}', '{}', 'https://x/mv-mix.m4a', 60, '{}', 'https://x/i.m4a') RETURNING id`,
    );
    const [{ id: backstageId }] = await q<{ id: string }>(sql`INSERT INTO mars_backstage (user_id, url, poster_url, title, seconds) VALUES (${me}, 'https://x/mv.mp4', 'https://x/mv.jpg', 'はじめてのMV', 60) RETURNING id`);
    await db.write.execute(sql`INSERT INTO mv_projects (user_id, song_id, backstage_id, video_url, poster_url, status) VALUES (${me}, ${songId}, ${backstageId}, 'https://x/mv.mp4', 'https://x/mv.jpg', 'done')`);
    expect(await flownInBluena('mars', backstageId)).toBe(false);
    const posts = new PlanetPostsService(db, {} as never, llm, works);
    const post = await posts.create(me, 'mars', { sourceId: backstageId, title: '', text: '' } as never, 'https://api');
    const { theirs } = await shown('mars', 'planet_post', post.id);
    // the opener: the film and its poster
    expect(theirs).toMatchObject({ title: 'はじめてのMV', url: 'https://x/mv.mp4', thumbUrl: 'https://x/mv.jpg', seconds: 60 });
    expect(await flownInBluena('mars', backstageId)).toBe(true);
    // a Mars post is not a Mercury one
    expect(await own('mercury', post.id)).toBeUndefined();
    await comesHome('mars', post.id, 'planet_posts', 'created_at');
    await home.takeOut(me, 'mars', post.id);
    await gone('mars', post.id);
    expect(await flownInBluena('mars', backstageId)).toBe(false);
    const again = await posts.create(me, 'mars', { sourceId: backstageId, title: '', text: '' } as never, 'https://api');
    expect(again.id).toBe(post.id); // one work = one post
    // story 2026-11-27: the MV made again on the Moon (a new film in a new 裏スタジオ entry) — Mars shows the film of now,
    // the post belongs to the new entry (Bluena: 「星にいる」 there), and flying the new film is the same post
    const [{ id: backstage2 }] = await q<{ id: string }>(sql`INSERT INTO mars_backstage (user_id, url, poster_url, title, seconds) VALUES (${me}, 'https://x/mv-2.mp4', 'https://x/mv-2.jpg', 'はじめてのMV', 58) RETURNING id`);
    await followMv(db, me, { backstageId, urls: ['https://x/mv.mp4', null] }, { backstageId: backstage2, url: 'https://x/mv-2.mp4', posterUrl: 'https://x/mv-2.jpg', seconds: 58 });
    await db.write.execute(sql`UPDATE mv_projects SET video_url = 'https://x/mv-2.mp4', backstage_id = ${backstage2} WHERE backstage_id = ${backstageId}`);
    expect(await around('mars', post.id)).toMatchObject({ title: 'はじめてのMV', url: 'https://x/mv-2.mp4', thumbUrl: 'https://x/mv-2.jpg', seconds: 58 });
    expect(await flownInBluena('mars', backstage2)).toBe(true);
    expect((await posts.create(me, 'mars', { sourceId: backstage2, title: '', text: '' } as never, 'https://api')).id).toBe(post.id);
    await storage.remove(me, 'mars_backstage', backstage2);
    await gone('mars', again.id);
  });

  it('ラジオ → 金星: POST /venus/shows/:id/publish (radio_shows, private → public)', async () => {
    expect(KIND_HOME_PLANET.radio).toBe('venus');
    const [{ id }] = await q<{ id: string }>(
      sql`INSERT INTO radio_shows (user_id, audio_url, seconds, cues_json, title, thumb_url, status, published_at) VALUES (${me}, 'https://x/show.m4a', 180, '[]', 'よるのラジオ', 'https://x/show.jpg', 'private', now() - interval '10 days') RETURNING id`,
    );
    await works.tag('radio_show', id, { userId: me, planet: 'venus', tags: { main: null, moods: ['ゆったり'] }, words: 'よるのラジオ' });
    await gone('venus', id);
    expect(await flownInBluena('venus', id)).toBe(false);
    const radio = of(RadioService, { db, showView: async (rows: unknown[]) => rows });
    await radio.publishShow(me, id, true);
    const { theirs } = await shown('venus', 'radio_show', id);
    // the opener: the show's sound and its picture
    expect(theirs).toMatchObject({ title: 'よるのラジオ', url: 'https://x/show.m4a', thumbUrl: 'https://x/show.jpg', seconds: 180 });
    // flown again after being private: its 88 hours start now (it was first on air 10 days ago)
    expect(Date.now() - Date.parse(theirs.flownAt)).toBeLessThan(60_000);
    expect(await flownInBluena('venus', id)).toBe(true);
    await comesHome('venus', id, 'radio_shows', 'published_at');
    // one already public keeps its time
    const before = (await own('venus', id))!.flownAt;
    await radio.publishShow(me, id, true);
    expect((await own('venus', id))!.flownAt).toBe(before);
    await home.takeOut(me, 'venus', id);
    await gone('venus', id);
    expect(await flownInBluena('venus', id)).toBe(false);
    await radio.publishShow(me, id, true);
    await storage.remove(me, 'radio_show', id);
    await gone('venus', id);
  });

  it('グッズ → 天王星: POST /moon/goods/:id/fly (goods.flown_at)', async () => {
    expect(KIND_HOME_PLANET.goods).toBe('uranus');
    const [{ id: rootId }] = await q<{ id: string }>(sql`INSERT INTO jupiter_roots (user_id, kind, url, title) VALUES (${me}, 'photo', 'https://x/goods-art.png', 'ねこ') RETURNING id`);
    const [{ id }] = await q<{ id: string }>(sql`INSERT INTO goods (user_id, kind, title, art_url, root_id) VALUES (${me}, 'トート', 'ねこのトート', 'https://x/goods-art.png', ${rootId}) RETURNING id`);
    await gone('uranus', id);
    const goods = of(GoodsService, { db, works });
    await goods.fly(me, id, true);
    const { theirs } = await shown('uranus', 'goods', id);
    // the opener: which goods it is (the app draws that mock-up) and the art printed on it
    expect(theirs).toMatchObject({ title: 'ねこのトート', text: 'トート', thumbUrl: 'https://x/goods-art.png' });
    expect((await goods.read(dachi, id)).artUrl).toBe('https://x/goods-art.png');
    expect(await flownInBluena('uranus', id)).toBe(true);
    await comesHome('uranus', id, 'goods', 'flown_at');
    await home.takeOut(me, 'uranus', id);
    await gone('uranus', id);
    expect(await flownInBluena('uranus', id)).toBe(false);
    await goods.fly(me, id, true);
    await storage.remove(me, 'goods', id);
    await gone('uranus', id);
  });

  it('本 → 冥王星: POST /moon/books/:id/fly (books.flown_at)', async () => {
    expect(KIND_HOME_PLANET.novel).toBe('pluto');
    const ch = (n: number, text: string) => ({ n, title: `第${n}章`, text, tags: [], at: new Date().toISOString(), summary: '' });
    const [{ id }] = await q<{ id: string }>(
      sql`INSERT INTO books (user_id, title, spell_json, chapters_json, cover_url) VALUES (${me}, 'よるの学校', '[]', ${JSON.stringify([ch(1, 'チャイムが鳴った。だれもいない教室で。')])}::jsonb, 'https://x/cover.png') RETURNING id`,
    );
    await gone('pluto', id);
    const novel = of(NovelService, { db, works });
    await novel.fly(me, id, true);
    const { theirs } = await shown('pluto', 'book', id);
    // the opener: the cover and the opening of chapter 1; the whole book for whoever the home reaches
    expect(theirs).toMatchObject({ title: 'よるの学校', text: 'チャイムが鳴った。だれもいない教室で。', thumbUrl: 'https://x/cover.png' });
    expect((await novel.read(dachi, id)).chapters).toHaveLength(1);
    await expect(novel.read(stranger, id)).resolves.toBeTruthy(); // public by now: it drifts to a stranger too
    // a new chapter written on the Moon afterwards is in the flown book
    await db.write.execute(sql`UPDATE books SET chapters_json = chapters_json || ${JSON.stringify([ch(2, 'つぎの日。')])}::jsonb WHERE id = ${id}`);
    expect((await novel.read(dachi, id)).chapters).toHaveLength(2);
    expect((await around('pluto', id))!.text).toBe('チャイムが鳴った。だれもいない教室で。');
    expect(await flownInBluena('pluto', id)).toBe(true);
    await comesHome('pluto', id, 'books', 'flown_at');
    await home.takeOut(me, 'pluto', id);
    await gone('pluto', id);
    expect(await flownInBluena('pluto', id)).toBe(false);
    await expect(novel.read(stranger, id)).rejects.toThrow();
    await novel.fly(me, id, true);
    await storage.remove(me, 'book', id);
    await gone('pluto', id);
  });

  it('story 2026-11-27: the homecoming report after 88 hours tells goods, books and games too (and a second flight again)', async () => {
    const moon = new MoonWorksService(db);
    const [{ id: goodsId }] = await q<{ id: string }>(sql`INSERT INTO goods (user_id, kind, title, art_url, flown_at) VALUES (${me}, 'トート', 'かえりのトート', 'https://x/g.png', now() - make_interval(hours => ${PLANET_FLY_HOURS + 2})) RETURNING id`);
    const [{ id: bookId }] = await q<{ id: string }>(sql`INSERT INTO books (user_id, title, spell_json, chapters_json, flown_at) VALUES (${me}, 'かえりの本', '[]', '[]', now() - make_interval(hours => ${PLANET_FLY_HOURS + 3})) RETURNING id`);
    const [{ id: gameId }] = await q<{ id: string }>(sql`INSERT INTO games (user_id, title, versions_json, active, flown_at) VALUES (${me}, 'かえりのゲーム', '[]', 0, now() - make_interval(hours => ${PLANET_FLY_HOURS + 4})) RETURNING id`);
    // the dachi kept the goods in their Bluena (the new homes' ☆)
    await db.write.execute(sql`INSERT INTO bluena_saves (user_id, kind, post_id) VALUES (${dachi}, 'goods', ${goodsId})`);
    const told = await moon.homecomings(me);
    const by = (key: string) => told.find((h) => h.key === key);
    expect(by(`goods:${goodsId}`)).toMatchObject({ planet: 'uranus', title: 'かえりのトート', named: [{ name: 'dachi' }], strangers: 0 });
    expect(by(`book:${bookId}`)).toMatchObject({ planet: 'pluto', title: 'かえりの本', named: [] });
    expect(by(`game:${gameId}`)).toMatchObject({ planet: 'neptune', title: 'かえりのゲーム' });
    await moon.markTold(me, told.map((h) => h.key));
    expect((await moon.homecomings(me)).some((h) => h.key === `goods:${goodsId}`)).toBe(false);
    // flown again and home again: told again (its report of before was said before this homecoming)
    await db.write.execute(sql`UPDATE work_homecomings SET told_at = now() - interval '10 days' WHERE user_id = ${me}`);
    expect((await moon.homecomings(me)).some((h) => h.key === `goods:${goodsId}`)).toBe(true);
    await db.write.execute(sql`DELETE FROM bluena_saves WHERE user_id = ${dachi}`);
    await db.write.execute(sql`DELETE FROM work_homecomings WHERE user_id = ${me}`);
    await db.write.execute(sql`DELETE FROM goods WHERE id = ${goodsId}`);
    await db.write.execute(sql`DELETE FROM books WHERE id = ${bookId}`);
    await db.write.execute(sql`DELETE FROM games WHERE id = ${gameId}`);
  });

  it('ゲーム → 海王星: POST /moon/games/:id/fly (games.flown_at)', async () => {
    expect(KIND_HOME_PLANET.game).toBe('neptune');
    const v = (title: string, howTo: string, code: string) => ({ code, title, howTo, tags: [], at: new Date().toISOString(), confirmId: 'c', kind: 'gameCheap' });
    const [{ id }] = await q<{ id: string }>(
      sql`INSERT INTO games (user_id, title, versions_json, active) VALUES (${me}, 'ねこパズル', ${JSON.stringify([v('ねこパズル', 'そろえて消す', 'game.v1()')])}::jsonb, 0) RETURNING id`,
    );
    await gone('neptune', id);
    const game = of(GameService, { db, works });
    await game.fly(me, id, true);
    const { theirs } = await shown('neptune', 'game', id);
    // the opener: the case (no picture yet: the app's neon face), how to play; PRESS START gets the playable version
    expect(theirs).toMatchObject({ title: 'ねこパズル', text: 'そろえて消す', thumbUrl: null });
    expect(await game.play(dachi, id)).toMatchObject({ code: 'game.v1()', version: 0, home: 'neptune' });
    // afterwards on the Moon: a new version on its face, and a cover from one of the maker's arts
    await db.write.execute(sql`UPDATE games SET versions_json = versions_json || ${JSON.stringify([v('ねこパズル2', 'ならべて消す', 'game.v2()')])}::jsonb, active = 1 WHERE id = ${id}`);
    const [{ id: rootId }] = await q<{ id: string }>(sql`INSERT INTO jupiter_roots (user_id, kind, url, title) VALUES (${me}, 'photo', 'https://x/case.png', 'ケース') RETURNING id`);
    await game.cover(me, id, rootId);
    expect(await around('neptune', id)).toMatchObject({ title: 'ねこパズル2', text: 'ならべて消す', thumbUrl: 'https://x/case.png' });
    expect((await game.play(dachi, id)).code).toBe('game.v2()');
    expect(await flownInBluena('neptune', id)).toBe(true);
    await comesHome('neptune', id, 'games', 'flown_at');
    await home.takeOut(me, 'neptune', id);
    await gone('neptune', id);
    expect(await flownInBluena('neptune', id)).toBe(false);
    await expect(game.play(stranger, id)).rejects.toThrow();
    await game.fly(me, id, true);
    await storage.remove(me, 'game', id);
    await gone('neptune', id);
  });
});
