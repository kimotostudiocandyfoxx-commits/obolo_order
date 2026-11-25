import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { flyingSince, PLANET_HOMES } from '@obolo/shared';
import { aroundWhere, farWhere, ownWhere, personWhere, PlanetHomeService, storeOf, toWork } from './planet-home.service';

const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(q);
const now = new Date('2026-11-23T12:00:00Z');
const since = flyingSince(now);
const saturn = storeOf('saturn')!;

describe('星のホーム feed SQL (M-R258 / M-R257)', () => {
  it('own works: no time limit (kept forever), flown kororins only', () => {
    const q = render(ownWhere(saturn, 'me'));
    expect(q.sql).toContain('"saturn_posts"."user_id" = $1');
    expect(q.sql).toContain('"saturn_posts"."room" = 0');
    expect(q.sql).not.toContain('created_at" >');
    expect(q.params).toEqual(['me']);
  });
  it('around: flown within the last 88 hours, dachi or (推し for a viewer who is not young, maker not young), not hidden, not blocked', () => {
    const q = render(aroundWhere(saturn, 'me', 'saturn_post', since));
    expect(q.sql).toContain('"saturn_posts"."created_at" >');
    expect(q.params).toContain(since);
    expect(now.getTime() - since.getTime()).toBe(88 * 3600_000);
    expect(q.sql).toMatch(/JOIN follows g ON g\.follower_id = f\.followee_id AND g\.followee_id = f\.follower_id/);
    expect(q.sql).toContain('SELECT f.followee_id FROM follows f WHERE f.follower_id = $');
    // the 推し branch is closed for a young viewer (or one with no birth year: 9999) and for a young maker
    expect(q.sql).toContain("AND NOT EXISTS (SELECT 1 FROM users v WHERE v.id = $");
    expect(q.sql).toContain("COALESCE(NULLIF(v.onboarding_json->>'birthYear', '')::int, 9999)");
    expect(q.sql).toContain("AND NOT EXISTS (SELECT 1 FROM users a WHERE a.id = \"saturn_posts\".\"user_id\"");
    expect(q.sql).toContain('NOT EXISTS (SELECT 1 FROM work_hides h');
    expect(q.sql).toContain('user_blocks b');
  });
  it('far: strangers only, never for a young viewer, never a young maker, within 88 hours', () => {
    const q = render(farWhere(storeOf('jupiter')!, 'me', 'jupiter_post', since));
    expect(q.sql).toContain('"jupiter_posts"."user_id" NOT IN (SELECT f.followee_id FROM follows f');
    expect(q.sql).toContain('AND NOT EXISTS (SELECT 1 FROM users v');
    expect(q.sql).toContain('AND NOT EXISTS (SELECT 1 FROM users a');
    expect(q.sql).toContain('"jupiter_posts"."created_at" >');
  });
  it('04 §3 a person: yourself = your own works; someone else = only one who reaches your home, without the 88 hours', () => {
    expect(render(personWhere(saturn, 'me', 'saturn_post', 'me')).sql).toBe(render(ownWhere(saturn, 'me')).sql);
    const q = render(personWhere(saturn, 'me', 'saturn_post', 'u2'));
    expect(q.params).toContain('u2');
    expect(q.sql).not.toContain('created_at" >');
    expect(q.sql).toMatch(/JOIN follows g ON g\.follower_id = f\.followee_id/);
    expect(q.sql).toContain('AND NOT EXISTS (SELECT 1 FROM users v WHERE v.id = $');
    expect(q.sql).toContain('NOT EXISTS (SELECT 1 FROM work_hides h');
    expect(q.sql).toContain('user_blocks b');
  });
  it('every planet in the config has a store or answers empty; Mercury and Mars share planet_posts by planet', () => {
    for (const p of Object.keys(PLANET_HOMES) as (keyof typeof PLANET_HOMES)[]) expect(!!storeOf(p)).toBe(!!PLANET_HOMES[p].store);
    expect(render(ownWhere(storeOf('mars')!, 'me')).params).toContain('mars');
    expect(render(ownWhere(storeOf('venus')!, 'me')).sql).toContain("\"radio_shows\".\"status\" = 'public'");
  });
});

/** a fake db: each select()/execute() takes the next answer in order */
function fakeDb(answers: unknown[], writes: unknown[] = []) {
  const next = () => Promise.resolve(answers.shift());
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void, no: (e: unknown) => void) => next().then(ok, no) : () => chain()),
      apply: () => chain(),
    });
  const w = {
    insert: () => ({ values: (v: unknown) => (writes.push(v), { onConflictDoNothing: async () => undefined, onConflictDoUpdate: async () => undefined }) }),
    delete: () => ({ where: async () => void writes.push('delete') }),
  };
  return { read: { select: () => chain(), execute: () => chain() }, write: { ...w, select: () => chain() } };
}

const row = (id: string, userId: string, hoursAgo: number) => ({ id, userId, flownAt: new Date(now.getTime() - hoursAgo * 3600_000), text: 'こんにちは', title: '', url: 'u', thumb: null, seconds: 2, name: userId, pic: null });

