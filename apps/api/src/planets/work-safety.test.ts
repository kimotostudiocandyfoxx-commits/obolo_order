import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { planetWorkScope, viewerSeesAuthor, youngViewer } from '../common/child';
import { planetPosts } from '../db/schema';
import { WorkSafetyService } from './work-safety.service';

const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(q);

describe('M-R213: under 15 (or no birth year) sees only dachi works', () => {
  const now = new Date('2026-11-22T00:00:00Z');
  it('who counts as young', () => {
    expect(youngViewer(null, now)).toBe(true);
    expect(youngViewer(undefined, now)).toBe(true);
    expect(youngViewer(2014, now)).toBe(true);
    expect(youngViewer(2012, now)).toBe(true);
    expect(youngViewer(2011, now)).toBe(false);
    expect(youngViewer(1990, now)).toBe(false);
  });
  it('the feed filter: own, a dachi (mutual follow), or any author when the viewer is not young', () => {
    const q = render(viewerSeesAuthor('viewer-1', planetPosts.userId));
    expect(q.sql).toContain('"planet_posts"."user_id" = $1');
    // dachi = mutual follows
    expect(q.sql).toMatch(/JOIN follows g ON g\.follower_id = f\.followee_id AND g\.followee_id = f\.follower_id/);
    // a missing birth year counts as young (9999)
    expect(q.sql).toContain("COALESCE(NULLIF(v.onboarding_json->>'birthYear', '')::int, 9999) >");
    expect(q.sql).toContain('OR NOT EXISTS');
    expect(q.params).toEqual(['viewer-1', 'viewer-1', 'viewer-1', 15]);
  });
  it('hidden works never come back for that viewer', () => {
    const q = render(planetWorkScope('viewer-1', planetPosts.userId, 'planet_post', planetPosts.id));
    expect(q.sql).toContain('NOT EXISTS (SELECT 1 FROM work_hides h WHERE h.user_id = $');
    expect(q.sql).toContain('h.target_id = "planet_posts"."id"');
    expect(q.params).toContain('planet_post');
  });
});

describe('M-R213: 〔見えなくする〕 and 〔通報〕', () => {
  const make = (authorOf: Record<string, string>) => {
    const inserted: { table: unknown; v: Record<string, unknown> }[] = [];
    let deleted = 0;
    const db = {
      write: {
        insert: (table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            inserted.push({ table, v });
            return { onConflictDoNothing: async () => undefined, then: (ok: () => void) => ok() };
          },
        }),
        delete: () => ({ where: async () => void deleted++ }),
      },
    };
    const s = new WorkSafetyService(db as never);
    (s as unknown as { author: (k: string, id: string) => Promise<string | null> }).author = async (_k, id) => authorOf[id] ?? null;
    return { s, inserted, deleted: () => deleted };
  };

  it('hides a stranger’s work for the viewer only, and can show it again', async () => {
    const { s, inserted, deleted } = make({ w1: 'stranger' });
    expect(await s.hide('me', 'saturn_post', 'w1', true)).toEqual({ hidden: true });
    expect(inserted[0].v).toEqual({ userId: 'me', kind: 'saturn_post', targetId: 'w1' });
    expect(await s.hide('me', 'saturn_post', 'w1', false)).toEqual({ hidden: false });
    expect(deleted()).toBe(1);
  });

  it('one’s own work or a missing one cannot be hidden or reported', async () => {
    const { s } = make({ mine: 'me' });
    await expect(s.hide('me', 'jupiter_post', 'mine', true)).rejects.toThrow();
    await expect(s.hide('me', 'jupiter_post', 'nope', true)).rejects.toThrow();
    await expect(s.report('me', 'planet_post', 'mine', { reason: 'mean' })).rejects.toThrow();
  });

  it('a report goes into the team’s report list', async () => {
    const { s, inserted } = make({ w2: 'stranger' });
    await s.report('me', 'radio_show', 'w2', { reason: 'scary', note: 'こわい' });
    expect(inserted[0].v).toEqual({ reporterId: 'me', targetUserId: 'stranger', kind: 'radio-show', targetId: 'w2', reason: 'scary', note: 'こわい' });
  });
});
