import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { flyingSince, type ContinentRule, type WorkTags } from '@obolo/shared';
import { continents, continentSeen, jupiterPosts, jupiterRoots, personHides, radioShows, planetHomes, planetPosts, planetWorkMeta, saturnPosts, songs, userBlocks, userReports, users, workHides } from '../db/schema';
import { aroundWhere } from './planet-home.service';
import { planetWorkScope } from '../common/child';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { workScore } from '@obolo/shared';
import { ContinentsService, continentWhere, ruleFilter, toContinent } from './continents.service';
import { farWhere, storeOf } from './planet-home.service';
import { PlanetPostsService } from './planet-posts.service';
import { PlanetWorksService, type WorkFacts } from './planet-works.service';
import { WorkSafetyService } from './work-safety.service';
import { JupiterService } from '../jupiter/jupiter.service';

const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(q);
const mockLlm = { name: 'mock', chat: async () => 'OK' } as never;

/**
 * An in-memory db: each select answers from the queue of the table it reads (`from(table)`), execute() from its own
 * queue; every write is recorded (the table, the values, the conflict update).
 */
function memDb(answers: Map<unknown, unknown[]>, exec: unknown[] = []) {
  const writes: { op: string; table: unknown; v?: unknown; set?: unknown }[] = [];
  const reader = () => {
    let table: unknown;
    const chain: unknown = new Proxy(() => undefined, {
      get: (_t, k) => {
        if (k === 'then') return (ok: (v: unknown) => void, no: (e: unknown) => void) => Promise.resolve((answers.get(table) ?? []).shift()).then(ok, no);
        if (k === 'from')
          return (t: unknown) => {
            table = t;
            return chain;
          };
        return () => chain;
      },
      apply: () => chain,
    });
    return chain;
  };
  const insert = (table: unknown) => ({
    values: (v: unknown) => {
      const w = { op: 'insert', table, v } as (typeof writes)[number];
      writes.push(w);
      const done = Promise.resolve(undefined);
      return {
        onConflictDoNothing: async () => undefined,
        onConflictDoUpdate: async (o: { set: unknown }) => void (w.set = o.set),
        returning: async () => (answers.get(`${String((table as { [k: symbol]: string })[Symbol.for('drizzle:Name')])}:returning`) ?? []).shift(),
        then: done.then.bind(done),
      };
    },
  });
  const del = (table: unknown) => ({ where: async () => void writes.push({ op: 'delete', table }) });
  return {
    db: { read: { select: reader, execute: async () => exec.shift() }, write: { select: reader, insert, delete: del } },
    writes,
  };
}
const q = (...pairs: [unknown, unknown[]][]) => new Map<unknown, unknown[]>(pairs);

// --- 2-1 tagging at creation ---------------------------------------------------------------------------------------

