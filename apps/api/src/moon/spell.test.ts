import { spellFrom } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { mergeSpell, SpellService } from './spell.service';

describe('R11: POST /moon/spell', () => {
  it('the model writes English for the free words and may add a few tags; the dictionary labels stay', () => {
    const tags = spellFrom('song', '花火の明るい曲');
    expect(tags.find((t) => t.ja === '花火')?.en).toBe('花火');
    const r = mergeSpell('song', { tags, added: [], removed: [] }, [{ ja: '花火', en: 'fireworks', group: 'theme' }, { ja: '明るい', en: 'cheerful', group: 'mood' }, { ja: '夏祭り', en: 'summer festival', group: 'theme' }, { ja: 'ロック', en: 'rock', group: 'genre' }], true);
    expect(r.tags.find((t) => t.ja === '花火')?.en).toBe('fireworks');
    expect(r.tags.find((t) => t.ja === '明るい')?.en).toBe('bright');
    // a second genre is not added over the one there
    expect(r.tags.filter((t) => t.group === 'genre')).toHaveLength(1);
    expect(r.added.map((t) => t.ja)).toContain('夏祭り');
  });
  it('the model failing is no failure: the rules’ spell stands', async () => {
    const s = new SpellService({ name: 'x', chat: async () => Promise.reject(new Error('down')) } as never);
    const v = await s.spell({ kind: 'art', said: '夜の海とクジラの絵' });
    expect(v.tags.map((t) => t.ja)).toEqual(expect.arrayContaining(['夜', '海', 'クジラ', '水彩']));
    const e = await s.spell({ kind: 'art', said: '水彩は外して', tags: v.tags });
    expect(e.removed.map((t) => t.ja)).toEqual(['水彩']);
  });
});
