import { describe, expect, it } from 'vitest';
import { spellEdit, spellFrom, spellPrompt } from './spell';
import { isLyricsTalk } from './lyrics';

/**
 * R13 fix (client 2026-11-25, iPad): 「プロンプトをピアノ系からEDM系にしてほしい」 came back as the same spell (ピアノ still on,
 * no EDM). Genre words are genre talismans of their own (the old genre goes), 「AからBに」 takes A off and puts B on, a
 * genre switch changes the instruments that came with the old genre (EDM brings シンセ・四つ打ち), 系 / プロンプト / 呪文
 * are understood.
 */
const base = spellFrom('song', '夏の海の明るい曲を作って');
const ja = (v: { tags: { ja: string }[] }) => v.tags.map((t) => t.ja);
const genre = (v: { tags: { ja: string; group: string }[] }) => v.tags.filter((t) => t.group === 'genre').map((t) => t.ja);
const inst = (v: { tags: { ja: string; group: string }[] }) => v.tags.filter((t) => t.group === 'instrument').map((t) => t.ja);

describe('R13 fix: a song spell switched to another genre', () => {
  it('the base spell is a pop song with piano and drums', () => {
    expect(genre({ tags: base })).toEqual(['ポップ']);
    expect(inst({ tags: base })).toEqual(['ピアノ', 'ドラム']);
  });

  it("the client's exact sentence: ピアノ goes, EDM comes in with シンセ and 四つ打ち", () => {
    const v = spellEdit('song', base, 'プロンプトをピアノ系からEDM系にしてほしい');
    expect(genre(v)).toEqual(['EDM']);
    expect(ja(v)).not.toContain('ピアノ');
    expect(ja(v)).not.toContain('ポップ');
    expect(inst(v)).toEqual(expect.arrayContaining(['シンセ', '四つ打ち']));
    expect(v.added.map((t) => t.ja)).toEqual(expect.arrayContaining(['EDM', 'シンセ', '四つ打ち']));
    expect(v.removed.map((t) => t.ja)).toEqual(expect.arrayContaining(['ピアノ', 'ポップ']));
    expect(spellPrompt('song', v.tags)).toMatch(/EDM/);
    // the words are about the style, not the lyrics
    expect(isLyricsTalk('プロンプトをピアノ系からEDM系にしてほしい')).toBe(false);
  });

  it('the same with 呪文 / スペル / no 系', () => {
    for (const s of ['呪文をピアノからEDMにして', 'スペルをピアノ系からEDM系に変えて', 'ピアノからEDMに', 'EDMにして', 'EDM系がいい', 'ＥＤＭにしてほしい']) {
      const v = spellEdit('song', base, s);
      expect(genre(v), s).toEqual(['EDM']);
      expect(ja(v), s).not.toContain('ピアノ');
      expect(inst(v), s).toEqual(expect.arrayContaining(['シンセ', '四つ打ち']));
    }
  });

  it('a piano kept through the switch stays', () => {
    const v = spellEdit('song', base, 'ピアノはそのままでEDMにして');
    expect(genre(v)).toEqual(['EDM']);
    expect(ja(v)).toContain('ピアノ');
  });

  it('each genre word is its own genre talisman (the old one goes)', () => {
    const cases: [string, string][] = [
      ['エレクトロにして', 'EDM'],
      ['ハウスにして', 'ハウス'],
      ['テクノっぽく', 'テクノ'],
      ['ダブステップ系で', 'ダブステップ'],
      ['トランスにして', 'トランス'],
      ['ロックにして', 'ロック'],
      ['ジャズ系にしてほしい', 'ジャズ'],
      ['ヒップホップにして', 'ヒップホップ'],
      ['ラップ系の曲にして', 'ヒップホップ'],
      ['R&Bにして', 'R&B'],
      ['ボカロっぽくして', 'ボカロ'],
      ['アニソン系にして', 'アニソン'],
      ['シティポップにして', 'シティポップ'],
      ['ローファイ系がいい', 'ローファイ'],
      ['バラードにして', 'バラード'],
      ['クラシックにして', 'クラシック'],
    ];
    for (const [s, g] of cases) {
      const v = spellEdit('song', base, s);
      expect(genre(v), s).toEqual([g]);
      expect(v.removed.map((t) => t.ja), s).toContain('ポップ');
    }
  });

  it('「AからBに」 / 「AじゃなくてB」 between two genres', () => {
    const rock = spellEdit('song', base, 'ロックにして');
    expect(genre(rock)).toEqual(['ロック']);
    expect(inst(rock)).toEqual(expect.arrayContaining(['エレキギター', 'ドラム']));
    expect(inst(rock)).not.toContain('ピアノ');
    const jazz = spellEdit('song', rock.tags, 'ロックからジャズにして');
    expect(genre(jazz)).toEqual(['ジャズ']);
    expect(inst(jazz)).toEqual(expect.arrayContaining(['ピアノ', 'サックス']));
    expect(inst(jazz)).not.toContain('エレキギター');
    const dub = spellEdit('song', base, 'ポップじゃなくてダブステップがいい');
    expect(genre(dub)).toEqual(['ダブステップ']);
    const techno = spellEdit('song', base, 'プロンプトをポップからテクノに変えて');
    expect(genre(techno)).toEqual(['テクノ']);
  });

  it('an instrument switch alone keeps the genre', () => {
    const v = spellEdit('song', base, 'ピアノからギターにして');
    expect(genre(v)).toEqual(['ポップ']);
    expect(inst(v)).toContain('ギター');
    expect(inst(v)).not.toContain('ピアノ');
  });

  it('the plain changes still work', () => {
    expect(ja(spellEdit('song', base, 'ピアノを外して'))).not.toContain('ピアノ');
    expect(ja(spellEdit('song', base, 'ギターも足して'))).toContain('ギター');
    expect(genre(spellEdit('song', base, 'もっと明るく'))).toEqual(['ポップ']);
  });

  it('a fresh spell names the new genres too', () => {
    expect(genre({ tags: spellFrom('song', 'EDMの曲を作って') })).toEqual(['EDM']);
    expect(inst({ tags: spellFrom('song', 'EDMの曲を作って') })).toEqual(['シンセ', '四つ打ち']);
    expect(genre({ tags: spellFrom('song', 'シティポップの曲') })).toEqual(['シティポップ']);
    expect(genre({ tags: spellFrom('song', 'ボカロ曲を作って') })).toEqual(['ボカロ']);
  });
});
