import { Logger } from '@nestjs/common';
import { ABSORBED_FEATURES, BATI_FACES, type TalkLook } from '@obolo/shared';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { costScope, type CostCtx } from '../wallet/cost-scope';
import { BATI_FACES_CUTFAIL, cutFailsOf, LOOK_BACK_CUTFAIL, LookService } from './look.service';

// Client 2026-11-27: every expression variant — {bati}'s faces, the talk's faces and their blink / mouth parts — and the
// back view goes through the one cut-out (media/cutting.ts cutLadder: five checks, never more than three retries)
// before it is stored. The painter, the background-removal model and the vision model are fakes: no provider is called.

const S = 320;
const HEX: Record<string, string> = { '#00FF00': '#00ff00', '#FF00FF': '#ff00ff', '#0000FF': '#0000ff' };
const FIGURE = '<circle cx="160" cy="165" r="95" fill="#f2c9a0" stroke="#3a2a2a" stroke-width="7"/><circle cx="130" cy="150" r="9" fill="#3a2a2a"/><circle cx="190" cy="150" r="9" fill="#3a2a2a"/>';
const svg = (body: string, bg?: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${bg ? `<rect width="${S}" height="${S}" fill="${bg}"/>` : ''}${body}</svg>`);
/** the picture worn now: a cut-out (transparent around the figure) */
const worn = () => sharp(svg(FIGURE)).png().toBuffer();
/** a painting of the figure on the key colour its prompt asks for */
const painting = async (prompt: string) => {
  const key = Object.keys(HEX).find((k) => prompt.includes(k));
  if (!key) throw new Error(`no key colour in the prompt: ${prompt.slice(0, 80)}`);
  return { data: await sharp(svg(FIGURE, HEX[key])).png().toBuffer(), mime: 'image/png' };
};

type Call = { what: string; scope: CostCtx | undefined };

function make(o: { judge?: (n: number) => string; user?: Record<string, unknown> } = {}) {
  const user: Record<string, unknown> = {
    id: 'u',
    email: 'u@example.com',
    displayName: 'ネオ',
    journeyDay: 2,
    journeyCompletedAt: null,
    orderedAt: null,
    subscriptionStatus: 'none',
    avatarUrl: 'https://x/look.png',
    createdAt: new Date(),
    batiImageUrl: 'https://x/bati.png',
    batiFood: 'たこ焼き',
    onboardingJson: {},
    ...o.user,
  };
  const db = {
    write: {
      select: () => ({ from: () => ({ where: async () => [user] }) }),
      update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => (Object.assign(user, v), Object.assign(Promise.resolve(), { returning: async () => [user] })) }) }),
    },
  };
  const stored: { url: string; mime: string; data: Buffer }[] = [];
  const media = {
    bytesByUrl: async (_u: string, url: string) => stored.find((s) => s.url === url)?.data ?? worn(),
    storeImage: async (_u: string, _k: string, mime: string, data: Buffer) => {
      const url = `https://x/stored-${stored.length}.png`;
      stored.push({ url, mime, data });
      return { id: `id-${stored.length}`, url };
    },
    removeByUrl: async () => undefined,
  };
  const calls: Call[] = [];
  const note = (what: string) => calls.push({ what, scope: costScope.get() && { ...costScope.get()! } });
  const looks = {
    generate: async (prompt: string) => {
      note(prompt.startsWith('Edit the picture: replace only the background') ? 'rekey' : 'paint');
      return painting(prompt);
    },
  };
  /** the background-removal model: it keeps the figure's disc */
  const model = {
    name: 'fake-rembg',
    async remove(img: { data: Buffer }) {
      note('model');
      return { data: await sharp(img.data).ensureAlpha().composite([{ input: svg('<circle cx="160" cy="165" r="98" fill="#fff"/>'), blend: 'dest-in' }]).png().toBuffer(), mime: 'image/png' };
    },
  };
  let looked = 0;
  const llm = { name: 'fake-vision', perceive: async () => (note('judge'), (o.judge ?? (() => 'OK'))(looked++)) };
  const charged: string[] = [];
  const ledger = { charge: async (_d: unknown, _u: string, kind: string) => (charged.push(kind), { refund: async () => undefined }) };
  const queue = { register: () => undefined, enqueue: async () => undefined };
  const s = new LookService(db as never, media as never, looks as never, looks as never, llm as never, new MemoryKv(), ledger as never, queue as never, undefined, undefined, undefined, undefined, undefined, model as never);
  const count = (what: string) => calls.filter((c) => c.what === what).length;
  return { s, user, stored, calls, count, charged, story: () => user.onboardingJson as Record<string, string> };
}
const alphaOf = async (png: Buffer) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { corner: data[3], middle: data[(Math.round(info.height / 2) * info.width + Math.round(info.width / 2)) * 4 + 3], hasAlpha: (await sharp(png).metadata()).hasAlpha };
};
const free = <T>(fn: () => Promise<T>) => costScope.run({ feature: 'look', userId: 'u' }, fn);
const NG = () => 'NG: a green halo around the outline';
const EVERY_STEP = 'colour:vision|model:vision|repaint:vision|repaint2:vision';

