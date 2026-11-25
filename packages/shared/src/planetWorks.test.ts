import { describe, expect, it } from 'vitest';
import {
  artTags,
  checkFavourites,
  continentSearchScore,
  continentsOf,
  effectiveVisibility,
  favouritesOf,
  figureFor,
  genericTags,
  pickTravel,
  PLANET_WORK_DEFAULT_VISIBILITY,
  planetGenreOf,
  rankContinents,
  songTags,
  toggleFavourite,
  workScore,
  type ContinentRule,
} from './planetWorks';

/** the prototype's Mercury rules (design/home/template.html RULE.mercury), the same as the 0056 seed */
const MERCURY: { key: string; rule: ContinentRule }[] = [
  { key: 'edm', rule: { g: ['EDM'], m: ['ダンス', 'フェス'], bpm: [118, 999] } },
  { key: 'hiphop', rule: { g: ['ヒップホップ'], m: ['ストリート'] } },
  { key: 'ballad', rule: { g: ['バラード'], m: ['しっとり'], bpm: [0, 90] } },
  { key: 'rock', rule: { g: ['ロック'], m: ['熱い'] } },
  { key: 'chill', rule: { g: ['ローファイ'], m: ['チル', '作業用'], bpm: [0, 100] } },
  { key: 'matsuri', rule: { g: [], m: ['祭り', '和風', '夏'] } },
  { key: 'rain', rule: { g: [], m: ['雨'] } },
];

describe('2-1 tags from the settings', () => {
  it('a song: the studio genre becomes the continents’ genre; moods from the mood and the spell; bpm kept', () => {
    const t = songTags({ genre: 'ディープハウス', mood: 'チル', bpm: 122, spell: [{ ja: '夏', en: 'summer', group: 'theme' }, { ja: 'ダンス', en: 'dance', group: 'genre' }] });
    expect(t.main).toBe('EDM');
    expect(t.bpm).toBe(122);
    expect(t.moods).toEqual(expect.arrayContaining(['チル', '夏']));
    expect(planetGenreOf('lo-fi')).toBe('ローファイ');
    expect(planetGenreOf('ポップ')).toBe('J-POP');
    expect(planetGenreOf('アニソン')).toBe('アニソン');
    expect(songTags({ genre: 'アニソン', mood: '元気', bpm: 160 }).moods).toEqual(expect.arrayContaining(['アニメ', 'アゲ']));
    expect(songTags(null)).toEqual({ main: null, moods: [], bpm: null });
  });
  it('an art: the spell’s style is the main class, colour / light / theme the moods', () => {
    const t = artTags([
      { ja: 'アニメ風', en: 'anime style', group: 'style' },
      { ja: 'やわらかい色', en: 'soft pastel colors', group: 'color' },
      { ja: 'ねこ', en: 'cat', group: 'theme' },
      { ja: '正方形', en: 'square', group: 'composition' },
    ]);
    expect(t.main).toBe('アニメ塗り');
    expect(t.moods).toEqual(expect.arrayContaining(['パステル', 'ねこ', 'どうぶつ']));
    expect(t.moods).not.toContain('正方形');
    expect(artTags(null, '水彩、夜').main).toBe('水彩');
    expect(artTags(null, '水彩、夜').moods).toContain('夜');
  });
  it('the other kinds have the same shape (values come later)', () => {
    expect(genericTags(null)).toEqual({ main: null, moods: [], bpm: null });
    expect(genericTags('MV', ['夜'])).toEqual({ main: 'MV', moods: ['夜'], bpm: null });
  });
});

describe('2-2 visibility', () => {
  it('the default is one constant (dachi until the client answers); held or unchecked works stay dachi', () => {
    expect(PLANET_WORK_DEFAULT_VISIBILITY).toBe('dachi');
    expect(effectiveVisibility(null, 'ok')).toBe('dachi');
    expect(effectiveVisibility(null, 'ok', 'public')).toBe('public');
    expect(effectiveVisibility('public', 'ok')).toBe('public');
    expect(effectiveVisibility('public', 'held')).toBe('dachi');
    expect(effectiveVisibility('public', 'unchecked')).toBe('dachi');
    expect(effectiveVisibility('dachi', 'ok', 'public')).toBe('dachi');
  });
});

describe('2-4 workScore (prototype)', () => {
  const rule = (k: string) => MERCURY.find((c) => c.key === k)!.rule;
  it('+3 main, +2 per mood, −2 out of the bpm range (only when something matched)', () => {
    expect(workScore({ main: 'EDM', moods: ['アゲ', '夜'], bpm: 128 }, rule('edm'))).toBe(3);
    expect(workScore({ main: 'EDM', moods: ['ダンス', 'フェス'], bpm: 128 }, rule('edm'))).toBe(7);
    // bpm penalty: an EDM song at 100 BPM
    expect(workScore({ main: 'EDM', moods: [], bpm: 100 }, rule('edm'))).toBe(1);
    // a ballad at 120 BPM: 3 + 2 − 2 = 3, still drifts
    expect(workScore({ main: 'バラード', moods: ['しっとり'], bpm: 120 }, rule('ballad'))).toBe(3);
    // nothing matched: no penalty below zero
    expect(workScore({ main: 'ロック', moods: [], bpm: 300 }, rule('ballad'))).toBe(0);
    // a mood alone (2) is enough to drift
    expect(workScore({ main: 'J-POP', moods: ['雨'], bpm: 92 }, rule('rain'))).toBe(2);
  });
  it('score ≥ 2 drifts; one work may reach several continents', () => {
    // prototype: 盆おどりリミックス (EDM 130, 祭り・和風・アゲ) → EDM大陸 and 夏祭りの島
    expect(continentsOf({ main: 'EDM', moods: ['祭り', '和風', 'アゲ'], bpm: 130 }, MERCURY)).toEqual(['edm', 'matsuri']);
    // しずくの部屋 (ローファイ 72, 雨・作業用) → チルの環礁 and 雨音の島
    expect(continentsOf({ main: 'ローファイ', moods: ['雨', '作業用'], bpm: 72 }, MERCURY)).toEqual(['chill', 'rain']);
    // the EDM song at 100 BPM (score 1) reaches nothing
    expect(continentsOf({ main: 'EDM', moods: [], bpm: 100 }, MERCURY)).toEqual([]);
  });
});

