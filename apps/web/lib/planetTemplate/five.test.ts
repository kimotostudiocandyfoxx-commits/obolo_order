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
  it('the sample: the prototype’s five works per planet, never 「名前の〜」, ten of yours and a shelf for every friend', () => {
    for (const p of FIVE_PLANETS) {
      const v = templateSample(p, Date.parse('2026-11-25T12:00:00Z'));
      expect(v.own).toHaveLength(10);
      for (const w of [...v.own, ...v.around]) {
        expect(FIVE[p].titles).toContain(w.title);
        expect(w.title).not.toContain(`${w.author.name}の`);
      }
      const people = peopleOf(v);
      expect(people).toHaveLength(10);
      for (const x of people) expect(x.works.length).toBeGreaterThanOrEqual(5);
    }
    const mars = templateSample('mars').around[0];
    expect(mars.url).toMatch(/song-\d\.mp3$/);
    expect(mars.thumbUrl).toBe(`/planets/sample/art-${sampleArtIndex(0, 'MIKIE⭐︎DRILL')}.webp`);
    expect(templateSample('pluto').around[0].text).toContain('むかしむかし、MIKIE⭐︎DRILLが');
  });
  it('story 2026-11-25 Uranus: each goods item on its own kind (its words, else its main tag, else a tote); the sample shows all six', () => {
    expect(goodsKindOfWork({ text: 'マグカップ' })).toBe('マグカップ');
    expect(goodsKindOfWork({ text: '', tags: { main: '缶バッジ', moods: [], bpm: null } })).toBe('缶バッジ');
    expect(goodsKindOfWork({ text: 'なにか' })).toBe('トート');
    const kinds = new Set(templateSample('uranus').around.map((w) => goodsKindOfWork(w)));
    expect(kinds.size).toBe(6);
    // Neptune's sample: some cases with a member's art, some with the neon face
    const cases = templateSample('neptune').around;
    expect(cases.some((w) => w.thumbUrl)).toBe(true);
    expect(cases.some((w) => !w.thumbUrl)).toBe(true);
  });
});
