import { describe, expect, it } from 'vitest';
import { BATI_VARIANTS } from './batiVariants';
import { spellComplete, spellFrom, type SpellTag } from './spell';
import {
  bookMatch,
  findSpell,
  isHappy,
  isNo,
  MoonCompassBody,
  SaveSpellBody,
  shouldOfferSave,
  shouldSuggestBook,
  SPELL_OFFER_GAP,
  SPELL_TOOL_LINE_TEXTS,
  SPELL_TOOL_MEMORY_EMPTY,
  spellBookName,
  spellNameUnique,
  spellQuery,
  spellToolIntent,
  youtubeLink,
  type SavedSpell,
} from './spellTools';
import { TOOL_STORY_LINES } from './toolVariants';

const t = (ja: string, group: SpellTag['group'], en = ja): SpellTag => ({ ja, en, group });
const saved = (id: string, kind: SavedSpell['kind'], name: string, tags: SpellTag[]): SavedSpell => ({ id, kind, name, tags, createdAt: '2026-11-25T00:00:00Z', usedAt: null });

describe('R12 spell book: a saved spell’s name from its content', () => {
  it('what it is about, then its genre / touch: 夏の海のポップ, 夜の海の水彩', () => {
    expect(spellBookName('song', spellFrom('song', '夏の海のポップな曲'))).toBe('夏の海のポップ');
    expect(spellBookName('art', spellFrom('art', '夜の海とクジラの絵'))).toBe('夜の海の水彩');
    expect(spellBookName('novel', spellFrom('novel', '魔法の森の冒険'))).toBe('魔法の森の女の子の冒険');
    expect(spellBookName('game', spellFrom('game', 'よける猫のゲーム'))).toBe('猫のよけるゲーム');
  });
  it('nothing it is about: its mood before the head (明るいポップ, 静かなバラード)', () => {
    expect(spellBookName('song', [t('ポップ', 'genre'), t('明るい', 'mood')])).toBe('明るいポップ');
    expect(spellBookName('song', [t('バラード', 'genre'), t('静か', 'mood')])).toBe('静かなバラード');
    expect(spellBookName('art', [])).toBe('絵');
  });
  it('at most 16 characters; a taken name gets a number', () => {
    const n = spellBookName('song', [t('とても長いテーマのことば', 'theme'), t('もうひとつ長いテーマ', 'theme'), t('ヒップホップ', 'genre')]);
    expect([...n].length).toBeLessThanOrEqual(16);
    expect(spellNameUnique('夏の海のポップ', ['夏の海のポップ'])).toBe('夏の海のポップ2');
    expect(spellNameUnique('夏の海のポップ', ['夏の海のポップ', '夏の海のポップ2'])).toBe('夏の海のポップ3');
    expect(spellNameUnique('星', [])).toBe('星');
  });
});

