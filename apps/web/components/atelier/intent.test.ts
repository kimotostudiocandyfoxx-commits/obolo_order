import { describe, expect, it } from 'vitest';
import { contentOf, detect, isBare } from './intent';

describe('atelier intent (M-R210)', () => {
  it('finds one kind by its words', () => {
    expect(detect('コロリンで「今日はいい日」', false)).toEqual({ kind: 'make', what: 'voice', content: '今日はいい日' });
    expect(detect('夜の海の絵を描いて', false)).toMatchObject({ kind: 'make', what: 'art' });
    expect(detect('夜の海の絵を見せて', false)).toMatchObject({ kind: 'make', what: 'image' });
    expect(detect('この曲のMVを作って', false)).toMatchObject({ kind: 'make', what: 'video' });
    expect(detect('バティを着せかえて', false)).toMatchObject({ kind: 'make', what: 'bati' });
    expect(detect('プロフィールの姿を変えたい', false)).toMatchObject({ kind: 'make', what: 'look' });
    expect(detect('ラジオ番組を作りたい', false)).toMatchObject({ kind: 'make', what: 'radio' });
  });
  it('asks back when two kinds are asked for', () => {
    expect(detect('アートとコロリン', false)).toEqual({ kind: 'ask', options: ['voice', 'art'] });
  });
  it('a change of the newest card is a refinement', () => {
    expect(detect('もっと明るく', true)).toEqual({ kind: 'refine', content: 'もっと明るく' });
    expect(detect('もっと明るく', false)).toMatchObject({ kind: 'talk' });
  });
  it('a question is a lookup, other words are talk', () => {
    expect(detect('ブラックホールってなに？', false)).toMatchObject({ kind: 'make', what: 'lookup' });
    expect(detect('こんにちは', false)).toEqual({ kind: 'talk', content: 'こんにちは' });
  });
  it('takes the request words off', () => {
    expect(contentOf('夏の海の曲を作って')).toBe('夏の海の曲');
  });
});

describe('M-R236: asking {bati} for the works with a ★ / a mark', () => {
  it('「★がついた曲、見せて」 is a find of starred songs', () => {
    expect(detect('★がついた曲、見せて', false)).toEqual({ kind: 'find', star: true, mark: undefined, planet: 'mercury' });
    expect(detect('♠の画像、出して', false)).toEqual({ kind: 'find', star: false, mark: 'spade', planet: 'jupiter' });
    expect(detect('お気に入り、ぜんぶ見せて', false)).toMatchObject({ kind: 'find', star: true, planet: undefined });
    expect(detect('仕事のやつ、見せて', false, { spade: '仕事' })).toMatchObject({ kind: 'find', mark: 'spade' });
  });
  it('without a ★ or a mark it is what it was', () => {
    expect(detect('絵を見せて', false).kind).toBe('make');
    expect(detect('星の歌を作って', false)).toMatchObject({ kind: 'make', what: 'song' });
  });
});

describe('M-R253 §1: 「新しく作って」', () => {
  it('names only the kind: {bati} asks what it should be (a new card)', () => {
    const it2 = detect('新しく曲を作って', true);
    expect(it2).toMatchObject({ kind: 'make', what: 'song' });
    expect(isBare((it2 as { content: string }).content)).toBe(true);
    expect(isBare('夏の海の歌')).toBe(false);
  });
});

describe('iPad feedback: {bati} opens with a short greeting', () => {
  it('おかえり！ on a returning visit, else the two やっほー in turn', async () => {
    const { greetingOf } = await import('./intent');
    expect(greetingOf({ neo: 'ネオ', returning: true, turn: 0 })).toBe('おかえり！');
    expect(greetingOf({ neo: 'ネオ', returning: false, turn: 0 })).toBe('やっほー！');
    expect(greetingOf({ neo: 'ネオ', returning: false, turn: 1 })).toBe('やっほー、{neo}！');
    expect(greetingOf({ neo: '', returning: false, turn: 1 })).toBe('やっほー！');
  });
});

describe('client 2026-11-24: {bati} answers — never the menu', () => {
  it('a health question is answered in the talk, not with 「なにをする？」 and the kinds', async () => {
    const { conversational, detect, wantsPicture } = await import('./intent');
    for (const last of [false, true]) {
      const it = detect('昨日から顎が痛いんだけど病気かなぁ', last);
      expect(conversational(it)).toBe(true);
    }
    // words only for a pain; a picture may come for a thing one can see
    expect(wantsPicture('昨日から顎が痛いんだけど病気かなぁ')).toBe(false);
    expect(wantsPicture('パンダってどんな動物？')).toBe(true);
  });
  it('small talk is answered too; a make request still makes', async () => {
    const { conversational, detect } = await import('./intent');
    expect(conversational(detect('こんにちは', false))).toBe(true);
    expect(conversational(detect('夜の海の絵を描いて', false))).toBe(false);
  });
});
