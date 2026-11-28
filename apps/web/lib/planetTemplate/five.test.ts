import { castOfWork } from './castWorks';
import { HOME_PLANETS } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { templateConfig } from './config';
import { ALL_SEEN_FIVE, bookOpening, caseFace, FIVE, FIVE_HOLD_MS, FIVE_PLANETS, fiveTitleOf, fiveTitleStyle, FIVE_TITLE_DEFAULT, goodsKindOfWork, isAudioUrl, isFivePlanet, sampleArtIndex, SHELF_ASPECT, waveBars } from './five';
import { peopleOf } from './people';
import { templateSample } from './sample';

describe('05 the five planets on the common template', () => {
  it('each has its kind of work (the handoff table) and keeps the template: JSLOT drift, your place, ▶ from your place', () => {
    expect(Object.fromEntries(FIVE_PLANETS.map((p) => [p, FIVE[p].kind]))).toEqual({ mars: 'mv', venus: 'radio', uranus: 'goods', pluto: 'book', neptune: 'game' });
    expect(HOME_PLANETS.filter(isFivePlanet)).toEqual([...FIVE_PLANETS]);
    const places = { mars: [0.79, 0.54], venus: [0.72, 0.38], uranus: [0.8, 0.48], pluto: [0.68, 0.36], neptune: [0.84, 0.44] } as const;
    for (const p of FIVE_PLANETS) {
      const c = templateConfig(p);
      expect(c.motion.kind).toBe('drift');
      expect([c.place.x, c.place.y]).toEqual(places[p]);
      expect(c.openLook).toEqual({ scale: 1.65, blur: 5, bright: 0.55 });
      // you pop out of your place, the works come along the template's path, all seen → the prototype's line
      expect(c.play.dance).toEqual({ x: places[p][0], y: places[p][1] });
      expect(c.play.danceAs).toBe('dance');
      expect(c.play.doneLine).toBe(ALL_SEEN_FIVE);
      expect(c.play.path.sit).toEqual({ x: 0.18, y: 0.86, size: 1 });
    }
  });
  it('▶: Mars shows each MV to its end (05: 曲の長さ), the others 5.2 s (05: 5〜7 秒)', () => {
    expect(templateConfig('mars').play.untilDone).toBe(true);
    for (const p of ['venus', 'uranus', 'pluto', 'neptune'] as const) {
      expect(templateConfig(p).play.untilDone).toBe(false);
      expect(templateConfig(p).holdMs).toBe(FIVE_HOLD_MS);
    }
    expect(FIVE_HOLD_MS).toBeGreaterThanOrEqual(5000);
    expect(FIVE_HOLD_MS).toBeLessThanOrEqual(7000);
  });
  it('07: the five skies are on — their sea and your own island', () => {
    for (const p of FIVE_PLANETS) expect(templateConfig(p).sky).toEqual({ sea: `/planets/continents/${p}/sea.webp`, me: `/planets/continents/${p}/me.webp` });
  });
  it('the title: its own (never 「〜のアート」), else the first line; its font by title, then by its main tag', () => {
    expect(fiveTitleOf({ title: ' ネオンの夜 ', text: 'x' })).toBe('ネオンの夜');
    expect(fiveTitleOf({ title: '', text: '一行目\n二行目' })).toBe('一行目');
    expect(fiveTitleStyle('mv', '走れ').font).toBe('Reggae One');
    expect(fiveTitleStyle('book', 'どこかの本', { main: 'ホラー', moods: [] }).font).toBe('Yuji Syuku');
    expect(fiveTitleStyle('radio', 'なにか', { main: null, moods: [] })).toEqual(FIVE_TITLE_DEFAULT);
    expect(fiveTitleStyle('game', 'なにか').font).toBe('DotGothic16');
  });
  it('the viewers’ bits: an MV vs. the sample’s song, the book’s first lines, the game’s case face, the wave', () => {
    expect(isAudioUrl('/planets/sample/song-1.mp3')).toBe(true);
    expect(isAudioUrl('https://x/mv.mp4?x=1')).toBe(false);
    expect(bookOpening('むかしむかし。\n\nその光は歌う。\n三段目')).toEqual(['むかしむかし。', 'その光は歌う。']);
    expect(bookOpening('あ'.repeat(200), 50)).toEqual([`${'あ'.repeat(50)}…`]);
    expect(bookOpening('')).toEqual([]);
    const a = caseFace('g-1', 'ねこジャンプ');
    expect(a).toEqual(caseFace('g-1', 'ねこジャンプ'));
    expect(a.glyph).toBe('ね');
    expect(waveBars()).toHaveLength(15);
    expect(waveBars()[1]).toEqual({ h: 22, delay: 0.08 });
    expect(SHELF_ASPECT).toMatchObject({ radio: 1.55, book: 0.72, game: 0.72 });
  });
  it('the sample: ten of yours (the prototype’s five works per planet, never 「名前の〜」); around you the cast with their own one work each (M-R344), MIKIE⭐︎DRILL not there until she has works', () => {
    for (const p of FIVE_PLANETS) {
      const v = templateSample(p, Date.parse('2026-11-25T12:00:00Z'));
      expect(v.own).toHaveLength(10);
      for (const w of v.own) {
        expect(FIVE[p].titles).toContain(w.title);
        expect(w.title).not.toContain(`${w.author.name}の`);
      }
      const people = peopleOf(v);
      expect(people).toHaveLength(19);
      expect(people.map((x) => x.name)).not.toContain('MIKIE⭐︎DRILL');
      for (const x of people) {
        expect(x.works).toHaveLength(1);
        expect(castOfWork(x.works[0])?.cast.name).toBe(x.name);
        expect(FIVE[p].titles).not.toContain(x.works[0].title);
      }
    }
    // Mars: the cast's song under their film; Pluto: the book opens on its own first page
    const mars = templateSample('mars').around[0];
    expect(mars.author.name).toBe('KIMORIN⭐︎');
    expect(mars.url).toBe('/planets/cast/kimorin/song.mp3');
    expect(mars.title).toBe('ピンポン・ジーニアス');
    expect(templateSample('pluto').around[0].text).toBe('KIMORINは、なんでも せいこうする はつめいかです。');
  });
  it('story 2026-11-25 Uranus: each goods item on its own kind (its words, else its main tag, else a tote); the sample shows all six', () => {
    expect(goodsKindOfWork({ text: 'マグカップ' })).toBe('マグカップ');
    expect(goodsKindOfWork({ text: '', tags: { main: '缶バッジ', moods: [], bpm: null } })).toBe('缶バッジ');
    expect(goodsKindOfWork({ text: 'なにか' })).toBe('トート');
    // the preview's own shop shows all six kinds; its own game shelf has cases with a picture and with the neon face
    const kinds = new Set(templateSample('uranus').own.map((w) => goodsKindOfWork(w)));
    expect(kinds.size).toBe(6);
    const cases = templateSample('neptune').own;
    expect(cases.some((w) => w.thumbUrl)).toBe(true);
    expect(cases.some((w) => !w.thumbUrl)).toBe(true);
  });
});

