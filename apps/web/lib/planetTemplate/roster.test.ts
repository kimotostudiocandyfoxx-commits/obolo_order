import { HOME_PLANETS } from '@obolo/shared';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { peopleOf } from './people';
import { dachiOf, HOME_CAST, oshiCount, oshiOn, residentsBy, ROSTER_DAYS, rosterDayOf, SUSHIMON } from './roster';
import { sampleCast, templateSample } from './sample';

describe('M-R341: the oshi grow by the residents of each planet visited (handoff planets-08, chapter 2)', () => {
  it('the table: 9 on day 3 … 18 on day 10; none before Saturn; all eighteen after the journey', () => {
    expect([3, 4, 5, 6, 7, 8, 9, 10].map(oshiCount)).toEqual([9, 10, 11, 12, 15, 16, 17, 18]);
    expect(oshiOn(2)).toEqual([]);
    expect(oshiCount(11)).toBe(18);
    expect(oshiCount(12)).toBe(18);
    expect(SUSHIMON.map((p) => p.name)).toEqual(['サーぽん', 'ガリみ♡', 'えびすけ', 'ウニまる', 'いかチョロ', 'しゃりお', 'かにぶぅ']);
  });
  it('the planets in the visiting order, each with its residents', () => {
    expect(ROSTER_DAYS.map((d) => `${d.day}:${d.planet}`)).toEqual(['3:saturn', '4:jupiter', '5:mercury', '6:mars', '7:venus', '8:pluto', '9:neptune', '10:uranus']);
    expect(ROSTER_DAYS.map((d) => d.residents.map((p) => p.name))).toEqual([['たこ焼きブラザー', 'たこ焼きシスター'], ['大根カイザー'], ['フリージー'], ['ヒポキン'], ['ボスG', 'ロングG', 'ハットG'], ['クロコパトラ'], ['オニモンク'], ['MONBAN']]);
    expect(rosterDayOf('pluto')).toBe(8);
    expect(rosterDayOf('uranus')).toBe(10);
    expect(residentsBy(8).map((p) => p.name).slice(-1)).toEqual(['クロコパトラ']);
  });
  it('who was just met comes first (three of them), then the Sushimon, then the residents met earlier; nobody twice', () => {
    expect(oshiOn(8).slice(0, 3).map((p) => p.name)).toEqual(['クロコパトラ', 'ハットG', 'ロングG']);
    expect(oshiOn(10)[0].name).toBe('MONBAN');
    expect(oshiOn(3).map((p) => p.name)).toEqual(['たこ焼きシスター', 'たこ焼きブラザー', ...SUSHIMON.map((p) => p.name)]);
    for (let d = 3; d <= 10; d++) expect(new Set(oshiOn(d).map((p) => p.name)).size).toBe(oshiCount(d));
  });
  it('ダチ: KIMORIN⭐︎ only, and MIKIE⭐︎DRILL once an Obolo Order', () => {
    expect(dachiOf(false).map((p) => p.name)).toEqual(['KIMORIN⭐︎']);
    expect(dachiOf(true).map((p) => p.name)).toEqual(['KIMORIN⭐︎', 'MIKIE⭐︎DRILL']);
  });
  it('every oshi has a figure for every planet and a chibi (the story team’s art, cut)', () => {
    for (const p of oshiOn(10)) {
      expect(existsSync(`public/planets/sample/chibi-${p.pic}.webp`), `chibi-${p.pic}`).toBe(true);
      for (const planet of HOME_PLANETS) expect(existsSync(`public/planets/sample/fig-${planet}-${p.pic}.webp`), `fig-${planet}-${p.pic}`).toBe(true);
    }
  });
});

describe('M-R342: only the story’s cast is on a home', () => {
  it('the sample home: KIMORIN⭐︎ and the eighteen oshi — the sample people of before are gone, and MIKIE⭐︎DRILL waits until she has works (M-R344)', () => {
    for (const planet of HOME_PLANETS) {
      const names = peopleOf(templateSample(planet)).map((p) => p.name);
      expect(names).toHaveLength(19);
      expect(names).not.toContain('MIKIE⭐︎DRILL');
      for (const n of names) expect(HOME_CAST.has(n), n).toBe(true);
      for (const gone of ['ユウキ', 'nana', 'れい', 'ショウ', 'ミオ', 'みお', 'はるか', 'ぽんず', 'kei']) expect(names).not.toContain(gone);
    }
  });
  it('a day’s sample: that day’s oshi and KIMORIN⭐︎ (MIKIE⭐︎DRILL only for an Obolo Order)', () => {
    expect(sampleCast({ day: 3 }).map(([n]) => n)).toEqual(['KIMORIN⭐︎', ...oshiOn(3).map((p) => p.name)]);
    expect(sampleCast({ day: 8 })).toHaveLength(17);
    expect(sampleCast({ day: 8 }).filter(([, , rel]) => rel === 'dachi').map(([n]) => n)).toEqual(['KIMORIN⭐︎']);
    expect(sampleCast().filter(([, , rel]) => rel === 'dachi').map(([n]) => n)).toEqual(['MIKIE⭐︎DRILL', 'KIMORIN⭐︎']);
    expect(sampleCast().filter(([, , rel]) => rel === 'oshi')).toHaveLength(18);
    const pluto = peopleOf(templateSample('pluto', Date.now(), { day: 8 }));
    expect(pluto.find((p) => p.name === 'クロコパトラ')?.figure).toBe('/planets/sample/fig-pluto-croco.webp');
    expect(pluto.some((p) => p.name === 'オニモンク')).toBe(false);
  });
});
