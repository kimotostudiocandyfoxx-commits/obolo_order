import { LOOK_STEP_MAX, MAKE_COST } from '@obolo/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { LookStepsService, stepsOf } from './steps.service';

// client 2026-11-27 (story M-R334): {bati}'s 進化 and one's own 変身 — 8 steps a round, each step's mana from the gem.
// Nothing here paints: the painter, the ledger and the storage are fakes.
async function pic(fill = '#e05050') {
  const dot = Buffer.from(`<svg width="128" height="128"><rect width="128" height="128" fill="#808080"/><circle cx="64" cy="64" r="30" fill="${fill}"/></svg>`);
  return sharp(dot).png().toBuffer();
}

function make(o: { member?: boolean; journeyDay?: number; balance?: number; fail?: boolean; confirmed?: boolean; /** the cut-out fails every retry */ badCut?: boolean } = {}) {
  const user: Record<string, unknown> = {
    id: 'u',
    email: 'u@example.com',
    displayName: 'ネオ',
    journeyDay: o.journeyDay ?? 2,
    journeyCompletedAt: null,
    ...(o.member ? { orderedAt: new Date(), subscriptionStatus: 'active' } : { orderedAt: null, subscriptionStatus: 'none' }),
    avatarUrl: null,
    batiImageUrl: 'https://x/bati-born.png',
    batiFood: 'カレー',
    createdAt: new Date(),
    consentVersion: null,
    consentAt: null,
    onboardingJson: o.confirmed ? { 'look.confirmed': 'https://x/look.png' } : {},
  };
  if (o.confirmed) user.avatarUrl = 'https://x/look.png';
  const db = {
    write: {
      select: () => ({ from: () => ({ where: async () => [user] }) }),
      update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => ({ returning: async () => [Object.assign(user, v)] }) }) }),
    },
  };
  const stored: { id: string; url: string; kind: string }[] = [];
  const media = {
    bytesByUrl: async () => pic(),
    storeImage: async (_u: string, kind: string) => {
      const id = `00000000-0000-4000-8000-0000000000${String(stored.length).padStart(2, '0')}`;
      const m = { id, url: `https://x/${kind}-${stored.length}.png`, kind };
      stored.push(m);
      return m;
    },
    getOwned: async (_u: string, id: string, kind: string) => stored.find((m) => m.id === id && m.kind === kind) ?? null,
  };
  const prompts: { prompt: string; refs: number }[] = [];
  const painter = {
    name: 'fake',
    generate: async (prompt: string, _i: number, refs: unknown[] = []) => {
      prompts.push({ prompt, refs: refs.length });
      if (o.fail) throw new Error('painter down');
      return { data: await pic('#50e050'), mime: 'image/png' };
    },
  };
  let balance = o.balance ?? 88;
  const charged: string[] = [];
  const refunded: string[] = [];
  const ledger = {
    charge: async (_db: unknown, _u: string, kind: string) => {
      const price = MAKE_COST[kind as keyof typeof MAKE_COST];
      if (balance < price) throw Object.assign(new Error('NO_MANA'), { code: 'NO_MANA' });
      balance = Math.round((balance - price) * 10) / 10;
      charged.push(kind);
      return {
        repeat: false,
        refund: async () => {
          balance = Math.round((balance + price) * 10) / 10;
          refunded.push(kind);
        },
      };
    },
  };
  const cuts: string[] = [];
  const worn: string[] = [];
  const confirmed: boolean[] = [];
  const look = {
    // the shared checked cut-out (media/cutting.ts cutLadder) is LookService.cut: every picture of a round goes through it
    cutOrNothing: async (img: { data: Buffer }, _out: number, key: string) => (cuts.push(key), o.badCut ? { png: null, record: 'colour:vision|model:vision|repaint:vision|repaint2:vision' } : { png: img.data, record: '' }),
    wearBati: async (_u: string, _cur: unknown, url: string) => (worn.push(`bati:${url}`), (user.batiImageUrl = url), {}),
    wearLook: async (_u: string, url: string) => (worn.push(`self:${url}`), (user.avatarUrl = url), {}),
    confirmFirstLook: async (_u: string, _o: string, atFix: boolean) => {
      confirmed.push(atFix);
      (user.onboardingJson as Record<string, string>)['look.confirmed'] = String(user.avatarUrl);
      balance = Math.round((balance - MAKE_COST.profileLook) * 10) / 10;
      return { me: {}, mana: MAKE_COST.profileLook };
    },
  };
  const s = new LookStepsService(db as never, media as never, painter as never, { name: 'mock' } as never, ledger as never, look as never, painter as never);
  return { s, user, prompts, charged, refunded, worn, confirmed, stored, cuts, balance: () => balance };
}

