import { describe, expect, it } from 'vitest';
import { talkPlain } from '@obolo/shared';
import { subtitlePieces, storyWords } from './subtitles';

describe('subtitlePieces (one sentence at a time, review of M-R251)', () => {
  it('splits the two exclamations of D04-S005 into two subtitles', () => {
    const t = storyWords('順番に、歌うんだZE!!　聞いてみるZE!!');
    expect(t).toBe('順番に、歌うんだZE！！　聞いてみるZE！！');
    expect(subtitlePieces(t).map((p) => p.text)).toEqual(['順番に、歌うんだZE！！', '聞いてみるZE！！']);
  });
  it('keeps 「！？」 and a closing bracket with their sentence', () => {
    expect(subtitlePieces('え！？　本当？」そうか。').map((p) => p.text)).toEqual(['え！？', '本当？」', 'そうか。']);
  });
  it('counts plain characters so the words still come with the voice', () => {
    const t = 'これは**大事**だ。次へ行こう。';
    const ps = subtitlePieces(t);
    expect(ps.map((p) => p.text)).toEqual(['これは**大事**だ。', '次へ行こう。']);
    expect(ps[1].from).toBe([...'これは大事だ。'].length);
    expect(ps.reduce((n, p) => n + p.len, 0)).toBe([...talkPlain(t)].length);
  });
  it('cuts a long sentence after 、 within the limit', () => {
    const t = 'たいていのことは、、、分かる。聞きたいこと、知りたいことは、いつでも、ぽんに、聞いてみろ。';
    const ps = subtitlePieces(t, 16);
    for (const p of ps) expect(p.len).toBeLessThanOrEqual(16);
    expect(ps.map((p) => p.text).join('')).toBe(t);
  });
  it('never shows a bare 「、、」 on its own', () => {
    const t = '、、、ミナト⭐︎。、、、もう一つ教えておくとても長い話になるけれど、最後まで聞いてほしい本当に大事なことなのだ、よく聞け。';
    for (const p of subtitlePieces(t)) expect(p.text).not.toMatch(/^[、。]+$/);
  });
  it('cuts a long sentence with no 「、」 into even parts', () => {
    const t = 'あしたのあさはやくにみんなでいっしょにうちゅうのはてまでとんでいこうぜ。';
    const ps = subtitlePieces(t, 16);
    for (const p of ps) expect(p.len).toBeLessThanOrEqual(16);
    expect(ps.map((p) => p.text).join('')).toBe(t);
  });
});