describe('2-1 a work is tagged the moment it is made', () => {
  it('Mercury: a song post carries genre / moods / bpm from songs.designJson (and its spell)', async () => {
    const song = { id: 's1', title: '盆おどり', mixUrl: 'm.mp3', seconds: 60, designJson: { genre: 'EDM', mood: 'アゲ', bpm: 130, spell: [{ ja: '祭り', en: 'festival', group: 'theme' }, { ja: '和風', en: 'japanese', group: 'theme' }] } };
    const post = { id: 'p1', planet: 'mercury', userId: 'me', kind: 'song', title: '盆おどり', text: '', url: 'm.mp3', posterUrl: null, seconds: 60, createdAt: new Date() };
    const { db } = memDb(q([songs, [[song]]], ['planet_posts:returning', [[post]]], [users, [[{ id: 'me', displayName: 'ネオ' }]]]));
    const tagged: [string, string, WorkFacts][] = [];
    const works = { tag: async (k: string, id: string, f: WorkFacts) => void tagged.push([k, id, f]) };
    await new PlanetPostsService(db as never, {} as never, mockLlm, works as never).create('me', 'mercury', { sourceId: 's1', title: '', text: '' } as never, 'http://x');
    expect(tagged).toHaveLength(1);
    const [kind, id, f] = tagged[0];
    expect([kind, id, f.planet, f.userId]).toEqual(['planet_post', 'p1', 'mercury', 'me']);
    expect(f.tags.main).toBe('EDM');
    expect(f.tags.bpm).toBe(130);
    expect(f.tags.moods).toEqual(expect.arrayContaining(['アゲ', '祭り', '和風']));
  });

  it('Jupiter: an art post carries the style / moods of the spell its root was painted with', async () => {
    const root = { id: 'r1', userId: 'me', kind: 'photo', url: 'a.png', posterUrl: null, spellJson: [{ ja: '水彩', en: 'watercolor', group: 'style' }, { ja: 'やわらかい色', en: 'soft', group: 'color' }, { ja: 'ねこ', en: 'cat', group: 'theme' }] };
    const post = { id: 'j1', userId: 'me', rootId: 'r1', kind: 'photo', url: 'a.png', posterUrl: null, text: '', filter: 'none', branch: 0, starCount: 0, replyCount: 0, createdAt: new Date() };
    const { db } = memDb(q([jupiterRoots, [[root]]], ['jupiter_posts:returning', [[post]]], [users, [[{ id: 'me' }]]]));
    const tagged: WorkFacts[] = [];
    const works = { tag: async (_k: string, _id: string, f: WorkFacts) => void tagged.push(f) };
    await new JupiterService(db as never, mockLlm, works as never).create('me', { rootId: 'r1', text: '', filter: 'none', branch: 0 });
    expect(tagged[0].tags.main).toBe('水彩');
    expect(tagged[0].tags.moods).toEqual(expect.arrayContaining(['パステル', 'ねこ', 'どうぶつ']));
  });

  it('the tags and the automatic check are kept; failing words hold the work (it stays dachi, with the reason)', async () => {
    const { db, writes } = memDb(q());
    const svc = new PlanetWorksService(db as never, mockLlm);
    const facts: WorkFacts = { userId: 'me', planet: 'mercury', tags: { main: 'EDM', moods: ['アゲ'], bpm: 128 }, words: 'ネオンダイブ' };
    await svc.tag('planet_post', 'p1', facts);
    expect(writes[0].table).toBe(planetWorkMeta);
    expect(writes[0].v).toMatchObject({ kind: 'planet_post', workId: 'p1', planet: 'mercury', main: 'EDM', moodsJson: ['アゲ'], bpm: 128, checkState: 'ok', checkReason: null });
    // no visibility written: the default constant decides until the maker chooses
    expect((writes[0].v as Record<string, unknown>).visibility).toBeUndefined();
    await svc.tag('planet_post', 'p2', { ...facts, words: '死ね' });
    expect(writes[1].v).toMatchObject({ checkState: 'held', checkReason: 'harassment' });
  });

  it('Saturn (M-R316): a voice kororin’s topic and moods come from its words, asked of the text model', async () => {
    const { db, writes } = memDb(q());
    const asked: string[] = [];
    const llm = { name: 'gemini', chat: async (r: { system: string; history: { text: string }[] }) => (r.system.includes('topic') ? (asked.push(r.history[0].text), '{"topic":"恋バナ","moods":["ドキドキ","好きな人"]}') : 'OK') };
    await new PlanetWorksService(db as never, llm as never).tag('saturn_post', 'k1', { userId: 'me', planet: 'saturn', tags: { main: null, moods: [] }, words: '好きな人と目が合った' });
    expect(asked).toEqual(['好きな人と目が合った']);
    expect(writes[0].v).toMatchObject({ kind: 'saturn_post', workId: 'k1', planet: 'saturn', main: '恋バナ', moodsJson: ['ドキドキ', '好きな人'], checkState: 'ok' });
  });

  it('Saturn: when the model fails the kororin is still kept (checked, no topic) — the backfill asks again and counts only what it now tags', async () => {
    const { db, writes } = memDb(q([planetWorkMeta, [[{ id: 'k1' }, { id: 'k2' }]]], [planetPosts, [[]]], [jupiterPosts, [[]]], [saturnPosts, [[]]], [radioShows, [[]]]));
    let up = false;
    const llm = { name: 'gemini', chat: async (r: { system: string }) => (r.system.includes('topic') ? (up ? '{"topic":"朝","moods":["おはよう"]}' : Promise.reject(new Error('quota'))) : 'OK') };
    const svc = new PlanetWorksService(db as never, llm as never);
    await svc.tag('saturn_post', 'k0', { userId: 'me', planet: 'saturn', tags: { main: null, moods: [] }, words: 'おはよう' });
    expect(writes[0].v).toMatchObject({ main: null, moodsJson: [], checkState: 'ok' });
    // backfill: nothing missing in the stores; k1 / k2 have rows without a topic
    (svc as unknown as Record<string, unknown>).facts = async (_k: string, id: string) => (id === 'k2' ? null : { userId: 'me', planet: 'saturn', tags: { main: null, moods: [] }, words: 'おはよう' });
    up = true;
    const done = await svc.backfill(10);
    expect(done.saturn_post).toBe(1);
    expect(writes.at(-1)).toMatchObject({ table: planetWorkMeta, v: { workId: 'k1', main: '朝', moodsJson: ['おはよう'] } });
  });
});

