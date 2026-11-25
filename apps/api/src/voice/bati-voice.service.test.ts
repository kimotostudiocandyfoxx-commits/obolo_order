import { BATI_VOICE_BASE_SEMITONES, BATI_VOICE_TUNING, batiVoicePitch, batiVoiceTuning, MEDIA_CONSENT_VERSION } from '@obolo/shared';
import { describe, expect, it, vi } from 'vitest';
import { BatiVoiceService, canUseMedia, hasMediaConsent } from './bati-voice.service';
import { fishVoiceModels } from './voice-models';
import type { VoiceModels } from './voice-models';

/** the API error's code ({ error: { code } }) */
const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? null);

const U = 'a0000000-0000-4000-8000-000000000001';

/** a service over a little world in memory: one user row, the media store, the queue and a fake voice-model provider */
function world(o: { consent?: boolean; enabled?: boolean; age?: number | null; guardian?: boolean; defaultVoice?: string; speed?: number } = {}) {
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
    speak: vi.fn(async (id: string, text: string) => Buffer.from(id.startsWith('model-') ? `tts:${text}` : `tts@${id}:${text}`)),
  };
  const s = new BatiVoiceService({} as never, media as never, queue as never, models, { FISH_DEFAULT_VOICE_ID: o.defaultVoice, ...(o.speed ? { BATI_VOICE_SPEED: o.speed } : {}) });
  // ffmpeg stands in: the bytes marked with the semitones they were shifted by
  const shifts: number[] = [];
  s.convert = async (input, semitones) => {
    shifts.push(semitones);
    return Buffer.concat([input, Buffer.from(`|${semitones}`)]);
  };
  const x = s as unknown as Record<string, unknown>;
  x.row = async () => ({ ...user });
  x.save = async (_id: string, patch: Record<string, unknown>) => Object.assign(user, patch) && { ...user };
  return { s, user, files, removed, jobs, models, shifts, media };
}

const take = (n = 1) => ({ mime: 'audio/webm', data: Buffer.from('v'.repeat(200 * n)).toString('base64') });

describe('{bati} voice from the egg recording (M-R246 / M-R247)', () => {
  it('needs the start-of-app consent: without it nothing is kept, no job, the default voice', async () => {
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

  it('the model is made from the recording pitched up 2 semitones, then becomes {bati}\'s voice', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 10, text: 'こんにちは' }, 'http://api');
    w.shifts.length = 0;
    await w.s.make(w.jobs[0].p as never);
    expect(BATI_VOICE_BASE_SEMITONES).toBe(2);
    expect(w.shifts).toEqual([2]);
    expect(w.models.made[0].audio.toString().endsWith('|2')).toBe(true);
    expect(w.models.made[0].text).toBe('こんにちは');
    expect(w.user).toMatchObject({ voiceBatiId: 'model-1', voiceBatiState: 'ready' });
    expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts:やぁ'));
  });

  it('〔声を消す〕 deletes the recording and the model; the default voice again', async () => {
    const w = world();
    await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
    const url = w.user.voiceBatiUrl as string;
    await w.s.make(w.jobs[0].p as never);
    const me = await w.s.remove(U);
    expect(w.models.gone).toEqual(['model-1']);
    expect(w.removed).toContain(url);
    expect(me.voices).toMatchObject({ bati: false, batiState: 'none' });
    expect(await w.s.speak(U, 'やぁ')).toBeNull();
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

describe('the 2nd / 3rd {bati}: the same base voice, a little changed by personality', () => {
  it('the 1st is the base voice as it is (+2); the others follow the table', () => {
    expect(batiVoiceTuning(1, 'king')).toEqual({ semitones: 0, speed: 1 });
    expect(batiVoicePitch(1, 'king')).toBe(2);
    expect(batiVoiceTuning(2, 'king')).toEqual(BATI_VOICE_TUNING.king);
    expect(batiVoicePitch(3, 'amae')).toBe(2 + BATI_VOICE_TUNING.amae.semitones);
    for (const t of Object.values(BATI_VOICE_TUNING)) {
      expect(Math.abs(t.semitones)).toBeLessThanOrEqual(2);
      expect(t.speed).toBeGreaterThan(0.85);
      expect(t.speed).toBeLessThan(1.15);
    }
  });

  describe('iPad feedback: the default {bati} voice (FISH_DEFAULT_VOICE_ID) until the member\'s own is made', () => {
    it('no own voice yet: {bati} speaks in the default model; once the own model is made, in that — by itself', async () => {
      const w = world({ defaultVoice: 'default-bati' });
      expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts@default-bati:やぁ'));
      await w.s.record(U, { takes: [take()], seconds: 10 }, 'http://api');
      // still being made: the default voice
      expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts@default-bati:やぁ'));
      await w.s.make(w.jobs[0].p as never);
      expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts:やぁ'));
      // 〔声を消す〕: back to the default voice
      await w.s.remove(U);
      expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts@default-bati:やぁ'));
    });
    it('under 13 / no consent: never the own voice, the default one still', async () => {
      const w = world({ age: 10, defaultVoice: 'default-bati' });
      w.user.voiceBatiId = 'model-x';
      expect(await w.s.speak(U, 'やぁ')).toEqual(Buffer.from('tts@default-bati:やぁ'));
    });
    it('no default set and no own voice: null (the Gemini voice); Fish off: null', async () => {
      expect(await world().s.speak(U, 'やぁ')).toBeNull();
      expect(await world({ enabled: false, defaultVoice: 'default-bati' }).s.speak(U, 'やぁ')).toBeNull();
    });
  });
});

describe('R14 (client 2026-11-25): {bati} speaks faster and punchier (BATI_VOICE_SPEED)', () => {
  it('the speed goes to the TTS with every line: 1.2 by default, the setting when set, × the {bati}’s own', async () => {
    const w = world({ defaultVoice: 'default-bati' });
    await w.s.speak(U, 'やぁ');
    expect(w.models.speak).toHaveBeenLastCalledWith('default-bati', 'やぁ', 1.2);
    const v = world({ defaultVoice: 'default-bati', speed: 1.35 });
    await v.s.speak(U, 'やぁ');
    expect(v.models.speak).toHaveBeenLastCalledWith('default-bati', 'やぁ', 1.35);
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
      await fishVoiceModels({ FISH_API_KEY: 'k', FISH_MODEL: 's2.1-pro' }).speak('voice-1', 'こんにちは', 1.2);
    } finally {
      globalThis.fetch = real;
    }
    expect(JSON.parse(sent[0].body)).toMatchObject({ text: 'こんにちは', reference_id: 'voice-1', prosody: { speed: 1.2, volume: 0 } });
  });
});