describe('PlanetHomeService', () => {
  it('person: a dachi past kororins newest first with their ball; nobody reachable → no person at all', async () => {
    const db = fakeDb([[{ ...row('p1', 'u2', 200), ball: 'ball.webp', figure: 'chibi.webp' }, row('p2', 'u2', 300)], { rows: [{ id: 'u2' }] }, []]);
    const svc = new PlanetHomeService(db as never);
    const v = await svc.person('me', 'saturn', 'u2');
    expect(v.rel).toBe('dachi');
    expect(v.works.map((w) => w.id)).toEqual(['p1', 'p2']);
    expect(v.person).toEqual({ id: 'u2', name: 'u2', figure: 'chibi.webp', ball: 'ball.webp' });
    expect(await svc.person('me', 'saturn', 'stranger')).toEqual({ planet: 'saturn', person: null, rel: null, works: [] });
  });
  it('feed: own in your order then newest, dachi white / 推し pink, Saturn has no far scenery', async () => {
    const db = fakeDb([
      [{ id: 'me', name: 'ネオ', onboarding: { birthYear: 1999 } }],
      [{ lastVisitAt: new Date('2026-11-22T00:00:00Z'), orderJson: ['o2'] }],
      [row('o1', 'me', 1), row('o2', 'me', 9000)],
      [row('a1', 'dachi', 2), row('a2', 'oshi', 3)],
      { rows: [{ id: 'dachi' }] },
    ]);
    const v = await new PlanetHomeService(db as never).feed('me', 'saturn', now);
    expect(v.live).toBe(true);
    expect(v.young).toBe(false);
    expect(v.own.map((w) => w.id)).toEqual(['o1', 'o2']);
    expect(v.own.every((w) => w.rel === 'own')).toBe(true);
    expect(v.around.map((w) => [w.id, w.rel])).toEqual([
      ['a1', 'dachi'],
      ['a2', 'oshi'],
    ]);
    expect(v.far).toEqual([]);
    expect(v.lastVisitAt).toBe('2026-11-22T00:00:00.000Z');
  });
  it('feed: a viewer under 15 never gets far scenery', async () => {
    const db = fakeDb([[{ id: 'me', name: 'ネオ', onboarding: { birthYear: 2014 } }], [], [], [], { rows: [] }]);
    const v = await new PlanetHomeService(db as never).feed('me', 'jupiter', now);
    expect(v.young).toBe(true);
    expect(v.far).toEqual([]);
  });
  it('feed: a planet with no store yet answers with your place only', async () => {
    const db = fakeDb([[{ id: 'me', name: 'ネオ', onboarding: {} }], []]);
    const v = await new PlanetHomeService(db as never).feed('me', 'uranus', now);
    expect(v).toMatchObject({ live: false, own: [], around: [], far: [], young: true });
  });
  it('〔推す〕: a young viewer cannot push a stranger, nor anyone a young stranger; a dachi stays in the list', async () => {
    const svc = (answers: unknown[], writes: unknown[] = []) => new PlanetHomeService(fakeDb(answers, writes) as never);
    await expect(svc([[{ onboarding: { birthYear: 2014 } }], [{ onboarding: { birthYear: 1990 } }], { rows: [] }]).push('me', 'x', now)).rejects.toThrow();
    await expect(svc([[{ onboarding: { birthYear: 1990 } }], [{ onboarding: { birthYear: 2014 } }], { rows: [] }]).push('me', 'x', now)).rejects.toThrow();
    const writes: unknown[] = [];
    const ok = await svc([[{ onboarding: { birthYear: 1990 } }], [{ onboarding: { birthYear: 1995 } }], { rows: [] }, [], [{ id: 'x', name: 'X', pic: null }], { rows: [] }], writes).push('me', 'x', now);
    expect(writes).toContainEqual({ followerId: 'me', followeeId: 'x' });
    expect(ok).toEqual([{ id: 'x', name: 'X', pic: null, dachi: false }]);
    await expect(svc([{ rows: [{ id: 'd' }] }]).unpush('me', 'd')).rejects.toThrow();
    await expect(svc([[{ onboarding: {} }], [{ onboarding: {} }], { rows: [{ id: 'd' }] }, [], [], { rows: [] }]).push('me', 'd', now)).resolves.toEqual([]);
  });
});

describe('Jupiter (03): the art title and the wing cut in the feed', () => {
  it("a Jupiter post's title is its own (none: '')", () => {
    const q = render(storeOf('jupiter')!.title);
    expect(q.sql).toBe(`COALESCE("jupiter_posts"."title", '')`);
  });
  it("author.wings: the maker's measured cut, only with their figure; none when unmeasured or not Jupiter", () => {
    const base = { id: 'w', userId: 'u', flownAt: now, text: '夜の森', title: '月と海', url: 'u', thumb: null, seconds: null, name: 'U', pic: null };
    expect(toWork({ ...base, figure: 'https://x/j.png', wings: '21,74' }, 'jupiter_post', 'dachi').author.wings).toEqual({ l: 21, r: 74 });
    expect(toWork({ ...base, figure: 'https://x/j.png', wings: 'none' }, 'jupiter_post', 'dachi').author.wings).toBeNull();
    expect(toWork({ ...base, figure: null, wings: '21,74' }, 'jupiter_post', 'dachi').author.wings).toBeNull();
    expect('wings' in toWork({ ...base, figure: 'https://x/s.png' }, 'saturn_post', 'dachi').author).toBe(false);
    expect(toWork(base, 'jupiter_post', 'own').title).toBe('月と海');
  });
});