// the real cut and its checks run on every fake painting (sharp): slow when the whole suite runs beside it
vi.setConfig({ testTimeout: 60_000 });
afterEach(() => vi.restoreAllMocks());

describe("{bati}'s expression variants go through the shared cut-out", () => {
  it('every face is cut and checked before it is stored: one model cut and one look per painting, nothing painted again', async () => {
    const t = make();
    const me = await free(() => t.s.batiFaces('u', 'https://x'));
    expect(t.count('paint')).toBe(BATI_FACES.length);
    // the pipeline saw every painting: the model cut each (the shape check) and the vision model looked at each cut
    expect(t.count('model')).toBe(BATI_FACES.length);
    expect(t.count('judge')).toBe(BATI_FACES.length);
    expect(t.count('rekey')).toBe(0);
    expect(Object.keys(me.bati?.faces ?? {}).sort()).toEqual([...BATI_FACES].sort());
    // what is stored is the cut-out: a PNG, clear in the corner, solid in the middle
    expect(t.stored).toHaveLength(BATI_FACES.length);
    for (const p of t.stored) {
      expect(p.mime).toBe('image/png');
      expect(await alphaOf(p.data)).toEqual({ corner: 0, middle: 255, hasAlpha: true });
    }
    expect(t.story()[BATI_FACES_CUTFAIL]).toBeUndefined();
  });

  it('the retries stop at the ladder: the model cut, then two repaints — never a fourth', async () => {
    const t = make({ judge: NG });
    await free(() => t.s.batiFaces('u', 'https://x'));
    // per face: the first painting, and exactly two re-keyed paintings (repaint, repaint2)
    expect(t.count('paint')).toBe(BATI_FACES.length);
    expect(t.count('rekey')).toBe(BATI_FACES.length * 2);
    // per face: the model cuts the first painting and each repaint (3), and four cuts are looked at
    expect(t.count('model')).toBe(BATI_FACES.length * 3);
    expect(t.count('judge')).toBe(BATI_FACES.length * 4);
  });

  it('a face no try cut cleanly is not stored: the plain picture stands in, it is recorded and logged as an error, and not painted again', async () => {
    const errors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const t = make({ judge: NG });
    const me = await free(() => t.s.batiFaces('u', 'https://x'));
    expect(t.stored).toHaveLength(0);
    expect(Object.keys(me.bati?.faces ?? {})).toEqual([]);
    const failed = cutFailsOf(t.story()[BATI_FACES_CUTFAIL], 'https://x/bati.png');
    expect(Object.keys(failed).sort()).toEqual([...BATI_FACES].sort());
    expect(failed.smile).toBe(EVERY_STEP);
    const lines = errors.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(BATI_FACES.length);
    expect(lines.find((l) => l.includes('bati face smile of u'))).toContain(`cut-out failed every retry and is not shown (bati face smile of u; ${EVERY_STEP})`);
    // asked again for the same picture: nothing is painted
    const n = t.calls.length;
    await free(() => t.s.batiFaces('u', 'https://x'));
    expect(t.calls).toHaveLength(n);
    // a new {bati} picture starts afresh
    expect(cutFailsOf(t.story()[BATI_FACES_CUTFAIL], 'https://x/another.png')).toEqual({});
  });

  it('a retry is never the member\'s cost twice: outside a paid making everything after the first failed check is absorbed (cutRetry)', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    expect(ABSORBED_FEATURES).toContain('cutRetry');
    const t = make({ judge: NG });
    await free(() => t.s.batiFaces('u', 'https://x'));
    const features = (what: string) => t.calls.filter((c) => c.what === what).map((c) => c.scope?.feature);
    // the picture itself and its first check: the feature's own small costs, once
    expect(new Set(features('paint'))).toEqual(new Set(['look']));
    expect(features('model').filter((f) => f === 'look')).toHaveLength(BATI_FACES.length);
    expect(features('judge').filter((f) => f === 'look')).toHaveLength(BATI_FACES.length);
    // the retries: the repaints, their model cuts and the looks at the retried cuts
    expect(new Set(features('rekey'))).toEqual(new Set(['cutRetry']));
    expect(features('model').filter((f) => f === 'cutRetry')).toHaveLength(BATI_FACES.length * 2);
    expect(features('judge').filter((f) => f === 'cutRetry')).toHaveLength(BATI_FACES.length * 3);
    for (const c of t.calls) expect(c.scope?.userId).toBe('u');
    // and no charge is made for any of it
    expect(t.charged).toEqual([]);
  });

  it('a clean first cut costs nothing as a retry', async () => {
    const t = make();
    await free(() => t.s.batiFaces('u', 'https://x'));
    expect(t.calls.filter((c) => c.scope?.feature !== 'look')).toEqual([]);
  });
});

