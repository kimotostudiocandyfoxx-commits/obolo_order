import { FindTalksQuery, FindWorksQuery, nextStars, SetItemMarkBody, talkDays } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { FindsService, likeOf } from './finds.service';

describe('M-R236: ★ and marks', () => {
  it('a tap goes ★ → ★★ → ★★★ → none', () => {
    expect([0, 1, 2, 3].map(nextStars)).toEqual([1, 2, 3, 0]);
  });
  it('the body: one mark of four, up to three stars', () => {
    expect(SetItemMarkBody.safeParse({ kind: 'song', id: 'x', stars: 2, mark: 'heart' }).success).toBe(true);
    expect(SetItemMarkBody.safeParse({ kind: 'song', id: 'x', stars: 4, mark: null }).success).toBe(false);
    expect(SetItemMarkBody.safeParse({ kind: 'song', id: 'x', stars: 1, mark: 'joker' }).success).toBe(false);
    expect(SetItemMarkBody.safeParse({ kind: 'other', id: 'x', stars: 1, mark: null }).success).toBe(false);
  });
  it('the query strings: star=1 is on, star=0 / none is off', () => {
    expect(FindWorksQuery.parse({ star: '1', planet: 'mercury' })).toMatchObject({ star: true, planet: 'mercury' });
    expect(FindWorksQuery.parse({ star: '0' }).star).toBe(false);
    expect(FindWorksQuery.parse({}).star).toBeFalsy();
    expect(FindTalksQuery.safeParse({ star: '1' }).success).toBe(false);
  });
  it('the search words are literal in ILIKE', () => {
    expect(likeOf('50%_off')).toBe('%50\\%\\_off%');
  });

  it('a row with no ★ and no mark is deleted, else upserted', async () => {
    const calls: string[] = [];
    const db = {
      write: {
        delete: () => ({ where: async () => void calls.push('delete') }),
        insert: () => ({ values: (v: unknown) => ({ onConflictDoUpdate: async () => void calls.push(`upsert ${JSON.stringify(v)}`) }) }),
      },
    };
    const s = new FindsService(db as never, {} as never);
    await s.setMark('u', { kind: 'song', id: 's1', stars: 0, mark: null });
    await s.setMark('u', { kind: 'song', id: 's1', stars: 2, mark: 'spade' });
    expect(calls).toEqual(['delete', 'upsert {"userId":"u","kind":"song","targetId":"s1","stars":2,"mark":"spade"}']);
  });
});

describe('M-R237: a thread as days', () => {
  const lines = [
    { id: 'a', at: '2026-11-20T01:00:00Z', who: 'me', text: 'おはよう' },
    { id: 'b', at: '2026-11-20T01:01:00Z', who: 'bati', text: '曲を作ろう' },
    { id: 'c', at: '2026-11-21T16:00:00Z', who: 'bati', text: 'こんばんは' },
  ];
  const marks: Record<string, { stars: number; mark: 'heart' | null }> = { b: { stars: 2, mark: 'heart' } };
  it('newest first, Japan days, the first words, the most stars and the mark', () => {
    const d = talkDays(lines, (id) => marks[id]);
    expect(d.map((x) => x.day)).toEqual(['2026-11-22', '2026-11-20']);
    expect(d[1]).toMatchObject({ first: 'おはよう', count: 2, stars: 2, mark: 'heart' });
  });
  it('the strip and the search box keep only the days that match', () => {
    expect(talkDays(lines, (id) => marks[id], { star: true }).map((x) => x.day)).toEqual(['2026-11-20']);
    expect(talkDays(lines, (id) => marks[id], { mark: 'heart' }).length).toBe(1);
    expect(talkDays(lines, (id) => marks[id], { q: 'こんばん' }).map((x) => x.day)).toEqual(['2026-11-22']);
  });
});
