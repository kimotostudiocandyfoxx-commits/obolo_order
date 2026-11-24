import { describe, expect, it } from 'vitest';
import { ChangeablesController } from './changeables.controller';

function make() {
  const rows: Record<string, { recordColour: string | null }> = {};
  const homes = {
    home: async (_u: string, p: string) => rows[p] ?? null,
    setColour: async (_u: string, p: string, c: string) => void (rows[p] = { recordColour: c }),
    kororin: async () => kororin,
    setKororin: async (_u: string, pic: number) => void (kororin = { pic }),
  };
  let kororin: { pic: number } | null = null;
  const kv = { incr: async () => 1, get: async () => null, set: async () => undefined, del: async () => undefined, expire: async () => undefined };
  // the account's sys answers (users.onboarding_json 'sys.*'), as UsersService keeps them
  const sys: Record<string, string> = {};
  const users = {
    sysAnswer: async (_u: string, k: string) => sys[`sys.${k}`] ?? null,
    saveSysStory: async (_u: string, a: Record<string, string>) => void Object.assign(sys, Object.fromEntries(Object.entries(a).map(([k, v]) => [`sys.${k}`, v]))),
  };
  return { rows, sys, kororin: () => kororin, c: new ChangeablesController(homes as never, kv as never, users as never) };
}

describe('M-R263: the changeables {bati} sets (Saturn record colour)', () => {
  it('reads black at first, sets a colour, and 〔元に戻す〕 is the same call back', async () => {
    const { rows, c } = make();
    expect(await c.all('u')).toEqual({ 'saturn.recordColour': 'black', 'kororin.pic': 'k01', 'talk.bubbleColour': 'pearl' });
    const r = await c.set('u', 'saturn.recordColour', { value: 'mint' });
    expect(r).toEqual({ id: 'saturn.recordColour', from: 'black', to: 'mint' });
    expect(rows.saturn.recordColour).toBe('mint');
    const back = await c.set('u', r.id, { value: r.from });
    expect(back.to).toBe('black');
    expect(rows.saturn.recordColour).toBe('black');
  });
  it('an unknown thing or choice is refused', async () => {
    const { c } = make();
    await expect(c.set('u', 'saturn.recordColour', { value: 'red' })).rejects.toThrow();
    await expect(c.set('u', 'jupiter.tree', { value: 'pink' })).rejects.toThrow();
  });
  it('M-R275: the kororin picture (1 of 24), changed and undone', async () => {
    const m = make();
    const r = await m.c.set('u', 'kororin.pic', { value: 'k19' });
    expect(r).toEqual({ id: 'kororin.pic', from: 'k01', to: 'k19' });
    expect(m.kororin()).toEqual({ pic: 19 });
    await m.c.set('u', r.id, { value: r.from });
    expect(m.kororin()).toEqual({ pic: 1 });
    await expect(m.c.set('u', 'kororin.pic', { value: 'k25' })).rejects.toThrow();
  });
  it('iPad feedback: the bubble colour — kept where the old picker kept it (sys.talk_color), changed and undone', async () => {
    const m = make();
    // a colour picked before (the first-talk picker, the settings) keeps showing
    m.sys['sys.talk_color'] = 'rose';
    expect((await m.c.all('u'))['talk.bubbleColour']).toBe('rose');
    const r = await m.c.set('u', 'talk.bubbleColour', { value: 'sky' });
    expect(r).toEqual({ id: 'talk.bubbleColour', from: 'rose', to: 'sky' });
    expect(m.sys['sys.talk_color']).toBe('sky');
    await m.c.set('u', r.id, { value: r.from });
    expect(m.sys['sys.talk_color']).toBe('rose');
    await expect(m.c.set('u', 'talk.bubbleColour', { value: 'honey' })).rejects.toThrow();
  });
});
