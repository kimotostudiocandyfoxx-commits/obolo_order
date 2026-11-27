import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppConfig } from '../config';
import { Database } from '../db/db';
import { ChibiBackfillController } from './chibi-backfill.controller';

/**
 * The planets' readiness report and the figure backfills' own SQL, on a real Postgres with every migration applied.
 * Skipped without one:  TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/obolo npx vitest run src/look/readiness.pg.test.ts
 * (an empty database made from apps/api/drizzle/*.sql; the test only writes rows it removes again).
 */
const URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL)('GET /admin/planets-readiness on Postgres (M-R326)', () => {
  let db: Database;
  const ids: string[] = [];
  const cfg = { ADMIN_TOKEN: 't' } as unknown as AppConfig;
  const kv = { incr: async () => 1, get: async () => null, set: async () => undefined } as never;
  const calls: string[] = [];
  const figures = {
    recut: async (id: string) => (calls.push(`recut:${id}`), { checked: 1, changed: 1, holes: 1, failed: 0, eaten: 0 }),
    repaintOld: async (id: string) => (calls.push(`repaint:${id}`), { repainted: 1, failed: 0, painted: 1 }),
  } as never;
  const req = { protocol: 'https', get: () => 'api' } as never;
  let c: ChibiBackfillController;

  const user = async (name: string, look: string | null, figuresJson: unknown, voice: string | null = null) => {
    const r = (await db.write.execute(
      sql`INSERT INTO users (email, handle, display_name, avatar_url, planet_figures, voice_self_id) VALUES (${`${name}@readiness.test`}, ${`rd_${name}`}, ${name}, ${look}, ${figuresJson ? JSON.stringify(figuresJson) : null}::jsonb, ${voice}) RETURNING id`,
    )) as unknown as { rows: { id: string }[] };
    ids.push(r.rows[0].id);
    return r.rows[0].id;
  };
  const ALL = (extra: Record<string, string> = {}) => ({
    ...Object.fromEntries(['saturnChibi', 'saturnBall', 'jupiter', 'mercury', 'mars', 'venus', 'uranus', 'pluto', 'neptune'].flatMap((f) => [[f, `https://x/${f}.png`], [`${f}#cut`, '2:colour']])),
    'jupiter#wings': '20,76',
    'mars#v': '2',
    ...extra,
  });

  beforeAll(async () => {
    db = new Database({ DATABASE_URL: URL!, DB_POOL_MAX: 2 } as AppConfig);
    await db.write.execute(sql`DELETE FROM users WHERE email LIKE '%@readiness.test'`);
    c = new ChibiBackfillController(db, {} as never, cfg, kv, figures);
  });
  afterAll(async () => {
    for (const t of ['planet_posts', 'songs', 'games']) await db.write.execute(sql`DELETE FROM ${sql.raw(t)} WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@readiness.test')`);
    await db.write.execute(sql`DELETE FROM users WHERE email LIKE '%@readiness.test'`);
    await db.close();
  });

  it('counts what is not ready, and the backfills pick exactly those members', async () => {
    const before = await c.readiness('t', '1.1.1.1');
    // ready: every figure of the look worn now, cut by the checked cut, wings measured, Mars on the prompt of now
    await user('ready', 'https://x/a.png', { 'https://x/a.png': ALL() });
    // a look but no figures at all
    await user('none', 'https://x/b.png', null);
    // figures of before: no cut mark, no wing cut, Mars with the light beam; and an older look kept the same way
    const old = await user('old', 'https://x/c.png', {
      'https://x/c.png': Object.fromEntries(['saturnChibi', 'saturnBall', 'jupiter', 'mercury', 'mars', 'venus', 'uranus', 'pluto', 'neptune'].map((f) => [f, `https://x/${f}.png`])),
      'https://x/c0.png': { mars: 'https://x/m0.png', 'mars#cut': 'r2' },
    });
    // a re-cut that failed its checks, a painting whose cut failed every retry (not shown), a Mars repaint that failed
    await user('marked', 'https://x/d.png', { 'https://x/d.png': ALL({ 'venus#cut': 'x2:area+shape', 'pluto#cutfail': 'colour:shape|model:area', 'mars#v': '2x' }) });
    const noPluto = ALL({ 'pluto#cutfail': 'colour:shape|model:area|repaint:vision|repaint2:area' });
    delete (noPluto as Record<string, string>).pluto;
    await user('hidden', 'https://x/e.png', { 'https://x/e.png': noPluto });
    // a game without tags; a Mercury song of a member with a voice, its title not read
    const voiced = await user('voiced', null, null, 'voice-1');
    await db.write.execute(sql`INSERT INTO games (user_id, title) VALUES (${voiced}, 'g')`);
    const s = (await db.write.execute(
      sql`INSERT INTO songs (user_id, title, phrases_json, mix_json, direction_json, mix_url, seconds, design_json, instrumental_url) VALUES (${voiced}, 'うた', '[]', '{}', '{}', 'https://x/s.m4a', 60, '{}', 'https://x/i.m4a') RETURNING id`,
    )) as unknown as { rows: { id: string }[] };
    await db.write.execute(sql`INSERT INTO planet_posts (user_id, planet, kind, url, title, source_id) VALUES (${voiced}, 'mercury', 'song', 'https://x/s.m4a', 'うた', ${s.rows[0].id})`);

    const r = await c.readiness('t', '1.1.1.1');
    const d = (k: keyof typeof r.figures) => r.figures[k] - before.figures[k];
    expect(r.ready).toBe(false);
    expect(r.membersWithLook - before.membersWithLook).toBe(5);
    expect(d('membersMissing')).toBe(2); // none, hidden (its Pluto)
    expect(d('membersWithNone')).toBe(1);
    expect(d('membersToRecut')).toBe(1); // old
    expect(d('figuresToRepaint')).toBe(1); // marked: venus x2
    expect(d('cutFailures')).toBe(1); // hidden's Pluto (marked's Pluto is shown: an older failure)
    expect(d('oldPrompt')).toBe(1); // old's Mars (marked's '2x' was tried)
    expect(d('oldPromptOtherLooks')).toBe(1); // old's other look
    expect(d('wingsNotMeasured')).toBe(1);
    expect(r.worksWithoutTags.game - before.worksWithoutTags.game).toBe(1);
    expect(r.worksWithoutTags.planet_post - before.worksWithoutTags.planet_post).toBe(1);
    expect(r.songsWithoutTitleVoice - before.songsWithoutTitleVoice).toBe(1);

    // the backfills' own picks (the service is a stand-in: only who is picked matters here)
    const recut = await c.recut('t', '1.1.1.1', req, '200');
    expect(calls.filter((x) => x.startsWith('recut:') && ids.includes(x.slice(6)))).toEqual([`recut:${old}`]);
    expect(recut.members).toBeGreaterThanOrEqual(1);
    await c.repaint('t', '1.1.1.1', req, '100');
    expect(calls.filter((x) => x.startsWith('repaint:') && ids.includes(x.slice(8)))).toEqual([`repaint:${old}`]);
  });
});
