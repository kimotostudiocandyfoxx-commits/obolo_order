import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { flyingSince, PLANET_HOMES, PLANET_WORK_KINDS, spellFrom } from '@obolo/shared';
import { books, games, marsBackstage, mvProjects, planetPosts, planetWorkMeta, radioShows, songs } from '../db/schema';
import { bookFacts, gameFacts } from '../craft/craft.store';
import { aroundWhere, ownWhere, storeOf } from './planet-home.service';
import { workSeenWhere } from './planet-songs.service';
import { PlanetWorksService, type WorkFacts } from './planet-works.service';

/**
 * Handoff 05 (Mars, Venus, Uranus, Pluto, Neptune) on the API: Pluto's books and Neptune's games are wired into the home
 * feed once flown, every one of the five kinds carries its 05 tags at creation, and the backfill fills them where it can.
 */
const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(q);
const since = flyingSince(new Date('2026-11-25T12:00:00Z'));

describe('05 the stores of the five planets', () => {
  it('Pluto: books once flown; the words are the opening of chapter 1, the picture its cover', () => {
    expect(PLANET_HOMES.pluto.store).toBe('book');
    const s = storeOf('pluto')!;
    const own = render(ownWhere(s, 'me'));
    expect(own.sql).toContain('"books"."deleted_at" IS NULL AND "books"."flown_at" IS NOT NULL');
    expect(render(s.text).sql).toContain(`"books"."chapters_json" -> 0 ->> 'text'`);
    expect(render(s.thumb).sql).toBe('"books"."cover_url"');
    const around = render(aroundWhere(s, 'me', 'book', since));
    expect(around.sql).toContain('"books"."flown_at" >');
    expect(around.params).toContain('book');
  });
  it('Neptune: games once flown; the title and how to play of the version on its face', () => {
    expect(PLANET_HOMES.neptune.store).toBe('game');
    const s = storeOf('neptune')!;
    expect(render(s.live).sql).toBe('("games"."deleted_at" IS NULL AND "games"."flown_at" IS NOT NULL)');
    expect(render(s.text).sql).toContain(`"games"."versions_json" -> "games"."active" ->> 'howTo'`);
    expect(render(s.title).sql).toContain(`"games"."title"`);
    // story 2026-11-25: the case shows its picture (one of the maker's arts); none: the app's neon face
    expect(render(s.thumb).sql).toBe('"games"."cover_url"');
  });
  it('Uranus (story 2026-11-25): goods once flown; the words are its kind (the mock-up drawn), the picture its art; Mars / Venus as before', () => {
    expect(PLANET_HOMES.uranus.store).toBe('goods');
    const s = storeOf('uranus')!;
    expect(render(s.live).sql).toBe('("goods"."deleted_at" IS NULL AND "goods"."flown_at" IS NOT NULL)');
    expect(render(s.text).sql).toBe('"goods"."kind"');
    expect(render(s.thumb).sql).toBe('"goods"."art_url"');
    expect(render(workSeenWhere('me', 'uranus')).sql).toContain('"goods"."user_id" = $');
    expect(PLANET_WORK_KINDS).toContain('goods');
    expect(PLANET_HOMES.mars.store).toBe('planet_post');
    expect(PLANET_HOMES.venus.store).toBe('radio_show');
    expect(PLANET_WORK_KINDS).toEqual(expect.arrayContaining(['book', 'game']));
  });
  it('who may open a flown game / book from the planet: the maker, their dachi / 推し (any time), anyone it drifts to', () => {
    const q = render(workSeenWhere('me', 'neptune'));
    expect(q.sql).toContain('"games"."user_id" = $');
    expect(q.sql).toMatch(/JOIN follows g ON g\.follower_id = f\.followee_id/);
    expect(q.sql).toContain('NOT EXISTS (SELECT 1 FROM work_hides h');
    expect(q.sql).toContain(`"planet_work_meta"."check_state" = 'ok'`);
  });
});

describe('05 the tags at creation (2-1 remainder)', () => {
  it('a book: genre, length and feeling; a game: genre and how it is played', () => {
    const spell = spellFrom('novel', 'ちょっと怖い学校の話');
    const f = bookFacts({ userId: 'me', title: '夜の学校', spellJson: spell, chaptersJson: [{ n: 1, title: '第1章', text: 'あ'.repeat(2000), tags: spell, at: '', summary: '' }] });
    expect(f).toMatchObject({ userId: 'me', planet: 'pluto', tags: { main: 'ホラー', moods: ['短い', 'こわい', 'わくわく'] }, words: '夜の学校 第1章' });
    const g = gameFacts({ userId: 'me', title: 'old', active: 1, versionsJson: [{ code: '', title: 'old', howTo: '', tags: [], at: '', confirmId: 'c', kind: 'gameCheap' }, { code: '', title: 'ねこパズル', howTo: 'そろえて消す', tags: spellFrom('game', 'パズルでハイスコア'), at: '', confirmId: 'c', kind: 'gameCheap' }] as never });
    expect(g).toMatchObject({ planet: 'neptune', tags: { main: 'パズル', moods: ['ひとりで', 'じっくり'] }, words: 'ねこパズル そろえて消す' });
  });
});