describe('{bati} の進化 (D03-S005b)', () => {
  it('each step is one picture from the picture before and takes one step’s mana from the gem', async () => {
    const t = make();
    const a = await t.s.step('u', { who: 'bati', wish: '翼を生やして' }, 'https://x');
    expect(a.mana).toBe(MAKE_COST.lookStep);
    expect(a.steps).toMatchObject({ used: 1, left: LOOK_STEP_MAX - 1, fixed: false, url: 'https://x/bati-0.png' });
    expect(t.charged).toEqual(['lookStep']);
    expect(t.prompts).toHaveLength(1);
    expect(t.prompts[0].prompt).toContain('"翼を生やして"');
    expect(t.prompts[0].refs).toBe(1);
    // painted on a key colour and cut out by the shared cut-out
    expect(t.prompts[0].prompt).toContain('chroma-key');
    expect(t.cuts).toHaveLength(1);
    const b = await t.s.step('u', { who: 'bati', wish: '色を水色に' }, 'https://x');
    expect(b.steps).toMatchObject({ used: 2, left: 6, url: 'https://x/bati-1.png' });
    expect(t.charged).toEqual(['lookStep', 'lookStep']);
    expect(t.balance()).toBe(88 - 2 * MAKE_COST.lookStep);
    // nothing of the account changes while the round is open
    expect(t.user.batiImageUrl).toBe('https://x/bati-born.png');
    expect(t.worn).toEqual([]);
  });

  it('〔↶ ひとつ前の姿にもどす〕: the picture before again — nothing painted, nothing given back, the count stays', async () => {
    const t = make();
    await expect(t.s.back('u', 'bati')).rejects.toMatchObject({ response: { error: { code: 'LOOK_STEPS_NO_BACK' } } });
    await t.s.step('u', { who: 'bati', wish: '翼' }, 'https://x');
    await t.s.step('u', { who: 'bati', wish: '王冠' }, 'https://x');
    const b = await t.s.back('u', 'bati');
    expect(b).toMatchObject({ mana: 0, steps: { used: 2, left: 6, url: 'https://x/bati-0.png', canBack: true } });
    const b2 = await t.s.back('u', 'bati');
    // back to the look it was born with (the one worn)
    expect(b2.steps).toMatchObject({ used: 2, url: 'https://x/bati-born.png', canBack: false });
    expect(t.charged).toEqual(['lookStep', 'lookStep']);
    expect(t.refunded).toEqual([]);
    expect(t.prompts).toHaveLength(2);
    // deciding now wears nothing new
    await t.s.fix('u', 'bati', 'https://x');
    expect(t.worn).toEqual([]);
  });

  it('eight steps at most: the ninth is refused, nothing charged, nothing painted', async () => {
    const t = make();
    for (let k = 0; k < LOOK_STEP_MAX; k++) await t.s.step('u', { who: 'bati', wish: `その${k}` }, 'https://x');
    expect(stepsOf(t.user as never, 'bati').used).toBe(8);
    expect(t.charged).toHaveLength(8);
    expect(t.balance()).toBe(Math.round((88 - 8 * MAKE_COST.lookStep) * 10) / 10);
    await expect(t.s.step('u', { who: 'bati', wish: 'もう一回' }, 'https://x')).rejects.toMatchObject({ response: { error: { code: 'LOOK_STEPS_DONE' } } });
    expect(t.charged).toHaveLength(8);
    expect(t.prompts).toHaveLength(8);
  });

  it('a step that could not be painted gives its mana back and does not count', async () => {
    const t = make({ fail: true });
    await expect(t.s.step('u', { who: 'bati', wish: '翼' }, 'https://x')).rejects.toThrow();
    expect(t.charged).toEqual(['lookStep']);
    expect(t.refunded).toEqual(['lookStep']);
    expect(t.balance()).toBe(88);
    expect(stepsOf(t.user as never, 'bati').used).toBe(0);
  });

  it('a picture no try cut cleanly is never shown: the mana goes back, the step does not count, 「もういちど」', async () => {
    const t = make({ badCut: true });
    await expect(t.s.step('u', { who: 'bati', wish: '翼' }, 'https://x')).rejects.toMatchObject({ response: { error: { code: 'LOOK_CUT_FAILED', message: 'うまく描けなかった……もういちど' } } });
    expect(t.charged).toEqual(['lookStep']);
    expect(t.refunded).toEqual(['lookStep']);
    expect(t.balance()).toBe(88);
    expect(stepsOf(t.user as never, 'bati')).toMatchObject({ used: 0, url: null });
    expect(t.stored).toEqual([]);
    // the four first pictures the same: none cut cleanly → nothing shown, the mana back
    const four = await t.s.pick4('u', { wish: '銀色の髪の旅人' }, 'https://x');
    expect(four).toEqual({ candidates: [], mana: 0 });
    expect(t.refunded).toEqual(['lookStep', 'lookPick4']);
    expect(t.balance()).toBe(88);
  });

  it('no mana: refused before anything is painted', async () => {
    const t = make({ balance: 0.3 });
    await expect(t.s.step('u', { who: 'bati', wish: '翼' }, 'https://x')).rejects.toThrow('NO_MANA');
    expect(t.prompts).toHaveLength(0);
  });

  it('words or a picture are needed; 〔{bati}の姿はこれだ〕 wears the last picture and closes the round', async () => {
    const t = make();
    await expect(t.s.step('u', { who: 'bati', wish: '' }, 'https://x')).rejects.toThrow();
    await t.s.step('u', { who: 'bati', wish: '王冠' }, 'https://x');
    const f = await t.s.fix('u', 'bati', 'https://x');
    expect(f.mana).toBe(0);
    expect(f.steps).toMatchObject({ used: 1, fixed: true });
    expect(t.worn).toEqual(['bati:https://x/bati-0.png']);
    await expect(t.s.step('u', { who: 'bati', wish: 'もう一回' }, 'https://x')).rejects.toThrow();
    expect(t.charged).toEqual(['lookStep']);
  });
});

