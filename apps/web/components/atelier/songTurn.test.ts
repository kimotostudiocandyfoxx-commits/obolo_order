import { describe, expect, it, vi } from 'vitest';
import { BATI_VARIANTS, lyricsFallback, SONG_LINES, spellEdit, spellFrom, type SpellView } from '@obolo/shared';
import { restyleAnswer, restyleGenre, songStyleChange, songTurnOf } from './songTurn';

const pop = spellFrom('song', 'ノリのいい曲を作って');
const lyrics = lyricsFallback(pop);

describe('R14 (client 2026-11-25): 「全然違うよ、サイケデリックトランスにして」 while a song spell waits', () => {
  it('is a change of the style spell, not of the lyrics (style words win over lyric words)', () => {
    for (const s of ['全然違うよ、サイケデリックトランスにして', '違うよ、サイケデリックトランス', 'そうじゃなくて、テクノがいい', 'イメージと違う、もっと速く', '全然違う', 'ロックにして', 'もっと明るいEDMにして'])
      expect(songTurnOf(s, lyrics), s).toBe('style');
    for (const s of ['サビをもっと明るく', '2番を足して', '歌詞もサイケデリックトランスっぽくして', 'ささやきを外して']) expect(songTurnOf(s, lyrics), s).toBe('lyrics');
  });

  it('the style spell is made again (only the spell is asked for: no lyrics), and {bati} asks about the lyrics once', async () => {
    const api = {
      moonSpell: vi.fn(async (b: { tags?: typeof pop; said: string }): Promise<SpellView> => ({ ...spellEdit('song', b.tags!, b.said), respelled: true })),
      moonLyrics: vi.fn(),
    };
    const r = await songStyleChange(api, { tags: pop, said: '全然違うよ、サイケデリックトランスにして', lyrics, history: [{ who: 'me', text: 'サイトラの曲を作りたい' }] });
    expect(api.moonSpell).toHaveBeenCalledTimes(1);
    expect(api.moonSpell.mock.calls[0][0]).toMatchObject({ kind: 'song', tags: pop, history: [{ who: 'me', text: 'サイトラの曲を作りたい' }] });
    expect(api.moonLyrics).not.toHaveBeenCalled();
    expect(r.view.tags.find((t) => t.group === 'genre')?.ja).toBe('サイケデリックトランス');
    expect(r.restyle).toBe('サイケデリックトランス');
    // the API down: by rule, still the style
    const down = await songStyleChange({ moonSpell: () => Promise.reject(new Error('x')) }, { tags: pop, said: '全然違うよ、サイケデリックトランスにして', lyrics });
    expect(down.view.tags.find((t) => t.group === 'genre')?.ja).toBe('サイケデリックトランス');
  });

  it('asks only when the genre changed a lot and there are lyrics', () => {
    const psy = spellFrom('song', 'サイケデリックトランスの曲');
    expect(restyleGenre(pop, psy, true)).toBe('サイケデリックトランス');
    expect(restyleGenre(pop, psy, false)).toBeNull();
    expect(restyleGenre(pop, spellEdit('song', pop, 'K-POPにして').tags, true)).toBeNull();
    expect(restyleGenre(pop, spellEdit('song', pop, 'ピアノを外して').tags, true)).toBeNull();
  });

  it('the answer: yes writes them again, no keeps them, other words are a change', () => {
    for (const s of ['うん', 'お願い', 'うん、書き直して', 'いいよ', 'はい！']) expect(restyleAnswer(s), s).toBe('yes');
    for (const s of ['そのままでいい', 'このままで', '大丈夫', 'いらない', '書き直さなくていい']) expect(restyleAnswer(s), s).toBe('no');
    expect(restyleAnswer('もっと速くして')).toBeNull();
  });

  it('the question in every speech style', () => {
    for (const v of ['teinei', 'kansai', 'cool', 'mellow', 'amae', 'gal', 'galfuwa', 'galane', 'galcool', 'galkansai'] as const) {
      const l = BATI_VARIANTS[SONG_LINES.lyricsRestyleAsk][v];
      expect(l, v).toContain('{genre}');
      expect(l, v).toMatch(/歌詞も/);
    }
  });
});