/** a db whose selects answer from a queue per table, and whose writes are recorded */
function memDb(answers: Map<unknown, unknown[]>) {
  const writes: { table: unknown; v: Record<string, unknown> }[] = [];
  const reader = () => {
    let table: unknown;
    const chain: unknown = new Proxy(() => undefined, {
      get: (_t, k) => {
        if (k === 'then') return (ok: (v: unknown) => void) => Promise.resolve((answers.get(table) ?? []).shift() ?? []).then(ok);
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
  const insert = (table: unknown) => ({ values: (v: Record<string, unknown>) => (writes.push({ table, v }), { onConflictDoUpdate: async () => undefined }) });
  return { db: { read: { select: reader }, write: { select: reader, insert } }, writes };
}

describe('05 the backfill', () => {
  it('a Mars MV posted before (no tags) takes its song’s genre now; a Venus show its topic and how it is spoken; others are left', async () => {
    // the kororins without a topic (none), then the Mars posts and the Venus shows without tags
    const meta = [[], [{ id: 'mv1' }, { id: 'clip1' }], [{ id: 'show1' }]];
    const { db, writes } = memDb(new Map<unknown, unknown[]>([[planetWorkMeta, meta]]));
    const svc = new PlanetWorksService(db as never, { name: 'mock', chat: async () => 'OK' } as never);
    const facts: Record<string, WorkFacts | null> = {
      mv1: { userId: 'u', planet: 'mars', tags: { main: 'EDM', moods: ['夜'], bpm: null }, words: '夜の街' },
      clip1: { userId: 'u', planet: 'mars', tags: { main: null, moods: [], bpm: null }, words: '' },
      show1: { userId: 'u', planet: 'venus', tags: { main: '雑談', moods: ['ゆったり'], bpm: null }, words: 'ねこラジオ' },
    };
    (svc as unknown as Record<string, unknown>).facts = async (_k: string, id: string) => facts[id] ?? null;
    const done = await svc.backfill(10);
    expect(done).toMatchObject({ planet_post: 1, radio_show: 1, book: 0, game: 0 });
    expect(writes.map((w) => [w.v.workId, w.v.main])).toEqual([
      ['mv1', 'EDM'],
      ['show1', '雑談'],
    ]);
  });
  it('an MV’s tags are its song’s: the 裏スタジオ video → the MV → the song', async () => {
    const { db } = memDb(new Map<unknown, unknown[]>([[planetPosts, [[{ design: { genre: 'ローファイヒップホップ', mood: 'チル' } }]]]]));
    const svc = new PlanetWorksService(db as never, { name: 'mock' } as never);
    const t = await (svc as unknown as { mvTagsOf: (id: string) => Promise<{ main: string | null; moods: string[] }> }).mvTagsOf('p1');
    expect(t).toMatchObject({ main: 'ローファイ', moods: expect.arrayContaining(['チル']) });
    // the joins it reads through (kept honest if a table is renamed)
    expect([marsBackstage, mvProjects, songs, radioShows, books, games].every(Boolean)).toBe(true);
  });
});

describe('Venus (story 2026-11-25): a show’s topic from the text model, as Saturn’s kororin; the word rules as the fallback', () => {
  const facts: WorkFacts = { userId: 'u', planet: 'venus', tags: { main: '雑談', moods: ['深夜', 'トーク'], bpm: null }, words: '好きな人の話をするラジオ' };
  it('the model’s topic; the moods stay how the show is spoken', async () => {
    const seen: string[] = [];
    const svc = new PlanetWorksService({} as never, { name: 'gemini', chat: async (r: { history: { text: string }[] }) => (seen.push(r.history[0].text), '{"topic":"恋バナ"}') } as never);
    expect(await svc.tagsFor('radio_show', facts)).toEqual({ main: '恋バナ', moods: ['深夜', 'トーク'], bpm: null });
    expect(seen[0]).toContain('好きな人の話をするラジオ');
  });
  it('a failing model (or offline) keeps the word rules’ topic', async () => {
    const down = new PlanetWorksService({} as never, { name: 'gemini', chat: async () => Promise.reject(new Error('quota')) } as never);
    expect(await down.tagsFor('radio_show', facts)).toEqual(facts.tags);
    const off = new PlanetWorksService({} as never, { name: 'mock', chat: async () => 'OK' } as never);
    expect(await off.tagsFor('radio_show', facts)).toEqual(facts.tags);
  });
});
