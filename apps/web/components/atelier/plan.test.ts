import { spellEdit, spellFrom } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { isYes, planOf } from './plan';

describe('R11: {bati} lays out the spell before it makes anything that spends mana', () => {
  it('a yes in words is a yes; anything else changes the spell', () => {
    for (const y of ['OK', 'ok!', 'いいよ', 'うん、お願い！', '作って', 'このスペルで作って', 'オッケー', 'はい、それで']) expect(isYes(y), y).toBe(true);
    for (const n of ['ロックで作って', 'ピアノも足して', '暗いのは外して', '', '夏の歌にして']) expect(isYes(n), n).toBe(false);
  });
  it('the plan carries the tags, the genre for the song design and the words it is about', () => {
    const p = planOf('song', { tags: spellFrom('song', '夏の海の明るい曲'), added: [], removed: [] });
    expect(p.genre).toBe('pop');
    expect(p.words).toBe('夏、海');
    const q = planOf('song', spellEdit('song', p.tags, 'ロックにして'));
    expect(q.genre).toBe('rock');
    expect(q.added.map((t) => t.ja)).toEqual(['ロック']);
  });
});
