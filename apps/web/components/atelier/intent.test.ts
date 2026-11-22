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