// --- 2-2 visibility ------------------------------------------------------------------------------------------------

describe('2-2 a dachi work never reaches continents, search, travel or the far scenery', () => {
  it('continents read public works only (chosen or by the default, check passed), never a young maker’s, hidden or blocked', () => {
    const r = render(continentWhere('me', 'mercury')!);
    expect(r.sql).toContain('COALESCE("planet_work_meta"."visibility", $');
    expect(r.sql).toContain(`= 'public' AND "planet_work_meta"."check_state" = 'ok'`);
    expect(r.params).toContain('dachi');
    expect(r.sql).toContain('"users"."suspended_at" IS NULL');
    expect(r.sql).toContain('NOT EXISTS (SELECT 1 FROM work_hides h');
    expect(r.sql).toContain('user_blocks b');
    expect(r.sql).toContain('SELECT 1 FROM users a WHERE a.id = "planet_posts"."user_id"');
    expect(continentWhere('me', 'pluto')).toBeNull();
  });
  it('the far scenery of a home asks the same (a work with no row is never public)', () => {
    const r = render(farWhere(storeOf('jupiter')!, 'me', 'jupiter_post', flyingSince()));
    expect(r.sql).toContain(`EXISTS (SELECT 1 FROM planet_work_meta pm WHERE pm.kind = $`);
    expect(r.sql).toContain(`AND pm.check_state = 'ok'`);
    expect(r.params).toContain('dachi');
  });
  it('the rule prefilter: a main class or a mood in common', () => {
    const r = render(ruleFilter({ g: ['EDM'], m: ['ダンス', 'フェス'], bpm: [118, 999] })!);
    expect(r.sql).toBe('("planet_work_meta"."main" = ANY(ARRAY[$1]::text[]) OR "planet_work_meta"."moods_json" ?| ARRAY[$2, $3]::text[])');
    expect(render(ruleFilter({ g: [], m: [] })!).sql).toBe('FALSE');
  });
  it('only the maker sets it; public with a held check stays dachi in effect', async () => {
    const writes: unknown[] = [];
    const db = { write: { insert: () => ({ values: (v: unknown) => (writes.push(v), { onConflictDoUpdate: async () => undefined }) }) } };
    const svc = new PlanetWorksService(db as never, mockLlm);
    const stub = svc as unknown as Record<string, unknown>;
    stub.facts = async () => ({ userId: 'maker', planet: 'mercury', tags: { main: 'EDM', moods: [], bpm: 120 }, words: '' });
    stub.meta = async () => ({ visibility: null, checkState: 'held', checkReason: 'harassment' });
    await expect(svc.setVisibility('someone-else', 'planet_post', 'p1', 'public')).rejects.toThrow();
    const v = await svc.setVisibility('maker', 'planet_post', 'p1', 'public');
    expect(v).toMatchObject({ chosen: 'public', visibility: 'dachi', check: 'held', reason: 'harassment' });
    expect(writes[0]).toMatchObject({ visibility: 'public' });
    stub.meta = async () => ({ visibility: 'public', checkState: 'ok', checkReason: null });
    expect(await svc.setVisibility('maker', 'planet_post', 'p1', 'public')).toMatchObject({ visibility: 'public', check: 'ok' });
  });
});

// --- 2-4 continents: workScore ------------------------------------------------------------------------------------

