import { describe, expect, it } from 'vitest';
import { boxAt, caretAt, chars, clip, deleteBack, deleteRange, editHintOnce, insertAt, sane, snap, stops, stretch, type CharBox } from './edit';

const caret = (n: number) => ({ a: n, b: n });
const FAMILY = '👨‍👩‍👧'; // three people joined with ZWJ: 8 UTF-16 units, one character
const FLAG = '🇯🇵'; // two regional indicators: 4 units, one character
const GA = 'が'; // か + a combining dakuten typed apart: 2 units, one character

describe('fixing heard words in place (client 2026-11-27): characters as a person sees them', () => {
  it('Japanese text: one stop after every kana, kanji and mark', () => {
    expect(chars('月がきれい。').map((c) => c.ch)).toEqual(['月', 'が', 'き', 'れ', 'い', '。']);
    expect(stops('月がきれい。')).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('an emoji, a joined family, a flag, a kana with its dakuten apart are each one character', () => {
    expect(chars(`a😀b`).map((c) => [c.o, c.e])).toEqual([[0, 1], [1, 3], [3, 4]]);
    expect(chars(FAMILY)).toHaveLength(1);
    expect(chars(FLAG)).toHaveLength(1);
    expect(chars(`${GA}き`).map((c) => c.ch)).toEqual([GA, 'き']);
    // 𠮷 (a kanji outside the basic plane) is a surrogate pair
    expect(stops('𠮷野家')).toEqual([0, 2, 3, 4]);
  });

  it('a position never stands inside a character', () => {
    expect(snap('a😀b', 2)).toBe(1);
    expect(snap('a😀b', 3)).toBe(3);
    expect(snap('a😀b', 99)).toBe(4);
    expect(snap('a😀b', -3)).toBe(0);
    // a stretch whose end falls inside a character takes the whole character; a backwards one is put in order
    expect(sane('a😀b', { a: 1, b: 2 })).toEqual({ a: 1, b: 3 });
    expect(sane('abc', { a: 3, b: 1 })).toEqual({ a: 1, b: 3 });
    expect(sane('abc', null)).toBeNull();
  });
});

describe('〔けす〕: one character per press', () => {
  it('takes the character before the caret, and the caret follows', () => {
    expect(deleteBack('あしたは雨', caret(3))).toEqual({ text: 'あしは雨', sel: caret(2) });
    expect(deleteBack('あしたは雨', caret(5))).toEqual({ text: 'あしたは', sel: caret(4) });
  });

  it('at the very start nothing goes', () => {
    expect(deleteBack('あした', caret(0))).toEqual({ text: 'あした', sel: caret(0) });
    expect(deleteBack('', caret(0))).toEqual({ text: '', sel: caret(0) });
  });

  it('a surrogate pair, a ZWJ family, a flag and a kana with its mark go whole in one press', () => {
    expect(deleteBack('やった😀', caret(5))).toEqual({ text: 'やった', sel: caret(3) });
    expect(deleteBack(`家族${FAMILY}だよ`, caret(2 + FAMILY.length))).toEqual({ text: '家族だよ', sel: caret(2) });
    expect(deleteBack(`${FLAG}に行く`, caret(4))).toEqual({ text: 'に行く', sel: caret(0) });
    expect(deleteBack(`${GA}っこう`, caret(2))).toEqual({ text: 'っこう', sel: caret(0) });
    expect(deleteBack('𠮷野家', caret(2))).toEqual({ text: '野家', sel: caret(0) });
    // a caret handed in inside the pair is first moved off it: the character BEFORE the pair goes, the pair stays whole
    expect(deleteBack('a😀', caret(2))).toEqual({ text: '😀', sel: caret(0) });
  });

  it('press after press empties the text and never leaves half a character', () => {
    let e = { text: `月${FAMILY}が😀き${GA}れい🇯🇵`, sel: caret(`月${FAMILY}が😀き${GA}れい🇯🇵`.length) };
    let presses = 0;
    while (e.text) {
      e = deleteBack(e.text, e.sel);
      presses++;
      // no lone surrogate anywhere
      expect(e.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    }
    expect(presses).toBe(9);
  });

  it('with a stretch selected it takes the stretch', () => {
    expect(deleteBack('あしたは雨', { a: 1, b: 3 })).toEqual({ text: 'あは雨', sel: caret(1) });
  });
});

describe('〔まとめてけす〕: the selected stretch', () => {
  it('takes it away and leaves the caret where it was', () => {
    expect(deleteRange('きょうは学校でテストがあった', { a: 4, b: 7 })).toEqual({ text: 'きょうはテストがあった', sel: caret(4) });
    expect(deleteRange('あした', { a: 0, b: 3 })).toEqual({ text: '', sel: caret(0) });
  });

  it('never cuts a character: a stretch that ends inside an emoji takes all of it', () => {
    expect(deleteRange('a😀b', { a: 0, b: 2 })).toEqual({ text: 'b', sel: caret(0) });
    expect(deleteRange(`x${FAMILY}y`, { a: 1, b: 4 })).toEqual({ text: 'xy', sel: caret(1) });
    expect(deleteRange('𠮷野家', { a: 1, b: 3 })).toEqual({ text: '家', sel: caret(0) });
  });

  it('a caret (nothing selected) takes nothing', () => {
    expect(deleteRange('あした', caret(2))).toEqual({ text: 'あした', sel: caret(2) });
  });
});

describe('the mic after a fix: the new words go in AT the caret, not at the end', () => {
  it('inserts at the caret and leaves the caret after the new words', () => {
    expect(insertAt('あしたは雨', caret(4), 'きっと')).toEqual({ text: 'あしたはきっと雨', sel: caret(7) });
    expect(insertAt('雨', caret(0), 'あしたは')).toEqual({ text: 'あしたは雨', sel: caret(4) });
  });

  it('replaces a selected stretch', () => {
    expect(insertAt('あしたは雨だね', { a: 4, b: 5 }, '晴れ')).toEqual({ text: 'あしたは晴れだね', sel: caret(6) });
  });

  it('delete a stretch, then speak: the words land where the stretch was', () => {
    const cut = deleteRange('きょうは学校でテストがあった', { a: 4, b: 7 });
    expect(insertAt(cut.text, cut.sel, '塾で')).toEqual({ text: 'きょうは塾でテストがあった', sel: caret(6) });
  });

  it('with no caret (nothing was tapped) the words are added at the end, as before', () => {
    expect(insertAt('あした', null, 'は雨')).toEqual({ text: 'あしたは雨', sel: caret(5) });
    expect(insertAt('', null, 'やった😀')).toEqual({ text: 'やった😀', sel: caret(5) });
  });

  it('a caret left over from a longer text is brought into this one', () => {
    expect(insertAt('あ', caret(9), 'い')).toEqual({ text: 'あい', sel: caret(2) });
    expect(insertAt('a😀', caret(2), 'x')).toEqual({ text: 'ax😀', sel: caret(2) });
  });

  it('the field’s length: what does not fit is cut from the end, never through a character', () => {
    expect(insertAt('あいう', caret(1), 'かきく', 5)).toEqual({ text: 'あかきくい', sel: caret(4) });
    expect(insertAt('あい', caret(2), '😀😀', 5)).toEqual({ text: 'あい😀', sel: caret(4) });
    expect(clip('あ😀', 2)).toBe('あ');
    expect(clip('あ😀', 0)).toBe('あ😀');
  });
});

describe('a tap and a long press on the drawn sentence', () => {
  // two lines of three 20 px characters: あいう / えおか
  const line = (o: number, top: number): CharBox[] => [0, 1, 2].map((k) => ({ o: o + k, e: o + k + 1, left: 10 + k * 20, right: 30 + k * 20, top, bottom: top + 24 }));
  const boxes = [...line(0, 100), ...line(3, 124)];

  it('a tap on the left half of a character puts the caret before it, on the right half after it', () => {
    expect(caretAt(boxes, 33, 110, 6)).toBe(1);
    expect(caretAt(boxes, 47, 110, 6)).toBe(2);
    expect(caretAt(boxes, 12, 130, 6)).toBe(3);
  });

  it('a tap past the end of a line is the end of that line; above or below the text, the nearest line', () => {
    expect(caretAt(boxes, 300, 110, 6)).toBe(3);
    expect(caretAt(boxes, 300, 130, 6)).toBe(6);
    expect(caretAt(boxes, 0, 10, 6)).toBe(0);
    expect(caretAt(boxes, 300, 900, 6)).toBe(6);
    expect(caretAt([], 5, 5, 4)).toBe(4);
  });

  it('a long press takes the character under the finger; dragged, the stretch grows either way', () => {
    const at = (x: number, y: number) => boxAt(boxes, x, y)!;
    const anchor = at(35, 110);
    expect(stretch(anchor, anchor)).toEqual({ a: 1, b: 2 });
    expect(stretch(anchor, at(55, 130))).toEqual({ a: 1, b: 6 });
    expect(stretch(anchor, at(12, 110))).toEqual({ a: 0, b: 2 });
    // a wide character (an emoji) is taken whole
    expect(stretch({ o: 1, e: 3 }, { o: 3, e: 4 })).toEqual({ a: 1, b: 4 });
  });
});

describe('the hint', () => {
  it('is shown once on a device', () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(editHintOnce(store)).toBe(true);
    expect(editHintOnce(store)).toBe(false);
    expect(editHintOnce(null)).toBe(false);
  });
});
