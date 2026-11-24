import { describe, expect, it } from 'vitest';
import { applyChange, changeRequest, CHANGEABLES, SATURN_RECORD_COLOUR, type ChangeStore } from './changeables';

const memStore = () => {
  const homes: Record<string, { recordColour?: string | null }> = {};
  const store: ChangeStore = { home: async (p) => homes[p] ?? null, setHome: async (p, patch) => void (homes[p] = { ...homes[p], ...patch }) };
  return { homes, store };
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
