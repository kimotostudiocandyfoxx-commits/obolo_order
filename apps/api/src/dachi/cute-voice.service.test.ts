import { CUTE_VOICE_RATE, cuteVoiceMana } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { apiError } from '../common/errors';
import { costScope } from '../wallet/cost-scope';
import { chargeRefused } from '../wallet/ledger.service';
import { CuteVoiceService } from './cute-voice.service';
import { DachiVoiceService, reachable } from './dachi-voice.service';

const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error ?? null);
const U = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const VOICE_ID = 'default-cute-voice';

/** the cute voice with the database, the ledger, the voice service, the storage and the mix replaced (no real call) */
function world(o: { recorded?: boolean; own?: string | null; balance?: number; fish?: boolean | 'fails'; voiceId?: string | null; mixFails?: boolean; chargeFails?: boolean } = {}) {
  let balance = o.balance ?? 10;
  const taken: number[] = [];
  const refunds: number[] = [];
  const spoken: { id: string; text: string; scope?: { feature?: string; kind?: string; paid?: boolean } }[] = [];
  const stored: { id: string; url: string; data: Buffer }[] = [];
  const mixes: { sound: string; soft?: boolean }[] = [];
  const media = {
    storeVoice: async (_u: string, _mime: string, data: Buffer) => {
      const m = { id: `v${stored.length}`, url: `https://r2/cute-${stored.length}.mp3`, data };
      stored.push(m);
      return m;
    },
  };
  const models = {
    enabled: o.fish !== false,
    create: async () => '',
    remove: async () => undefined,
    speak: async (id: string, text: string) => {
      if (o.fish === 'fails') throw new Error('fish 500');
      const s = costScope.get();
      spoken.push({ id, text, scope: s && { feature: s.feature, kind: s.kind, paid: s.paid } });
      // 2 s of a 128 kbit/s MP3
      return Buffer.alloc(32_000, 1);
    },
  };
  const mixer = {
    mixFor: async (_u: string, _id: string, p: { sound: string; soft?: boolean }) => {
      if (o.mixFails) return null;
      mixes.push(p);
      return { id: 'mix0', url: `https://r2/mix-${p.sound}.mp3`, seconds: 3.5 };
    },
  };
  const s = new CuteVoiceService({} as never, media as never, {} as never, {} as never, models as never, { FISH_DEFAULT_VOICE_ID: o.voiceId === null ? undefined : (o.voiceId ?? VOICE_ID) }, mixer as never, undefined);
  const x = s as unknown as Record<string, unknown>;
  x.who = async () => ({ recorded: o.recorded ?? false, own: o.recorded ? (o.own ?? null) : null });
  x.rate = async () => CUTE_VOICE_RATE;
  x.charge = async (_u: string, price: number) => {
    if (o.chargeFails) throw apiError(507, 'STORAGE_QUOTA', 'full');
    if (balance < price) throw chargeRefused('NO_MANA');
    balance = Math.round((balance - price) * 10) / 10;
    taken.push(price);
    // as LedgerService.charge: what follows in this scope is this paid making
    costScope.tag({ kind: 'cuteVoice', job: 'k', paid: true });
    return {
      refund: async () => {
        balance = Math.round((balance + price) * 10) / 10;
        refunds.push(price);
      },
    };
  };
  return { s, taken, refunds, spoken, stored, mixes, balance: () => balance };
}

