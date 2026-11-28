import { execFileSync } from 'node:child_process';
import { JOURNEY_DONE, MEDIA_CONSENT_VERSION } from '@obolo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceService } from './voice.service';

/** the API error's code ({ error: { code } }) */
const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? null);

const U = 'a0000000-0000-4000-8000-000000000001';
/** a {bati} record as kept in users.batis_json (only what the voice reads) */
const bati = (id: string, egg: 'moon' | 'sun') => ({ id, name: id, egg, seed: 'カレー', seedKind: 'food', personality: 'genki', self: 'ぼく', call: '{neo}', catchphrase: '', intro: '', imageUrl: null, createdAt: new Date().toISOString() });

/** the service over one user row; Fish stands in (what it was asked is kept) */
function world(o: { egg?: 'moon' | 'sun'; recorded?: boolean; balance?: number; own?: string | null; journeyDay?: number; cfg?: Record<string, unknown> } = {}) {
  const user = {
    id: U,
    voiceSelfId: 'self-model',
    voiceKororinId: null,
    voiceBatiId: o.own === undefined ? 'own-model' : o.own,
    consentVersion: MEDIA_CONSENT_VERSION,
    consentAt: new Date(),
    guardianConsentVersion: null,
    guardianConsentAt: null,
    onboardingJson: { birthYear: String(new Date().getFullYear() - (o.recorded === false ? 10 : 30)) },
    batiFood: 'カレー',
    batiId: 'b1',
    batisJson: [bati('b1', o.egg ?? 'moon')],
    createdAt: new Date(),
    journeyDay: o.journeyDay ?? 2,
    journeyCompletedAt: null,
  };
  const db = { write: { select: () => ({ from: () => ({ where: async () => [user] }) }) } };
  const media = { storeAudio: vi.fn(async () => ({ id: 'm1', url: 'https://cdn/m1.mp3' })) };
  const sent: { text: string; reference_id: string; prosody?: { speed: number } }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }),
  );
  const s = new VoiceService({ FISH_API_KEY: 'k', FISH_MODEL: 's2.1-pro', FISH_BATI_MOON_VOICE_ID: 'girl', FISH_BATI_SUN_VOICE_ID: 'boy', ...o.cfg } as never, db as never, media as never, {} as never);
  (s as unknown as { balance: () => Promise<number> }).balance = async () => o.balance ?? 5;
  return { s, user, sent, media };
}

afterEach(() => vi.unstubAllGlobals());

describe('M-R342 (client 2026-11-27): the bati slot is the fixed voice of the {bati}’s egg', () => {
  it('a post read by {bati}: the egg’s voice — never the member’s own model — at 1.3× with the reading style’s speed on top', async () => {
    const moon = world({ egg: 'moon' });
    expect(await moon.s.readByBati(U, { text: 'やっほー' }, 'http://api')).toEqual({ url: 'https://cdn/m1.mp3', mediaId: 'm1' });
    expect(moon.sent[0]).toMatchObject({ text: 'やっほー', reference_id: 'girl', prosody: { speed: 1.3 } });
    const sun = world({ egg: 'sun' });
    await sun.s.readByBati(U, { text: 'やっほー', style: 'yukkuri' }, 'http://api');
    expect(sun.sent[0]).toMatchObject({ text: '[calm] やっほー', reference_id: 'boy', prosody: { speed: 1.04 } });
  });

  it('the server’s own ids and speed win', async () => {
    const w = world({ egg: 'sun', cfg: { FISH_BATI_SUN_VOICE_ID: 'boy-2', BATI_VOICE_SPEED: 1.5 } });
    await w.s.readByBati(U, { text: 'やっほー' }, 'http://api');
    expect(w.sent[0]).toMatchObject({ reference_id: 'boy-2', prosody: { speed: 1.5 } });
  });

  it('voiceId: bati is always there (its egg’s voice); self is the member’s own model', async () => {
    const w = world({ egg: 'sun', own: null });
    expect(await w.s.voiceId(U, 'bati')).toBe('boy');
    expect(await w.s.voiceId(U, 'self')).toBe('self-model');
    expect(code(await w.s.voiceId(U, 'kororin').catch((e: unknown) => e))).toBe('VOICE_NOT_REGISTERED');
  });

  it('the member’s own voice is read at its own speed (no {bati} speed on it)', async () => {
    const w = world();
    await w.s.readAloud(U, { slot: 'self', text: 'こんにちは' }, 'http://api');
    expect(w.sent[0]).toMatchObject({ reference_id: 'self-model' });
    expect(w.sent[0].prosody).toBeUndefined();
  });

  it('nothing can be registered as {bati}’s voice (the member’s voice model is not overwritten)', async () => {
    const w = world();
    const e = await w.s.register(U, { slot: 'bati', audio: { mime: 'audio/mp4', data: 'x'.repeat(200) } }, 'http://api').catch((x: unknown) => x);
    expect(code(e)).toBe('BATI_VOICE_FIXED');
    expect(w.user.voiceBatiId).toBe('own-model');
    expect(w.sent).toHaveLength(0);
  });
});

