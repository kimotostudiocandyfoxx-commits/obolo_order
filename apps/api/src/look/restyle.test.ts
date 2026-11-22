import { BATI_MAGIC_PER_DAY, BATI_RESTYLE_PER_DAY, JOURNEY_DONE } from '@obolo/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { LookService } from './look.service';

// Bati's room (P-BATI-ROOM): the dress-up rounds, their limit and mana, and choosing one
async function grey() {
  const dot = Buffer.from('<svg width="256" height="256"><rect width="256" height="256" fill="#808080"/><circle cx="128" cy="128" r="60" fill="#e05050"/></svg>');
  return sharp(dot).png().toBuffer();
}

function make(journeyDay: number) {
  const user: Record<string, unknown> = { id: 'u', journeyDay, avatarUrl: 'https://x/look.png', createdAt: new Date(), batiImageUrl: 'https://x/bati.png', batiFood: 'たこ焼き', onboardingJson: { 'bati.faces': '{"smile":"https://x/s.png"}' } };
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
  const ledger = { charge: async (_db: unknown, _u: string, kind: string) => (charged.push(kind), { refund: async () => undefined }) };
  const jobs: string[] = [];
  const queue = { register: () => undefined, enqueue: async (name: string) => void jobs.push(name) };
  const s = new LookService(db as never, media as never, looks as never, looks as never, { name: 'mock' } as never, new MemoryKv(), ledger as never, queue as never);
  return { s, user, prompts, charged, jobs };
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

  it('a chosen picture becomes the Bati and its faces are drawn again', async () => {
    const { s, user, jobs } = make(2);
    const r = await s.restyle('u', 'リボン', 'https://x');
    const me = await s.chooseRestyle('u', r.candidates[1].id, 'https://x');
    expect(user.batiImageUrl).toBe(r.candidates[1].url);
    expect(me.bati?.faces).toBeUndefined();
    expect(jobs).toEqual(['bati.faces']);
    await expect(s.chooseRestyle('u', '00000000-0000-4000-8000-0000000000ff', 'https://x')).rejects.toThrow();
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
