import { BATI_FIXED_VOICES, MEDIA_CONSENT_VERSION } from '@obolo/shared';
import { describe, expect, it, vi } from 'vitest';
import { BatiVoiceService, canUseMedia, hasMediaConsent, voiceUnpitched } from './bati-voice.service';
import { batiVoiceId, defaultCuteVoiceId, fishVoiceModels } from './voice-models';
import type { VoiceModels } from './voice-models';

/** the API error's code ({ error: { code } }) */
const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? null);

const U = 'a0000000-0000-4000-8000-000000000001';

/** a service over a little world in memory: one user row, the media store, the queue and a fake voice-model provider */
function world(o: { consent?: boolean; enabled?: boolean; age?: number | null; guardian?: boolean; speed?: number; moonVoice?: string; sunVoice?: string } = {}) {
  const user: Record<string, unknown> = {
    id: U,
    voiceBatiId: null,
    voiceBatiUrl: null,
    voiceBatiState: null,
    consentVersion: o.consent === false ? null : MEDIA_CONSENT_VERSION,
    consentAt: o.consent === false ? null : new Date(),
    batiFood: null,
    batisJson: null,
    batiId: null,
    guardianConsentVersion: o.guardian ? MEDIA_CONSENT_VERSION : null,
    guardianConsentAt: o.guardian ? new Date() : null,
    onboardingJson: o.age === null ? {} : { birthYear: String(new Date().getFullYear() - (o.age ?? 30)) },
    createdAt: new Date(),
    journeyDay: 2,
  };
  const files = new Map<string, Buffer>();
  const removed: string[] = [];
  const media = {
    storeAudio: vi.fn(async (_u: string, _m: string, data: Buffer) => {
      const id = `m${files.size + 1}0000000-0000`;
      const url = `https://cdn/${id}.mp3`;
      files.set(url, data);
      return { id, url, mime: 'audio/mpeg', sizeBytes: data.length };
    }),
    audioByUrl: async (_u: string, url: string) => files.get(url) ?? null,
    removeByUrl: async (_u: string, url: string) => {
      removed.push(url);
      files.delete(url);
    },
  };
  const jobs: { name: string; p: unknown }[] = [];
  const queue = { register: vi.fn(), enqueue: vi.fn(async (name: string, p: unknown) => void jobs.push({ name, p })), getHandler: vi.fn(), close: vi.fn() };
  const models: VoiceModels & { made: { audio: Buffer; text?: string }[]; gone: string[] } = {
    enabled: o.enabled ?? true,
    made: [],
    gone: [],
    create: vi.fn(async (x) => {
      models.made.push(x);
      return `model-${models.made.length}`;
    }),
    remove: vi.fn(async (id: string) => void models.gone.push(id)),
    speak: vi.fn(async (id: string, text: string) => Buffer.from(`tts@${id}:${text}`)),
  };
  const s = new BatiVoiceService({} as never, media as never, queue as never, models, { FISH_BATI_MOON_VOICE_ID: o.moonVoice, FISH_BATI_SUN_VOICE_ID: o.sunVoice, ...(o.speed ? { BATI_VOICE_SPEED: o.speed } : {}) });
  // ffmpeg stands in: the bytes marked with the semitones they were shifted by
  const shifts: number[] = [];
  s.convert = async (input, semitones) => {
    shifts.push(semitones);
    return Buffer.concat([input, Buffer.from(`|${semitones}`)]);
  };
  const x = s as unknown as Record<string, unknown>;
  x.row = async () => ({ ...user });
  x.save = async (_id: string, patch: Record<string, unknown>) => Object.assign(user, patch) && { ...user };
  x.mark = async (_id: string, on: boolean) => {
    const j = { ...(user.onboardingJson as Record<string, string>) };
    if (on) j['voice.unpitched'] = '1';
    else delete j['voice.unpitched'];
    user.onboardingJson = j;
  };
  // the admin page: this one member while their model is an old one
  x.oldModels = async () => (user.voiceBatiId && user.voiceBatiUrl && user.voiceBatiState === 'ready' && !voiceUnpitched(user as never) ? [{ ...user }] : []);
  return { s, user, files, removed, jobs, models, shifts, media };
}

const take = (n = 1) => ({ mime: 'audio/webm', data: Buffer.from('v'.repeat(200 * n)).toString('base64') });

