import { describe, expect, it } from 'vitest';
import { spellFrom } from './spell';
import { isLyricsTalk, lyricsDemoEdit, lyricsDiff, lyricsEdit, lyricsFallback, lyricsFind, replaceAsk } from './lyrics';

/**
 * R13 fix (client 2026-11-25, iPad): asked several times to change the lyrics, {bati} kept saying it could not. The
 * client's phrasing — 「〇〇を△△に変えて欲しい」「話のままでのところを靴のままでにしてほしい」 (話のままで meant はだしのままで),
 * 「歌詞を変えて」「サビを変えて」 — is understood: a phrase is found in the lyrics by sound (kana folded, a kanji slip
 * allowed) and replaced; new words go to the writer (the review demo's stand-in changes the lines).
 */
const base = lyricsFallback(spellFrom('song', '夏の海の明るい曲'));
const lines = (l: typeof base) => l.blocks.flatMap((b) => b.lines);

describe('R13 fix: a phrase of the lyrics replaced', () => {
  it('the base lyrics have はだしのままで', () => {
    expect(lines(base).some((x) => x.includes('はだしのままで'))).toBe(true);
  });

  it("the client's exact sentence: 話のままで → はだしのままで, replaced by 靴のままで", () => {
    const said = '話のままでのところを靴のままでにしてほしい';
    expect(replaceAsk(said)).toEqual({ from: '話のままで', to: '靴のままで' });
    expect(lyricsFind(base, '話のままで')?.text).toBe('はだしのままで');
    expect(isLyricsTalk(said, base)).toBe(true);
    const e = lyricsEdit(base, said)!;
    expect(e.op).toBe('replace');
    const all = lines(e.lyrics);
    expect(all.some((x) => x.startsWith('靴のままで'))).toBe(true);
    expect(all.some((x) => x.includes('はだし'))).toBe(false);
    expect(lyricsDiff(base, e.lyrics).changedLines.length).toBeGreaterThan(0);
  });

  it('「〇〇を△△に変えて欲しい」 with the words as written, and in katakana', () => {
    const a = lyricsEdit(base, 'はだしをサンダルに変えて欲しい')!;
    expect(lines(a.lyrics).some((x) => x.includes('サンダルのままで'))).toBe(true);
    const b = lyricsEdit(base, 'ハダシのままでをくつのままでに変えて')!;
    expect(lines(b.lyrics).some((x) => x.includes('くつのままで'))).toBe(true);
    const c = lyricsEdit(base, '「風がさらって」を「波がさらって」にしてください')!;
    expect(lines(c.lyrics).some((x) => x.includes('波がさらって'))).toBe(true);
  });

  it('nothing close in the lyrics, or a style word, is not a lyric replace', () => {
    expect(lyricsFind(base, 'ロケットの発射台')).toBeNull();
    expect(isLyricsTalk('ピアノをギターに変えて', base)).toBe(false);
    expect(isLyricsTalk('テンポを速いのに変えて', base)).toBe(false);
    expect(replaceAsk('サビを明るい感じに')).toBeNull();
  });

  it('「歌詞を変えて」「サビを変えて」 are lyric talk; the writer makes them (the demo stand-in changes the lines)', () => {
    for (const s of ['歌詞を変えて', 'サビを変えて', 'サビを書き直して', 'Aメロを別の歌詞に']) {
      expect(isLyricsTalk(s), s).toBe(true);
      const d = lyricsDemoEdit(base, s);
      expect(d, s).not.toBeNull();
      expect(lyricsDiff(base, d!).changedLines.length, s).toBeGreaterThan(0);
    }
    const chorusOnly = lyricsDiff(base, lyricsDemoEdit(base, 'サビを変えて')!);
    expect(chorusOnly.changedLines.every((k) => k.startsWith('chorus'))).toBe(true);
  });
});
