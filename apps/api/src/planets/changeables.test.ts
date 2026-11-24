import { describe, expect, it } from 'vitest';
import { ChangeablesController } from './changeables.controller';

function make() {
  const rows: Record<string, { recordColour: string | null }> = {};
  const homes = {
    home: async (_u: string, p: string) => rows[p] ?? null,
    setColour: async (_u: string, p: string, c: string) => void (rows[p] = { recordColour: c }),
  };
  const kv = { incr: async () => 1, get: async () => null, set: async () => undefined, del: async () => undefined, expire: async () => undefined };
  return { rows, c: new ChangeablesController(homes as never, kv as never) };
}

describe('M-R263: the changeables {bati} sets (Saturn record colour)', () => {
  it('reads black at first, sets a colour, and 〔元に戻す〕 is the same call back', async () => {
    const { rows, c } = make();
    expect(await c.all('u')).toEqual({ 'saturn.recordColour': 'black' });
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
});