describe('a long title wraps to two lines, then shrinks (story 2026-11-28)', () => {
  it('one line when it fits; two lines at the same size; smaller letters only past two lines — never under 13 px', async () => {
    const { titleFit, titleBase } = await import('./five');
    expect(titleBase(390)).toBeCloseTo(27.3);
    expect(titleFit('ネオンの夜', 390)).toEqual({ lines: 1, size: null });
    // 17 letters: two lines of nine at 27.3 px fit in 351 px
    expect(titleFit('サーぽんのサーモンまめちしきラジオ', 390)).toEqual({ lines: 2, size: null });
    const long = titleFit('あ'.repeat(40), 390);
    expect(long.lines).toBe(2);
    expect(long.size).toBeCloseTo(17.5);
    expect(20 * long.size!).toBeLessThanOrEqual(351);
    expect(titleFit('あ'.repeat(200), 390).size).toBe(13);
    // every cast title on every planet fits a 320 px phone in two lines at 13 px or more
    const { CAST_WORKS } = await import('./castWorks');
    for (const c of CAST_WORKS) for (const t of [c.song, c.radio, c.goods, c.game]) expect(Math.ceil([...t].length / 2) * (titleFit(t, 320).size ?? titleBase(320)), t).toBeLessThanOrEqual(320 * 0.9 + 0.01);
  });
});

