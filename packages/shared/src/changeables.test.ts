import { describe, expect, it } from 'vitest';
import { applyChange, changeRequest, CHANGEABLES, KORORIN_COLOUR, KORORIN_FACE, SATURN_RECORD_COLOUR, type ChangeStore } from './changeables';
import { KORORINS, kororinOf } from './planetHome';

const memStore = () => {
  const homes: Record<string, { recordColour?: string | null }> = {};
  let kororin: { colour?: string; face?: string } | null = null;
  const store: ChangeStore = {
    home: async (p) => homes[p] ?? null,
    setHome: async (p, patch) => void (homes[p] = { ...homes[p], ...patch }),
    kororin: async () => kororin,
    setKororin: async (patch) => void (kororin = { ...kororin, ...patch }),
  };
  return { homes, store, kororin: () => kororin };
};

describe('M-R263: what {bati} can change (the registry)', () => {
  it('Saturn record colour: six choices, black the standard one', () => {
    expect(CHANGEABLES.map((c) => c.id)).toContain('saturn.recordColour');
    expect(SATURN_RECORD_COLOUR.choices.map((c) => c.name)).toEqual(['黒', 'ピンク', 'ラベンダー', 'ミント', 'ゴールド', '空色']);
  });
  it('reads the request: a choice, the nearest few for one that is not there, or a question', () => {
    const r1 = changeRequest('土星のレコード、ピンクにして');
    expect(r1 && 'choice' in r1 && r1.choice.id).toBe('pink');
    const r2 = changeRequest('レコードを水色に変えて');
    expect(r2 && 'choice' in r2 && r2.choice.id).toBe('sky');
    const r3 = changeRequest('レコード、赤がいい');
    expect(r3 && 'near' in r3 && r3.near.map((c) => c.id)).toEqual(['pink', 'gold', 'lavender']);
    const r4 = changeRequest('レコードの色を変えたい');
    expect(r4 && 'ask' in r4).toBe(true);
    expect(changeRequest('ピンクの曲を作って')).toBeNull();
    expect(changeRequest('レコード聞きたい')).toBeNull();
  });
  it('applies through the store and keeps what it was for 〔元に戻す〕', async () => {
    const { homes, store } = memStore();
    const r = await applyChange(store, 'saturn.recordColour', 'pink');
    expect(r).toEqual({ id: 'saturn.recordColour', from: 'black', to: 'pink' });
    expect(homes.saturn.recordColour).toBe('pink');
    // 〔元に戻す〕 is the same change back
    const back = await applyChange(store, r.id, r.from);
    expect(back).toEqual({ id: 'saturn.recordColour', from: 'pink', to: 'black' });
    expect(homes.saturn.recordColour).toBe('black');
    await expect(applyChange(store, 'saturn.recordColour', 'red')).rejects.toThrow();
    await expect(applyChange(store, 'nope', 'pink')).rejects.toThrow();
  });
  it('lines: the example of §7 as written', () => {
    expect(SATURN_RECORD_COLOUR.doneLine(SATURN_RECORD_COLOUR.choices[1])).toBe('レコード、ピンクにしたよ！ 土星に行ったら見てみて。');
  });
});

describe('M-R266: the kororin (8 made, any colour with any face)', () => {
  it('the 8, and しろもち for someone who has not chosen', () => {
    expect(KORORINS.map((k) => k.name)).toEqual(['しろもち', 'きんぴか', 'もも', 'みんと', 'ぷらむ', 'そら', 'ぴーち', 'よぞら']);
    expect(kororinOf(null)).toEqual({ colour: 'pearl', face: 'omega' });
    expect(kororinOf({ colour: 'night', face: 'nope' })).toEqual({ colour: 'night', face: 'omega' });
  });
  it('{bati} reads a colour or a face for the kororin, and leaves the record alone', () => {
    const c = changeRequest('コロリンをピンクにして');
    expect(c && 'choice' in c && [c.item.id, c.choice.id]).toEqual(['kororin.colour', 'pink']);
    const f = changeRequest('コロリンの顔、ウインクにして');
    expect(f && 'choice' in f && [f.item.id, f.choice.id]).toEqual(['kororin.face', 'wink']);
    const a = changeRequest('コロリンの顔を変えたい');
    expect(a && 'ask' in a && a.item.id).toBe('kororin.face');
    const r = changeRequest('レコードをピンクにして');
    expect(r && 'choice' in r && r.item.id).toBe('saturn.recordColour');
    // every chip reads back as its own choice
    for (const item of CHANGEABLES)
      for (const ch of item.choices) {
        const q = changeRequest(item.chip(ch));
        expect(q && 'choice' in q && [q.item.id, q.choice.id]).toEqual([item.id, ch.id]);
      }
  });
  it('a kororin change keeps the other half, carries the whole kororin, and undoes', async () => {
    const { store, kororin } = memStore();
    await applyChange(store, KORORIN_FACE.id, 'star');
    const r = await applyChange(store, KORORIN_COLOUR.id, 'night');
    expect(r).toEqual({ id: 'kororin.colour', from: 'pearl', to: 'night', kororin: { colour: 'night', face: 'star' } });
    await applyChange(store, r.id, r.from);
    expect(kororin()).toEqual({ colour: 'pearl', face: 'star' });
    await expect(applyChange(store, KORORIN_FACE.id, 'pink')).rejects.toThrow();
  });
});
