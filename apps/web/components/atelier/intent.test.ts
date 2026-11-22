import { describe, expect, it } from 'vitest';
import { contentOf, detect } from './intent';

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