describe('the member’s own voice from the day-2 recording (M-R246 / M-R247; M-R342: not {bati}’s voice any more)', () => {
  it('needs the start-of-app consent: without it nothing is kept, no job', async () => {
    const w = world({ consent: false });
    const me = await w.s.record(U, { takes: [take()], seconds: 11 }, 'http://api');
    expect(me.voices.batiState).toBe('none');
    expect(w.media.storeAudio).not.toHaveBeenCalled();
    expect(w.jobs).toHaveLength(0);
    expect(hasMediaConsent({ consentVersion: 'old', consentAt: new Date() })).toBe(false);
  });

  it('the job refuses to make a model when the consent is gone', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 11 }, 'http://api');
    w.user.consentAt = null;
    await w.s.make(w.jobs[0].p as never);
    expect(w.models.create).not.toHaveBeenCalled();
    expect(w.user.voiceBatiState).toBe('none');
  });

  it('a recording too short is refused (the egg asks for more), the appended takes are then taken as one', async () => {
    const w = world();
    expect(code(await w.s.record(U, { takes: [take()], seconds: 4 }, 'http://api').catch((e: unknown) => e))).toBe('VOICE_TOO_SHORT');
    expect(w.jobs).toHaveLength(0);
    // 「、、、もう少し、聞かせてやれ。」 → the user goes on: both takes are sent
    const me = await w.s.record(U, { takes: [take(), take(2)], seconds: 10.4 }, 'http://api');
    expect(me.voices.batiState).toBe('making');
    expect(w.shifts).toEqual([0, 0]);
    expect(w.jobs).toEqual([{ name: 'voice.bati', p: expect.objectContaining({ userId: U, url: w.user.voiceBatiUrl }) }]);
  });

  it('M-R342: the model is made from the recording as it is (no pitch change); {bati} does not speak in it', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 10, text: 'こんにちは' }, 'http://api');
    w.shifts.length = 0;
    await w.s.make(w.jobs[0].p as never);
    expect(w.shifts).toEqual([0]);
    expect(w.models.made[0].audio.toString().endsWith('|0')).toBe(true);
    expect(w.models.made[0].text).toBe('こんにちは');
    expect(w.user).toMatchObject({ voiceBatiId: 'model-1', voiceBatiState: 'ready' });
    // {bati} keeps its egg's fixed voice (no {bati} yet: the Moon egg's)
    expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from(`tts@${BATI_FIXED_VOICES.moon}:やぁ`));
  });

  it('〔声を消す〕 deletes the recording and the model; {bati}’s voice is not touched', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
    const url = w.user.voiceBatiUrl as string;
    await w.s.make(w.jobs[0].p as never);
    const me = await w.s.remove(U);
    expect(w.models.gone).toEqual(['model-1']);
    expect(w.removed).toContain(url);
    expect(me.voices).toMatchObject({ bati: false, batiState: 'none' });
    expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from(`tts@${BATI_FIXED_VOICES.moon}:やぁ`));
  });

  it('a deletion while the model is being made deletes the new model too', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
    const job = w.jobs[0].p as never;
    const create = w.models.create;
    w.models.create = vi.fn(async (x) => {
      const id = await create(x);
      await w.s.remove(U);
      return id;
    });
    await w.s.make(job);
    expect(w.models.gone).toContain('model-1');
    expect(w.user.voiceBatiId).toBeNull();
  });

  it('no voice service here: nothing is kept', async () => {
    const w = world({ enabled: false });
    await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
    expect(w.media.storeAudio).not.toHaveBeenCalled();
  });
});

describe('M-R248: children — by birth year', () => {
  it('under 13 (or no birth year yet): never — nothing kept, no model, even with the agreement', async () => {
    for (const age of [12, null]) {
      const w = world({ age, guardian: true });
      const me = await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
      expect(me.voices.batiState).toBe('none');
      expect(w.media.storeAudio).not.toHaveBeenCalled();
    }
  });

  it('13〜15: only with the guardian\'s consent; 16 and over: their own', async () => {
    expect((await world({ age: 14 }).s.record(U, { takes: [take()], seconds: 10 }, 'http://api')).voices.batiState).toBe('none');
    expect((await world({ age: 14, guardian: true }).s.record(U, { takes: [take()], seconds: 10 }, 'http://api')).voices.batiState).toBe('making');
    expect((await world({ age: 16 }).s.record(U, { takes: [take()], seconds: 10 }, 'http://api')).voices.batiState).toBe('making');
    const y = new Date().getFullYear();
    const row = (age: number, guardian: boolean) => ({ consentVersion: MEDIA_CONSENT_VERSION, consentAt: new Date(), guardianConsentVersion: guardian ? MEDIA_CONSENT_VERSION : null, guardianConsentAt: guardian ? new Date() : null, onboardingJson: { birthYear: String(y - age) } });
    expect([canUseMedia(row(12, true)), canUseMedia(row(13, false)), canUseMedia(row(13, true)), canUseMedia(row(15, true)), canUseMedia(row(16, false))]).toEqual([false, false, true, true, true]);
  });

  it('the job refuses too when the account is not allowed (a birth year set under 13 meanwhile)', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
    w.user.onboardingJson = { birthYear: String(new Date().getFullYear() - 10) };
    await w.s.make(w.jobs[0].p as never);
    expect(w.models.create).not.toHaveBeenCalled();
  });
});

