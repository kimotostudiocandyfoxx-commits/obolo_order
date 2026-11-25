import 'reflect-metadata';
import { ABSORBED_FEATURES, makeCostEstimates, titleVoiceUsd, type FullSongBody, type RunwareAudioTask } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import type { JobName, JobPayloads } from '../infra/queue';
import { PlanetSongsService } from '../planets/planet-songs.service';
import { costScope, featureOfJob } from '../wallet/cost-scope';
import { SongService } from './song.service';
import { SongTitleVoiceService, titleKey, titleVoiceOf, type TitleVoice } from './song-title-voice.service';

type Job = JobPayloads['song.title'];

/** the service over an in-memory world: members (their voice model), songs, a queue run by hand, a fake Fish */
function world(o: { voice?: string | null; fishOn?: boolean; fishFails?: boolean; queueFails?: boolean } = {}) {
  const voices = new Map<string, string | null>([['u1', o.voice === undefined ? 'fish-u1' : o.voice]]);
  const songs = new Map<string, { userId: string; title: string; design: Record<string, unknown> }>();
  const queued: { name: JobName; p: Job; key?: string }[] = [];
  const spoken: { ref: string; text: string }[] = [];
  const stored: string[] = [];
  const removed: string[] = [];
  const queue = {
    register: () => undefined,
    enqueue: async (name: JobName, p: Job, opts?: { dedupeKey?: string }) => {
      if (o.queueFails) throw new Error('queue down');
      queued.push({ name, p, key: opts?.dedupeKey });
    },
  };
  const models = {
    enabled: o.fishOn ?? true,
    speak: async (ref: string, text: string) => {
      if (o.fishFails) throw new Error('fish 402');
      spoken.push({ ref, text });
      return Buffer.from(`mp3:${text}`);
    },
  };
  const media = {
    storeAudio: async (_u: string, _m: string, data: Buffer) => {
      const url = `https://cdn/${stored.length + 1}-${data.toString()}.mp3`;
      stored.push(url);
      return { url };
    },
    removeByUrl: async (_u: string, url: string) => void removed.push(url),
  };
  const svc = new SongTitleVoiceService({} as never, media as never, queue as never, models as never);
  const posts: { userId: string; songId: string; title: string }[] = [];
  Object.assign(svc, {
    voiceOf: async (userId: string) => (models.enabled ? (voices.get(userId) ?? null) : null),
    songOf: async (userId: string, id: string) => {
      const s = songs.get(id);
      return s && s.userId === userId ? { title: s.title, design: s.design } : undefined;
    },
    keep: async (id: string, v: TitleVoice) => void (songs.get(id)!.design.titleVoice = v),
    backfillRows: async (n: number) => posts.filter((p) => !titleVoiceOf(songs.get(p.songId)?.design, p.title)).slice(0, n),
  });
  /** run what is queued, as the queue would (each job in its own scope) */
  const drain = async () => {
    while (queued.length) {
      const j = queued.shift()!;
      await costScope.run({ feature: featureOfJob(j.name), userId: j.p.userId }, async () => {
        await svc.make(j.p);
        scopes.push({ ...costScope.get()! });
      });
    }
  };
  const scopes: ReturnType<typeof costScope.get>[] = [];
  return { svc, voices, songs, queued, spoken, stored, removed, drain, posts, scopes };
}