describe('the default cute voice reads the ダチ words of a member who is not recorded (client 2026-11-27)', () => {
  it('reads the words in THE default voice, takes the price of these words first, keeps the voice and its quiet mix', async () => {
    const w = world();
    const words = 'やったー！すごく、うれしい';
    const r = await w.s.speak(U, words, 'https://api');
    const price = cuteVoiceMana(words);
    expect(r).toEqual({ tts: 'cute', mana: price, voice: { id: 'v0', url: 'https://r2/cute-0.mp3' }, mixed: { id: 'mix0', url: 'https://r2/mix-ureshii.mp3', mood: 'ureshii', soft: false }, seconds: 3.5 });
    expect(w.taken).toEqual([price]);
    expect(w.refunds).toEqual([]);
    // only the words go to the voice service, in the one default voice — and its cost is this paid making's
    expect(w.spoken).toEqual([{ id: VOICE_ID, text: words, scope: { feature: 'dachi', kind: 'cuteVoice', paid: true } }]);
  });

  it('the paid scope is its own: the ダチ talk around it stays the absorbed ダチ talk', async () => {
    const w = world();
    await costScope.run({ feature: 'dachi', userId: U }, async () => {
      await w.s.speak(U, 'こんにちは', '');
      expect(costScope.get()).toEqual({ feature: 'dachi', userId: U });
    });
  });

  it('no mana / not enough: no voice, nothing taken, nothing asked of the voice service — the words go alone', async () => {
    for (const balance of [0, 0.1]) {
      const w = world({ balance });
      // 0.1 mana does not cover a long message
      expect(await w.s.speak(U, 'あ'.repeat(120), '')).toEqual({ miss: 'noMana' });
      expect([w.taken, w.spoken, w.stored]).toEqual([[], [], []]);
    }
    // one mana covers a price below one (the tenths wait, as for every price below 1)
    const one = world({ balance: 1 });
    expect(await one.s.speak(U, 'おはよう', '')).toMatchObject({ mana: 0.1 });
  });

  it('a member who IS recorded does not get the cute voice’s switch (theirs is the version button on the draft card)', async () => {
    const w = world({ recorded: true });
    expect((await w.s.info(U)).on).toBe(false);
    // …and a member who is not recorded has no 「きれい」 version to choose
    expect(await world().s.cleanInfo(U)).toEqual({ on: false, own: false, rate: CUTE_VOICE_RATE });
  });

  it('no voice service, or no default voice set: nothing taken, the words go alone', async () => {
    for (const o of [{ fish: false as const }, { voiceId: null }]) {
      const w = world(o);
      expect(await w.s.speak(U, 'こんにちは', '')).toEqual({ miss: 'failed' });
      expect(w.taken).toEqual([]);
      expect((await w.s.info(U)).on).toBe(false);
    }
    expect(await world().s.info(U)).toEqual({ on: true, rate: CUTE_VOICE_RATE });
  });

  it('the voice could not be made: the mana is given back, the words go alone', async () => {
    const w = world({ fish: 'fails', balance: 5 });
    expect(await w.s.speak(U, 'こんにちは', '')).toEqual({ miss: 'failed' });
    expect(w.taken).toEqual(w.refunds);
    expect(w.balance()).toBe(5);
    expect(w.stored).toEqual([]);
  });

  it('a charge stopped by something else (a full Bluena): the words go alone, said as "could not" — not as no mana', async () => {
    expect(await world({ chargeFails: true }).s.speak(U, 'こんにちは', '')).toEqual({ miss: 'failed' });
  });

  it('a mix that failed: the voice alone is the message', async () => {
    const r = await world({ mixFails: true }).s.speak(U, 'こんにちは', '');
    expect(r).toMatchObject({ mixed: null, seconds: 2, voice: { id: 'v0' } });
  });
});