/** a {bati} record as kept in users.batis_json (only what the voice reads) */
const bati = (id: string, egg: 'moon' | 'sun') => ({ id, name: id, egg, seed: 'カレー', seedKind: 'food', personality: 'genki', self: 'ぼく', call: '{neo}', catchphrase: '', intro: '', imageUrl: null, createdAt: new Date().toISOString() });

describe('M-R342 (client 2026-11-27): every {bati} speaks in the fixed Fish voice of its egg', () => {
  it('both eggs: 活発なマスコットキャラ by default; each egg has its own setting, and the settings win', () => {
    expect(batiVoiceId({}, 'moon')).toBe('270c409c18d14a60a81ad8c2f24007b9');
    expect(batiVoiceId({}, 'sun')).toBe('270c409c18d14a60a81ad8c2f24007b9');
    expect(batiVoiceId({ FISH_BATI_SUN_VOICE_ID: 'boy-2' }, 'sun')).toBe('boy-2');
    expect(batiVoiceId({ FISH_BATI_SUN_VOICE_ID: 'boy-2' }, 'moon')).toBe(BATI_FIXED_VOICES.moon);
    // no egg known (no {bati} born yet): the Moon egg's voice
    expect(batiVoiceId({})).toBe(BATI_FIXED_VOICES.moon);
    expect(batiVoiceId({}, null)).toBe(BATI_FIXED_VOICES.moon);
  });

  it('the member’s own voice model is never {bati}’s voice: the egg’s, with a model made or not', async () => {
    const w = world({ moonVoice: 'girl', sunVoice: 'boy' });
    Object.assign(w.user, { batiFood: 'カレー', batiId: 'b1', batisJson: [bati('b1', 'sun')], voiceBatiId: 'model-x' });
    expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts@boy:やぁ'));
    expect(w.s.voiceRef(w.user as never)).toBe('boy');
    expect(await w.s.voiceOf(U)).toBe('boy');
  });

  it('the 2nd / 3rd {bati} (SYS-S003) speak in their own egg’s voice: swapping the one in the chat swaps the voice', async () => {
    const w = world({ moonVoice: 'girl', sunVoice: 'boy' });
    Object.assign(w.user, { batiFood: 'カレー', batiId: 'b1', batisJson: [bati('b1', 'moon'), bati('b2', 'sun'), bati('b3', 'moon')] });
    expect(w.s.voiceRef(w.user as never)).toBe('girl');
    w.user.batiId = 'b2';
    expect(w.s.voiceRef(w.user as never)).toBe('boy');
    w.user.batiId = 'b3';
    expect(w.s.voiceRef(w.user as never)).toBe('girl');
    // no pitch change for any of them (ffmpeg is not run on what {bati} says)
    w.shifts.length = 0;
    await w.s.speak(U, 'やぁ');
    expect(w.shifts).toEqual([]);
  });

  it('a {bati} born before the list (no record): the egg answered on day 2; nothing recorded there: the Sun egg (legacyEgg)', async () => {
    const w = world({ moonVoice: 'girl', sunVoice: 'boy' });
    Object.assign(w.user, { batiFood: 'カレー', batiId: null, batisJson: null, onboardingJson: { birthYear: '1990', 'd2.f_egg': 'moon' } });
    expect(w.s.voiceRef(w.user as never)).toBe('girl');
    w.user.onboardingJson = { birthYear: '1990' };
    expect(w.s.voiceRef(w.user as never)).toBe('boy');
  });

  it('under 13 / not recorded: the same voices', async () => {
    const w = world({ age: 10, moonVoice: 'girl', sunVoice: 'boy' });
    Object.assign(w.user, { batiFood: 'カレー', batiId: 'b1', batisJson: [bati('b1', 'sun')] });
    expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts@boy:やぁ'));
  });

  it('the voice service off: null (the caller’s Gemini voice)', async () => {
    expect(await world({ enabled: false }).s.speak(U, 'やぁ')).toBeNull();
  });

  it('the default cute voice (ダチ messages of members who are not recorded) is a constant of its own', () => {
    expect(defaultCuteVoiceId({ FISH_DEFAULT_VOICE_ID: 'cute' })).toBe('cute');
    expect(defaultCuteVoiceId({})).toBeNull();
    expect(batiVoiceId({ FISH_DEFAULT_VOICE_ID: 'cute' } as never, 'moon')).toBe(BATI_FIXED_VOICES.moon);
  });
});

