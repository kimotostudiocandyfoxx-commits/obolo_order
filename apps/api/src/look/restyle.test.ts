import { BATI_MAGIC_PER_DAY, BATI_RESTYLE_PER_DAY, JOURNEY_DONE, MAKE_COST } from '@obolo/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { costScope } from '../wallet/cost-scope';
import { LookService } from './look.service';

// Bati's room (P-BATI-ROOM): the dress-up rounds, their limit and mana, and choosing one
async function grey() {
  const dot = Buffer.from('<svg width="256" height="256"><rect width="256" height="256" fill="#808080"/><circle cx="128" cy="128" r="60" fill="#e05050"/></svg>');
  return sharp(dot).png().toBuffer();
}

function make(journeyDay: number, o: { member?: boolean; completed?: boolean; balance?: number } = {}) {
  const user: Record<string, unknown> = {
    id: 'u',
    email: 'u@example.com',
    displayName: 'ネオ',
    journeyDay,
    journeyCompletedAt: o.completed ? new Date() : null,
    // client 2026-11-25: an Obolo Order member may change a confirmed look (charged); a resident may not
    ...(o.member ? { orderedAt: new Date(), subscriptionStatus: 'active' } : { orderedAt: null, subscriptionStatus: 'none' }),
    avatarUrl: 'https://x/look.png', createdAt: new Date(), batiImageUrl: 'https://x/bati.png', batiFood: 'たこ焼き', onboardingJson: { 'bati.faces': '{"smile":"https://x/s.png"}' } };
  const db = {
    write: {
      select: () => ({ from: () => ({ where: async () => [user] }) }),
      update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => ({ returning: async () => [Object.assign(user, v)] }) }) }),
    },
  };
  const stored: string[] = [];
  const media = {
    bytesByUrl: async () => grey(),
    imageData: async () => ({ data: await grey(), mime: 'image/png' }),
    storeImage: async (_u: string, _k: string, _m: string, _d: Buffer) => {
      const id = `00000000-0000-4000-8000-00000000000${stored.length}`;
      stored.push(id);
      return { id, url: `https://x/${id}.png` };
    },
    getOwned: async (_u: string, id: string) => (stored.includes(id) ? { id, url: `https://x/${id}.png` } : null),
  };
  const prompts: string[] = [];
  const looks = { generate: async (p: string) => (prompts.push(p), { data: await grey(), mime: 'image/png' }) };
  const charged: string[] = [];
  // a charge marks the request's scope as that paid making (LedgerService.charge)
  const whole: { kind: string; key: string }[] = [];
  const ledger = {
    charge: async (_db: unknown, _u: string, kind: string) => (charged.push(kind), costScope.tag({ kind: kind as never, job: `make:${kind}:u:1`, paid: true }), { refund: async () => undefined }),
    // the first look (client 2026-11-25): one charge per member, whatever the balance
    chargeWhole: async (_db: unknown, _u: string, kind: string, key: string) => {
      const repeat = whole.some((w) => w.key === key);
      if (!repeat) whole.push({ kind, key });
      const price = MAKE_COST.profileLook;
      const taken = repeat ? 0 : Math.min(Math.floor(price), o.balance ?? 88);
      return { price, taken, waiting: Math.floor(price) - taken, repeat };
    },
  };
  const jobs: string[] = [];
  const queue = { register: () => undefined, enqueue: async (name: string) => void jobs.push(name) };
  const figures: { look: string; paid?: unknown }[] = [];
  const fig = { enqueue: async (_u: string, _o: string, look: string, paid?: unknown) => void figures.push({ look, paid }) };
  const s = new LookService(db as never, media as never, looks as never, looks as never, { name: 'mock' } as never, new MemoryKv(), ledger as never, queue as never, undefined, undefined, undefined, undefined, fig as never);
  return { s, user, prompts, charged, jobs, figures, whole };
}

