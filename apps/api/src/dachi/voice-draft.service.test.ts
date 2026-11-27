import { VOICE_MIX_CAP_WORDS, type SendDachiMessageBody } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { costScope, featureOfPath } from '../wallet/cost-scope';
import { DachiVoiceService, reachable } from './dachi-voice.service';
import { DachiVoiceDraftService } from './voice-draft.service';

const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string; message?: string } } }).getResponse?.().error ?? null);
const U = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const audio = Buffer.from('a recording');

/** the draft service with ffmpeg, the database and the storage replaced (no real call of any kind) */
function world(o: { cap?: number; allowed?: boolean; words?: string | Error; mood?: string; mixFails?: boolean } = {}) {
  const stored: { id: string; url: string; data: Buffer }[] = [];
  const removed: string[] = [];
  const mixes: { sound: string; soft?: boolean; feature?: string }[] = [];
  const asked: string[] = [];
  const media = {
    storeVoice: async (_u: string, _mime: string, data: Buffer) => {
      const m = { id: `a${stored.length}000000-0000-4000-8000-000000000000`, url: `https://r2/voice-${stored.length}.mp3`, data };
      stored.push(m);
      return m;
    },
    imageData: async (_u: string, id: string) => {
      const m = stored.find((s) => s.id === id);
      return m ? { data: m.data, mime: 'audio/mpeg' } : null;
    },
    getOwned: async (_u: string, id: string) => stored.find((s) => s.id === id) ?? null,
    removeByUrl: async (_u: string, url: string) => void removed.push(url),
  };
  const llm = {
    name: 'gemini',
    transcribe: async () => {
      if (o.words instanceof Error) throw o.words;
      return o.words ?? 'やったー！';
    },
    chat: async (req: { history: { text: string }[] }) => (asked.push(req.history[0].text), o.mood ?? 'unknown'),
  };
  const s = new DachiVoiceDraftService({} as never, media as never, new MemoryKv(), { VOICE_MIX_DAILY_CAP: o.cap ?? 100 }, llm as never);
  const x = s as unknown as Record<string, unknown>;
  x.mayRecord = async () => o.allowed ?? true;
  x.clean = async (b: Buffer) => ({ mp3: Buffer.concat([Buffer.from('clean:'), b]), seconds: 5 });
  x.mix = async (v: Buffer, p: { sound: string; soft?: boolean }) => {
    if (o.mixFails) throw new Error('ffmpeg');
    mixes.push({ ...p, feature: costScope.get()?.feature });
    return { mp3: Buffer.concat([Buffer.from(`mix:${p.sound}:`), v]), seconds: 7.05 };
  };
  const used = new Set<string>();
  x.inUse = async (id: string) => used.has(id);
  return { s, stored, removed, mixes, asked, used };
}

