import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { LedgerError } from '@obolo/ledger';
import { MEDIA_CONSENT_VERSION, lyricsFallback, lyricsSecondVerse, songVoiceKey, songVoiceQuote, spellFrom, JOB_MAX_ATTEMPTS, type JobView, type MakeConfirm, type SongPhrase } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db/db';
import { JobsService } from '../jobs/jobs.service';
import { LedgerService, type ManaEntryInput, type Tx } from '../wallet/ledger.service';
import { SongService } from './song.service';
import { SongTweakService, type TweakDesign } from './song-tweak.service';
import { SongVoiceService } from './song-voice.service';

/** the ledger's real rules over an in-memory wallet */
class MemLedger extends LedgerService {
  balance = 500;
  rows: ManaEntryInput[] = [];
  tenths = { pendingTenths: 0, rows: 0, takenMana: 0 };
  protected override async lockedBalance() {
    return this.balance;
  }
  protected override async tenthsRow() {
    return { ...this.tenths };
  }
  protected override async saveTenths(_tx: Tx, _u: string, v: { pendingTenths: number; rows: number; takenMana: number }) {
    this.tenths = v;
  }
  /** what the member has spent, the waiting tenths counted (prices are to the tenth of a mana) */
  spent() {
    return Math.round((500 - this.balance + this.tenths.pendingTenths / 10) * 10) / 10;
  }
  protected override async applied(_tx: Tx, key: string) {
    return this.rows.some((r) => r.idempotencyKey === key);
  }
  protected override async deltaOf(_tx: Tx, key: string) {
    return this.rows.find((r) => r.idempotencyKey === key)?.delta;
  }
  override async applyMana(_tx: Tx, e: ManaEntryInput) {
    if (this.rows.some((r) => r.idempotencyKey === e.idempotencyKey)) return {} as never;
    if (this.balance + e.delta < 0) throw new LedgerError('INSUFFICIENT_BALANCE', 'negative');
    this.balance += e.delta;
    this.rows.push(e);
    return {} as never;
  }
}
const memDb = { write: { transaction: <T,>(fn: (tx: Tx) => Promise<T>) => fn({} as Tx) } } as unknown as Database;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof HttpException ? `${e.getStatus()} ${(e.getResponse() as { error: { code: string } }).error.code}` : String(e);
  }
};

const adult = { id: 'u1', voiceSelfUrl: 'https://cdn/me.wav', consentVersion: MEDIA_CONSENT_VERSION, consentAt: new Date(), guardianConsentVersion: null, guardianConsentAt: null, onboardingJson: { birthYear: '1995' } };
const lyrics = lyricsSecondVerse(lyricsFallback(spellFrom('song', '夏の海の明るい曲')));