describe('「きれい」: a recorded member’s caption read as the voice message (client 2026-11-27, shared voiceVersion.ts)', () => {
  it('in the member’s own registered voice model when they have one — the per-character price first, the same machinery', async () => {
    const w = world({ recorded: true, own: 'my-own-model' });
    const words = 'あした、あそぼう';
    const r = await w.s.speak(U, words, 'https://api');
    const price = cuteVoiceMana(words);
    expect(r).toMatchObject({ tts: 'clean', mana: price, voice: { id: 'v0' } });
    expect(w.taken).toEqual([price]);
    expect(w.spoken).toEqual([{ id: 'my-own-model', text: words, scope: { feature: 'dachi', kind: 'cuteVoice', paid: true } }]);
    expect(await w.s.cleanInfo(U)).toEqual({ on: true, own: true, rate: CUTE_VOICE_RATE });
  });

  it('with no voice model of their own: the default cute voice', async () => {
    const w = world({ recorded: true });
    expect(await w.s.speak(U, 'こんにちは', '')).toMatchObject({ tts: 'clean' });
    expect(w.spoken[0].id).toBe(VOICE_ID);
    expect(await w.s.cleanInfo(U)).toEqual({ on: true, own: false, rate: CUTE_VOICE_RATE });
    // no model of their own and no default voice here, or no voice service: 「きれい」 is not offered
    expect((await world({ recorded: true, voiceId: null }).s.cleanInfo(U)).on).toBe(false);
    expect((await world({ recorded: true, own: 'my-own-model', voiceId: null }).s.cleanInfo(U)).on).toBe(true);
    expect((await world({ recorded: true, own: 'my-own-model', fish: false }).s.cleanInfo(U)).on).toBe(false);
  });

  it('the sound the member chose under 「おと」 is the one mixed in (なし: the voice alone); left out, it is picked from the words', async () => {
    const chosen = world({ recorded: true });
    expect(await chosen.s.speak(U, 'やったー！', '', { sound: 'oyasumi' })).toMatchObject({ mixed: { mood: 'oyasumi', soft: false } });
    expect(chosen.mixes).toEqual([{ sound: 'oyasumi', soft: false }]);
    const soft = world({ recorded: true });
    expect(await soft.s.speak(U, 'やったー！', '', { sound: 'ureshii', soft: true })).toMatchObject({ mixed: { mood: 'ureshii', soft: true } });
    const none = world({ recorded: true });
    expect(await none.s.speak(U, 'やったー！', '', { sound: 'none' })).toMatchObject({ mixed: null, seconds: 2 });
    expect(none.mixes).toEqual([]);
  });

  it('no mana: nothing taken, nothing read — the words go alone; a failure gives the mana back', async () => {
    const poor = world({ recorded: true, own: 'my-own-model', balance: 0 });
    expect(await poor.s.speak(U, 'こんにちは', '')).toEqual({ miss: 'noMana' });
    expect([poor.taken, poor.spoken, poor.stored]).toEqual([[], [], []]);
    const broken = world({ recorded: true, own: 'my-own-model', fish: 'fails', balance: 3 });
    expect(await broken.s.speak(U, 'こんにちは', '')).toEqual({ miss: 'failed' });
    expect(broken.balance()).toBe(3);
  });
});