describe('R12 spell book: finding a saved spell from words (fuzzy)', () => {
  const book = [
    saved('a', 'song', '夏の海のポップ', spellFrom('song', '夏の海のポップ')),
    saved('b', 'art', '夜の海の水彩', spellFrom('art', '夜の海の水彩')),
    saved('c', 'song', '雨の街のジャズ', spellFrom('song', '雨の街のジャズ')),
  ];
  it('「夏の海のやつ使って」 → 夏の海のポップ; its own name; a part of it', () => {
    expect(spellQuery('夏の海のやつ使って')).toBe('夏の海');
    expect(spellQuery('スペルブックの『雨の街のジャズ』を使って')).toBe('雨の街のジャズ');
    expect(findSpell('夏の海のやつ使って', book).spell?.id).toBe('a');
    expect(findSpell('雨の街のジャズ', book).spell?.id).toBe('c');
    expect(findSpell('ジャズのやつ', book).spell?.id).toBe('c');
  });
  it('two as good → close (bati asks which); nothing near → none', () => {
    const r = findSpell('海のやつ', book);
    expect(r.spell).toBeUndefined();
    expect(r.close.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(findSpell('宇宙のロック', book).close).toEqual([]);
  });
  it('a kind asked for: a saved spell of that kind with the same words (the defaults do not count)', () => {
    expect(bookMatch('song', '夏の海の曲つくって', book)?.id).toBe('a');
    expect(bookMatch('art', '夏の海の曲つくって', book)).toBeNull();
    expect(bookMatch('song', '明るい曲', book)).toBeNull();
    expect(bookMatch('song', '雨の曲', book)?.id).toBe('c');
  });
});

describe('R12 spell book: when bati offers it (not every time, never twice in a row)', () => {
  it('a happy word about the work, not a change or a no', () => {
    for (const s of ['いいね！', '最高', 'これ好き', 'すごい！', 'めっちゃかわいい', '気に入った']) expect(isHappy(s), s).toBe(true);
    for (const s of ['好きじゃない', 'もっと明るく', 'いいね、でもピアノ足して', 'いまいち', 'ありがとう', '']) expect(isHappy(s), s).toBe(false);
  });
  it('the first happy word after a work offers; then not for the next few works', () => {
    let m = { ...SPELL_TOOL_MEMORY_EMPTY, works: 1 };
    expect(shouldOfferSave(m, { happy: true, kept: false })).toBe(true);
    expect(shouldOfferSave(m, { happy: false, kept: false })).toBe(false);
    expect(shouldOfferSave(m, { happy: true, kept: true })).toBe(false);
    expect(shouldOfferSave({ ...SPELL_TOOL_MEMORY_EMPTY }, { happy: true, kept: false })).toBe(false);
    m = { ...m, offeredAt: 1 };
    for (let w = 2; w < 1 + SPELL_OFFER_GAP; w++) expect(shouldOfferSave({ ...m, works: w }, { happy: true, kept: false }), `work ${w}`).toBe(false);
    expect(shouldOfferSave({ ...m, works: 1 + SPELL_OFFER_GAP }, { happy: true, kept: false })).toBe(true);
  });
  it('a saved spell is suggested at most once in a few asks', () => {
    expect(shouldSuggestBook(SPELL_TOOL_MEMORY_EMPTY)).toBe(true);
    expect(shouldSuggestBook({ ...SPELL_TOOL_MEMORY_EMPTY, asks: 2, suggestedAt: 1 })).toBe(false);
    expect(shouldSuggestBook({ ...SPELL_TOOL_MEMORY_EMPTY, asks: 5, suggestedAt: 1 })).toBe(true);
  });
  it('a no to bati’s question', () => {
    for (const s of ['いや', 'ううん、いい', 'やめとく', 'いらない', 'しまわない']) expect(isNo(s), s).toBe(true);
    for (const s of ['うん', 'しまって', 'いいよ']) expect(isNo(s), s).toBe(false);
  });
});

describe('R12: the member’s words about the tools', () => {
  it('the compass and the book are asked for', () => {
    expect(spellToolIntent('コンパス出して')).toEqual({ tool: 'compass' });
    expect(spellToolIntent('コンパス使いたい')).toEqual({ tool: 'compass' });
    expect(spellToolIntent('スペルブック出して')).toEqual({ tool: 'book' });
    expect(spellToolIntent('スペルブック見せて！')).toEqual({ tool: 'book' });
  });
  it('keep, rename, use, throw away', () => {
    expect(spellToolIntent('しまっておいて')).toEqual({ tool: 'save' });
    expect(spellToolIntent('それ、しまっといて')).toEqual({ tool: 'save' });
    expect(spellToolIntent('スペルブックにしまって')).toEqual({ tool: 'save' });
    expect(spellToolIntent('名前を「夏のうた」にして')).toEqual({ tool: 'rename', name: '夏のうた' });
    expect(spellToolIntent('夏のうたって名前にして')).toEqual({ tool: 'rename', name: '夏のうた' });
    expect(spellToolIntent('夏の海のやつ使って', true)).toEqual({ tool: 'use', query: '夏の海', named: true });
    expect(spellToolIntent('スペルブックの雨の街のジャズを使って')).toEqual({ tool: 'use', query: '雨の街のジャズ', named: true });
    expect(spellToolIntent('夜の海の水彩は捨てて')).toEqual({ tool: 'discard', query: '夜の海の水彩' });
  });
  it('the open book’s pages; ordinary words are nothing', () => {
    expect(spellToolIntent('次のページ', true)).toEqual({ tool: 'page', step: 1 });
    expect(spellToolIntent('前のページ', true)).toEqual({ tool: 'page', step: -1 });
    expect(spellToolIntent('とじて', true)).toEqual({ tool: 'close' });
    expect(spellToolIntent('次のページ')).toBeNull();
    expect(spellToolIntent('夏の海の曲つくって')).toBeNull();
    expect(spellToolIntent('ピアノも足して')).toBeNull();
    expect(spellToolIntent('暗いのは外して')).toBeNull();
  });
});

describe('R12 compass: what it reads', () => {
  it('a YouTube link in what was said, as the plain watch link', () => {
    const id = 'dQw4w9WgXcQ';
    for (const u of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?si=abc`, `https://music.youtube.com/watch?v=${id}&list=RD`, `https://youtube.com/shorts/${id}`, `これ！ https://m.youtube.com/watch?feature=share&v=${id}`])
      expect(youtubeLink(u), u).toBe(`https://www.youtube.com/watch?v=${id}`);
    expect(youtubeLink('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeLink('夏の曲つくって')).toBeNull();
  });
  it('one of a file, an image or a link', () => {
    expect(MoonCompassBody.safeParse({ url: 'https://youtu.be/dQw4w9WgXcQ' }).success).toBe(true);
    expect(MoonCompassBody.safeParse({ url: 'https://example.com/x' }).success).toBe(false);
    expect(MoonCompassBody.safeParse({}).success).toBe(false);
    expect(MoonCompassBody.safeParse({ fileId: '11111111-1111-4111-8111-111111111111', url: 'https://youtu.be/dQw4w9WgXcQ' }).success).toBe(false);
    expect(MoonCompassBody.safeParse({ image: { mime: 'image/png', data: 'AAAA' } }).success).toBe(true);
  });
  it('a read spell is completed with the kind’s own defaults (a song always has a genre, tempo, voice)', () => {
    const s = spellComplete('song', [t('夜のドライブ', 'theme', 'a night drive')]);
    expect(s.map((x) => x.group)).toEqual(expect.arrayContaining(['theme', 'genre', 'tempo', 'voice', 'instrument']));
    expect(SaveSpellBody.safeParse({ kind: 'chapter', tags: s }).success).toBe(false);
  });
});

describe('R12: bati’s tool lines in every style', () => {
  it('every line has all its styles, with the same placeholders and sentences', () => {
    const holes = (x: string) => [...x.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).filter((h) => h !== '{self}').sort();
    const sentences = (x: string) => (x.match(/[^！？。!?]+[！？。!?]*/g) ?? [x]).length;
    for (const line of [...SPELL_TOOL_LINE_TEXTS, ...Object.values(TOOL_STORY_LINES)]) {
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
