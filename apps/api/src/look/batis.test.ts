import { BATI_MAX } from '@obolo/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { toMe } from '../users/users.service';
import { LookService } from './look.service';

// M-R215 / M-R217 / M-R218: three {bati} at most, the grown egg, the personality from the seed, the look's rules
async function grey() {
  return sharp(Buffer.from('<svg width="64" height="64"><rect width="64" height="64" fill="#808080"/></svg>')).png().toBuffer();
}

function make(over: Record<string, unknown> = {}, llmAnswer?: string) {
  const user: Record<string, unknown> = {
    id: 'u',
    journeyDay: 3,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    onboardingJson: {},
    batiFood: null,
    batiImageUrl: null,
    batiName: null,
    batisJson: null,
    batiId: null,
    batiEggAt: null,
    ...over,
  };
  const db = {
    write: {
      select: () => ({ from: () => ({ where: async () => [user] }) }),
      update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => ({ returning: async () => [Object.assign(user, v)] }) }) }),
    },
  };
  const media = { bytesByUrl: async () => grey(), storeImage: async () => ({ id: 'm', url: 'https://x/m.png' }), getOwned: async () => null };
  const prompts: string[] = [];
  const looks = { generate: async (p: string) => (prompts.push(p), { data: await grey(), mime: 'image/png' }) };
  const jobs: string[] = [];
  const queue = { register: () => undefined, enqueue: async (name: string) => void jobs.push(name) };
  const llm = llmAnswer === undefined ? { name: 'mock', chat: async () => '' } : { name: 'fake', chat: async () => llmAnswer };
  const s = new LookService(db as never, media as never, looks as never, looks as never, { name: 'mock' } as never, new MemoryKv(), { charge: async () => ({ refund: async () => undefined }) } as never, queue as never, llm as never);
  return { s, user, prompts, jobs };
}

/** a born {bati}, as the list keeps it */
const born = (id: string, name: string) => ({ id, name, egg: 'sun', seed: 'カレー', seedKind: 'food', personality: 'genki', self: 'ボク', call: '{neo}', catchphrase: 'だよ！', intro: '…', imageUrl: `https://x/${id}.png`, createdAt: '2026-11-01T00:00:00Z' });

describe("the first {bati}: the personality from the favourite food (M-R217)", () => {
  it('decides it at the egg, keeps the food as the seed, makes the small egg (88 days)', async () => {
    const { s, user } = make();
    const me = await s.egg('u', { food: 'たこ焼き', egg: 'moon' });
    // a 関西 food: 関西弁の子, or now and then 関西ギャルの子 (M-R227)
    expect(['kansai', 'galkansai']).toContain(me.bati?.personality);
    expect(me.bati?.egg).toBe('moon');
    expect(me.bati?.self).toBe('ウチ');
    expect(me.bati?.card).toMatchObject({ seed: 'たこ焼き', rare: false });
    expect(me.bati?.card?.trait).toBeTruthy();
    expect(me.batis).toHaveLength(1);
    expect(me.batiEgg?.ready).toBe(false);
    expect((user.batiEggAt as Date).getTime() - Date.now()).toBeGreaterThan(87 * 86_400_000);
  });

  it('a rare one gets its story lines rewritten once (a job); an unfit seed is asked again', async () => {
    const { s, jobs } = make({}, '{"personality":"butler","self":"私","call":"{neo}さま","catchphrase":"〜でございます","trait":"きれい好き","intro":"空気から生まれた、きれい好き。"}');
    const me = await s.egg('u', { food: '空気', egg: 'sun' });
    expect(me.bati?.card?.rare).toBe(true);
    expect(jobs).toContain('bati.lines');
    const unfit = make({}, '{"ok":false}');
    await expect(unfit.s.egg('u', { food: 'なにか', egg: 'sun' })).rejects.toMatchObject({ response: { error: { code: 'SEED_REASK' } } });
  });

  it('a {bati} from before the list keeps working, with a personality that never changes', () => {
    const { user } = make({ batiFood: 'ラーメン', batiName: 'ポン', batiImageUrl: 'https://x/b.png' });
    const a = toMe(user as never);
    const b = toMe(user as never);
    expect(a.bati?.name).toBe('ポン');
    expect(a.bati?.personality).toBeDefined();
    expect(a.bati?.personality).toBe(b.bati?.personality);
    expect(a.batis).toHaveLength(1);
  });
});

