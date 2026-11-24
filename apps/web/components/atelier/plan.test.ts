import { describe, expect, it } from 'vitest';
import { isYes, planFor, themeOf } from './plan';

describe('R11: {bati} proposes before it makes anything that spends mana', () => {
  it('a yes in words is a yes; anything else changes the plan', () => {
    for (const y of ['OK', 'ok!', 'いいよ', 'うん、お願い！', '作って', 'これで作って', 'オッケー', 'はい、それで']) expect(isYes(y), y).toBe(true);
    for (const n of ['ロックで作って', 'もっと暗く', 'やっぱり海の歌', '', '夏の歌にして']) expect(isYes(n), n).toBe(false);
  });
  it('the theme is the member’s words, the style words aside', () => {
    expect(themeOf('夏の海の明るい曲を作って')).toBe('夏の海');
    expect(themeOf('ロックで')).toBe('');
  });
  it('a song plan has a genre and a mood, and they go into the making', () => {
    const p = planFor('song', '夏の海の明るい曲を作って');
    expect(p).toMatchObject({ theme: '夏の海', mood: '明るい', genre: 'pop' });
    expect(p.text).toBe('「夏の海」の歌を、明るいポップで');
    expect(p.words).toContain('夏の海');
    expect(p.words).toContain('明るいポップ');
  });
  it('a change keeps what it does not name', () => {
    const p = planFor('song', '夏の海の明るい曲を作って');
    const q = planFor('song', 'ロックにして', p);
    expect(q).toMatchObject({ theme: '夏の海', mood: '明るい', genre: 'rock' });
    expect(q.text).toBe('「夏の海」の歌を、明るいロックで');
  });
  it('art and video plans', () => {
    expect(planFor('art', '夜の海とクジラの絵を描いて').text).toContain('夜の海とクジラ');
    expect(planFor('video', '星空をとぶ映像').text).toContain('いちばん新しい曲');
  });
});
