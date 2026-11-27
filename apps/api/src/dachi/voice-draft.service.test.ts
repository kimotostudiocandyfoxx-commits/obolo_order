import { VOICE_MIX_CAP_WORDS, VOICE_TUNE_DEFAULT, VOICE_TUNE_KEY, VOICE_VERSION_KEY, type SendDachiMessageBody, type VoiceTune } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { costScope, featureOfPath } from '../wallet/cost-scope';
import { DachiVoiceService, reachable } from './dachi-voice.service';
import { DachiController } from './dachi.controller';
import { DachiVoiceDraftService } from './voice-draft.service';
import { NoVoiceError } from '../voice/voice-mix';

const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string; message?: string } } }).getResponse?.().error ?? null);
const U = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const audio = Buffer.from('a recording');

/** the draft service with ffmpeg, the database and the storage replaced (no real call of any kind) */
function world(o: { cap?: number; allowed?: boolean; words?: string | Error; mood?: string; mixFails?: boolean; silent?: boolean; tune?: VoiceTune; kept?: Record<string, string> } = {}) {
  const stored: { id: string; url: string; data: Buffer }[] = [];
  const removed: string[] = [];
  const cleaned: { tune: VoiceTune; input: string }[] = [];
  const heardBy: string[] = [];
  /** what is kept with each member (users.onboarding_json) */
  const json = new Map<string, Record<string, string>>();
  const keptOf = (u: string) => json.get(u) ?? { ...(o.kept ?? {}), ...(o.tune ? { [VOICE_TUNE_KEY]: JSON.stringify(o.tune) } : {}) };
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
    transcribe: async (b: Buffer) => {
      heardBy.push(b.toString());
      if (o.words instanceof Error) throw o.words;
      return o.words ?? 'やったー！';
    },
    chat: async (req: { history: { text: string }[] }) => (asked.push(req.history[0].text), o.mood ?? 'unknown'),
  };
  const kv = new MemoryKv();
  const s = new DachiVoiceDraftService({} as never, media as never, kv, { VOICE_MIX_DAILY_CAP: o.cap ?? 100 }, llm as never);
  const x = s as unknown as Record<string, unknown>;
  x.mayRecord = async () => o.allowed ?? true;
  x.kept = async (u: string) => ({ ...keptOf(u) });
  x.keep = async (u: string, key: string, value: string | null) => {
    const j = { ...keptOf(u) };
    if (value === null) delete j[key];
    else j[key] = value;
    json.set(u, j);
  };
  x.userIds = async (after: string | null, limit: number) => [U, B].filter((id) => !after || id > after).slice(0, limit);
  x.hear = async (b: Buffer) => Buffer.concat([Buffer.from('heard:'), b]);
  x.clean = async (b: Buffer, t: VoiceTune) => {
    if (o.silent) throw new NoVoiceError(0);
    cleaned.push({ tune: t, input: b.toString() });
    return { mp3: Buffer.concat([Buffer.from('clean:'), b]), seconds: 5, heard: Buffer.concat([Buffer.from('heard:'), b]), made: { autotune: true, shape: 'rubberband' } };
  };
  x.mix = async (v: Buffer, p: { sound: string; soft?: boolean }) => {
    if (o.mixFails) throw new Error('ffmpeg');
    mixes.push({ ...p, feature: costScope.get()?.feature });
    return { mp3: Buffer.concat([Buffer.from(`mix:${p.sound}:`), v]), seconds: 7.05 };
  };
  const used = new Set<string>();
  x.inUse = async (id: string) => used.has(id);
  return { s, kv, stored, removed, mixes, asked, used, cleaned, heardBy, keptOf, allow: (yes: boolean) => void (x.mayRecord = async () => yes) };
}