/** a Runware song (one mix, never split) and the song service around it — the GPU and storage faked */
function world(o: { split?: boolean; member?: Record<string, unknown> | null; gpuFails?: boolean; tempo?: number } = {}) {
  const phrases: SongPhrase[] = lyrics.blocks.flatMap((b) => b.lines).map((text, i) => ({ index: i, section: 'verse' as const, text, slot: 'self' as const, url: 'https://cdn/song.mp3', seconds: 2, startBeat: 8 + i * 4, beats: 4 }));
  const design: TweakDesign & Record<string, unknown> = { engine: 'runware', bpm: 120, lyrics, sourceUrl: 'https://cdn/song.mp3', ...(o.tempo ? { tempo: o.tempo } : {}), ...(o.split ? { vocalsUrl: 'https://cdn/voc.m4a', guideUrl: 'https://cdn/voc.m4a', original: { mixUrl: 'https://cdn/song.mp3', seconds: 100, phrases } } : {}) };
  const row: Record<string, unknown> = { id: 's1', userId: 'u1', title: '夏', mixUrl: 'https://cdn/song.mp3', instrumentalUrl: o.split ? 'https://cdn/inst.m4a' : 'https://cdn/song.mp3', seconds: 100, phrasesJson: phrases, designJson: design, mixJson: {}, directionJson: {}, savedAt: null };
  const calls = { split: 0, voice: [] as { vocals: string; instrumental: string }[] };
  const db = { write: { update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => ({ returning: async () => (Object.assign(row, v), [row]) }) }) }) } };
  const media = { audioByUrl: async (_u: string, url: string) => Buffer.from(url), storeAudio: async (_u: string, _m: string, data: Buffer) => ({ url: `https://cdn/stored-${data.toString()}.m4a` }) };
  const songs = new SongService({ name: 'mock' } as never, { MUSIC_URL: 'https://gpu' } as never, db as never, media as never, {} as never);
  Object.assign(songs, {
    owned: async () => row,
    member: async () => (o.member === undefined ? adult : o.member),
    voiceSample: async () => Buffer.from('me'),
    stretch: async (data: Buffer, tempo: number) => ({ data: Buffer.from(`fast${tempo}-${data.toString()}`), seconds: Math.round((100 / tempo) * 10) / 10 }),
    split: async () => {
      calls.split++;
      Object.assign(row, { instrumentalUrl: 'https://cdn/inst.m4a', designJson: { ...(row.designJson as object), vocalsUrl: 'https://cdn/voc.m4a', guideUrl: 'https://cdn/voc.m4a', original: { mixUrl: 'https://cdn/song.mp3', seconds: 100, phrases } } });
    },
    gpuVoice: async (b: { vocals: Buffer; instrumental: Buffer }) => {
      calls.voice.push({ vocals: b.vocals.toString(), instrumental: b.instrumental.toString() });
      if (o.gpuFails) throw Object.assign(new HttpException({ error: { code: 'MUSIC_FAILED', message: 'x' } }, 502));
      return { seconds: 100, vocals: Buffer.from('own-voc'), mix: Buffer.from('own-mix'), voiceNote: 'ok' };
    },
  });
  // the job queue: a job's work run at once (as the queue would)
  const jobsMade: { kind: string; input: Record<string, unknown> }[] = [];
  const jobs = {
    create: async (_u: string, kind: string, input: Record<string, unknown>) => (jobsMade.push({ kind, input }), { id: `job${jobsMade.length}`, kind, status: 'queued' } as JobView),
    get: async (_u: string, id: string) => ({ id, kind: 'song-voice', status: 'queued' }) as JobView,
  };
  const kv = new Map<string, string>();
  const ledger = new MemLedger();
  const rates = { usdJpy: 160, gpuSecondJpy: 0.5, cpuSecondJpy: 0.01 };
  const cost = { rates: async () => rates, rule: () => ({ feeRate: 0.036, feeFixedJpy: 0, feeBaseJpy: 88, margin: 0.08 }), voiceSeconds: async () => ({}) };
  const voice = new SongVoiceService(songs, jobs as never, ledger, memDb, { get: async (k: string) => kv.get(k) ?? null, set: async (k: string, v: string) => void kv.set(k, v) } as never, cost as never);
  const tweaks = new SongTweakService({ name: 'mock', chat: async () => '{"ops":[]}' } as never, {} as never, {} as never);
  const renders: { vocalsUrl: string; plan: { tempo: number } }[] = [];
  Object.assign(tweaks, {
    load: async () => row,
    save: async (_u: string, _id: string, v: { mixUrl: string; seconds: number; phrases: SongPhrase[]; design: TweakDesign }) => Object.assign(row, { mixUrl: v.mixUrl, seconds: v.seconds, phrasesJson: v.phrases, designJson: v.design }),
    render: async (_u: string, x: { vocalsUrl: string; plan: { tempo: number }; total: number }) => (renders.push(x), { data: Buffer.from('x'), seconds: x.total }),
    store: async () => `https://cdn/r${renders.length}.m4a`,
    startSplit: async () => 'job-split',
  });
  return { row, songs, voice, ledger, jobsMade, calls, rates, tweaks, renders, design: () => row.designJson as TweakDesign };
}
const yes = (price: number, spell: string): { confirm: MakeConfirm & { spell: string } } => ({ confirm: { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f', price, spell } });

describe('R18: 君の声にする魔法 — quote → yes → charge → job → both versions', () => {
  it('the quote is the price rule of the GPU seconds; the yes is charged exactly that; the job converts; both voices kept', async () => {
    const w = world();
    const q = await w.voice.quote('u1', 's1');
    expect(q).toEqual({ status: 'quote', price: songVoiceQuote({ split: true }, w.rates).mana, spell: songVoiceKey('s1', true), split: true });
    if (q.status !== 'quote') throw new Error('no quote');
    // nothing charged by the quote
    expect(w.ledger.rows).toHaveLength(0);
    const job = await w.voice.start('u1', 's1', yes(q.price, q.spell), 'http://x');
    expect(job.id).toBe('job1');
    expect(w.ledger.rows.map((r) => [r.refType, r.reason])).toEqual([['songVoice', 'generation']]);
    expect(w.ledger.spent()).toBe(q.price);
    expect(w.jobsMade).toEqual([{ kind: 'song-voice', input: { songId: 's1', origin: 'http://x', confirm: yes(q.price, q.spell).confirm } }]);
    // the job's work: the split (never split), then only the studio vocal converted
    const v = await w.songs.voiceSwap('u1', 's1', 'http://x');
    expect(w.calls.split).toBe(1);
    expect(w.calls.voice).toEqual([{ vocals: 'https://cdn/voc.m4a', instrumental: 'https://cdn/inst.m4a' }]);
    expect(w.design().own).toMatchObject({ vocalsUrl: 'https://cdn/stored-own-voc.m4a', mixUrl: 'https://cdn/stored-own-mix.m4a' });
    expect(w.design().vocalsUrl).toBe('https://cdn/voc.m4a');
    expect(w.design().original?.mixUrl).toBe('https://cdn/song.mp3');
    expect(v.url).toBe('https://cdn/stored-own-mix.m4a');
    expect(v.voice).toEqual({ using: 'own', versions: ['original', 'own'] });
    // asked again: no second charge, only a switch
    expect(await w.voice.quote('u1', 's1')).toEqual({ status: 'has', using: 'own' });
    expect(await code(w.voice.start('u1', 's1', yes(q.price, q.spell), 'http://x'))).toBe('409 VOICE_UNAVAILABLE');
    expect(w.ledger.rows).toHaveLength(1);
  });
  it('a song already split: the quote is only the conversion (lower), no second split', async () => {
    const full = await world().voice.quote('u1', 's1');
    const w = world({ split: true });
    const q = await w.voice.quote('u1', 's1');
    expect(q).toMatchObject({ status: 'quote', split: false, spell: songVoiceKey('s1', false) });
    if (q.status !== 'quote' || full.status !== 'quote') throw new Error('no quote');
    expect(q.price).toBeLessThan(full.price);
    await w.voice.start('u1', 's1', yes(q.price, q.spell), 'http://x');
    await w.songs.voiceSwap('u1', 's1', 'http://x');
    expect(w.calls.split).toBe(0);
    expect(w.calls.voice).toHaveLength(1);
  });
  it('a yes to an old quote (the song split meanwhile, another price) is refused, never charged', async () => {
    const w = world();
    const q = await w.voice.quote('u1', 's1');
    if (q.status !== 'quote') throw new Error('no quote');
    await w.songs.split('u1', 's1', 'http://x');
    expect(await code(w.voice.start('u1', 's1', yes(q.price, q.spell), 'http://x'))).toMatch(/409 (PRICE_CHANGED|SPELL_CHANGED)/);
    expect(w.ledger.rows).toHaveLength(0);
  });
  it('no registered voice: nothing charged ({bati} tells how to register); the consent rules: nothing either', async () => {
    const w = world({ member: { ...adult, voiceSelfUrl: null } });
    expect(await w.voice.quote('u1', 's1')).toEqual({ status: 'noVoice' });
    expect(await code(w.voice.start('u1', 's1', yes(10, songVoiceKey('s1', true)), 'http://x'))).toBe('409 VOICE_UNAVAILABLE');
    expect(w.ledger.rows).toHaveLength(0);
    // under 13, and 13–15 without a guardian's yes: never (canUseMedia)
    const year = new Date().getFullYear();
    for (const m of [{ ...adult, onboardingJson: { birthYear: String(year - 10) } }, { ...adult, onboardingJson: { birthYear: String(year - 14) } }, { ...adult, onboardingJson: { birthYear: '1995', 'consent.media': '0' } }]) {
      const c = world({ member: m });
      expect(await c.voice.quote('u1', 's1')).toEqual({ status: 'noConsent' });
      expect(await code(c.voice.start('u1', 's1', yes(10, songVoiceKey('s1', true)), 'http://x'))).toBe('409 VOICE_UNAVAILABLE');
    }
    const guarded = world({ member: { ...adult, onboardingJson: { birthYear: String(year - 14) }, guardianConsentVersion: MEDIA_CONSENT_VERSION, guardianConsentAt: new Date() } });
    expect((await guarded.voice.quote('u1', 's1')).status).toBe('quote');
  });
});

describe('R18: the song’s tempo (1.2×) comes after the conversion', () => {
  it('the take as sung is converted, then made faster (the pitch kept) — what the member hears', async () => {
    const w = world({ split: true, tempo: 1.2 });
    const v = await w.songs.voiceSwap('u1', 's1', 'http://x');
    expect(w.calls.voice).toEqual([{ vocals: 'https://cdn/voc.m4a', instrumental: 'https://cdn/inst.m4a' }]);
    expect(w.design().own).toMatchObject({ mixUrl: 'https://cdn/stored-own-mix.m4a', first: { mixUrl: 'https://cdn/stored-fast1.2-own-mix.m4a', seconds: 83.3 } });
    expect(v.url).toBe('https://cdn/stored-fast1.2-own-mix.m4a');
    expect(v.seconds).toBe(83.3);
  });
});

describe('R18: a failure gives the mana back', () => {
  it('the job fails for good → the very mana charged comes back, once', async () => {
    const w = world({ gpuFails: true });
    const q = await w.voice.quote('u1', 's1');
    if (q.status !== 'quote') throw new Error('no quote');
    await w.voice.start('u1', 's1', yes(q.price, q.spell), 'http://x');
    const row = { id: 'j1', userId: 'u1', kind: 'song-voice', status: 'queued', attempts: 0, inputJson: w.jobsMade[0].input, startedAt: null, etaAt: new Date(), late: 0, lastErrorCode: null, createdAt: new Date() };
    const queue = { register: () => undefined, enqueue: async () => undefined };
    const jobs = new JobsService(memDb, queue as never, w.songs, {} as never, { notify: async () => undefined } as never, {} as never, w.ledger);
    Object.assign(jobs, { load: async () => ({ ...row }), patch: async (_id: string, set: object) => void Object.assign(row, set), recentMs: async () => [], waiting: async () => 0 });
    for (let i = 0; i < JOB_MAX_ATTEMPTS; i++) await jobs.run('j1');
    expect(row.status).toBe('failed');
    expect(w.ledger.rows.map((r) => r.reason)).toEqual(['generation', 'refund']);
    expect(w.ledger.spent()).toBe(0);
    expect(w.design().own).toBeUndefined();
  });
});

describe('R18: both versions on the work — a free switch; the free changes apply to both', () => {
  it('「元の声で」/「自分の声で」 switch for free; the changes so far are made again from that voice’s stems (tempo after the conversion)', async () => {
    const w = world({ split: true });
    await w.songs.voiceSwap('u1', 's1', 'http://x');
    // a free change in the member's voice: rendered from the converted vocal
    const t = await w.tweaks.tweak('u1', 's1', { said: 'テンポ速くして' }, 'http://x');
    expect(t.status).toBe('done');
    expect(w.renders[0]).toMatchObject({ vocalsUrl: 'https://cdn/stored-own-voc.m4a', plan: { tempo: 1.1 } });
    // back to the original voice: the same change made again from the studio's vocal
    const a = await w.tweaks.useVoice('u1', 's1', 'original', 'http://x');
    expect(a.using).toBe('original');
    expect(w.renders[1]).toMatchObject({ vocalsUrl: 'https://cdn/voc.m4a', plan: { tempo: 1.1 } });
    expect(w.ledger.rows).toHaveLength(0);
    // and to the member's voice again
    const b = await w.tweaks.useVoice('u1', 's1', 'own', 'http://x');
    expect(b).toMatchObject({ using: 'own', versions: ['original', 'own'] });
    expect(w.renders[2].vocalsUrl).toBe('https://cdn/stored-own-voc.m4a');
    // 元に戻して (to the untouched song) keeps the voice in use
    const u = await w.tweaks.tweak('u1', 's1', { undo: true }, 'http://x');
    expect(u.song?.url).toBe('https://cdn/stored-own-mix.m4a');
  });
  it('no changes yet: the switch is the kept mixes (nothing rendered)', async () => {
    const w = world({ split: true });
    await w.songs.voiceSwap('u1', 's1', 'http://x');
    expect((await w.tweaks.useVoice('u1', 's1', 'original', 'http://x')).song.url).toBe('https://cdn/song.mp3');
    expect((await w.tweaks.useVoice('u1', 's1', 'own', 'http://x')).song.url).toBe('https://cdn/stored-own-mix.m4a');
    expect(w.renders).toHaveLength(0);
  });
  it('the words: own voice is the spell (not a free change), another person’s voice is declined', async () => {
    const w = world({ split: true });
    expect(await w.tweaks.tweak('u1', 's1', { said: '自分の声にして' }, 'http://x')).toMatchObject({ status: 'voice', voice: 'own' });
    expect(await w.tweaks.tweak('u1', 's1', { said: 'アイドルの声で歌って' }, 'http://x')).toMatchObject({ status: 'voice', voice: 'other' });
    expect(await w.tweaks.tweak('u1', 's1', { said: '元の声で' }, 'http://x')).toMatchObject({ status: 'voice', voice: 'original' });
  });
});