describe('sending words with 〔こえをつける〕', () => {
  function talk(cute: { speak: (u: string, t: string, origin: string, chosen: { sound?: string; soft?: boolean }) => Promise<unknown> } | undefined, o: { flagged?: boolean } = {}) {
    const dropped: string[] = [];
    const mixer = { discard: async (_u: string, id: string) => void dropped.push(id) };
    const rows: Record<string, unknown>[] = [];
    const pushes: { title: string }[] = [];
    const llm = { name: 'gemini', chat: async () => (o.flagged ? 'FLAG:harassment' : 'OK') };
    const s = new DachiVoiceService({} as never, { list: async () => [] } as never, {} as never, { notify: async (_to: string, n: { title: string }) => void pushes.push(n) } as never, llm as never, undefined, mixer as never, cute as never);
    const x = s as unknown as Record<string, unknown>;
    x.journey = async () => ({ journeyDay: 3, journeyCompletedAt: null, dachiAt: new Date(), displayName: 'A' });
    x.areDachi = async () => reachable({ follows: 2, blocks: 0, peerOk: true });
    x.insertMessage = async (r: Record<string, unknown>) => {
      const m = { ...r, id: `m${rows.length}`, createdAt: new Date() };
      rows.push(m);
      return m;
    };
    return { s, rows, pushes, dropped };
  }
  const made = { tts: 'cute', mana: 0.2, voice: { id: 'v0', url: 'https://r2/cute-0.mp3' }, mixed: { id: 'mix0', url: 'https://r2/mix-ureshii.mp3', mood: 'ureshii', soft: true }, seconds: 3.52 };

  it('made: a voice message — the words as its caption, the mix heard, the voice alone for 〔おとをけす〕, the mana said', async () => {
    const asked: string[] = [];
    const w = talk({ speak: async (_u, t) => (asked.push(t), made) });
    const v = await w.s.send(U, B, { text: 'やったー！', spoken: true });
    expect(v).toMatchObject({ kind: 'voice', text: 'やったー！', audioUrl: 'https://r2/mix-ureshii.mp3', seconds: 3.5, sound: { mood: 'ureshii', plainUrl: 'https://r2/cute-0.mp3' }, cute: { mana: 0.2 } });
    expect(w.rows[0]).toMatchObject({ kind: 'voice', audioMediaId: 'mix0', workJson: { text: 'やったー！', tts: 'cute', sound: { plainMediaId: 'v0', soft: true } } });
    expect(asked).toEqual(['やったー！']);
    expect(w.pushes[0].title).toContain('声のメッセージ');
  });

  it('no mana, or it could not be made: the same words as a text message, with why — never an error', async () => {
    for (const miss of ['noMana', 'failed'] as const) {
      const w = talk({ speak: async () => ({ miss }) });
      const v = await w.s.send(U, B, { text: 'やったー！', spoken: true });
      expect(v).toMatchObject({ kind: 'text', text: 'やったー！', audioUrl: null, cute: { miss } });
      expect(w.rows[0]).toMatchObject({ kind: 'text', workJson: { text: 'やったー！' } });
    }
    const thrown = talk({ speak: async () => Promise.reject(new Error('boom')) });
    expect(await thrown.s.send(U, B, { text: 'うん', spoken: true })).toMatchObject({ kind: 'text', cute: { miss: 'failed' } });
  });

  it('the default cute voice is not the member’s own voice: a member who is not recorded hears their message as before', async () => {
    const w = talk({ speak: async () => made });
    const mine = await w.s.send(U, B, { text: 'やったー！', spoken: true });
    expect(mine).toMatchObject({ fromMe: true, audioUrl: 'https://r2/mix-ureshii.mp3' });
    expect(mine.sentVoice).toBeUndefined();
  });

  it('「きれい」: sent as a voice message the SENDER does not hear; the sound chosen rides along; the 「そのまま」 draft of the same take goes', async () => {
    const asked: unknown[] = [];
    const w = talk({ speak: async (_u, t, _o, chosen) => (asked.push([t, chosen]), { ...made, tts: 'clean' }) });
    const drop = 'd1111111-1111-4111-8111-111111111111';
    const mine = await w.s.send(U, B, { text: 'あした、あそぼう', spoken: true, sound: 'ureshii', soft: true, drop });
    expect(asked).toEqual([['あした、あそぼう', { sound: 'ureshii', soft: true }]]);
    expect(w.rows[0]).toMatchObject({ kind: 'voice', audioMediaId: 'mix0', workJson: { text: 'あした、あそぼう', tts: 'clean' } });
    // the sender: the words, the mana, a mark that a voice went — no audio
    expect(mine).toMatchObject({ kind: 'voice', fromMe: true, audioUrl: null, sentVoice: true, text: 'あした、あそぼう', cute: { mana: 0.2 } });
    expect(mine.sound).toBeUndefined();
    // the receiver hears it
    expect(w.s.toView(B, w.rows[0] as never)).toMatchObject({ audioUrl: 'https://r2/mix-ureshii.mp3', sound: { plainUrl: 'https://r2/cute-0.mp3' } });
    expect(w.dropped).toEqual([drop]);
    // with no mana the words go alone with the calm line — and the recording's draft is still not kept
    const poor = talk({ speak: async () => ({ miss: 'noMana' }) });
    expect(await poor.s.send(U, B, { text: 'あした、あそぼう', spoken: true, drop })).toMatchObject({ kind: 'text', cute: { miss: 'noMana' } });
    expect(poor.dropped).toEqual([drop]);
  });

  it('no such member (null), no switch, or no cute voice here: plain words as ever, nothing said about a voice', async () => {
    let asked = 0;
    const recorded = talk({ speak: async () => (asked++, null) });
    const v = await recorded.s.send(U, B, { text: 'うん', spoken: true });
    expect(v.kind).toBe('text');
    expect(v.cute).toBeUndefined();
    await recorded.s.send(U, B, { text: 'うん' });
    expect(asked).toBe(1);
    expect((await talk(undefined).s.send(U, B, { text: 'うん', spoken: true })).cute).toBeUndefined();
  });

  it('words that may not be sent are refused before any voice (nothing is charged for them)', async () => {
    let asked = 0;
    const w = talk({ speak: async () => (asked++, made) }, { flagged: true });
    await expect(w.s.send(U, B, { text: 'ひどいことば', spoken: true })).rejects.toSatisfy((e) => code(e)?.code === 'CONTENT_FLAGGED');
    expect([asked, w.rows.length]).toEqual([0, 0]);
  });
});