describe('a ダチ voice message made ready (client 2026-11-27, the trial)', () => {
  it('cleans the recording, keeps the clean voice, hears its words and picks the sound from them', async () => {
    const w = world({ words: 'きょうも、おつかれさま', mood: 'otsukare' });
    const d = await w.s.draft(U, 'audio/mp4; codecs=mp4a', audio, 'https://api');
    expect(d).toEqual({ mediaId: w.stored[0].id, url: 'https://r2/voice-0.mp3', seconds: 5, text: 'きょうも、おつかれさま', sound: 'otsukare', soft: false });
    expect(w.stored[0].data.toString()).toBe('clean:a recording');
    expect(w.asked).toEqual(['きょうも、おつかれさま']);
  });

  it('words with no mood, or no words at all: the weakest うれしい (never none) — the voice is still a message', async () => {
    expect(await world({ words: '三時に駅の前で', mood: 'unknown' }).s.draft(U, 'audio/webm', audio, '')).toMatchObject({ sound: 'ureshii', soft: true });
    const deaf = await world({ words: new Error('stt down') }).s.draft(U, 'audio/webm', audio, '');
    expect(deaf).toMatchObject({ text: '', sound: 'ureshii', soft: true, seconds: 5 });
  });

  it('never under 13 (or without the agreement): refused before anything is read, kept or counted', async () => {
    const w = world({ allowed: false, cap: 1 });
    await expect(w.s.draft(U, 'audio/mp4', audio, '')).rejects.toSatisfy((e) => code(e)?.code === 'VOICE_NOT_ALLOWED');
    expect(w.stored).toHaveLength(0);
    // not counted: the same member, once allowed, still has the day's whole cap
    (w.s as unknown as Record<string, unknown>).mayRecord = async () => true;
    await expect(w.s.draft(U, 'audio/mp4', audio, '')).resolves.toBeTruthy();
  });

  it('the daily cap: the cap-th goes, the next gets a calm line, another member is not touched, tomorrow it goes again', async () => {
    const w = world({ cap: 2 });
    await w.s.draft(U, 'audio/webm', audio, '');
    await w.s.draft(U, 'audio/webm', audio, '');
    const err = await w.s.draft(U, 'audio/webm', audio, '').catch((e: unknown) => e);
    expect(code(err)).toMatchObject({ code: 'VOICE_MIX_CAP', message: VOICE_MIX_CAP_WORDS });
    expect((err as { getStatus: () => number }).getStatus()).toBe(429);
    expect(w.stored).toHaveLength(2);
    await expect(w.s.draft(B, 'audio/webm', audio, '')).resolves.toBeTruthy();
    // the count is kept per day (Japan time)
    await expect(w.s.countToday(U, new Date(Date.now() + 36 * 3600_000))).resolves.toBeUndefined();
  });

  it('refuses what is not a recording', async () => {
    const w = world();
    await expect(w.s.draft(U, 'text/plain', audio, '')).rejects.toSatisfy((e) => code(e)?.code === 'UNSUPPORTED_AUDIO');
    await expect(w.s.draft(U, 'audio/webm', Buffer.alloc(0), '')).rejects.toSatisfy((e) => code(e)?.code === 'EMPTY_UPLOAD');
    await expect(w.s.draft(U, 'audio/webm', Buffer.alloc(3 * 1024 * 1024 + 1), '')).rejects.toSatisfy((e) => code(e)?.code === 'TOO_LARGE');
  });

  it('〔▶ きいてみる〕: the mix with the chosen sound, nothing kept; なし is the clean voice itself', async () => {
    const w = world();
    const d = await w.s.draft(U, 'audio/webm', audio, '');
    expect((await w.s.preview(U, { mediaId: d.mediaId, sound: 'oyasumi' })).toString()).toBe('mix:oyasumi:clean:a recording');
    expect((await w.s.preview(U, { mediaId: d.mediaId, sound: 'none' })).toString()).toBe('clean:a recording');
    expect(w.stored).toHaveLength(1);
    await expect(w.s.preview(U, { mediaId: B, sound: 'oyasumi' })).rejects.toSatisfy((e) => code(e)?.code === 'MEDIA_NOT_FOUND');
  });

  it('the mix that is sent is a second file, and its cost is the member’s small cost (voiceMix), not the absorbed ダチ talk', async () => {
    const w = world();
    const d = await w.s.draft(U, 'audio/webm', audio, '');
    const m = await costScope.run({ feature: 'dachi', userId: U }, () => w.s.mixFor(U, d.mediaId, { sound: 'ureshii', soft: true }, ''));
    expect(m).toEqual({ id: w.stored[1].id, url: 'https://r2/voice-1.mp3', seconds: 7.05 });
    expect(w.mixes).toEqual([{ sound: 'ureshii', soft: true, feature: 'voiceMix' }]);
    expect(featureOfPath('/dachi/voice')).toBe('voiceMix');
    expect(featureOfPath('/dachi/voice/preview')).toBe('voiceMix');
    expect(featureOfPath('/dachi/threads/x/messages')).toBe('dachi');
    // a mix that cannot be made is no mix (the voice goes alone)
    const bad = world({ mixFails: true });
    const d2 = await bad.s.draft(U, 'audio/webm', audio, '');
    expect(await bad.s.mixFor(U, d2.mediaId, { sound: 'ureshii' }, '')).toBeNull();
  });

  it('〔けす〕: the draft’s file goes — unless a message already carries it', async () => {
    const w = world();
    const a = await w.s.draft(U, 'audio/webm', audio, '');
    const b = await w.s.draft(U, 'audio/webm', audio, '');
    w.used.add(b.mediaId);
    await w.s.discard(U, a.mediaId);
    await w.s.discard(U, b.mediaId);
    expect(w.removed).toEqual([a.url]);
  });
});

