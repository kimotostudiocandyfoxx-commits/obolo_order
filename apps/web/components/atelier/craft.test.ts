import { CRAFT_LINES, MOON_LINES, type BookView } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { craftAnswer, craftBegin, craftConfirmLine, craftDoneLines, craftSpellKind, wantsNew } from './craft';
import { contentOf, detect, isBare } from './intent';
import { FLIES, type Work } from './work';

const book = (n: number, done = false): BookView => ({ id: 'b1', title: '森の鈴', tags: [], cover: null, chapters: Array.from({ length: n }, (_, i) => ({ n: i + 1, title: 't', text: 'x', tags: [], at: '' })), done, home: 'pluto', createdAt: '', updatedAt: '' });

describe('本・ゲーム in the Moon chat', () => {
  it('「本を作りたい」「小説を書いて」 is a book, 「ゲーム作って」 a game; 日本 is not', () => {
    expect(detect('本を作りたい', false)).toMatchObject({ kind: 'make', what: 'novel' });
    expect(detect('小説を書いて', false)).toMatchObject({ kind: 'make', what: 'novel' });
    expect(detect('猫のお話を作って', false)).toMatchObject({ kind: 'make', what: 'novel' });
    expect(detect('ゲーム作って', false)).toMatchObject({ kind: 'make', what: 'game' });
    expect(detect('日本の首都はどこ？', false)).toMatchObject({ what: 'lookup' });
    expect(isBare(contentOf('ゲームを作って'))).toBe(true);
    expect(isBare(contentOf('本を作りたい'))).toBe(true);
  });
  it('the questions: all three for a bare ask, fewer when the words said some (never fewer than two)', () => {
    const a = craftBegin('novel', '', true);
    expect(a.left.map((q) => q.group)).toEqual(['world', 'hero', 'mood']);
    const b = craftBegin('game', '猫がよけるゲーム', false);
    expect(b.answers).toEqual([{ said: '猫がよけるゲーム' }]);
    expect(b.left.length).toBeGreaterThanOrEqual(2);
    const c = craftAnswer(a, '魔法の森');
    expect(c.answers).toEqual([{ group: 'world', said: '魔法の森' }]);
    expect(c.left).toHaveLength(2);
  });
  it('a book already there: the next words are a chapter spell; its own question', () => {
    const w: Work = { id: 'w', kind: 'novel', prompt: '', status: 'ready', ref: { bookId: 'b1' }, book: book(1) };
    expect(craftSpellKind('novel')).toBe('novel');
    expect(craftSpellKind('novel', w)).toBe('chapter');
    expect(craftSpellKind('game', w)).toBe('game');
    expect(craftConfirmLine('novel', w)).toBe(CRAFT_LINES.chapterSpell);
    expect(craftConfirmLine('game')).toBe(MOON_LINES.confirm);
  });
  it('after a chapter {bati} asks what happens next (the first time: where the book is); the end; a game', () => {
    const w = (n: number, done = false): Work => ({ id: 'w', kind: 'novel', prompt: '', status: 'ready', book: book(n, done) });
    expect(craftDoneLines(w(1)).map((l) => l.text)).toEqual([CRAFT_LINES.bookKept, CRAFT_LINES.chapterDone]);
    expect(craftDoneLines(w(2))).toEqual([{ text: CRAFT_LINES.chapterDone, vars: { n: 2 } }]);
    expect(craftDoneLines(w(4, true))).toEqual([{ text: CRAFT_LINES.bookEnd }]);
    expect(craftDoneLines({ id: 'g', kind: 'game', prompt: '', status: 'ready' })).toEqual([{ text: CRAFT_LINES.gameDone }]);
    expect(wantsNew('新しい本を作って')).toBe(true);
    expect(wantsNew('もっと難しく')).toBe(false);
  });
  it('home planets from the one shared map; books and games keep theirs but are not flown yet', () => {
    expect(FLIES.novel).toBeUndefined();
    expect(FLIES.game).toBeUndefined();
    expect(FLIES.song).toBe('mercury');
  });
});

describe('the reader', () => {
  it('numbers chapters in kanji', async () => {
    const { kanjiNum } = await import('./BookRead');
    expect([1, 7, 10, 11, 20, 30].map(kanjiNum)).toEqual(['一', '七', '十', '十一', '二十', '三十']);
  });
});
