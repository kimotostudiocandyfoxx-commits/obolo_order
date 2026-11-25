import 'reflect-metadata';
import { lyricsFallback, lyricsSecondVerse, spellFrom, SONG_MODEL_NORMAL, SONG_MODEL_PREMIUM, type FullSongBody, type RunwareAudioTask, type SongPhrase } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { runwareAudio, type RunwareSong } from './runware-music';
import { SongService } from './song.service';
import { SongTweakService, type TweakDesign } from './song-tweak.service';

// --- the Runware call: async, polled, the cost kept ---------------------------------------------------------------------

function fakeRunware(replies: unknown[]) {
  const sent: unknown[] = [];
  const f = (async (url: string, init?: { body?: string }) => {
    if (url === 'https://cdn.runware/x.mp3') return new Response(Buffer.from('ID3song'), { status: 200 });
    sent.push(JSON.parse(init!.body!));
    const r = replies.shift() ?? { data: [] };
    return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, sent };
}
const task: RunwareAudioTask = { taskType: 'audioInference', taskUUID: 't-1', model: SONG_MODEL_NORMAL, positivePrompt: 'pop', outputFormat: 'MP3', outputType: 'URL', includeCost: true, deliveryMethod: 'async', duration: 90, settings: { lyrics: '[Verse]\nあ' } };

describe('R17: a song on Runware (async + getResponse)', () => {
  it('sends the task, asks getResponse until the audio is there, downloads it and keeps Runware’s cost', async () => {
    const { f, sent } = fakeRunware([{ data: [{ taskUUID: 't-1', taskType: 'audioInference' }] }, { data: [] }, { data: [{ taskUUID: 't-1', status: 'processing' }] }, { data: [{ taskUUID: 't-1', status: 'success', audioURL: 'https://cdn.runware/x.mp3', cost: 0.009 }] }]);
    const got = await runwareAudio('k', task, { fetch: f, sleep: async () => undefined });
    expect(got).toMatchObject({ costUsd: 0.009, taskUUID: 't-1', model: SONG_MODEL_NORMAL, audioUrl: 'https://cdn.runware/x.mp3' });
    expect(got.data.toString()).toBe('ID3song');
    expect(sent[0]).toEqual([task]);
    expect(sent.slice(1)).toEqual(Array(3).fill([{ taskType: 'getResponse', taskUUID: 't-1' }]));
  });
  it('a sync answer that has the audio is taken at once; an error is MUSIC_FAILED', async () => {
    const one = fakeRunware([{ data: [{ taskUUID: 't-1', audioURL: 'https://cdn.runware/x.mp3', cost: 0.01 }] }]);
    expect((await runwareAudio('k', task, { fetch: one.f })).costUsd).toBe(0.01);
    expect(one.sent).toHaveLength(1);
    const bad = fakeRunware([{ errors: [{ code: 'invalidModel', message: 'no' }] }]);
    await expect(runwareAudio('k', task, { fetch: bad.f })).rejects.toMatchObject({ response: { error: { code: 'MUSIC_FAILED' } } });
  });
});

// --- which engine sings ------------------------------------------------------------------------------------------------

const lyrics = lyricsFallback(spellFrom('song', '夏の海の明るい曲'));
const body: FullSongBody = {
  title: '夏',
  genre: 'pop',
  mood: 'bright',
  bpm: 120,
  keyRoot: 0,
  scale: 'major',
  progression: [0, 4, 5, 3],
  instrumentalPrompt: 'bright japanese pop, no vocals',
  seconds: 60,
  sections: [{ name: 'verse', lines: [{ text: 'なつのうみ', beats: 8 }] }],
  lyrics,
};

function songs(cfg: Record<string, unknown>, runware: (t: RunwareAudioTask) => Promise<RunwareSong>, stretch?: (d: Buffer, tempo: number) => Promise<{ data: Buffer; seconds: number }>) {
  const inserted: Record<string, unknown>[] = [];
  const db = { write: { insert: () => ({ values: (v: Record<string, unknown>) => ({ returning: async () => (inserted.push(v), [{ id: 'song-1', savedAt: null, ...v }]) }) }) } };
  const media = { storeAudio: async (_u: string, mime: string) => ({ url: `https://cdn/${mime === 'audio/mpeg' ? 'song.mp3' : 'x.m4a'}` }) };
  const s = new SongService({ name: 'mock' } as never, cfg as never, db as never, media as never, {} as never);
  const tasks: RunwareAudioTask[] = [];
  let gpu = 0;
  const stretches: number[] = [];
  Object.assign(s, {
    runware: (t: RunwareAudioTask) => (tasks.push(t), runware(t)),
    // the take is as long as asked; made faster it is that ÷ tempo
    audioSeconds: async () => tasks[tasks.length - 1]?.duration ?? 98.5,
    stretch: stretch ?? (async (_d: Buffer, tempo: number) => (stretches.push(tempo), { data: Buffer.from('fast'), seconds: Math.round(((tasks[tasks.length - 1]?.duration ?? 98.5) / tempo) * 10) / 10 })),
    createGpu: async () => (gpu++, { id: 'gpu-song' }),
  });
  return { s, tasks, inserted, stretches, gpuCalls: () => gpu };
}
const ok = async (t: RunwareAudioTask): Promise<RunwareSong> => ({ data: Buffer.from('mp3'), audioUrl: 'u', costUsd: t.model === SONG_MODEL_PREMIUM ? 0.15 : 0.009, taskUUID: t.taskUUID, model: t.model, ms: 13_000 });
const down = async (): Promise<RunwareSong> => {
  throw new Error('runware down');
};

describe('R17: which engine sings (MUSIC_PROVIDER, the fallback, the secret spell)', () => {
  it('runware (default): ACE-Step 1.5 XL SFT with our metatag sheet, ja, the design’s key; one mix kept, not split', async () => {
    const { s, tasks, inserted, gpuCalls } = songs({ MUSIC_RUNWARE_KEY: 'k', MUSIC_PROVIDER: 'runware', MUSIC_URL: 'https://gpu' }, ok);
    await s.createFull('u1', body, 'http://x');
    expect(gpuCalls()).toBe(0);
    expect(tasks[0]).toMatchObject({ model: SONG_MODEL_NORMAL, includeCost: true, settings: { vocalLanguage: 'ja', bpm: 120, keyScale: 'C major' } });
    expect(tasks[0].settings.lyrics).toMatch(/^\[Intro\]/);
    // R17: a minute delivered, sung 1.2× longer
    expect(tasks[0].duration).toBe(72);
    expect(tasks[0].positivePrompt).not.toMatch(/no vocals/);
    const d = inserted[0].designJson as Record<string, unknown>;
    expect(d).toMatchObject({ engine: 'runware', cost: { usd: 0.009, model: SONG_MODEL_NORMAL }, sourceUrl: 'https://cdn/song.mp3' });
    expect(d.vocalsUrl).toBeUndefined();
    expect(inserted[0]).toMatchObject({ mixUrl: 'https://cdn/x.m4a', seconds: 60 });
  });
  it('Runware failing → our GPU sings it (when there is one); without the GPU the error stands', async () => {
    const a = songs({ MUSIC_RUNWARE_KEY: 'k', MUSIC_PROVIDER: 'runware', MUSIC_URL: 'https://gpu' }, down);
    expect(await a.s.createFull('u1', body, 'http://x')).toEqual({ id: 'gpu-song' });
    const b = songs({ MUSIC_RUNWARE_KEY: 'k', MUSIC_PROVIDER: 'runware' }, down);
    await expect(b.s.createFull('u1', body, 'http://x')).rejects.toThrow('runware down');
  });
  it("MUSIC_PROVIDER 'gpu', or no Runware key: the old path", async () => {
    const a = songs({ MUSIC_RUNWARE_KEY: 'k', MUSIC_PROVIDER: 'gpu', MUSIC_URL: 'https://gpu' }, ok);
    await a.s.createFull('u1', body, 'http://x');
    expect([a.gpuCalls(), a.tasks.length]).toEqual([1, 0]);
    const b = songs({ MUSIC_PROVIDER: 'runware', MUSIC_URL: 'https://gpu' }, ok);
    await b.s.createFull('u1', body, 'http://x');
    expect([b.gpuCalls(), b.tasks.length]).toEqual([1, 0]);
  });
  it('the secret spell: MiniMax Music 2.6 with its own tags; a failure never falls back (the mana comes back)', async () => {
    const a = songs({ MUSIC_RUNWARE_KEY: 'k', MUSIC_PROVIDER: 'gpu', MUSIC_URL: 'https://gpu' }, ok);
    await a.s.createFull('u1', { ...body, premium: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f' }, 'http://x');
    expect(a.tasks[0].model).toBe(SONG_MODEL_PREMIUM);
    expect(a.tasks[0].settings.lyrics).toMatch(/\[Verse\]|\[Chorus\]/);
    expect(a.tasks[0].settings.lyrics).not.toMatch(/ - /);
    expect((a.inserted[0].designJson as Record<string, unknown>).premium).toBe(true);
    const b = songs({ MUSIC_RUNWARE_KEY: 'k', MUSIC_URL: 'https://gpu' }, down);
    await expect(b.s.createFull('u1', { ...body, premium: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f' }, 'http://x')).rejects.toThrow('runware down');
    expect(b.gpuCalls()).toBe(0);
  });
});

// --- the lazy split ------------------------------------------------------------------------------------------------------

function runwareRow() {
  const l = lyricsSecondVerse(lyrics);
  const phrases: SongPhrase[] = l.blocks
    .flatMap((b) => b.lines)
    .map((text, i) => ({ index: i, section: 'verse' as const, text, slot: 'self' as const, url: 'https://cdn/song.mp3', seconds: 2, startBeat: 8 + i * 4, beats: 4 }));
  const design: TweakDesign = { engine: 'runware', bpm: 120, lyrics: l, sourceUrl: 'https://cdn/song.mp3' };
  return { id: 's1', userId: 'u1', mixUrl: 'https://cdn/song.mp3', instrumentalUrl: 'https://cdn/song.mp3', seconds: 100, phrasesJson: phrases, designJson: design };
}
function tweaks() {
  const row = runwareRow() as Record<string, unknown>;
  const renders: { instrumentalUrl: string; plan: { stem: string } }[] = [];
  const splits: { voice: boolean }[] = [];
  const s = new SongTweakService({ name: 'mock', chat: async () => '{"ops":[]}' } as never, {} as never, {} as never);
  Object.assign(s, {
    load: async () => row,
    save: async (_u: string, _id: string, v: { mixUrl: string; seconds: number; phrases: SongPhrase[]; design: TweakDesign }) => Object.assign(row, { mixUrl: v.mixUrl, seconds: v.seconds, phrasesJson: v.phrases, designJson: v.design }),
    render: async (_u: string, o: { instrumentalUrl: string; plan: { stem: string }; total: number }) => (renders.push(o), { data: Buffer.from('x'), seconds: o.total }),
    store: async () => 'https://cdn/v.m4a',
    startSplit: async () => (splits.push({ voice: false }), 'job-split'),
  });
  return { s, row, renders, splits };
}

describe('R17: our GPU is woken only for a change that needs the stems / the times (or the member’s voice)', () => {
  it('tempo / key / length / fades: made from the mix alone — no split', async () => {
    const { s, renders, splits } = tweaks();
    const r = await s.tweak('u1', 's1', { said: 'テンポ速くしてキーを上げて' }, 'http://x');
    expect(r.status).toBe('done');
    expect(splits).toHaveLength(0);
    expect(renders[0]).toMatchObject({ instrumentalUrl: 'https://cdn/song.mp3', plan: { stem: 'instrumental' } });
  });
  it('karaoke / the voice louder / 2番カット: a split job first ({bati} waits), nothing rendered yet', async () => {
    for (const said of ['カラオケにして', '歌だけ大きく', '2番カット']) {
      const { s, renders, splits } = tweaks();
      const r = await s.tweak('u1', 's1', { said }, 'http://x');
      expect(r, said).toMatchObject({ status: 'wait', jobId: 'job-split' });
      expect(splits).toEqual([{ voice: false }]);
      expect(renders).toHaveLength(0);
    }
  });
  it('once split, the same words are made from the stems (no second split)', async () => {
    const { s, row, renders, splits } = tweaks();
    Object.assign(row, { instrumentalUrl: 'https://cdn/inst.m4a', designJson: { ...(row.designJson as TweakDesign), vocalsUrl: 'https://cdn/voc.m4a' } });
    const r = await s.tweak('u1', 's1', { said: 'カラオケにして' }, 'http://x');
    expect(r.status).toBe('done');
    expect(splits).toHaveLength(0);
    expect(renders[0]).toMatchObject({ instrumentalUrl: 'https://cdn/inst.m4a', plan: { stem: 'instrumental' } });
  });
  it('R18: 「自分の声で歌って」 is 君の声にする魔法 now (a price and a yes), never a free split with the voice', async () => {
    const { s, splits } = tweaks();
    expect(await s.tweak('u1', 's1', { said: '自分の声で歌って' }, 'http://x')).toMatchObject({ status: 'voice', voice: 'own' });
    expect(splits).toHaveLength(0);
  });
});

// --- R17: 60 s by default, sung 1.2× longer and delivered 1.2× faster -----------------------------------------------------

describe('R17: the song length and the 1.2× signature tempo', () => {
  it('default: 60 s delivered — sung 72 s, made 1.2× faster; the take kept as the original, the line times ÷ 1.2', async () => {
    const { s, tasks, inserted, stretches } = songs({ MUSIC_RUNWARE_KEY: 'k' }, ok);
    await s.createFull('u1', body, 'http://x');
    expect(tasks[0].duration).toBe(72);
    expect(stretches).toEqual([1.2]);
    const d = inserted[0].designJson as TweakDesign;
    expect(inserted[0]).toMatchObject({ mixUrl: 'https://cdn/x.m4a', seconds: 60, instrumentalUrl: 'https://cdn/song.mp3' });
    expect(d.tempo).toBe(1.2);
    expect(d.original).toMatchObject({ mixUrl: 'https://cdn/song.mp3', seconds: 72 });
    expect(d.first).toMatchObject({ mixUrl: 'https://cdn/x.m4a', seconds: 60 });
    const take = d.original!.phrases;
    const shown = inserted[0].phrasesJson as SongPhrase[];
    expect(shown).toHaveLength(take.length);
    shown.forEach((p, i) => {
      expect(p.startBeat).toBeCloseTo(take[i].startBeat / 1.2, 2);
      expect(p.seconds).toBeCloseTo(take[i].seconds / 1.2, 1);
      expect(p.url).toBe('https://cdn/x.m4a');
    });
  });
  it('lyrics that do not fit in a minute (a full song) make it longer; a length the member asked for is honoured', async () => {
    const full = songs({ MUSIC_RUNWARE_KEY: 'k' }, ok);
    await full.s.createFull('u1', { ...body, lyrics: lyricsFallback(spellFrom('song', '夏の海の明るい曲'), 'フルで') }, 'http://x');
    expect(full.tasks[0].duration).toBeGreaterThan(120);
    const two = songs({ MUSIC_RUNWARE_KEY: 'k' }, ok);
    await two.s.createFull('u1', { ...body, spell: spellFrom('song', '夏の海の明るい曲を2分で') }, 'http://x');
    expect(two.tasks[0].duration).toBe(144);
    expect(two.inserted[0].seconds).toBe(120);
  });
  it('SONG_DEFAULT_TEMPO 1 turns it off; a stretch that fails delivers the take as sung', async () => {
    const off = songs({ MUSIC_RUNWARE_KEY: 'k', SONG_DEFAULT_TEMPO: 1 }, ok);
    await off.s.createFull('u1', body, 'http://x');
    expect(off.tasks[0].duration).toBe(60);
    expect(off.stretches).toEqual([]);
    expect(off.inserted[0]).toMatchObject({ mixUrl: 'https://cdn/song.mp3', seconds: 60 });
    expect((off.inserted[0].designJson as TweakDesign).tempo).toBeUndefined();
    const bad = songs({ MUSIC_RUNWARE_KEY: 'k' }, ok, async () => {
      throw new Error('no ffmpeg');
    });
    await bad.s.createFull('u1', body, 'http://x');
    expect(bad.inserted[0]).toMatchObject({ mixUrl: 'https://cdn/song.mp3', seconds: 72 });
    expect((bad.inserted[0].designJson as TweakDesign).tempo).toBeUndefined();
  });
  it('the secret spell is delivered 1.2× faster too', async () => {
    const a = songs({ MUSIC_RUNWARE_KEY: 'k' }, ok);
    await a.s.createFull('u1', { ...body, premium: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f' }, 'http://x');
    expect(a.stretches).toEqual([1.2]);
    expect((a.inserted[0].designJson as TweakDesign).tempo).toBe(1.2);
  });
});

describe('R17: free changes are made from the take as sung, the 1.2× folded in', () => {
  const fast = () => {
    const t = tweaks();
    const d = t.row.designJson as TweakDesign;
    const take = t.row.phrasesJson as SongPhrase[];
    Object.assign(t.row, {
      mixUrl: 'https://cdn/fast.m4a',
      seconds: 83.3,
      phrasesJson: take.map((p) => ({ ...p, startBeat: p.startBeat / 1.2, beats: p.beats / 1.2, seconds: p.seconds / 1.2 })),
      designJson: { ...d, tempo: 1.2, original: { mixUrl: 'https://cdn/song.mp3', seconds: 100, phrases: take }, first: { mixUrl: 'https://cdn/fast.m4a', seconds: 83.3, phrases: [] } },
    });
    return t;
  };
  it('a change renders from the original take at 1.2 × its tempo (never from the faster song)', async () => {
    const { s, renders } = fast();
    const r = await s.tweak('u1', 's1', { said: 'テンポ速くして' }, 'http://x');
    expect(r.status).toBe('done');
    const o = renders[0] as unknown as { instrumentalUrl: string; plan: { tempo: number }; seconds: number; total: number };
    expect(o.instrumentalUrl).toBe('https://cdn/song.mp3');
    expect(o.plan.tempo).toBeCloseTo(1.32);
    expect(o.seconds).toBe(100);
    expect(o.total).toBeCloseTo(100 / 1.32, 0);
  });
  it('a change that is not about tempo keeps the 1.2×; 「元の速さで」 goes back to 1 (the take as sung)', async () => {
    const a = fast();
    await a.s.tweak('u1', 's1', { said: 'キーを上げて' }, 'http://x');
    expect((a.renders[0] as unknown as { plan: { tempo: number; semitones: number } }).plan).toMatchObject({ tempo: 1.2, semitones: 2 });
    const b = fast();
    const r = await b.s.tweak('u1', 's1', { said: '元の速さで' }, 'http://x');
    expect(r).toMatchObject({ status: 'done', what: '元の速さに' });
    expect((b.renders[0] as unknown as { plan: { tempo: number }; total: number }).plan.tempo).toBe(1);
    expect(r.song?.seconds).toBe(100);
  });
  it('「元に戻して」 after one change: back to the song as delivered (1.2×), not the take', async () => {
    const { s } = fast();
    await s.tweak('u1', 's1', { said: 'テンポ速くして' }, 'http://x');
    const r = await s.tweak('u1', 's1', { undo: true }, 'http://x');
    expect(r).toMatchObject({ status: 'undone', song: { url: 'https://cdn/fast.m4a', seconds: 83.3 } });
  });
});