describe('2-4 search', () => {
  const cs = [
    { key: 'edm', name: 'EDM大陸', tags: ['EDM', 'ダンス', 'フェス', 'アゲ'], creator: null },
    { key: 'jazz', name: 'ジャズの入り江', tags: ['ジャズ', 'おしゃれ', '夜'], creator: { id: 'u', name: 'kei' } },
  ];
  it('name +3, tag +2, creator +1; a #tag chip must be on it', () => {
    expect(continentSearchScore(cs[0], 'edm')).toBe(5);
    expect(continentSearchScore(cs[1], 'kei')).toBe(1);
    expect(continentSearchScore(cs[1], 'ロック')).toBe(-1);
    expect(continentSearchScore(cs[1], '', '夜')).toBe(1);
    expect(continentSearchScore(cs[0], '', '夜')).toBe(-1);
    expect(rankContinents(cs, '').length).toBe(2);
    expect(rankContinents(cs, '#夜').map((c) => c.key)).toEqual(['jazz']);
  });
});

describe('2-5 favourites: five slots', () => {
  const cs = [
    { key: 'a', creatorId: null },
    { key: 'b', creatorId: null },
    { key: 'u1', creatorId: 'someone' },
    { key: 'c', creatorId: null },
    { key: 'd', creatorId: null },
    { key: 'e', creatorId: null },
    { key: 'f', creatorId: null },
  ];
  it('never chosen: the operator’s first five; a gone continent becomes an empty slot', () => {
    expect(favouritesOf(null, cs)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(favouritesOf(null, cs.slice(0, 3))).toEqual(['a', 'b', null, null, null]);
    expect(favouritesOf(['a', 'gone', null, 'u1', 'a'], cs)).toEqual(['a', null, null, 'u1', null]);
    expect(favouritesOf(['a'], cs)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('☆: into the first empty slot, FULL when five, a slot replaces, off empties', () => {
    expect(toggleFavourite(['a', null, 'c', null, null], 'f', true)).toEqual(['a', 'f', 'c', null, null]);
    expect(toggleFavourite(['a', 'b', 'c', 'd', 'e'], 'f', true)).toBe('FULL');
    expect(toggleFavourite(['a', 'b', 'c', 'd', 'e'], 'f', true, 2)).toEqual(['a', 'b', 'f', 'd', 'e']);
    expect(toggleFavourite(['a', 'b', 'c', 'd', 'e'], 'a', true, 4)).toEqual([null, 'b', 'c', 'd', 'a']);
    expect(toggleFavourite(['a', 'b', 'c', 'd', 'e'], 'b', true)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(toggleFavourite(['a', 'b', 'c', 'd', 'e'], 'c', false)).toEqual(['a', 'b', null, 'd', 'e']);
  });
  it('the whole five: known keys, none twice, exactly five', () => {
    const keys = new Set(cs.map((c) => c.key));
    expect(checkFavourites(['a', null, null, null, 'f'], keys)).toEqual(['a', null, null, null, 'f']);
    expect(checkFavourites(['a', 'a', null, null, null], keys)).toBe('TWICE');
    expect(checkFavourites(['zz', null, null, null, null], keys)).toBe('UNKNOWN');
    expect(checkFavourites(['a'], keys)).toBe('BAD_SLOTS');
  });
});

describe('2-5 〔旅〕: unseen first', () => {
  it('never-shown continents first, then the ones shown longest ago', () => {
    const seen = new Map([
      ['a', 300],
      ['b', 100],
      ['c', 200],
    ]);
    const r = pickTravel(['a', 'b', 'c', 'd', 'e'], seen, 4, () => 0.5);
    expect(r.slice(0, 2).sort()).toEqual(['d', 'e']);
    expect(r.slice(2)).toEqual(['b', 'c']);
    expect(pickTravel(['a', 'b'], new Map(), 6)).toHaveLength(2);
  });
});

describe('2-6 figureFor', () => {
  it('each planet’s riding figure from GET /me planetFigures', () => {
    const f = { saturnChibi: 'c.png', saturnBall: 'b.png', mercury: 'ship.png' };
    expect(figureFor(f, 'mercury')).toEqual({ planet: 'mercury', ride: 'ship', figure: 'mercury', url: 'ship.png' });
    expect(figureFor(f, 'saturn')).toEqual({ planet: 'saturn', ride: 'kororin', figure: 'saturnChibi', url: 'c.png', ball: 'b.png' });
    expect(figureFor(undefined, 'jupiter')).toMatchObject({ ride: 'butterfly', url: null });
  });
});