describe('sending it: the caption and the sound ride with the voice', () => {
  function talk(o: { mixed?: boolean; flagged?: boolean } = {}) {
    const rows: Record<string, unknown>[] = [];
    const media = { getOwned: async (_u: string, id: string) => ({ id, url: `https://r2/${id}.mp3` }) };
    const mixer = { mixFor: async (_u: string, _id: string, p: { sound: string }) => (o.mixed === false ? null : { id: 'mix-id', url: `https://r2/mix-${p.sound}.mp3`, seconds: 6.3 }) };
    const llm = { name: 'gemini', chat: async () => (o.flagged ? 'FLAG:harassment' : 'OK') };
    const s = new DachiVoiceService({} as never, { list: async () => [] } as never, media as never, { notify: async () => undefined } as never, llm as never, undefined, mixer as never);
    const x = s as unknown as Record<string, unknown>;
    x.journey = async () => ({ journeyDay: 3, journeyCompletedAt: null, dachiAt: new Date(), displayName: 'A' });
    x.areDachi = async () => reachable({ follows: 2, blocks: 0, peerOk: true });
    x.insertMessage = async (r: Record<string, unknown>) => {
      const m = { ...r, id: `m${rows.length}`, createdAt: new Date() };
      rows.push(m);
      return m;
    };
    return { s, rows };
  }
  const body = (extra: Partial<Extract<SendDachiMessageBody, { mediaId: string }>> = {}): SendDachiMessageBody => ({ mediaId: 'a1111111-1111-4111-8111-111111111111', seconds: 4.2, ...extra });

  it('the mix is what is heard; the clean voice is kept for 〔おとをけす〕; the caption is the bubble’s words', async () => {
    const w = talk();
    const v = await w.s.send(U, B, body({ caption: 'やったー！', sound: 'ureshii' }));
    expect(v).toMatchObject({ kind: 'voice', audioUrl: 'https://r2/mix-ureshii.mp3', seconds: 6.3, text: 'やったー！', sound: { mood: 'ureshii', plainUrl: 'https://r2/a1111111-1111-4111-8111-111111111111.mp3' } });
    expect(w.rows[0]).toMatchObject({ audioMediaId: 'mix-id', workJson: { text: 'やったー！', sound: { mood: 'ureshii', plainMediaId: 'a1111111-1111-4111-8111-111111111111' } } });
  });

  it('なし, no sound asked, or a mix that failed: the clean voice alone, with no note to turn off', async () => {
    for (const extra of [{ caption: 'うん', sound: 'none' as const }, { caption: 'うん' }]) {
      const v = await talk().s.send(U, B, body(extra));
      expect(v).toMatchObject({ audioUrl: 'https://r2/a1111111-1111-4111-8111-111111111111.mp3', seconds: 4.2, text: 'うん' });
      expect(v.sound).toBeUndefined();
    }
    const failed = talk({ mixed: false });
    const v = await failed.s.send(U, B, body({ sound: 'oyasumi' }));
    expect(v).toMatchObject({ audioUrl: 'https://r2/a1111111-1111-4111-8111-111111111111.mp3', seconds: 4.2 });
    expect(v.sound).toBeUndefined();
    // the voice of before the trial (no caption, no sound) is the same row as ever
    const old = talk();
    await old.s.send(U, B, body());
    expect(old.rows[0].workJson).toBeUndefined();
  });

  it('a caption that would not pass as typed words is not sent', async () => {
    const w = talk({ flagged: true });
    await expect(w.s.send(U, B, body({ caption: 'ひどいことば', sound: 'ureshii' }))).rejects.toSatisfy((e) => code(e)?.code === 'CONTENT_FLAGGED');
    expect(w.rows).toHaveLength(0);
  });
});