describe("Bati's room: dress up the Bati", () => {
  it('paints four pictures of the same Bati with the wish, free during the first journey, a few rounds a day', async () => {
    const { s, prompts, charged } = make(2);
    const r = await s.restyle('u', '魔法使いの帽子', 'https://x');
    expect(r.candidates).toHaveLength(4);
    expect(r.touches).toBeUndefined();
    expect(r.left).toBe(BATI_RESTYLE_PER_DAY - 1);
    expect(prompts[0]).toContain('魔法使いの帽子');
    expect(prompts[0]).toContain('same creature');
    expect(charged).toEqual([]);
    for (let k = 1; k < BATI_RESTYLE_PER_DAY; k++) await s.restyle('u', 'マント', 'https://x');
    await expect(s.restyle('u', 'マント', 'https://x')).rejects.toThrow();
  }, 30_000);

  it('M-R223: without a wish, four cards in four touches; the birth food is in every prompt', async () => {
    const { s, prompts } = make(2);
    const r = await s.restyle('u', {}, 'https://x');
    expect(r.candidates).toHaveLength(4);
    expect(r.touches).toEqual(['アニメ風', 'ゆるキャラ風', '3D風', 'ドット絵風']);
    expect(new Set(prompts).size).toBe(4);
    for (const p of prompts) {
      expect(p).toContain('born from the food "たこ焼き"');
      expect(p).toMatch(/small tattoo/);
    }
  });

  it('M-R223: a wish goes on from the card tapped just before', async () => {
    const { s } = make(2);
    const r = await s.restyle('u', {}, 'https://x');
    const r2 = await s.restyle('u', { wish: '服を着せて', from: r.candidates[2].id }, 'https://x');
    expect(r2.candidates).toHaveLength(4);
  });

  it('M-R223: the decided looks are kept; 〔前に戻す〕 and the shelf put one back with its faces', async () => {
    const { s, user, jobs } = make(2);
    const a = await s.restyle('u', {}, 'https://x');
    await s.chooseRestyle('u', a.candidates[0].id, 'https://x');
    // its faces come in the background
    (user.onboardingJson as Record<string, string>)['bati.faces'] = JSON.stringify({ smile: 'https://x/a-smile.png' });
    const b = await s.restyle('u', 'マント', 'https://x');
    let me = await s.chooseRestyle('u', b.candidates[1].id, 'https://x');
    expect(me.bati?.looks).toEqual(['https://x/bati.png', a.candidates[0].url, b.candidates[1].url]);
    me = await s.restyleBack('u', 'https://x');
    expect(user.batiImageUrl).toBe(a.candidates[0].url);
    expect(me.bati?.faces).toEqual({ smile: 'https://x/a-smile.png' });
    me = await s.restyleBack('u', 'https://x');
    expect(user.batiImageUrl).toBe('https://x/bati.png');
    await expect(s.restyleBack('u', 'https://x')).rejects.toThrow();
    // the face shelf: any of them, not someone else's picture
    await s.restoreBati('u', b.candidates[1].url, 'https://x');
    expect(user.batiImageUrl).toBe(b.candidates[1].url);
    await expect(s.restoreBati('u', 'https://elsewhere/x.png', 'https://x')).rejects.toThrow();
    expect(jobs.filter((j) => j === 'bati.faces').length).toBeGreaterThan(0);
  });

  it('M-R223: no mana for the own look on day 2, redraws as often as they like', async () => {
    const { s, charged } = make(2);
    const r = await s.candidates('u', { animal: 'しろくま', color: 'おまかせ', mood: 'おまかせ' }, 'https://x');
    expect(r.candidates).toHaveLength(4);
    for (let k = 0; k < 6; k++) await s.refine('u', { mediaId: r.candidates[0].id, instruction: 'もっとかっこよく' }, 'https://x');
    expect(charged).toEqual([]);
  });

  it('M-R223: own looks are kept and one can be worn again', async () => {
    const { s, user } = make(2);
    const r = await s.candidates('u', { animal: 'しろくま', color: 'おまかせ', mood: 'おまかせ' }, 'https://x');
    let me = await s.choose('u', r.candidates[1].id);
    expect(me.lookHistory).toEqual(['https://x/look.png', r.candidates[1].url]);
    me = await s.restoreLook('u', 'https://x/look.png');
    expect(user.avatarUrl).toBe('https://x/look.png');
    await expect(s.restoreLook('u', 'https://elsewhere/x.png')).rejects.toThrow();
  });

  it.each([
    ['sound', '雨の音', /favourite sound "雨の音"/],
    ['word', 'ありがとう', /word "ありがとう"/],
  ] as const)('M-R223: the %s {bati} keeps its seed in every look', async (kind, seed, rule) => {
    const { s, user, prompts } = make(2);
    Object.assign(user, {
      batiId: 'b2',
      batiFood: seed,
      batisJson: [{ id: 'b2', name: 'ポン', egg: 'moon', seed, seedKind: kind, personality: 'genki', self: 'ボク', call: '{neo}', catchphrase: '', intro: '', imageUrl: 'https://x/bati.png', createdAt: new Date().toISOString() }],
    });
    await s.restyle('u', {}, 'https://x');
    expect(prompts).toHaveLength(4);
    for (const p of prompts) expect(p).toMatch(rule);
  });

  it('takes the look mana after the journey', async () => {
    const { s, charged } = make(JOURNEY_DONE);
    await s.restyle('u', 'リボン', 'https://x');
    expect(charged).toEqual(['look']);
  });

  it('R17: a paid round paints two (still a row to pick from); the free rounds of the journey four', async () => {
    const paid = make(JOURNEY_DONE, { member: true });
    expect((await paid.s.restyle('u', 'リボン', 'https://x')).candidates).toHaveLength(2);
    expect(paid.prompts).toHaveLength(2);
    expect((await paid.s.refine('u', { instruction: '髪を長く', magic: true }, 'https://x')).candidates).toHaveLength(2);
    expect(paid.s.lookCount(false)).toBe(4);
    expect(paid.s.lookCount(true)).toBe(2);
    const free = make(2);
    expect((await free.s.restyle('u', 'リボン', 'https://x')).candidates).toHaveLength(4);
  });

  it('a chosen picture becomes the Bati and its faces are drawn again', async () => {
    const { s, user, jobs } = make(2);
    const r = await s.restyle('u', 'リボン', 'https://x');
    const me = await s.chooseRestyle('u', r.candidates[1].id, 'https://x');
    expect(user.batiImageUrl).toBe(r.candidates[1].url);
    expect(me.bati?.faces).toBeUndefined();
    expect(jobs).toEqual(['bati.faces']);
    await expect(s.chooseRestyle('u', '00000000-0000-4000-8000-0000000000ff', 'https://x')).rejects.toThrow();
  });

  it("client 2026-11-25: Bati's magic on your own look takes the profile look's mana; the look chosen gets its planet figures as that making", async () => {
    const { s, charged, figures } = make(JOURNEY_DONE, { member: true });
    const r = await costScope.run({ feature: 'look', userId: 'u' }, () => s.refine('u', { instruction: '髪を長く', magic: true }, 'https://x'));
    expect(charged).toEqual(['profileLook']);
    await s.choose('u', r.candidates[0].id, 'https://x');
    expect(figures).toEqual([{ look: r.candidates[0].url, paid: { kind: 'profileLook', job: 'make:profileLook:u:1' } }]);
    // {bati}'s dress-up stays 'look'
    await s.restyle('u', 'リボン', 'https://x');
    expect(charged).toEqual(['profileLook', 'look']);
    // the first journey's look on day 2: free now, its figures wait for the confirmation at the end of day 2
    const free = make(2);
    const f = await free.s.refine('u', { instruction: '髪を長く', magic: true }, 'https://x');
    await free.s.choose('u', f.candidates[0].id, 'https://x');
    expect(free.charged).toEqual([]);
    expect(free.figures).toEqual([]);
  });

  it('client 2026-11-25: the end of day 2 confirms the first look — its full profileLook once, then its figures as that making', async () => {
    const { s, user, whole, figures, jobs } = make(2);
    const r = await s.candidates('u', { animal: 'しろくま', color: 'おまかせ', mood: 'おまかせ' }, 'https://x');
    await s.choose('u', r.candidates[0].id, 'https://x');
    // not finished yet: nothing taken
    expect((await s.confirmFirstLook('u', 'https://x')).mana).toBe(0);
    user.journeyCompletedAt = new Date();
    const c = await costScope.run({ feature: 'other', userId: 'u' }, () => s.confirmFirstLook('u', 'https://x'));
    expect(c.mana).toBe(MAKE_COST.profileLook);
    expect(whole).toEqual([{ kind: 'profileLook', key: 'make:profileLook:first:u' }]);
    expect(figures).toEqual([{ look: r.candidates[0].url, paid: { kind: 'profileLook', job: 'make:profileLook:first:u' } }]);
    expect(jobs).toContain('talk.look');
    expect(c.me.lookLocked).toBe(true);
    // a retry (the day's completion sent again) takes nothing more
    expect((await s.confirmFirstLook('u', 'https://x')).mana).toBe(0);
    expect(whole).toHaveLength(1);
  });

  it('client 2026-11-25: a short balance never stops the journey (the rest waits)', async () => {
    const { s, whole } = make(2, { completed: true, balance: 3 });
    const c = await s.confirmFirstLook('u', 'https://x');
    expect(c.mana).toBe(MAKE_COST.profileLook);
    expect(whole).toHaveLength(1);
  });

  it('client 2026-11-25: a resident keeps the confirmed look (LOOK_LOCKED); a member changes it at the profile look; the dress-up is not locked', async () => {
    const res = make(4);
    const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: { response?: { error?: { code?: string } } }) => e.response?.error?.code);
    expect(await code(res.s.refine('u', { instruction: '髪を長く', magic: true }, 'https://x'))).toBe('LOOK_LOCKED');
    expect(await code(res.s.candidates('u', { animal: 'しろくま', color: 'おまかせ', mood: 'おまかせ' }, 'https://x'))).toBe('LOOK_LOCKED');
    expect(await code(res.s.refine('u', { instruction: '髪を長く' }, 'https://x'))).toBe('LOOK_LOCKED');
    expect(await code(res.s.restoreLook('u', 'https://x/old.png'))).toBe('LOOK_LOCKED');
    expect(await code(res.s.choose('u', '00000000-0000-4000-8000-000000000000'))).toBe('LOOK_LOCKED');
    expect(res.prompts).toEqual([]);
    // {bati}'s own dress-up stays open (free on the first journey)
    expect((await res.s.restyle('u', 'リボン', 'https://x')).candidates).toHaveLength(4);
    // the admin token passes
    expect((await res.s.refine('u', { instruction: '髪を長く', magic: true }, 'https://x', true)).candidates.length).toBeGreaterThan(0);
    // a member during the journey: the magic round is charged as profileLook
    const mem = make(4, { member: true });
    expect((await mem.s.refine('u', { instruction: '髪を長く', magic: true }, 'https://x')).candidates).toHaveLength(2);
    expect(mem.charged).toEqual(['profileLook']);
  });

  it('client 2026-11-25: the back view — one klein picture from behind per look, in GET /me, recorded as the first look while not confirmed', async () => {
    const { s, user, prompts } = make(2);
    const seen = await costScope.run({ feature: 'look', userId: 'u' }, async () => {
      const me = await s.backView('u', 'https://x');
      expect(me.lookBack).toMatch(/^https:\/\/x\//);
      return costScope.get();
    });
    expect(seen).toMatchObject({ kind: 'profileLook', job: 'make:profileLook:first:u', paid: true });
    expect(prompts.filter((p) => p.includes('seen from directly behind'))).toHaveLength(1);
    expect((user.onboardingJson as Record<string, string>)['look.back.of']).toBe('https://x/look.png');
    // made once per look
    const n = prompts.length;
    await s.backView('u', 'https://x');
    expect(prompts).toHaveLength(n);
  });

  it("Bati's magic on the look is counted per day, not by the story's small total", async () => {
    const { s, charged } = make(2);
    // six rounds: more than the story's refines (NEO_LOOK_REFINES), still free on the first journey
    for (let k = 0; k < 6; k++) {
      const r = await s.refine('u', { instruction: '髪を長く', magic: true }, 'https://x');
      expect(r.candidates).toHaveLength(4);
      expect(r.refinesLeft).toBe(BATI_MAGIC_PER_DAY - k - 1);
    }
    expect(charged).toEqual([]);
  });
});
