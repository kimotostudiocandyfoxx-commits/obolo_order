import { describe, expect, it } from 'vitest';
import { applyChange, changeRequest, CHANGEABLES, KORORIN_COLOUR, KORORIN_FACE, SATURN_RECORD_COLOUR, TALK_BUBBLE_COLOUR, type ChangeStore } from './changeables';
import { SELF_TALK_TONES, TALK_TONE_DEFAULT } from './talkTone';
import { KORORINS, kororinOf } from './planetHome';
import { changeLines, type ChangeRequest } from './changeables';

const changeLinesNear = (r: ChangeRequest) => ('near' in r ? changeLines.near(r.asked, r.near) : null);

const memStore = () => {
  const homes: Record<string, { recordColour?: string | null }> = {};
  let kororin: { colour?: string; face?: string } | null = null;
  let talk: string | null = null;
  const store: ChangeStore = {
    talkColour: async () => talk,
    setTalkColour: async (id) => void (talk = id),
    home: async (p) => homes[p] ?? null,
    setHome: async (p, patch) => void (homes[p] = { ...homes[p], ...patch }),
    kororin: async () => kororin,
    setKororin: async (patch) => void (kororin = { ...kororin, ...patch }),
  };
  return { homes, store, kororin: () => kororin, talk: () => talk, setTalk: (t: string | null) => void (talk = t) };
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

describe('iPad feedback: the bubble colour is a changeable (no picker at the first talk)', () => {
  it('the six own colours, 月光パール for everyone at first', async () => {
    expect(CHANGEABLES.map((c) => c.id)).toContain('talk.bubbleColour');
    expect(TALK_BUBBLE_COLOUR.choices.map((c) => c.id)).toEqual([...SELF_TALK_TONES]);
    expect(TALK_BUBBLE_COLOUR.choices.map((c) => c.name)).toEqual(['月光パール', '霧の空色', 'くすみローズ', 'セージ', '杏', 'ライラック']);
    const { store } = memStore();
    expect(TALK_TONE_DEFAULT).toBe('pearl');
    expect(await TALK_BUBBLE_COLOUR.get(store)).toBe('pearl');
  });
  it('a colour chosen before (the old first-talk picker / the settings) is read as it is', async () => {
    const m = memStore();
    m.setTalk('rose');
    expect(await TALK_BUBBLE_COLOUR.get(m.store)).toBe('rose');
    // something that is not one of the own colours reads as the default
    m.setTalk('honey');
    expect(await TALK_BUBBLE_COLOUR.get(m.store)).toBe('pearl');
  });
  it('reads the request: a colour, the nearest few, or a question — and leaves the record and the kororin alone', () => {
    const a = changeRequest('吹き出しを水色にして');
    expect(a && 'choice' in a && [a.item.id, a.choice.id]).toEqual(['talk.bubbleColour', 'sky']);
    const b = changeRequest('ふきだし、ピンクがいい');
    expect(b && 'choice' in b && [b.item.id, b.choice.id]).toEqual(['talk.bubbleColour', 'rose']);
    const c = changeRequest('チャットの色、むらさきに変えて');
    expect(c && 'choice' in c && [c.item.id, c.choice.id]).toEqual(['talk.bubbleColour', 'lilac']);
    const d = changeRequest('吹き出し、赤にして');
    expect(d && 'near' in d && d.near.map((x) => x.id)).toEqual(['rose', 'apricot']);
    expect(d && changeLinesNear(d)).toBe('赤は、ないんだ。くすみローズ・杏なら、できるよ！');
    const e = changeRequest('吹き出しの色を変えたい');
    expect(e && 'ask' in e && e.item.id).toBe('talk.bubbleColour');
    const r = changeRequest('レコードをピンクにして');
    expect(r && 'choice' in r && r.item.id).toBe('saturn.recordColour');
    const k = changeRequest('コロリンをピンクにして');
    expect(k && 'choice' in k && k.item.id).toBe('kororin.colour');
    expect(changeRequest('吹き出しの絵を見せて')).toBeNull();
  });
  it('applies through the store, keeps what it was for 〔元に戻す〕, refuses others', async () => {
    const m = memStore();
    const r = await applyChange(m.store, TALK_BUBBLE_COLOUR.id, 'sage');
    expect(r).toEqual({ id: 'talk.bubbleColour', from: 'pearl', to: 'sage' });
    expect(m.talk()).toBe('sage');
    const back = await applyChange(m.store, r.id, r.from);
    expect(back).toEqual({ id: 'talk.bubbleColour', from: 'sage', to: 'pearl' });
    expect(m.talk()).toBe('pearl');
    await expect(applyChange(m.store, TALK_BUBBLE_COLOUR.id, 'honey')).rejects.toThrow();
    await expect(applyChange(m.store, TALK_BUBBLE_COLOUR.id, 'black')).rejects.toThrow();
  });
  it('lines', () => {
    const sky = TALK_BUBBLE_COLOUR.choices.find((c) => c.id === 'sky')!;
    expect(TALK_BUBBLE_COLOUR.doneLine(sky)).toBe('吹き出し、霧の空色にしたよ！');
    expect(TALK_BUBBLE_COLOUR.undoneLine(TALK_BUBBLE_COLOUR.choices[0])).toBe('元に戻したよ。吹き出しは、月光パール！');
    expect(TALK_BUBBLE_COLOUR.chip(sky)).toBe('吹き出しを霧の空色にして');
  });
});
