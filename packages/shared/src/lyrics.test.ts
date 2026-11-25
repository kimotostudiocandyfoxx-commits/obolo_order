import { describe, expect, it } from 'vitest';
import { spellFrom, spellKey } from './spell';
import {
  isLyricsTalk,
  lyricBlockLabels,
  lyricsCaption,
  lyricsDemoEdit,
  lyricsDiff,
  lyricsEdit,
  lyricsFallback,
  lyricsKey,
  lyricsLines,
  lyricsNormalize,
  lyricsPrompt,
  lyricsSecondVerse,
  lyricsSections,
  lyricsSheet,
  lyricsStructure,
  ownLyricsOf,
  parseLyricsSheet,
  songSpellKey,
  SongLyrics,
  type SongLyrics as L,
} from './lyrics';
import { FullSongBody } from './schemas';

const tags = spellFrom('song', '夏の海の明るい曲');
const base = lyricsFallback(tags);

describe('R13: lyrics with metatags — structure, sheet and engine', () => {
  it('the fallback is valid, original and has the engine tags', () => {
    expect(SongLyrics.safeParse(base).success).toBe(true);
    expect(base.blocks.map((b) => b.section)).toEqual(['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'final-chorus', 'outro']);
    expect(lyricBlockLabels(base)).toEqual(['はじまり', 'Aメロ', 'サビ前', 'サビ', 'Cメロ', '大サビ', 'おわり']);
    expect(base.blocks[3].lines[0]).toContain('夏');
  });

  it('serializes to ACE-Step’s lyric sheet: structure tag + at most two modifiers, blank lines between blocks', () => {
    const s = lyricsSheet(base);
    expect(s.startsWith('[Intro]\n\n[Verse]\n')).toBe(true);
    expect(s).toContain('[Pre-Chorus - building energy]');
    expect(s).toContain('[Chorus - harmonies]');
    expect(s).toContain('[Bridge - whispered]');
    expect(s).toContain('[Final Chorus - powerful]');
    expect(s.endsWith('[Outro - fade out]')).toBe(true);
    // numbered verses once there are two
    const two = lyricsSecondVerse(base);
    expect(lyricsSheet(two)).toContain('[Verse 1]');
    expect(lyricsSheet(two)).toContain('[Verse 2]');
    expect(lyricBlockLabels(two)).toContain('2番Aメロ');
    expect(lyricBlockLabels(two)).toContain('2番サビ');
  });

  it('parse ∘ serialize is the identity', () => {
    const back = parseLyricsSheet(lyricsSheet(base));
    expect(back?.blocks).toEqual(base.blocks);
    const two = lyricsSecondVerse(base);
    expect(parseLyricsSheet(lyricsSheet(two))?.blocks).toEqual(two.blocks);
  });

  it('reads the model’s answer in English, ids or Japanese; drops modifiers the engine does not use; cleans lines', () => {
    const l = lyricsNormalize({
      title: '夏のうた',
      blocks: [
        { tag: '[Intro - piano]', lines: [] },
        { tag: 'Verse 1', lines: ['あさの　ひかり [whispered]', '「まどを　あけて」'] },
        { section: 'サビ', hints: ['ハモり', 'sparkly glitter', 'powerful', 'falsetto'], lines: ['ひかれ'] },
        { tag: 'Guitar Solo', lines: ['not sung'] },
        { tag: 'hook', lines: [] },
        { tag: 'Outro - fade out' },
      ],
    });
    expect(l?.title).toBe('夏のうた');
    expect(l?.blocks).toEqual([
      { section: 'intro', hints: [], lines: [] },
      { section: 'verse', hints: [], lines: ['あさの　ひかり', 'まどを　あけて'] },
      { section: 'chorus', hints: ['harmonies', 'powerful'], lines: ['ひかれ'] },
      { section: 'guitar-solo', hints: [], lines: [] },
      { section: 'outro', hints: ['fade'], lines: [] },
    ]);
    expect(lyricsNormalize({ blocks: [{ tag: 'Intro' }] })).toBeNull();
    expect(lyricsNormalize('nope')).toBeNull();
  });

  it('maps to the engine: older verse / chorus / bridge sections for the sung lines, caption words for the tags', () => {
    const secs = lyricsSections(base);
    expect(secs.map((s) => s.name)).toEqual(['verse', 'chorus', 'bridge', 'chorus']);
    expect(secs[0].lines).toHaveLength(6); // verse + pre-chorus together
    expect(FullSongBody.shape.sections.safeParse(secs).success).toBe(true);
    const solo: L = { blocks: [...base.blocks.slice(0, 4), { section: 'guitar-solo', hints: [], lines: [] }, ...base.blocks.slice(4)] };
    expect(lyricsCaption(solo)).toEqual(expect.arrayContaining(['guitar solo', 'vocal harmonies', 'whispered vocals in parts', 'fade-out ending']));
    expect(lyricsPrompt('bright pop song, featuring guitar solo', solo)).not.toMatch(/guitar solo.*guitar solo/);
    expect(lyricsPrompt('x', undefined)).toBe('x');
    expect(lyricsLines(base)[0]).toEqual({ label: 'Aメロ', text: base.blocks[1].lines[0] });
  });

  it('the yes covers the style talismans AND the lyrics', () => {
    const k = songSpellKey(tags, base)!;
    expect(k.startsWith(spellKey('song', tags))).toBe(true);
    expect(k.length).toBeLessThanOrEqual(64);
    expect(songSpellKey(tags, null)).toBe(spellKey('song', tags));
    const edited = lyricsEdit(base, 'ささやきを外して')!.lyrics;
    expect(songSpellKey(tags, edited)).not.toBe(k);
    expect(lyricsKey(edited)).not.toBe(lyricsKey(base));
    expect(songSpellKey(null, null)).toBeNull();
  });

  it('a member’s own lyrics: found in the words, structured with tags', () => {
    expect(ownLyricsOf('歌詞はこれで：あさのひかり\nまどをあけて')).toBe('あさのひかり\nまどをあけて');
    expect(ownLyricsOf('サビをもっと明るく')).toBeNull();
    const l = lyricsStructure('あさのひかり\nまどをあけて\n\nラーメン ラーメン\nおいしいな\n\nよるのそら\nほしがでた\n\nラーメン ラーメン\nおいしいな')!;
    expect(l.blocks.map((b) => b.section)).toEqual(['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro']);
    const tagged = lyricsStructure('[Aメロ]\nあさのひかり\n[サビ]\nラーメン')!;
    expect(tagged.blocks.map((b) => b.section)).toEqual(['intro', 'verse', 'chorus', 'outro']);
  });
});

describe('R13: changing the lyrics by words', () => {
  it('knows lyric talk from style talk', () => {
    for (const s of ['サビをもっと明るく', '2番を足して', 'ささやきを外して', '歌詞の夏を冬に', '間奏を入れて', 'ハモりをつけて']) expect(isLyricsTalk(s), s).toBe(true);
    for (const s of ['もっと明るく', 'ピアノも足して', 'ロックにして', 'テンポを速く']) expect(isLyricsTalk(s), s).toBe(false);
  });

  it('takes a modifier off (everywhere, or in the named block)', () => {
    const e = lyricsEdit(base, 'ささやきを外して')!;
    expect(e.op).toBe('dropHint');
    expect(e.lyrics.blocks.some((b) => b.hints.includes('whispered'))).toBe(false);
    const d = lyricsDiff(base, e.lyrics);
    expect(d.goneHints).toEqual([{ key: 'bridge#1', hint: 'whispered' }]);
    expect(d.changedLines).toEqual([]);
    const h = lyricsEdit(base, 'サビのハモりはいらない')!;
    expect(h.lyrics.blocks[3].hints).toEqual([]);
    expect(lyricsEdit(base, 'ファルセットを外して')).toBeNull();
  });

  it('puts a modifier on: the named block, else its natural place; never more than two', () => {
    const e = lyricsEdit(base, 'Aメロにささやきを足して')!;
    expect(e.op).toBe('addHint');
    expect(e.lyrics.blocks[1].hints).toEqual(['whispered']);
    expect(lyricsDiff(base, e.lyrics).newHints).toEqual(['verse#1/whispered']);
    const f = lyricsEdit(base, '裏声を入れて')!;
    expect(f.lyrics.blocks[3].hints).toEqual(['harmonies', 'falsetto']);
    const g = lyricsEdit(f.lyrics, 'サビにかけあいを足して')!;
    expect(g.lyrics.blocks[3].hints).toEqual(['falsetto', 'call']);
  });

  it('adds / removes an instrumental block in its place', () => {
    const a = lyricsEdit(base, 'ギターソロを入れて')!;
    expect(a.op).toBe('addBlock');
    expect(a.lyrics.blocks.map((b) => b.section)).toEqual(['intro', 'verse', 'pre-chorus', 'chorus', 'guitar-solo', 'bridge', 'final-chorus', 'outro']);
    expect(lyricsDiff(base, a.lyrics).newBlocks).toEqual(['guitar-solo#1']);
    const r = lyricsEdit(base, 'イントロなしで')!;
    expect(r.op).toBe('dropBlock');
    expect(r.lyrics.blocks[0].section).toBe('verse');
    expect(lyricsDiff(base, r.lyrics).goneBlocks).toEqual([{ key: 'intro#1', section: 'intro', hints: [], at: 0 }]);
    // a sung block is not removed by rule
    expect(lyricsEdit(base, 'Cメロを外して')).toBeNull();
  });

  it('replaces words: 「歌詞の〇〇を△△に」', () => {
    const e = lyricsEdit(base, '歌詞の「はだし」を「サンダル」にして')!;
    expect(e.op).toBe('replace');
    expect(e.lyrics.blocks[1].lines[1]).toContain('サンダル');
    expect(lyricsDiff(base, e.lyrics).changedLines).toEqual(['verse#1:1']);
    expect(lyricsEdit(base, '歌詞の「ない言葉」を「x」にして')).toBeNull();
  });

  it('a change that needs new words goes to the model (null by rule); the demo’s stand-in changes the lines', () => {
    expect(lyricsEdit(base, 'サビをもっと明るく')).toBeNull();
    expect(lyricsEdit(base, '2番を足して')).toBeNull();
    const b = lyricsDemoEdit(base, 'サビをもっと明るく')!;
    const d = lyricsDiff(base, b);
    expect(d.changedLines.some((k) => k.startsWith('chorus#1:'))).toBe(true);
    expect(d.newHints).toContain('chorus#1/euphoric');
    const two = lyricsDemoEdit(base, '2番を足して')!;
    expect(two.blocks.filter((x) => x.section === 'verse')).toHaveLength(2);
    expect(lyricsDiff(base, two).newBlocks).toEqual(expect.arrayContaining(['verse#2', 'chorus#2']));
  });
});

import { BATI_VARIANTS } from './batiVariants';
import { SONG_LINE_TEXTS } from './songVariants';
describe('R13: bati’s song lines in every style', () => {
  it('every line has all its styles, with the same placeholders and sentences; ていねい writes デス／マス', () => {
    const holes = (x: string) => [...x.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).filter((h) => h !== '{self}').sort();
    const sentences = (x: string) => (x.match(/[^！？。!?]+[！？。!?]*/g) ?? [x]).length;
    expect(SONG_LINE_TEXTS).toContain('曲調のスペルはこんなんだね。');
    expect(SONG_LINE_TEXTS).toContain('そして、スペル入りの歌詞はこんな感じ。');
    for (const line of SONG_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      for (const [k, s] of Object.entries(v)) {
        expect(holes(s), `${k}: ${line}`).toEqual(holes(line));
        expect(sentences(s), `${k}: ${s}`).toBe(sentences(line));
        if (k === 'teinei') expect(s).not.toMatch(/(です|ます)(?![\p{sc=Han}])/u);
      }
    }
  });
});