const cont = (key: string, rule: ContinentRule, sortOrder: number, creatorId: string | null = null) => ({ c: { id: key, planet: 'mercury', key, name: key, creatorId, ruleJson: rule, tagsJson: [key], skyUrl: null, landUrl: null, shoreUrl: null, sortOrder, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }, creatorName: null });
const MERCURY = [
  cont('edm', { g: ['EDM'], m: ['ダンス', 'フェス'], bpm: [118, 999] }, 1),
  cont('hiphop', { g: ['ヒップホップ'], m: ['ストリート'] }, 2),
  cont('ballad', { g: ['バラード'], m: ['しっとり'], bpm: [0, 90] }, 3),
  cont('rock', { g: ['ロック'], m: ['熱い'] }, 4),
  cont('chill', { g: ['ローファイ'], m: ['チル', '作業用'], bpm: [0, 100] }, 5),
  cont('matsuri', { g: [], m: ['祭り', '和風', '夏'] }, 6),
  cont('rain', { g: [], m: ['雨'] }, 7),
];
const work = (id: string, userId: string, t: WorkTags) => ({ id, userId, flownAt: new Date('2026-11-25T00:00:00Z'), text: '', title: id, url: `${id}.mp3`, thumb: null, seconds: 60, name: userId, pic: null, main: t.main, moods: t.moods, bpm: t.bpm ?? null });
const WORKS = [
  work('bon', 'stranger', { main: 'EDM', moods: ['祭り', '和風', 'アゲ'], bpm: 130 }),
  work('slowedm', 'stranger', { main: 'EDM', moods: [], bpm: 100 }),
  work('fastballad', 'oshi', { main: 'バラード', moods: ['しっとり'], bpm: 120 }),
  work('mine', 'me', { main: 'EDM', moods: ['ダンス'], bpm: 128 }),
];