describe('a ダチ voice message made ready (client 2026-11-27, the trial)', () => {
  it('cleans the recording, keeps the clean voice, hears its words and picks the sound from them', async () => {
    const w = world({ words: 'きょうも、おつかれさま', mood: 'otsukare' });
    const d = await w.s.draft(U, 'audio/mp4; codecs=mp4a', audio, 'https://api');
    expect(d).toEqual({ version: 'asis', mediaId: w.stored[0].id, seconds: 5, text: 'きょうも、おつかれさま', sound: 'otsukare', soft: false });
    // nothing in it can be played: the sender does not hear the take
    expect(JSON.stringify(d)).not.toContain('http');
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
    w.allow(true);
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

  it('the sender does not hear the take: the draft’s mix and the settings’ trial are refused for everyone (410), nothing is played back', () => {
    const c = new DachiController({} as never, {} as never, {} as never, new MemoryKv(), {} as never, world().s, {} as never);
    for (const call of [() => c.voicePreview(), () => c.voiceTunePreview()]) {
      let err: unknown;
      try {
        call();
      } catch (e) {
        err = e;
      }
      expect(code(err)?.code).toBe('VOICE_NOT_PLAYED');
      expect((err as { getStatus: () => number }).getStatus()).toBe(410);
    }
    // and the service has nothing left that gives a take back
    const s = world().s as unknown as Record<string, unknown>;
    for (const gone of ['preview', 'tunePreview', 'lastTake', 'keepTake']) expect(s[gone]).toBeUndefined();
  });

  it('the mix that is sent is a second file, and its cost is the member’s small cost (voiceMix), not the absorbed ダチ talk', async () => {
    const w = world();
    const d = await w.s.draft(U, 'audio/webm', audio, '');
    const m = await costScope.run({ feature: 'dachi', userId: U }, () => w.s.mixFor(U, d.mediaId!, { sound: 'ureshii', soft: true }, ''));
    expect(m).toEqual({ id: w.stored[1].id, url: 'https://r2/voice-1.mp3', seconds: 7.05 });
    expect(w.mixes).toEqual([{ sound: 'ureshii', soft: true, feature: 'voiceMix' }]);
    expect(featureOfPath('/dachi/voice')).toBe('voiceMix');
    expect(featureOfPath('/dachi/voice?as=asis')).toBe('voiceMix');
    expect(featureOfPath('/dachi/threads/x/messages')).toBe('dachi');
    // a mix that cannot be made is no mix (the voice goes alone)
    const bad = world({ mixFails: true });
    const d2 = await bad.s.draft(U, 'audio/webm', audio, '');
    expect(await bad.s.mixFor(U, d2.mediaId!, { sound: 'ureshii' }, '')).toBeNull();
  });

  it('〔とりなおす〕: the draft’s file goes — unless a message already carries it; and no "last take" is kept beside a draft', async () => {
    const w = world();
    const a = await w.s.draft(U, 'audio/webm', audio, '');
    const b = await w.s.draft(U, 'audio/webm', audio, '');
    // one file a take: the made-ready voice — the clean whole take is not kept any more
    expect(w.stored.map((m) => m.data.toString())).toEqual(['clean:a recording', 'clean:a recording']);
    expect(await w.kv.get(`voice-take:${U}`)).toBeNull();
    w.used.add(b.mediaId!);
    await w.s.discard(U, a.mediaId!);
    await w.s.discard(U, b.mediaId!);
    expect(w.removed).toEqual(['https://r2/voice-0.mp3']);
  });

  it('the one-off cleanup: a last take kept on 2026-11-27 goes — at the member’s next take, and for everyone by the sweep', async () => {
    const w = world();
    const take = async (u: string) => {
      const m = await (w.s as unknown as { media: { storeVoice: (u: string, mime: string, d: Buffer) => Promise<{ id: string; url: string }> } }).media.storeVoice(u, 'audio/mpeg', Buffer.from(`last take of ${u}`));
      await w.kv.set(`voice-take:${u}`, m.id, 30 * 86400);
      return m;
    };
    const mine = await take(U);
    // the member's own next take takes it away
    await w.s.draft(U, 'audio/webm', audio, '');
    await new Promise((r) => setTimeout(r, 0));
    expect(w.removed).toEqual([mine.url]);
    expect(await w.kv.get(`voice-take:${U}`)).toBeNull();
    // the sweep: a page of members at a time, until `next` is null
    const theirs = await take(B);
    expect(await w.s.sweepTakes(null, 1)).toEqual({ looked: 1, removed: 0, next: U });
    expect(await w.s.sweepTakes(U, 1)).toEqual({ looked: 1, removed: 1, next: B });
    expect(await w.s.sweepTakes(B, 1)).toEqual({ looked: 0, removed: 0, next: null });
    expect(w.removed).toEqual([mine.url, theirs.url]);
    expect(await w.kv.get(`voice-take:${B}`)).toBeNull();
    // again: nothing left to do
    expect(await w.s.sweepTakes(null, 500)).toEqual({ looked: 2, removed: 0, next: null });
  });
});

describe('the two versions: 「そのまま」 and 「きれい」, remembered per member (client 2026-11-27, shared voiceVersion.ts)', () => {
  it('the default is 「そのまま」; 「きれい」 is remembered on the server, and back to the default is no entry', async () => {
    const w = world();
    expect(await w.s.version(U)).toBe('asis');
    expect(await w.s.setVersion(U, 'clean')).toBe('clean');
    expect(w.keptOf(U)).toEqual({ [VOICE_VERSION_KEY]: 'clean' });
    expect(await w.s.version(U)).toBe('clean');
    expect(await w.s.version(B)).toBe('asis');
    await w.s.setVersion(U, 'asis');
    expect(w.keptOf(U)).toEqual({});
    // only a member who is recorded has the choice
    w.allow(false);
    await expect(w.s.setVersion(U, 'clean')).rejects.toSatisfy((e) => code(e)?.code === 'VOICE_NOT_ALLOWED');
  });

  it('「きれい」: the take is heard as words and gone — no file is kept, nothing is made of the recording', async () => {
    const w = world({ kept: { [VOICE_VERSION_KEY]: 'clean' }, words: 'あした、あそぼう', mood: 'ureshii' });
    const d = await w.s.draft(U, 'audio/webm', audio, '', { cleanOn: true });
    expect(d).toEqual({ version: 'clean', mediaId: null, seconds: 0, text: 'あした、あそぼう', sound: 'ureshii', soft: false });
    expect(w.heardBy).toEqual(['heard:a recording']);
    expect([w.stored, w.cleaned]).toEqual([[], []]);
  });

  it('the button on the card asks for the other version of the same take; where 「きれい」 cannot be made the take is 「そのまま」', async () => {
    const w = world({ kept: { [VOICE_VERSION_KEY]: 'clean' } });
    expect(await w.s.draft(U, 'audio/webm', audio, '', { as: 'asis', cleanOn: true })).toMatchObject({ version: 'asis', mediaId: w.stored[0].id, seconds: 5 });
    const plain = world();
    expect(await plain.s.draft(U, 'audio/webm', audio, '', { as: 'clean', cleanOn: true })).toMatchObject({ version: 'clean', mediaId: null });
    // no voice service / no voice to read in: remembered or asked, it is the recording that is made ready
    expect(await w.s.draft(U, 'audio/webm', audio, '', { cleanOn: false })).toMatchObject({ version: 'asis' });
    expect(await w.s.draft(U, 'audio/webm', audio, '', { as: 'clean' })).toMatchObject({ version: 'asis' });
  });

  it('both are counted in the day’s cap, and refused for a member who is not recorded', async () => {
    const w = world({ cap: 1 });
    await w.s.draft(U, 'audio/webm', audio, '', { as: 'clean', cleanOn: true });
    await expect(w.s.draft(U, 'audio/webm', audio, '', { as: 'asis', cleanOn: true })).rejects.toSatisfy((e) => code(e)?.code === 'VOICE_MIX_CAP');
    const no = world({ allowed: false });
    await expect(no.s.draft(U, 'audio/webm', audio, '', { as: 'clean', cleanOn: true })).rejects.toSatisfy((e) => code(e)?.code === 'VOICE_NOT_ALLOWED');
    expect(no.heardBy).toEqual([]);
  });
});

describe('the member’s own voice settings (client 2026-11-27, shared voiceTune.ts)', () => {
  it('a take is made in the member’s settings; the default is sample K at +2 semitones (it was +6)', async () => {
    const w = world();
    await w.s.draft(U, 'audio/webm', audio, '');
    expect(w.cleaned[0].tune).toEqual({ key: 2, speed: 1.8, tune: 0.6, cut: true });
    // a member who saved settings of their own before the default moved keeps them — also a +6 of their own
    const before = world({ tune: { key: 6, speed: 1.6, tune: 0.6, cut: true } });
    await before.s.draft(U, 'audio/webm', audio, '');
    expect(before.cleaned[0].tune).toEqual({ key: 6, speed: 1.6, tune: 0.6, cut: true });
    // …and their 「もとにもどす」 is the new default, kept as no entry
    expect((await before.s.setTune(U, { reset: true })).tune).toEqual({ key: 2, speed: 1.8, tune: 0.6, cut: true });
    expect(before.keptOf(U)).toEqual({});
    const mine = world({ tune: { key: 0, speed: 1.2, tune: 0, cut: false } });
    await mine.s.draft(U, 'audio/webm', audio, '');
    expect(mine.cleaned[0].tune).toEqual({ key: 0, speed: 1.2, tune: 0, cut: false });
  });

  it('the words are heard from the clean, uncut take — not from the changed voice', async () => {
    const w = world({ words: 'こんにちは' });
    const d = await w.s.draft(U, 'audio/webm', audio, '');
    expect(w.heardBy).toEqual(['heard:a recording']);
    expect(d.text).toBe('こんにちは');
    expect(w.stored[0].data.toString()).toBe('clean:a recording');
  });

  it('a take with nothing but silence: said as too short (VOICE_SILENT), nothing kept, never sent as it is', async () => {
    const w = world({ silent: true });
    const err = await w.s.draft(U, 'audio/webm', audio, '').catch((e: unknown) => e);
    expect(code(err)?.code).toBe('VOICE_SILENT');
    expect((err as { getStatus: () => number }).getStatus()).toBe(422);
    expect(w.stored).toEqual([]);
  });

  it('changed part by part, always inside the limits whatever is sent; 〔もとにもどす〕 is the default', async () => {
    const w = world();
    expect(await w.s.tune(U)).toEqual({ tune: VOICE_TUNE_DEFAULT, isDefault: true });
    expect((await w.s.setTune(U, { key: 4 })).tune).toEqual({ key: 4, speed: 1.8, tune: 0.6, cut: true });
    expect((await w.s.setTune(U, { speed: 1.4, cut: false })).tune).toEqual({ key: 4, speed: 1.4, tune: 0.6, cut: false });
    // far outside: the ends of the ranges (−6…+8, 1.0…2.0, 0…1)
    expect((await w.s.setTune(U, { key: 99, speed: 9, tune: 5 })).tune).toEqual({ key: 8, speed: 2, tune: 1, cut: false });
    expect((await w.s.setTune(U, { key: -99, speed: 0.1, tune: -3 })).tune).toEqual({ key: -6, speed: 1, tune: 0, cut: false });
    expect(await w.s.setTune(U, { reset: true })).toMatchObject({ tune: VOICE_TUNE_DEFAULT, isDefault: true });
    // the next take is made in them
    await w.s.setTune(U, { key: 5 });
    await w.s.draft(U, 'audio/webm', audio, '');
    expect(w.cleaned.at(-1)?.tune.key).toBe(5);
  });

  it('only a member who is recorded has them (the default cute voice of the others is not touched)', async () => {
    const w = world();
    w.allow(false);
    await expect(w.s.setTune(U, { key: 0 })).rejects.toSatisfy((e) => code(e)?.code === 'VOICE_NOT_ALLOWED');
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

  /** the receiver's view of the row just sent */
  const heard = (w: ReturnType<typeof talk>, k = 0) => w.s.toView(B, w.rows[k] as never);

  it('the mix is what is heard; the clean voice is kept for 〔おとをけす〕; the caption is the bubble’s words', async () => {
    const w = talk();
    await w.s.send(U, B, body({ caption: 'やったー！', sound: 'ureshii' }));
    const v = heard(w);
    expect(v).toMatchObject({ kind: 'voice', audioUrl: 'https://r2/mix-ureshii.mp3', seconds: 6.3, text: 'やったー！', sound: { mood: 'ureshii', plainUrl: 'https://r2/a1111111-1111-4111-8111-111111111111.mp3' } });
    expect(w.rows[0]).toMatchObject({ audioMediaId: 'mix-id', workJson: { text: 'やったー！', sound: { mood: 'ureshii', plainMediaId: 'a1111111-1111-4111-8111-111111111111' } } });
  });

  it('なし, no sound asked, or a mix that failed: the clean voice alone, with no note to turn off', async () => {
    for (const extra of [{ caption: 'うん', sound: 'none' as const }, { caption: 'うん' }]) {
      const t = talk();
      await t.s.send(U, B, body(extra));
      const v = heard(t);
      expect(v).toMatchObject({ audioUrl: 'https://r2/a1111111-1111-4111-8111-111111111111.mp3', seconds: 4.2, text: 'うん' });
      expect(v.sound).toBeUndefined();
    }
    const failed = talk({ mixed: false });
    await failed.s.send(U, B, body({ sound: 'oyasumi' }));
    const v = heard(failed);
    expect(v).toMatchObject({ audioUrl: 'https://r2/a1111111-1111-4111-8111-111111111111.mp3', seconds: 4.2 });
    expect(v.sound).toBeUndefined();
    // the voice of before the trial (no caption, no sound) is the same row as ever
    const old = talk();
    await old.s.send(U, B, body());
    expect(old.rows[0].workJson).toBeUndefined();
  });

  it('the SENDER does not hear their own voice: their view of it has no audio — the words and a mark that it was sent', async () => {
    const w = talk();
    const mine = await w.s.send(U, B, body({ caption: 'やったー！', sound: 'ureshii' }));
    expect(mine).toMatchObject({ kind: 'voice', fromMe: true, audioUrl: null, sentVoice: true, text: 'やったー！', seconds: 6.3 });
    expect(mine.sound).toBeUndefined();
    expect(JSON.stringify(mine)).not.toContain('r2/');
    // read again later (the thread's list): the same
    expect(w.s.toView(U, w.rows[0] as never)).toMatchObject({ audioUrl: null, sentVoice: true });
    // the receiver hears it as ever
    expect(heard(w)).toMatchObject({ fromMe: false, audioUrl: 'https://r2/mix-ureshii.mp3', sound: { plainUrl: 'https://r2/a1111111-1111-4111-8111-111111111111.mp3' } });
    expect(heard(w).sentVoice).toBeUndefined();
    // a voice with no caption and no sound: the same rule
    const plain = talk();
    expect(await plain.s.send(U, B, body())).toMatchObject({ audioUrl: null, sentVoice: true, text: null });
  });

  it('a caption that would not pass as typed words is not sent', async () => {
    const w = talk({ flagged: true });
    await expect(w.s.send(U, B, body({ caption: 'ひどいことば', sound: 'ureshii' }))).rejects.toSatisfy((e) => code(e)?.code === 'CONTENT_FLAGGED');
    expect(w.rows).toHaveLength(0);
  });
});