describe('the grown egg and the three (M-R215 / M-R218)', () => {
  const one = { batiFood: 'カレー', batiName: 'ポン', batiImageUrl: 'https://x/b1.png', batiId: 'b1', batisJson: [born('b1', 'ポン')] };

  it('refuses the egg before it has grown', async () => {
    const { s } = make({ ...one, batiEggAt: new Date(Date.now() + 86_400_000) });
    await expect(s.hatchNew('u', { egg: 'moon', seed: '雨の音' })).rejects.toMatchObject({ response: { error: { code: 'EGG_NOT_READY' } } });
  });

  it('the second is born from a sound and comes into the chat; the first keeps its name and look', async () => {
    const { s, user } = make({ ...one, batiEggAt: new Date(Date.now() - 1000) });
    const me = await s.hatchNew('u', { egg: 'moon', seed: '雨の音' });
    expect(me.batis).toHaveLength(2);
    // never the first one's style (M-R227)
    expect(me.bati?.personality).not.toBe('genki');
    expect(me.bati?.card?.seed).toBe('雨の音');
    expect(me.batis?.find((b) => b.id === 'b1')).toMatchObject({ name: 'ポン', imageUrl: 'https://x/b1.png', active: false });
    // the third egg comes 88 days later
    expect((user.batiEggAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it(`never more than ${BATI_MAX}: once three are born, no new egg`, async () => {
    const three = { ...one, batisJson: [born('b1', 'ポン'), born('b2', 'ピン'), born('b3', 'パン')], batiEggAt: new Date(Date.now() - 1000) };
    const { s } = make(three);
    await expect(s.hatchNew('u', { egg: 'sun', seed: 'ありがとう' })).rejects.toMatchObject({ response: { error: { code: 'BATI_FULL' } } });
    const two = make({ ...one, batisJson: [born('b1', 'ポン'), born('b2', 'ピン')], batiEggAt: new Date(Date.now() - 1000) });
    const me = await two.s.hatchNew('u', { egg: 'sun', seed: 'ありがとう' });
    expect(me.batis).toHaveLength(3);
    expect(me.batiEgg).toBeNull();
  });

  it('swaps which one is in the chat; 呼び方 and 一人称 are the only things that change', async () => {
    const { s, user } = make({ ...one, batisJson: [born('b1', 'ポン'), { ...born('b2', 'ピン'), personality: 'keigo', self: 'わたくし', call: '{neo}さま' }] });
    let me = await s.switchBati('u', 'b2');
    expect(user.batiName).toBe('ピン');
    expect(user.batiImageUrl).toBe('https://x/b2.png');
    // a retired style (敬語の子) is read as the nearest current one (M-R225)
    expect(me.bati?.personality).toBe('teinei');
    me = await s.batiSpeech('u', { call: 'たっくん', self: 'ぼく' });
    expect(me.bati?.callCustom).toBe('たっくん');
    expect(me.bati?.self).toBe('ぼく');
    expect(me.bati?.personality).toBe('teinei');
    me = await s.switchBati('u', 'b1');
    expect(me.bati?.name).toBe('ポン');
    expect(me.batis?.find((b) => b.id === 'b2')?.callCustom).toBe('たっくん');
  });
});

describe("{bati}'s look (M-R215)", () => {
  it('refuses a dress-up wish for a real person or another work, and passes the born look along', async () => {
    const { s, prompts } = make({ batiFood: 'カレー', batiName: 'ポン', batiImageUrl: 'https://x/now.png', batiId: 'b1', batisJson: [{ ...born('b1', 'ポン'), bornImageUrl: 'https://x/born.png' }] });
    await expect(s.restyle('u', 'ピカチュウにして', 'https://x')).rejects.toMatchObject({ response: { error: { code: 'MODERATION' } } });
    await expect(s.restyle('u', '有名な俳優にそっくり', 'https://x')).rejects.toMatchObject({ response: { error: { code: 'MODERATION' } } });
    expect(prompts).toEqual([]);
    await s.restyle('u', '水彩画のタッチで', 'https://x');
    expect(prompts[0]).toContain('second picture');
    expect(prompts[0]).toContain('must not resemble any real, existing person');
  }, 30_000);
});

import { MEMORY_PER_BATI } from '@obolo/shared';
import { BatiMemoryService } from './memory.service';

describe("what {bati} remembers (M-R222): only on the member's 「覚えといて」, five at most, never the forbidden things", () => {
  const base = { batiFood: 'カレー', batiName: 'ポン', batiImageUrl: 'https://x/b1.png', batiId: 'b1', batisJson: [born('b1', 'ポン'), born('b2', 'ピン')], onboardingJson: { birthYear: '1990' } };
  const memory = (over: Record<string, unknown> = {}) => {
    const { user } = make({ ...base, ...over });
    const db = {
      write: {
        select: () => ({ from: () => ({ where: async () => [user] }) }),
        update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => ({ returning: async () => [Object.assign(user, v)] }) }) }),
      },
    };
    return { s: new BatiMemoryService(db as never, { name: 'mock' } as never), user };
  };

  it('keeps it on the {bati} in the chat only', async () => {
    const { s } = memory();
    expect((await s.remember('u', '金曜が曲の締め切り')).result).toBe('kept');
    const me = await s.add('u', '朝が弱い', 'b2');
    expect(me.bati?.memories?.map((p) => p.text)).toEqual(['金曜が曲の締め切り']);
    expect(me.batis).toHaveLength(2);
  });

  it('refuses what is never kept (stricter under 15), and the same thing twice', async () => {
    const { s } = memory();
    expect((await s.remember('u', '電話は090-1234-5678')).result).toBe('refused');
    await expect(s.add('u', '住所は東京都渋谷区1-2-3')).rejects.toMatchObject({ response: { error: { code: 'MEMORY_REFUSED' } } });
    expect((await s.remember('u', 'ゆうきくんと遊ぶのが好き')).result).toBe('kept');
    expect((await s.remember('u', 'ゆうきくんと遊ぶのが好き')).result).toBe('already');
    const child = memory({ onboardingJson: { birthYear: String(new Date().getFullYear() - 10) } });
    expect((await child.s.remember('u', 'ゆうきくんと遊ぶのが好き')).result).toBe('refused');
    expect(await child.s.callAs('u', 'さくら小学校のネオ')).toBe(false);
  });

  it(`${MEMORY_PER_BATI} at most: then 「どれか忘れてもいい？」; forgetting frees it`, async () => {
    const { s } = memory();
    for (const t of ['犬', '猫', '海', '山', '空']) expect((await s.remember('u', `${t}が好き`)).result).toBe('kept');
    expect((await s.remember('u', '星が好き')).result).toBe('full');
    await expect(s.add('u', '星が好き')).rejects.toMatchObject({ response: { error: { code: 'MEMORY_FULL', message: expect.stringContaining('忘れてもいい') } } });
    expect((await s.forget('u', {})).bati?.memories).toEqual([]);
    const kept = await s.add('u', '星が好き');
    expect((await s.forget('u', { memory: kept.bati!.memories![0].id })).bati?.memories).toEqual([]);
  });

  it('「〇〇って呼んで」 changes the 呼び方; the role changes (the first starts as なんでも)', async () => {
    const { s } = memory();
    const u = await s.callAs('u', 'ネオっち');
    expect(u && toMe(u).bati?.callCustom).toBe('ネオっち');
    expect((await s.role('u', { role: 'work' })).bati?.role).toBe('work');
  });
});