describe('2-4 Saturn plazas (M-R316) and the operator continents (M-R317)', () => {
  const seed = readFileSync(join(__dirname, '../../drizzle/0057_person_hides_saturn_plazas.sql'), 'utf8');
  const rows = [...seed.matchAll(/\('saturn', '(\w+)', '([^']+)', '(\{[^']+\})'::jsonb/g)].map((m) => ({ key: m[1], name: m[2], rule: JSON.parse(m[3]) as ContinentRule }));
  it('ten plazas on the rings, from the prototype, no maker named', () => {
    expect(rows.map((r) => r.key)).toEqual(['chat', 'koi', 'oshi', 'school', 'night', 'game', 'warai', 'anime', 'asa', 'nemui']);
    expect(rows.map((r) => r.name)).toContain('ねむねむ星');
    expect(seed).not.toMatch(/creator_id"?\)? VALUES|タク'|ショウ'|ぽんず'|はるか'|みお'/);
  });
  it('a kororin tagged from its words drifts to its plaza (恋バナ + ドキドキ → 恋バナの部屋)', () => {
    const tags: WorkTags = { main: '恋バナ', moods: ['ドキドキ'], bpm: null };
    expect(rows.filter((r) => workScore(tags, r.rule) >= 2).map((r) => r.key)).toEqual(['koi']);
  });
  it('an operator continent never carries a maker’s name, even if one were joined', () => {
    const base = { planet: 'saturn', key: 'game', name: 'ゲーム実況の島', ruleJson: { g: ['ゲーム'], m: [] }, tagsJson: [], skyUrl: null, landUrl: null, shoreUrl: null } as never as Parameters<typeof toContinent>[0];
    expect(toContinent({ ...base, creatorId: null, creatorName: 'タク' }).creator).toBeNull();
    expect(toContinent({ ...base, creatorId: 'u1', creatorName: 'ミナ' }).creator).toEqual({ id: 'u1', name: 'ミナ' });
  });
});

describe('2-4 workScore decides where a work drifts', () => {
  const land = async (key: string) => {
    const { db } = memDb(q([continents, [MERCURY]], [users, [[{ onboarding: { birthYear: 1995 } }]]], [planetPosts, [WORKS]]), [{ rows: [{ id: 'oshi', dachi: false }] }]);
    return new ContinentsService(db as never).land('me', 'mercury', key);
  };
  it('+3 main, +2 per mood, −2 out of the BPM range; score ≥ 2 drifts; best first', async () => {
    const edm = await land('edm');
    // mine: 3 + 2 = 5; bon: 3; slowedm: 3 − 2 = 1 (out)
    expect(edm.works.map((w) => [w.id, w.score, w.rel])).toEqual([
      ['mine', 5, 'own'],
      ['bon', 3, 'stranger'],
    ]);
    // a ballad at 120 BPM: 3 + 2 − 2 = 3, still there; the pushed stranger is 推し
    expect((await land('ballad')).works.map((w) => [w.id, w.score, w.rel])).toEqual([['fastballad', 3, 'oshi']]);
  });
  it('one work drifts to several continents', async () => {
    expect((await land('matsuri')).works.map((w) => w.id)).toEqual(['bon']);
    expect((await land('edm')).works.map((w) => w.id)).toContain('bon');
    expect((await land('rock')).works).toEqual([]);
  });
  it('a viewer under 15 meets no strangers on a continent; search counts nothing for them', async () => {
    const { db } = memDb(q([continents, [MERCURY, MERCURY]], [users, [[{ onboarding: { birthYear: 2014 } }], [{ onboarding: {} }]]]));
    const svc = new ContinentsService(db as never);
    expect(await svc.land('me', 'mercury', 'edm')).toMatchObject({ young: true, works: [] });
    expect((await svc.search('me', 'mercury', 'edm')).map((c) => [c.key, c.count])).toEqual([['edm', 0]]);
  });
  it('search: matched continents with how many public works drifted there', async () => {
    const { db } = memDb(q([continents, [MERCURY]], [users, [[{ onboarding: { birthYear: 1990 } }]]], [planetPosts, [WORKS]]));
    const r = await new ContinentsService(db as never).search('me', 'mercury', '', 'matsuri');
    expect(r.map((c) => [c.key, c.count])).toEqual([['matsuri', 1]]);
  });
});

// --- 2-3 report --------------------------------------------------------------------------------------------------

describe('2-3 a report is kept per work and the reporter stops seeing that person (one way, M-R317)', () => {
  it('report → user_reports (the work), the work hidden, the person hidden for the reporter only — no block, no follow touched', async () => {
    const { db, writes } = memDb(q([planetPosts, [[{ u: 'stranger' }]]]));
    const s = new WorkSafetyService(db as never);
    await s.report('me', 'planet_post', 'p1', { reason: 'mean' });
    expect(writes.map((w) => w.table)).toEqual([userReports, workHides, personHides]);
    expect(writes[0].v).toMatchObject({ reporterId: 'me', targetUserId: 'stranger', kind: 'planet-post', targetId: 'p1' });
    expect(writes[1].v).toEqual({ userId: 'me', kind: 'planet_post', targetId: 'p1' });
    expect(writes[2].v).toEqual({ userId: 'me', hiddenId: 'stranger' });
    expect(writes.some((w) => w.table === userBlocks || w.op === 'delete')).toBe(false);
  });
  it('the reported person is out of every planet place for the reporter: home (around, far), continents (landing, search counts), the old feeds', () => {
    const one = /NOT EXISTS \(SELECT 1 FROM person_hides ph WHERE ph\.user_id = \$\d+ AND ph\.hidden_id = "(\w+)"\."user_id"\)/;
    const since = flyingSince(new Date('2026-11-25T00:00:00Z'));
    const s = storeOf('saturn')!;
    for (const q1 of [aroundWhere(s, 'me', 'saturn_post', since), farWhere(s, 'me', 'saturn_post', since), continentWhere('me', 'saturn')!, planetWorkScope('me', saturnPosts.userId, 'saturn_post', saturnPosts.id)]) {
      const r = render(q1);
      expect(r.sql).toMatch(one);
      expect(r.params).toContain('me');
    }
    // one way: only the reporter's own rows (ph.user_id = the viewer) are read, never the other side's
    expect(render(continentWhere('me', 'jupiter')!).sql).not.toMatch(/ph\.hidden_id = \$/);
  });
  it('the blocked person’s works are out of every continent and the far scenery (both ways)', () => {
    expect(render(continentWhere('me', 'jupiter')!).sql).toMatch(/b\.blocker_id = \$\d+ AND b\.blocked_id = "jupiter_posts"\."user_id"\) OR \(b\.blocker_id = "jupiter_posts"\."user_id"/);
  });
});

// --- 2-5 favourites / Bluena ☆ / seen ----------------------------------------------------------------------------

describe('2-5 じぶんの空: five favourite slots', () => {
  const ten = [...MERCURY, cont('u1', { g: [], m: ['夜'] }, 8, 'member'), cont('z', { g: [], m: ['z'] }, 9)];
  it('never chosen: the operator’s first five', async () => {
    const { db } = memDb(q([continents, [ten]], [planetHomes, [[]]]));
    const v = await new ContinentsService(db as never).sky('me', 'mercury');
    expect(v.favourites).toEqual(['edm', 'hiphop', 'ballad', 'rock', 'chill']);
    expect(v.continents).toHaveLength(9);
    expect(v.continents[0]).toMatchObject({ key: 'edm', creator: null, pictures: { sky: null, land: null, shore: null } });
  });
  it('☆ fills an empty slot, FULL (409) when five, a slot swaps; the five at once must be valid', async () => {
    const svc = (saved: (string | null)[] | null) => {
      const m = memDb(q([continents, [ten]], [planetHomes, [[{ f: saved }]]]));
      return { svc: new ContinentsService(m.db as never), writes: m.writes };
    };
    const a = svc(['edm', null, 'rock', null, null]);
    expect(await a.svc.favourite('me', 'mercury', 'rain', true)).toEqual(['edm', 'rain', 'rock', null, null]);
    expect(a.writes[0]).toMatchObject({ table: planetHomes, v: { continentFavsJson: ['edm', 'rain', 'rock', null, null] } });
    await expect(svc(null).svc.favourite('me', 'mercury', 'rain', true)).rejects.toMatchObject({ status: 409 });
    expect(await svc(null).svc.favourite('me', 'mercury', 'rain', true, 0)).toEqual(['rain', 'hiphop', 'ballad', 'rock', 'chill']);
    expect(await svc(null).svc.favourite('me', 'mercury', 'rock', false)).toEqual(['edm', 'hiphop', 'ballad', null, 'chill']);
    await expect(svc(null).svc.favourite('me', 'mercury', 'nowhere', true)).rejects.toMatchObject({ status: 404 });
    await expect(svc(null).svc.setFavourites('me', 'mercury', ['edm', 'edm', null, null, null])).rejects.toMatchObject({ status: 400 });
    expect(await svc(null).svc.setFavourites('me', 'mercury', [null, null, 'u1', null, null])).toEqual([null, null, 'u1', null, null]);
  });
});

describe('2-5 the seen record and 〔旅〕', () => {
  it('〔旅〕 shows unseen continents first and records them as shown; landing records landed', async () => {
    const seen = [
      { userId: 'me', planet: 'mercury', key: 'edm', shownAt: new Date(1000), landedAt: null },
      { userId: 'me', planet: 'mercury', key: 'hiphop', shownAt: null, landedAt: new Date(500) },
    ];
    const { db, writes } = memDb(q([continents, [MERCURY, MERCURY]], [continentSeen, [seen]]));
    const svc = new ContinentsService(db as never);
    const now = new Date('2026-11-25T00:00:00Z');
    const picked = (await svc.travel('me', 'mercury', 6, now)).map((c) => c.key);
    expect(picked).toHaveLength(6);
    expect(picked.slice(0, 5).sort()).toEqual(['ballad', 'chill', 'matsuri', 'rain', 'rock']);
    // the oldest seen next (hiphop landed at 500 before edm shown at 1000)
    expect(picked[5]).toBe('hiphop');
    expect(writes.every((w) => w.table === continentSeen && (w.v as { shownAt: Date }).shownAt === now)).toBe(true);
    await svc.visit('me', 'mercury', 'rain', now);
    expect(writes.at(-1)).toMatchObject({ table: continentSeen, v: { key: 'rain', landedAt: now }, set: { landedAt: now } });
  });
});

describe('2-5 ☆ a work into Bluena', () => {
  it('someone else’s work (any kind) is kept as a link; not one’s own, not a blocked person’s, not a reported one’s', async () => {
    const m = memDb(q([userBlocks, [[], [{ x: 'b' }], []]], [personHides, [[], [{ x: 'me' }]]]));
    const svc = new PlanetWorksService(m.db as never, mockLlm);
    (svc as unknown as Record<string, unknown>).facts = async () => ({ userId: 'stranger', planet: 'jupiter', tags: { main: null, moods: [] }, words: '' });
    expect(await svc.save('me', 'jupiter_post', 'j1', true)).toEqual({ saved: true });
    expect(m.writes[0]).toMatchObject({ v: { userId: 'me', kind: 'jupiter_post', postId: 'j1' } });
    await expect(svc.save('me', 'jupiter_post', 'j1', true)).rejects.toThrow();
    await expect(svc.save('me', 'jupiter_post', 'j1', true)).rejects.toThrow();
    await expect(svc.save('stranger', 'jupiter_post', 'j1', true)).rejects.toThrow();
    expect(await svc.save('me', 'jupiter_post', 'j1', false)).toEqual({ saved: false });
  });
});

// keep the imports honest (tables the fakes key on)
void jupiterPosts;
