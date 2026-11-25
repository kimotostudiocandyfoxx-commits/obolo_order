import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { SongPhrase } from '@obolo/shared';
import { timedLyrics } from '../compose/lyrics';
import { PlanetSongsService, songSeenWhere } from './planet-songs.service';

const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(q);

/** a db whose one select answers `rows` */
const dbOf = (rows: unknown[]) => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => Promise.resolve(rows).then(ok) : () => chain),
    apply: () => chain,
  });
  return { read: { select: () => chain } } as never;
};

const phrase = (i: number, text: string, startBeat: number, beats = 8, seconds = 3): SongPhrase => ({ index: i, section: i === 2 ? 'chorus' : 'verse', text, slot: 'self', url: `p${i}.mp3`, seconds, startBeat, beats });

describe('02 §2 a song’s lyrics and their times (M-R288)', () => {
  it('each line starts where the song puts it: its beat, the delay, the gaps before it, the tempo', () => {
    const lines = timedLyrics([phrase(0, '青い空に', 0), phrase(1, '', 8), phrase(2, '波の音が', 16)], { bpm: 120 }, { tempo: 1, delayBeats: 4, gaps: [0, 1] });
    // 120 bpm: a beat is 0.5 s; the delay of 4 beats = 2 s; the gap after line 1 (no words) pushes line 2 by 1 s
    expect(lines.map((l) => [l.t, l.text])).toEqual([
      [2, '青い空に'],
      [11, '波の音が'],
    ]);
    expect(lines[0].end).toBeLessThanOrEqual(6);
    expect(lines[1].chorus).toBe(true);
    // a faster song (tempo 1.25) comes sooner
    expect(timedLyrics([phrase(0, 'a', 8)], { bpm: 120 }, { tempo: 1.25, delayBeats: 0, gaps: [] })[0].t).toBeCloseTo(3.2);
  });
  it('a song without words has no lyrics (it plays without them)', () => {
    expect(timedLyrics([phrase(0, '  ', 0)], { bpm: 100 }, null)).toEqual([]);
  });
});

describe('02 §2 GET /planet-works/planet_post/:id/song', () => {
  it('the sound, jacket, title and timed lyrics; no title voice yet', async () => {
    const svc = new PlanetSongsService(dbOf([{ id: 's1', title: '夏のはじまり', url: 'https://x/s.m4a', art: 'https://x/j.webp', seconds: 61, phrases: [phrase(0, '青い空に', 0)], design: { bpm: 120 }, mix: { tempo: 1, delayBeats: 0, gaps: [] } }]));
    const v = await svc.song('me', 's1');
    expect(v).toMatchObject({ kind: 'planet_post', id: 's1', title: '夏のはじまり', url: 'https://x/s.m4a', art: 'https://x/j.webp', titleVoice: null });
    expect(v.lyrics).toEqual([{ t: 0, end: expect.any(Number), text: '青い空に' }]);
  });
  it('a post with no song behind it plays without lyrics', async () => {
    const v = await new PlanetSongsService(dbOf([{ id: 's2', title: 't', url: 'u', art: null, seconds: null, phrases: null, design: null, mix: null }])).song('me', 's2');
    expect(v.lyrics).toEqual([]);
  });
  it('not seen by this viewer (or gone): 404', async () => {
    await expect(new PlanetSongsService(dbOf([])).song('me', 'x')).rejects.toMatchObject({ status: 404 });
  });
  it('seen by: its maker, their dachi / 推し, or a stranger only when it is public in effect (a dachi song never)', () => {
    const q = render(songSeenWhere('viewer-1')).sql;
    expect(q).toContain('"planet_posts"."user_id" = $');
    expect(q).toContain('SELECT f.followee_id FROM follows f');
    expect(q).toContain("= 'public'");
    expect(q).toContain("\"planet_work_meta\".\"check_state\" = 'ok'");
    expect(q).toContain('user_blocks');
  });
});
