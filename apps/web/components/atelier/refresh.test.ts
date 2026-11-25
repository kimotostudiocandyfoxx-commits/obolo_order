import type { JobView, SongLyrics } from '@obolo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Msg, Work } from './work';

// the server as the app sees it: the job's state is set per test
const api = {
  mode: 'live' as const,
  job: null as JobView | null,
  gets: 0,
  saves: 0,
  async getJob(id: string): Promise<JobView> {
    this.gets++;
    if (!this.job || this.job.id !== id) throw Object.assign(new Error('gone'), { status: 404 });
    return this.job;
  },
  async composeSongSave() {
    this.saves++;
    return {};
  },
  async createMoonWork() {
    return { id: 'moon-1' };
  },
};
vi.mock('@/lib/api', () => ({ getApi: () => api, ApiError: class extends Error {} }));

const { failJob, finishJob } = await import('./makers');
const { startJobPolling } = await import('@/lib/atelier/jobs');
const { failedCard, mergeMsgs, newerWork, refreshWork } = await import('./refresh');
const { talks } = await import('./shelf');

const store = new Map<string, string>();
const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

const lyrics: SongLyrics = { title: 'よるのステップ', blocks: [{ section: 'verse', hints: [], lines: ['よるのまちを'] }, { section: 'chorus', hints: [], lines: ['ステップ ふんで'] }] } as unknown as SongLyrics;
/** the card as the talk saved it while the song was being made (no sound yet) */
const making: Work = { id: 'w-song', kind: 'song', prompt: 'よるのステップの曲', status: 'making', title: 'よるのステップ', lyrics, job: { id: 'job-1', long: true } };
const job = (x: Partial<JobView>): JobView => ({ id: 'job-1', kind: 'song', status: 'running', stage: 'singing', result: null, errorCode: null, error: null, createdAt: new Date().toISOString(), etaAt: new Date(Date.now() + 180_000).toISOString(), ...x });
const song = { id: 'song-9', title: 'よるのステップ', url: 'https://media.example/song-9.mp3' };

let stop: () => void = () => undefined;
beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = fake;
  store.set('obolo.atelier.talks.v1', JSON.stringify([{ id: 't1', at: '2026-11-25T10:00:00Z', msgs: [{ id: 'a', who: 'me', text: '曲をつくって' }, { id: 'm-w-song', who: 'work', work: making }] }]));
  api.gets = 0;
  api.saves = 0;
  stop = startJobPolling((w, j) => finishJob(w, j, true), failJob, 3_600_000);
});
afterEach(() => {
  stop();
  store.clear();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('R16: a song card saved while it was being made, opened again', () => {
  it('the job is done on the server: the card is the finished song (its sound, its lyrics) and the saved talk is too', async () => {
    api.job = job({ status: 'done', result: { song: song as never } });
    const w = await refreshWork(making, 't1');
    expect(w.status).toBe('ready');
    expect(w.audio).toBe(song.url);
    expect(w.ref?.songId).toBe('song-9');
    expect(w.lyrics?.title).toBe('よるのステップ');
    expect(w.job).toBeUndefined();
    expect(w.settled).toEqual({ job: 'job-1' });
    expect(w.versions).toHaveLength(1);
    const saved = talks()[0].msgs.find((m) => m.who === 'work') as Extract<Msg, { who: 'work' }>;
    expect(saved.work.status).toBe('ready');
    expect(saved.work.audio).toBe(song.url);
    expect(api.saves).toBe(1);
  });

  it('looked at twice at once (the day opened, the card opened): finished once', async () => {
    api.job = job({ id: 'job-2', status: 'done', result: { song: song as never } });
    const card = { ...making, job: { id: 'job-2', long: true } };
    const [a, b] = await Promise.all([refreshWork(card, 't1'), refreshWork(card, 't1')]);
    expect(a.audio).toBe(song.url);
    expect(b.audio).toBe(song.url);
    expect(api.saves).toBe(1);
  });

  it('still being made: the card stays making (its count comes from the job)', async () => {
    api.job = job({ id: 'job-3' });
    const card = { ...making, job: { id: 'job-3', long: true } };
    expect(await refreshWork(card, 't1')).toBe(card);
  });

  it('failed on the server: a failed card that says so and that its mana is back', async () => {
    api.job = job({ id: 'job-4', status: 'failed', errorCode: 'MUSIC_DOWN' });
    const w = await refreshWork({ ...making, job: { id: 'job-4', long: true } }, 't1');
    expect(w.status).toBe('failed');
    expect(w.note).toContain('マナは、もどしてある');
    expect(w.settled).toEqual({ job: 'job-4', failed: true });
    const saved = talks()[0].msgs.find((m) => m.who === 'work') as Extract<Msg, { who: 'work' }>;
    expect(saved.work.status).toBe('failed');
  });

  it('the job is gone: failed (no mana words: nothing is known about it)', async () => {
    api.job = null;
    const w = await refreshWork({ ...making, job: { id: 'job-5', long: true } }, 't1');
    expect(w.status).toBe('failed');
    expect(w.note).toBe('うまく、できなかった……');
  });

  it('a finished card is not asked for again', async () => {
    const ready: Work = { ...making, status: 'ready', audio: song.url, job: undefined };
    expect(await refreshWork(ready, 't1')).toBe(ready);
    expect(api.gets).toBe(0);
  });
});

describe('R16: the talk opened again with an older copy in memory', () => {
  const done: Work = { ...making, status: 'ready', audio: song.url, job: undefined, settled: { job: 'job-1' } };
  it('a card waiting for a job gives way to the saved copy where that job is over', () => {
    expect(newerWork(making, done)).toBe(done);
    const own: Msg[] = [{ id: 'a', who: 'me', text: '曲' }, { id: 'm', who: 'work', work: making }];
    const merged = mergeMsgs(own, [{ id: 'm', who: 'work', work: done }]);
    expect((merged[1] as Extract<Msg, { who: 'work' }>).work.audio).toBe(song.url);
    expect(merged[0]).toBe(own[0]);
  });
  it('a new try being made is not undone by the copy of the try before', () => {
    const redo: Work = { ...done, status: 'making', job: { id: 'job-9', long: true } };
    expect(newerWork(redo, done)).toBe(redo);
    const own: Msg[] = [{ id: 'm', who: 'work', work: redo }];
    expect(mergeMsgs(own, [{ id: 'm', who: 'work', work: done }])).toBe(own);
  });
  it('a redo that failed keeps the try before as its face', () => {
    const redo: Work = { ...done, versions: [{ prompt: 'a', title: 'よるのステップ', audio: song.url, at: 'x' }], active: 0, status: 'making', job: { id: 'job-9', long: true } };
    const w = failedCard(redo, job({ id: 'job-9', status: 'failed' }));
    expect(w.status).toBe('ready');
    expect(w.audio).toBe(song.url);
    expect(w.settled).toEqual({ job: 'job-9', failed: true });
  });
});