describe('M-R342: the old +2 voice models made again from the stored recording (the admin one-off)', () => {
  /** a member with a model from before M-R342: the recording stored as it was said, the model made at +2, no mark */
  const old = async (o: Parameters<typeof world>[0] = {}) => {
    const w = world(o);
    const rec = await w.media.storeAudio(U, 'audio/mpeg', Buffer.from('recording'));
    Object.assign(w.user, { voiceBatiId: 'old-model', voiceBatiUrl: rec.url, voiceBatiState: 'ready' });
    w.shifts.length = 0;
    return w;
  };
  it('made again without the pitch change, the old model deleted, the member marked — and never looked at again', async () => {
    const w = await old();
    expect(await w.s.remakeOld(null, 20)).toEqual({ looked: 1, remade: 1, notAllowed: 0, noRecording: 0, failed: 0, next: null });
    expect(w.shifts).toEqual([0]);
    expect(w.models.made[0].audio.toString()).toBe('recording|0');
    expect(w.user.voiceBatiId).toBe('model-1');
    expect(w.models.gone).toEqual(['old-model']);
    expect(voiceUnpitched(w.user as never)).toBe(true);
    expect(await w.s.remakeOld(null, 20)).toMatchObject({ looked: 0, remade: 0 });
    expect(w.models.create).toHaveBeenCalledTimes(1);
  });
  it('a model made since M-R342 is marked when it is made: skipped', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
    await w.s.make(w.jobs[0].p as never);
    expect(voiceUnpitched(w.user as never)).toBe(true);
    expect(await w.s.remakeOld(null, 20)).toMatchObject({ looked: 0, remade: 0 });
    // 〔声を消す〕 takes the mark with the model
    await w.s.remove(U);
    expect(voiceUnpitched(w.user as never)).toBe(false);
  });
  it('the voice may not be used now (no current agreement / age): nothing is sent, the old model stays for a later run', async () => {
    const w = await old({ consent: false });
    expect(await w.s.remakeOld(null, 20)).toMatchObject({ looked: 1, remade: 0, notAllowed: 1 });
    expect(w.models.create).not.toHaveBeenCalled();
    expect(w.user.voiceBatiId).toBe('old-model');
    expect(voiceUnpitched(w.user as never)).toBe(false);
  });
  it('the stored recording is gone: left as it is', async () => {
    const w = await old();
    w.files.clear();
    expect(await w.s.remakeOld(null, 20)).toMatchObject({ looked: 1, remade: 0, noRecording: 1 });
    expect(w.user.voiceBatiId).toBe('old-model');
    expect(w.models.gone).toEqual([]);
  });
  it('a failure keeps the old model (tried again next run); deleted meanwhile: the new model goes too', async () => {
    const w = await old();
    w.models.create = vi.fn(async () => Promise.reject(new Error('fish down')));
    expect(await w.s.remakeOld(null, 20)).toMatchObject({ remade: 0, failed: 1 });
    expect(w.user.voiceBatiId).toBe('old-model');
    const v = await old();
    const create = v.models.create;
    v.models.create = vi.fn(async (x) => {
      const id = await create(x);
      await v.s.remove(U);
      return id;
    });
    expect(await v.s.remakeOld(null, 20)).toMatchObject({ remade: 0, failed: 1 });
    expect(v.models.gone).toContain('model-1');
    expect(v.user.voiceBatiId).toBeNull();
  });
  it('a full page gives the id to go on from; no voice service: nothing', async () => {
    const w = await old();
    expect((await w.s.remakeOld(null, 1)).next).toBe(U);
    expect(await (await old({ enabled: false })).s.remakeOld(null, 20)).toMatchObject({ looked: 0, remade: 0 });
  });
});

describe('M-R342: {bati} speaks at 1.3× with the pitch unchanged (BATI_VOICE_SPEED; R14 had 1.2)', () => {
  it('the speed goes to the TTS with every line: 1.3 by default, the setting when set', async () => {
    const w = world({ moonVoice: 'girl' });
    await w.s.speak(U, 'やぁ');
    expect(w.models.speak).toHaveBeenLastCalledWith('girl', 'やぁ', 1.3);
    const v = world({ speed: 1.35 });
    await v.s.speak(U, 'やぁ');
    expect(v.models.speak).toHaveBeenLastCalledWith(BATI_FIXED_VOICES.moon, 'やぁ', 1.35);
    expect(v.s.speed(0.9)).toBe(1.22);
    expect(world({ speed: 2 }).s.speed(1.1)).toBe(2);
  });
  it('Fish gets it as prosody.speed (the pitch stays: no sped-up playback)', async () => {
    const sent: { body: string; headers: Record<string, string> }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: { body: string; headers: Record<string, string> }) => {
      sent.push(init);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as never;
    try {
      await fishVoiceModels({ FISH_API_KEY: 'k', FISH_MODEL: 's2.1-pro' }).speak('voice-1', 'こんにちは', 1.3);
    } finally {
      globalThis.fetch = real;
    }
    expect(JSON.parse(sent[0].body)).toMatchObject({ text: 'こんにちは', reference_id: 'voice-1', prosody: { speed: 1.3, volume: 0 } });
  });
});