describe('M-R342: {bati}’s voice at 0 mana — one rule for everyone', () => {
  it('during the first journey everyone hears {bati}, at 0 mana too (recorded or not)', async () => {
    for (const recorded of [true, false]) {
      const w = world({ recorded, balance: 0, journeyDay: 2 });
      expect(await w.s.readByBati(U, { text: 'やっほー' }, 'http://api')).not.toBeNull();
    }
  });
  it('after the journey: no voice at 0 mana (the device’s reading voice instead) — recorded or not; the voice with mana', async () => {
    for (const recorded of [true, false]) {
      const none = world({ recorded, balance: 0, journeyDay: JOURNEY_DONE });
      expect(await none.s.readByBati(U, { text: 'やっほー' }, 'http://api')).toBeNull();
      expect(none.sent).toHaveLength(0);
      expect(code(await none.s.speak(U, { slot: 'bati', text: 'やっほー' }, 'http://api').catch((e: unknown) => e))).toBe('NO_VOICE_NOW');
      const some = world({ recorded, balance: 1, journeyDay: JOURNEY_DONE, egg: 'sun' });
      expect(await some.s.readByBati(U, { text: 'やっほー' }, 'http://api')).not.toBeNull();
      expect(some.sent[0].reference_id).toBe('boy');
    }
  });
});

describe('POST /voice/dictate (R21 playtest, iPhone Safari: 「00:00」 and noise stood in the answer)', () => {
  /** a short real recording made here (ffmpeg): a tone, or silence */
  const take = (src: string) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', src, '-t', '1.2', '-c:a', 'aac', '-f', 'adts', 'pipe:1']);
  const service = (answer: string) => {
    const heard: Buffer[] = [];
    const llm = { transcribe: async (b: Buffer) => (heard.push(b), answer) };
    const s = new VoiceService({} as never, {} as never, {} as never, llm as never);
    const warns: string[] = [];
    (s as unknown as { log: { warn: (m: string) => void } }).log = { warn: (m: string) => void warns.push(m) };
    return { s, heard, warns };
  };

  it('the model’s 「00:00」 for a silent take is no words (the web then says it did not hear) — logged with the loudness', async () => {
    const w = service('00:00');
    expect(await w.s.dictate('audio/mp4', take('anullsrc=r=44100:cl=mono'))).toEqual({ text: '' });
    expect(w.heard).toHaveLength(1);
    expect(w.warns[0]).toMatch(/^dictate no speech \(audio\/mp4, \d+ bytes, model "00:00", mean -9\d(\.\d)? dB, max -9\d(\.\d)? dB\)$/);
  });

  it('a sound tag around real words: only the words', async () => {
    const w = service('[00:00] おにぎり');
    expect(await w.s.dictate('audio/mp4', take('sine=f=440:r=44100'))).toEqual({ text: 'おにぎり' });
    expect(w.warns).toHaveLength(0);
  });

  it('a tone (no voice) answered as 「（ノイズ）」: no words, and the log shows the take was loud', async () => {
    const w = service('（ノイズ）');
    expect(await w.s.dictate('audio/mp4', take('sine=f=440:r=44100'))).toEqual({ text: '' });
    const max = Number(/max (-?[\d.]+) dB/.exec(w.warns[0])?.[1]);
    expect(max).toBeGreaterThan(-30);
  });
});