describe('{name} の変身 (D03-S004)', () => {
  it('four first pictures (one charge), one chosen as the base, steps from it, then confirmed with the profile look’s mana', async () => {
    const t = make();
    const four = await t.s.pick4('u', { wish: '銀色の髪の旅人' }, 'https://x');
    expect(four.candidates).toHaveLength(4);
    expect(four.mana).toBe(MAKE_COST.lookPick4);
    expect(t.charged).toEqual(['lookPick4']);
    expect(t.prompts.map((p) => /exactly (\d) heads/.exec(p.prompt)?.[1])).toEqual(['2', '3', '5', '7']);
    // the four and every transform step are cut out too (the same checked cut-out as {bati}'s)
    expect(t.prompts.every((p) => p.prompt.includes('chroma-key'))).toBe(true);
    expect(t.cuts).toHaveLength(4);
    expect(t.stored.every((m) => m.kind === 'avatar')).toBe(true);
    const base = await t.s.base('u', four.candidates[2].id);
    expect(base.steps).toMatchObject({ used: 0, left: 8, url: four.candidates[2].url });
    const a = await t.s.step('u', { who: 'self', wish: '髪を銀色に' }, 'https://x');
    expect(a.steps).toMatchObject({ used: 1, left: 7 });
    expect(t.cuts).toHaveLength(5);
    expect(t.charged).toEqual(['lookPick4', 'lookStep']);
    const f = await t.s.fix('u', 'self', 'https://x');
    expect(t.worn).toEqual([`self:${a.steps.url}`]);
    expect(t.confirmed).toEqual([true]);
    expect(f.mana).toBe(MAKE_COST.profileLook);
    expect(f.steps.fixed).toBe(true);
    expect(t.balance()).toBe(Math.round((88 - MAKE_COST.lookPick4 - MAKE_COST.lookStep - MAKE_COST.profileLook) * 10) / 10);
  });

  it('a photo is refused for an account whose photo may not be used (the wish in words instead)', async () => {
    const t = make();
    await expect(t.s.pick4('u', { photo: { mime: 'image/jpeg', data: 'x'.repeat(200) } }, 'https://x')).rejects.toMatchObject({ response: { error: { code: 'PHOTO_NOT_ALLOWED' } } });
    expect(t.charged).toEqual([]);
  });

  it('after it is confirmed a resident’s look stays as it is; an Obolo Order member opens a new round', async () => {
    const r = make({ confirmed: true, journeyDay: 4 });
    await expect(r.s.step('u', { who: 'self', wish: '髪を青に' }, 'https://x')).rejects.toMatchObject({ response: { error: { code: 'LOOK_LOCKED' } } });
    await expect(r.s.open('u', 'self')).rejects.toMatchObject({ response: { error: { code: 'LOOK_LOCKED' } } });
    expect(r.charged).toEqual([]);

    const m = make({ confirmed: true, journeyDay: 9, member: true });
    const o = await m.s.open('u', 'self');
    expect(o.steps).toMatchObject({ used: 0, left: 8, fixed: false, url: 'https://x/look.png' });
    await m.s.step('u', { who: 'self', wish: 'マントを着せて' }, 'https://x');
    const f = await m.s.fix('u', 'self', 'https://x');
    // the same scheme after joining: each step's mana, then the profile look's as a normal charge
    expect(m.charged).toEqual(['lookStep', 'profileLook']);
    expect(f.mana).toBe(MAKE_COST.profileLook);
    expect(m.confirmed).toEqual([]);
  });
});
