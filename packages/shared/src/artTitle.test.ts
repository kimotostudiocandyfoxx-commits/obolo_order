import { describe, expect, it } from 'vitest';
import { ART_TITLE_LINE_TEXTS, ART_TITLE_LINES, ART_TITLE_MAX, ArtTitleBody, artTitleFallback, artTitleTalk, cleanArtTitle, cleanSongTitle, songTitleTalk } from './artTitle';
import { BATI_VARIANTS } from './batiVariants';
import { JupiterRootBody, JupiterRootTitleBody } from './schemas';
import { spellFrom } from './spell';

describe('story 2026-11-25: an art work has a title', () => {
  it('words about the title: a new one said (kept as said), another one asked for, or nothing about it', () => {
    expect(artTitleTalk('タイトルは「夜の森」にして')).toEqual({ to: '夜の森' });
    expect(artTitleTalk('タイトルを星の海に変えて')).toEqual({ to: '星の海' });
    expect(artTitleTalk('題名は月とねこでお願い')).toEqual({ to: '月とねこ' });
    expect(artTitleTalk('『はじまりの朝』ってタイトルにして')).toEqual({ to: 'はじまりの朝' });
    expect(artTitleTalk('タイトルは夏の終わりがいいな')).toEqual({ to: '夏の終わり' });
    expect(artTitleTalk('ほかのタイトルにして')).toEqual({ again: true });
    expect(artTitleTalk('タイトル変えて')).toEqual({ again: true });
    expect(artTitleTalk('別のタイトルがいいな')).toEqual({ again: true });
    // not about the title
    expect(artTitleTalk('もっと明るくして')).toBeNull();
    expect(artTitleTalk('ねこの絵を描いて')).toBeNull();
    expect(artTitleTalk('夜の森にして')).toBeNull();
  });
  it('story 2026-11-27: the same words change a SONG\'s title (and 曲名 / 曲の名前 mean the song)', () => {
    expect(songTitleTalk('タイトルは「夜の森」にして')).toEqual({ to: '夜の森', named: false });
    expect(songTitleTalk('星の海ってタイトルにして')).toEqual({ to: '星の海', named: false });
    expect(songTitleTalk('曲名は月とねこにして')).toEqual({ to: '月とねこ', named: true });
    expect(songTitleTalk('曲の名前をはじまりの朝に変えて')).toEqual({ to: 'はじまりの朝', named: true });
    // words about a picture, another title asked of {bati}, or nothing about a title: not a song's new title
    expect(songTitleTalk('絵の名前は夜の森にして')).toBeNull();
    expect(songTitleTalk('ほかのタイトルにして')).toBeNull();
    expect(songTitleTalk('もっと速くして')).toBeNull();
    expect(cleanSongTitle('「ほしのうた」\n')).toBe('ほしのうた');
    expect(cleanSongTitle('あ'.repeat(60))).toHaveLength(40);
  });
  it('a title as kept: no quotes, no 「〜の絵」, one line, at most ART_TITLE_MAX', () => {
    expect(cleanArtTitle('「月と海」')).toBe('月と海');
    expect(cleanArtTitle('ねこの絵')).toBe('ねこ');
    expect(cleanArtTitle('a\nb')).toBe('a b');
    expect(cleanArtTitle('あ'.repeat(40))).toHaveLength(ART_TITLE_MAX);
    expect(JupiterRootBody.safeParse({ mediaId: '00000000-0000-4000-8000-000000000000', title: 'あ'.repeat(ART_TITLE_MAX + 1) }).success).toBe(false);
    expect(JupiterRootTitleBody.safeParse({ title: ' ' }).success).toBe(false);
    expect(ArtTitleBody.parse({}).tags).toEqual([]);
  });
  it("{bati}'s title by rule (no writer): from the spell, else the words asked, never empty", () => {
    const t = artTitleFallback(spellFrom('art', '夕焼けの町を水彩で'), '夕焼けの町を水彩で');
    expect(t.length).toBeGreaterThan(0);
    expect(t).not.toMatch(/の絵$|描いて/);
    expect(artTitleFallback([], '屋根の上のねこの絵を描いて')).toBe('屋根の上のねこ');
    expect(artTitleFallback([], '')).toBe('むだい');
  });
  it("{bati}'s lines (PROVISIONAL) in every style: the same placeholders and sentences; the style in at most half; ていねい writes デス／マス", () => {
    expect(ART_TITLE_LINES.propose).toBe('タイトルは「{title}」にしてみたよ。ちがう名前がよければ、言ってね。');
    const holes = (x: string) => [...x.matchAll(/\{[a-z0-9]+\}/g)].map((m) => m[0]).sort();
    const split = (x: string) => x.match(/[^！？。!?]+[！？。!?]*/g) ?? [x];
    for (const line of ART_TITLE_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      expect(Object.keys(v)).toHaveLength(10);
      for (const [k, s] of Object.entries(v)) {
        expect(holes(s), `${k}: ${line}`).toEqual(holes(line));
        expect(split(s).length, `${k}: ${s}`).toBe(split(line).length);
        if (k === 'teinei') expect(s).not.toMatch(/(です|ます)(?![\p{sc=Han}])/u);
        const changed = split(s).filter((x, i) => x.trim() !== split(line)[i]?.trim()).length;
        if (k !== 'teinei') expect(changed, `${k}: ${s}`).toBeLessThanOrEqual(Math.ceil(split(line).length / 2));
      }
    }
  });
});