describe('client 2026-11-25: a song’s title read in its maker’s own voice (Mercury)', () => {
  it('a member with a registered voice: only the title is read in that voice, kept, and saved on the song', async () => {
    const w = world();
    w.songs.set('s1', { userId: 'u1', title: ' 夏の  はじまり ', design: { bpm: 120, engine: 'runware' } });
    expect(await w.svc.later('u1', 's1', 'http://x')).toBe(true);
    expect(w.queued[0]).toMatchObject({ name: 'song.title', p: { userId: 'u1', songId: 's1', origin: 'http://x' } });
    await w.drain();
    expect(w.spoken).toEqual([{ ref: 'fish-u1', text: '夏の はじまり' }]);
    const d = w.songs.get('s1')!.design;
    // the rest of the design stays
    expect(d).toMatchObject({ bpm: 120, engine: 'runware', titleVoice: { text: '夏の はじまり', url: w.stored[0] } });
    expect(titleVoiceOf(d, '夏の はじまり')).toBe(w.stored[0]);
    // made once: asked again, nothing is read again
    await w.svc.later('u1', 's1', 'http://x');
    await w.drain();
    expect(w.spoken).toHaveLength(1);
  });

  it('no registered voice (or the voice service off): nothing is queued, nothing is read (titleVoice stays null)', async () => {
    const none = world({ voice: null });
    none.songs.set('s1', { userId: 'u1', title: '夏', design: {} });
    expect(await none.svc.later('u1', 's1', 'http://x')).toBe(false);
    expect(none.queued).toEqual([]);
    expect(titleVoiceOf(none.songs.get('s1')!.design, '夏')).toBeNull();
    const off = world({ fishOn: false });
    off.songs.set('s1', { userId: 'u1', title: '夏', design: {} });
    expect(await off.svc.later('u1', 's1', 'http://x')).toBe(false);
    // a voice taken away between the queue and the job: the job reads nothing
    const gone = world();
    gone.songs.set('s1', { userId: 'u1', title: '夏', design: {} });
    await gone.svc.later('u1', 's1', 'http://x');
    gone.voices.set('u1', null);
    await gone.drain();
    expect(gone.spoken).toEqual([]);
    expect(gone.songs.get('s1')!.design.titleVoice).toBeUndefined();
  });

  it('a failure never touches the song: queueing never throws, a failed reading leaves the song as it was', async () => {
    const q = world({ queueFails: true });
    expect(await q.svc.later('u1', 's1', 'http://x')).toBe(false);
    const f = world({ fishFails: true });
    f.songs.set('s1', { userId: 'u1', title: '夏', design: { bpm: 100 } });
    await f.svc.later('u1', 's1', 'http://x');
    await expect(f.svc.make(f.queued[0].p)).rejects.toThrow('fish 402');
    expect(f.songs.get('s1')!.design).toEqual({ bpm: 100 });
  });

  it('a song made on Runware is made (and returned) even when the title’s queue is down; with a voice it is queued', async () => {
    const make = (queueFails: boolean) => {
      const w = world({ queueFails });
      const db = { write: { insert: () => ({ values: (v: Record<string, unknown>) => ({ returning: async () => [{ id: 'song-1', savedAt: null, ...v }] }) }) } };
      const media = { storeAudio: async () => ({ url: 'https://cdn/song.mp3' }) };
      const s = new SongService({ name: 'mock' } as never, { MUSIC_RUNWARE_KEY: 'k', MUSIC_PROVIDER: 'runware', SONG_DEFAULT_TEMPO: 1 } as never, db as never, media as never, {} as never, w.svc);
      Object.assign(s, {
        runware: async (t: RunwareAudioTask) => ({ data: Buffer.from('mp3'), audioUrl: 'u', costUsd: 0.009, taskUUID: t.taskUUID, model: t.model, ms: 1 }),
        audioSeconds: async () => 60,
      });
      return { s, w };
    };
    const body = { title: '夏', genre: 'pop', mood: 'bright', bpm: 120, keyRoot: 0, scale: 'major', progression: [0], instrumentalPrompt: 'pop', seconds: 60, sections: [{ name: 'verse', lines: [{ text: 'なつ', beats: 8 }] }] } as FullSongBody;
    const down = make(true);
    expect(await down.s.createFull('u1', body, 'http://x')).toMatchObject({ id: 'song-1', title: '夏' });
    const up = make(false);
    // a paid song's job: the reading is that making's cost (not a small cost again)
    await costScope.run({ feature: 'other', userId: 'u1', kind: 'song', job: 'make:song:c1', paid: true }, () => up.s.createFull('u1', body, 'http://x'));
    expect(up.w.queued[0].p).toMatchObject({ songId: 'song-1', paid: { kind: 'song', job: 'make:song:c1' } });
  });

  it('the cost: a paid song’s reading is booked as that song; outside it, absorbed (titleVoice); in the song’s price', async () => {
    const w = world();
    w.songs.set('s1', { userId: 'u1', title: '夏', design: {} });
    w.songs.set('s2', { userId: 'u1', title: '冬', design: {} });
    await costScope.run({ feature: 'other', kind: 'song', job: 'make:song:c1', paid: true }, () => w.svc.later('u1', 's1', 'http://x'));
    await w.svc.later('u1', 's2', 'http://x');
    await w.drain();
    expect(w.scopes[0]).toMatchObject({ kind: 'song', job: 'make:song:c1', paid: true });
    expect(w.scopes[1]).toMatchObject({ feature: 'titleVoice' });
    expect(w.scopes[1]!.paid).toBeUndefined();
    expect(featureOfJob('song.title')).toBe('titleVoice');
    expect(ABSORBED_FEATURES).toContain('titleVoice');
    // 24 Japanese characters on Fish ≈ $0.00108, in the song's (and the secret spell's) estimate
    expect(titleVoiceUsd()).toBeCloseTo((24 * 3 * 15) / 1e6, 10);
    const e = makeCostEstimates();
    expect(e.song.note).toContain('曲名の読み上げ');
    expect(e.songPremium.note).toContain('曲名の読み上げ');
  });

  it('a post flying under another title is read in that title (the one before goes out of the Bluena)', async () => {
    const w = world();
    w.songs.set('s1', { userId: 'u1', title: '夏', design: {} });
    await w.svc.later('u1', 's1', 'http://x');
    await w.drain();
    const first = w.stored[0];
    await w.svc.later('u1', 's1', 'http://x', '夏のうた');
    await w.drain();
    expect(titleVoiceOf(w.songs.get('s1')!.design, '夏のうた')).toBe(w.stored[1]);
    expect(titleVoiceOf(w.songs.get('s1')!.design, '夏')).toBeNull();
    expect(w.removed).toEqual([first]);
    expect(titleKey(' a \n b ')).toBe('a b');
  });

  it('the admin backfill: the songs flying without their title read get it, `limit` at a time, until none is left', async () => {
    const w = world();
    for (const id of ['s1', 's2', 's3']) {
      w.songs.set(id, { userId: 'u1', title: id, design: {} });
      w.posts.push({ userId: 'u1', songId: id, title: `t-${id}` });
    }
    expect(await w.svc.backfill(2, 'http://x')).toEqual({ queued: 2, looked: 2 });
    await w.drain();
    expect(await w.svc.backfill(2, 'http://x')).toEqual({ queued: 1, looked: 1 });
    await w.drain();
    expect(await w.svc.backfill(2, 'http://x')).toEqual({ queued: 0, looked: 0 });
    expect(w.spoken.map((s) => s.text)).toEqual(['t-s1', 't-s2', 't-s3']);
    // the backfill is absorbed
    expect(w.scopes.every((s) => s?.feature === 'titleVoice' && !s.paid)).toBe(true);
  });
});

describe('GET /planet-works/planet_post/:id/song gives the title voice', () => {
  const dbOf = (rows: unknown[]) => {
    const chain: unknown = new Proxy(() => undefined, {
      get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => Promise.resolve(rows).then(ok) : () => chain),
      apply: () => chain,
    });
    return { read: { select: () => chain } } as never;
  };
  const row = (title: string, voice: string | null) => ({ id: 'p1', title, url: 'u', art: null, seconds: 60, phrases: [], design: { bpm: 120, titleVoice: { text: '夏', url: 'https://cdn/t.mp3', at: 'x' } }, mix: null, voice });
  it('the reading of this post’s title, while the maker’s voice is registered; else null', async () => {
    expect((await new PlanetSongsService(dbOf([row('夏', 'fish-u1')])).song('me', 'p1')).titleVoice).toBe('https://cdn/t.mp3');
    expect((await new PlanetSongsService(dbOf([row('夏のうた', 'fish-u1')])).song('me', 'p1')).titleVoice).toBeNull();
    expect((await new PlanetSongsService(dbOf([row('夏', null)])).song('me', 'p1')).titleVoice).toBeNull();
  });
});