describe('the back view goes through the shared cut-out', () => {
  it('the 1st retry is used: the colour cut fails a check, the model\'s cut of the same painting passes — nothing is painted again', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const t = make({ judge: (n) => (n === 0 ? 'NG: halo' : 'OK') });
    const me = await free(() => t.s.backView('u', 'https://x'));
    expect(me.lookBack).toBe(t.stored[0].url);
    expect([t.count('paint'), t.count('rekey'), t.count('model'), t.count('judge')]).toEqual([1, 0, 1, 2]);
    expect(await alphaOf(t.stored[0].data)).toEqual({ corner: 0, middle: 255, hasAlpha: true });
  });

  it('in a paid making the retries are that making\'s costs — one price, no second charge', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    // the first look, not confirmed yet: its pictures are recorded as its profileLook making (taken once at the end of day 2)
    const t = make({ judge: NG });
    await free(() => t.s.backView('u', 'https://x'));
    expect(t.count('rekey')).toBe(2);
    for (const c of t.calls) expect(c.scope).toMatchObject({ kind: 'profileLook', job: 'make:profileLook:first:u', paid: true, feature: 'look' });
    expect(t.charged).toEqual([]);
  });

  it('a back no try cut cleanly is not kept: the app shows its stand-in, it is recorded, logged, and not painted again', async () => {
    const errors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const t = make({ judge: NG });
    const me = await free(() => t.s.backView('u', 'https://x'));
    expect(me.lookBack ?? null).toBeNull();
    expect(t.stored).toHaveLength(0);
    expect(t.story()['look.back']).toBeUndefined();
    expect(cutFailsOf(t.story()[LOOK_BACK_CUTFAIL], 'https://x/look.png')).toEqual({ back: EVERY_STEP });
    expect(String(errors.mock.calls[0][0])).toContain(`cut-out failed every retry and is not shown (back view of u; ${EVERY_STEP})`);
    const n = t.calls.length;
    await free(() => t.s.backView('u', 'https://x'));
    expect(t.calls).toHaveLength(n);
  });
});

describe("the talk's expression variants go through the shared cut-out", () => {
  const talkOf = (t: ReturnType<typeof make>, who: 'me' | 'bati') => JSON.parse(t.story()[`talk.${who}`]) as TalkLook;

  it('your own: every painting of the talk — standee, chibi, back, faces, blink and mouth edits — is cut by the pipeline', async () => {
    const t = make();
    await free(() => t.s.talkLook('u', 'me', 'https://x'));
    // standee + chibi + back + 3 faces + (blink, mouth) × (normal, smile)
    expect(t.count('paint')).toBe(10);
    expect(t.count('model')).toBe(10);
    expect(t.count('judge')).toBe(10);
    expect(t.count('rekey')).toBe(0);
    expect(Object.keys(talkOf(t, 'me').faces ?? {}).sort()).toEqual(['normal', 'shy', 'smile', 'surprised']);
    for (const p of t.stored) expect(p.mime).toBe('image/png');
  });

  it("{bati}'s: the faces not drawn before are cut by the pipeline too", async () => {
    const t = make({ user: { onboardingJson: { 'bati.faces': '{"smile":"https://x/s.png","surprise":"https://x/o.png","think":"https://x/t.png","sad":"https://x/d.png"}' } } });
    await free(() => t.s.talkLook('u', 'bati', 'https://x'));
    // 'shy' is the one face {bati} has not; then (blink, mouth) × (normal, smile)
    expect(t.count('paint')).toBe(5);
    expect(t.count('model')).toBe(5);
    expect(t.count('judge')).toBe(5);
    expect(talkOf(t, 'bati').faces?.shy?.kind).toBe('image');
  });

  it('an expression no try cut cleanly is left out: the normal face stands in, no blink / mouth part is cut from a bad edit', async () => {
    const errors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const t = make({ judge: NG, user: { onboardingJson: { 'bati.faces': '{"smile":"https://x/s.png","surprise":"https://x/o.png","think":"https://x/t.png","sad":"https://x/d.png"}' } } });
    await free(() => t.s.talkLook('u', 'bati', 'https://x'));
    // each of the five paintings: the model cut and two repaints, then nothing more (the failed cut is not painted again)
    expect(t.count('paint')).toBe(5);
    expect(t.count('rekey')).toBe(10);
    expect(t.stored).toHaveLength(0);
    const talk = talkOf(t, 'bati');
    expect(talk.faces?.shy).toBeUndefined();
    expect(talk.faces?.normal).toEqual({ kind: 'image', url: 'https://x/bati.png' });
    expect(talk.faces?.smile).toEqual({ kind: 'image', url: 'https://x/s.png' });
    const lines = errors.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(5);
    expect(lines.some((l) => l.includes('talk face shy (bati) of u'))).toBe(true);
    expect(lines.some((l) => l.includes('talk blink of normal (bati) of u'))).toBe(true);
    expect(lines.some((l) => l.includes('talk mouth of smile (bati) of u'))).toBe(true);
  });
});
