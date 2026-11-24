import { describe, expect, it } from 'vitest';
import { spellDrop, spellEdit, spellFrom, spellKey, spellNormalize, spellPrompt, SpellTags } from './spell';

const ja = (ts: { ja: string }[]) => ts.map((t) => t.ja);

describe('R11: the spell (スペル) as wooden tags', () => {
  it('a song: what it is about, then genre, mood, tempo, instruments, voice — each Japanese with its English behind', () => {
    const t = spellFrom('song', '夏の海の明るい曲を作って');
    expect(ja(t)).toEqual(['夏', '海', 'ポップ', '明るい', 'ふつうの速さ', 'ピアノ', 'ドラム', 'やさしい歌声']);
    expect(t.find((x) => x.ja === '海')?.en).toBe('the sea');
    expect(SpellTags.safeParse(t).success).toBe(true);
  });
  it('a picture: subject, touch, colour, composition', () => {
    expect(ja(spellFrom('art', '夜の海とクジラの絵を描いて'))).toEqual(['夜', '海', 'クジラ', '水彩', 'やわらかい色', '正方形']);
    expect(ja(spellFrom('art', 'ふわふわの動物'))).toEqual(['ふわふわ', '動物', '水彩', 'やわらかい色', '正方形']);
  });
  it('the English prompt is built from the tags as they are', () => {
    const t = spellFrom('song', '夏の海の明るい曲');
    expect(spellPrompt('song', t)).toBe('bright pop song, about summer, the sea, mid tempo, featuring piano, drums, soft vocals');
    expect(spellPrompt('art', spellFrom('art', '夜の海とクジラ'))).toBe('illustration, of night, the sea, a whale, watercolor, soft pastel colors, square composition');
    expect(spellPrompt('song', t)).not.toMatch(/[^\x20-\x7e]/);
  });
  it('「〇〇も足して」 adds, 「〇〇は外して」 removes, a genre replaces the genre, a mood takes its opposite off', () => {
    let t = spellFrom('song', '夏の海の明るい曲');
    let r = spellEdit('song', t, 'ストリングスも足して');
    expect(ja(r.added)).toEqual(['ストリングス']);
    t = r.tags;
    r = spellEdit('song', t, 'ロックにして');
    expect(ja(r.added)).toEqual(['ロック']);
    expect(ja(r.removed)).toEqual(['ポップ']);
    t = r.tags;
    r = spellEdit('song', t, 'もっと暗く');
    expect(ja(r.added)).toEqual(['暗い']);
    expect(ja(r.removed)).toEqual(['明るい']);
    t = r.tags;
    r = spellEdit('song', t, '暗いのは外して');
    expect(ja(r.removed)).toEqual(['暗い']);
    expect(ja(r.tags)).not.toContain('暗い');
    r = spellEdit('song', r.tags, '花火も入れて');
    expect(r.added).toEqual([{ ja: '花火', en: '花火', group: 'theme' }]);
    const d = spellDrop(r.tags, 'drums');
    expect(ja(d.removed)).toEqual(['ドラム']);
  });
  it('the yes is tied to the tag set (any change is another key)', () => {
    const t = spellFrom('song', '夏の海の明るい曲');
    expect(spellKey('song', t)).toBe(spellKey('song', spellFrom('song', '夏の海の明るい曲')));
    expect(spellKey('song', t)).not.toBe(spellKey('song', spellEdit('song', t, 'ピアノは外して').tags));
    expect(spellKey('song', t)).not.toBe(spellKey('art', t));
  });
  it("the model's pairs get the dictionary's labels (stable), the rest clipped, no English left in Japanese", () => {
    const n = spellNormalize('song', [{ ja: 'ピアノ', en: 'grand piano', group: 'instrument' }, { ja: 'はなび', en: 'fireworks', group: 'theme' }, { ja: 'バラード', en: 'ballad', group: 'genre' }, { ja: 'ロック', en: 'rock', group: 'genre' }, { ja: 1 }]);
    expect(n).toEqual([
      { ja: 'はなび', en: 'fireworks', group: 'theme' },
      { ja: 'バラード', en: 'ballad', group: 'genre' },
      { ja: 'ピアノ', en: 'piano', group: 'instrument' },
    ]);
  });
});
