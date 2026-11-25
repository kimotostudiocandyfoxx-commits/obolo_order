import { describe, expect, it } from 'vitest';
import type { Work } from '@/components/atelier/work';
import { choiceOf, detectOpen, filterShelf, kindsPresent, nearness, pickOpen, rowActions, type Shelved } from './find';

const w = (kind: Work['kind'], title: string, extra: Partial<Work> = {}): Work => ({ id: `${kind}-${title}`, kind, prompt: '', status: 'ready', title, ...extra });
const at = (d: number) => new Date(Date.UTC(2026, 10, d, 9)).toISOString();
const S = (work: Work, d: number, stars = 0): Shelved => ({ title: work.title ?? '', createdAt: at(d), stars, work });

const items: Shelved[] = [
  S(w('song', '夏の海のうた', { spell: [{ ja: 'サマーポップ', en: 'summer pop', group: 'genre' }] as Work['spell'] }), 20, 1),
  S(w('song', '夜のドライブ'), 22),
  S(w('art', '空飛ぶクジラ', { image: 'x.png' }), 21, 2),
  S(w('video', '夏の海のうた（MV）', { video: 'v.mp4' }), 23),
  S(w('novel', '星の図書館'), 19),
  S(w('game', 'ネコジャンプ'), 18),
  S(w('radio', 'よるのラジオ', { audio: 'r.mp3' }), 17),
];

describe('R16: a tap on a Bluena row opens its viewer, never sends it', () => {
  it('tap = view everywhere; 〔送る〕 only in a talk', () => {
    expect(rowActions(false)).toEqual({ tap: 'view', send: false });
    expect(rowActions(true)).toEqual({ tap: 'view', send: true });
  });
});

describe('R16: the kind strip, ★ and the search box', () => {
  it('shows すべて and only the kinds there are (写真 with a 📎 picture)', () => {
    expect(kindsPresent(items)).toEqual(['all', 'song', 'art', 'video', 'book', 'game']);
    expect(kindsPresent(items.slice(0, 2), 3)).toEqual(['all', 'song', 'photo']);
    expect(kindsPresent([])).toEqual(['all']);
  });
  it('filters by kind and ★', () => {
    expect(filterShelf(items, { kind: 'song' }).map((x) => x.title)).toEqual(['夏の海のうた', '夜のドライブ']);
    expect(filterShelf(items, { star: true }).map((x) => x.title)).toEqual(['夏の海のうた', '空飛ぶクジラ']);
    expect(filterShelf(items, { kind: 'book' }).map((x) => x.work.kind)).toEqual(['novel']);
    // コロリン・ラジオ are under すべて only
    expect(filterShelf(items, { kind: 'all' })).toHaveLength(items.length);
  });
  it('searches the title and the spell words (kana / width folded)', () => {
    expect(filterShelf(items, { q: 'クジラ' }).map((x) => x.title)).toEqual(['空飛ぶクジラ']);
    expect(filterShelf(items, { q: 'くじら' }).map((x) => x.title)).toEqual(['空飛ぶクジラ']);
    expect(filterShelf(items, { q: 'サマー' }).map((x) => x.title)).toEqual(['夏の海のうた']);
    expect(filterShelf(items, { q: '夏の海', kind: 'video' }).map((x) => x.work.kind)).toEqual(['video']);
    expect(filterShelf(items, { q: 'ぜんぜんない' })).toEqual([]);
  });
});

describe("R16: {bati} opens a work by words", () => {
  it('reads the ask: its kind, the name, whether it says it is yours', () => {
    expect(detectOpen('ブルーナの夏の海の曲流して')).toEqual({ what: 'song', words: '夏の海', strong: true, verb: 'play' });
    expect(detectOpen('この前のクジラの絵見せて')).toMatchObject({ what: 'art', words: 'クジラ', strong: true, verb: 'see' });
    expect(detectOpen('星の図書館の本読みたい')).toMatchObject({ what: 'book', words: '星の図書館', verb: 'read' });
    expect(detectOpen('ネコジャンプで遊びたい')).toMatchObject({ what: 'game', verb: 'game' });
    expect(detectOpen('この前の絵見せて')).toMatchObject({ what: 'art', words: '', strong: true });
  });
  it('leaves the other asks alone (a picture search, making, plain talk)', () => {
    expect(detectOpen('パンダの絵見せて')).toBeNull();
    expect(detectOpen('夏の曲作って流して')).toBeNull();
    expect(detectOpen('こんにちは')).toBeNull();
    expect(detectOpen('流して')).toBeNull();
  });
  it('picks the best match by title / spell (fuzzy); two as near: the choice', () => {
    const p = pickOpen(items, detectOpen('ブルーナの夏の海の曲流して')!);
    expect('hit' in p && p.hit.title).toBe('夏の海のうた');
    // a near spelling
    const q = pickOpen(items, detectOpen('夜ドライブの歌ながして')!);
    expect('hit' in q && q.hit.title).toBe('夜のドライブ');
    // the spell's words find it too
    const r = pickOpen(items, detectOpen('ブルーナのサマーポップ流して')!);
    expect('hit' in r && r.hit.title).toBe('夏の海のうた');
    // the newest of its kind when no name is said
    const n = pickOpen(items, detectOpen('この前の絵見せて')!);
    expect('hit' in n && n.hit.title).toBe('空飛ぶクジラ');
    expect(pickOpen(items, detectOpen('ブルーナのカレーの歌流して')!)).toEqual({ none: true });
    const two = [...items, S(w('song', '夏の海のうた', { id: 'song-2' }), 24)];
    const c = pickOpen(two, detectOpen('ブルーナの夏の海の曲流して')!);
    expect('choose' in c && c.choose.map((x) => x.createdAt)).toEqual([at(24), at(20)]);
    if ('choose' in c) {
      expect(choiceOf(c.choose, '夏の海のうた')).toBe(c.choose[0]);
      expect(choiceOf(c.choose, '2')).toBe(c.choose[1]);
    }
  });
  it('nearness: in it = 1, a near spelling partly', () => {
    expect(nearness('クジラ', '空飛ぶクジラ')).toBe(1);
    expect(nearness('よるどらいぶ', '夜のドライブ')).toBeGreaterThan(0.3);
    expect(nearness('カレー', '空飛ぶクジラ')).toBe(0);
  });
});
