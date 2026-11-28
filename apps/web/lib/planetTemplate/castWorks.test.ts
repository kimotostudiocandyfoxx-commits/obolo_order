import { HOME_PLANETS, type PlanetHomeView } from '@obolo/shared';
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAST_WITHOUT_WORKS,
  CAST_WORKS,
  castAround,
  castAsset,
  castByKey,
  castByName,
  castGamePicture,
  castMv,
  castOfWork,
  castOn,
  castPicture,
  castReadsToEnd,
  castSong,
  castTapVoice,
  castWork,
  isCastPerson,
  rosterDayOfMember,
  withCast,
} from './castWorks';
import { GAME_KINDS } from './castGame';
import { peopleOf } from './people';
import { oshiOn, ROSTER_DAYS, SUSHIMON } from './roster';
import { emptyHome } from './sample';
import { songOf } from './sky';

const file = (url: string) => `public${url}`;

describe('M-R344: the cast’s works on all eight planets are the story team’s own (no sample works)', () => {
  it('the seven Sushimon, the eleven residents and KIMORIN⭐︎ — nineteen with works; MIKIE⭐︎DRILL has none yet', () => {
    expect(CAST_WORKS).toHaveLength(19);
    expect(CAST_WORKS.filter((c) => c.group === 'sushimon').map((c) => c.name)).toEqual(SUSHIMON.map((p) => p.name));
    expect(CAST_WORKS.filter((c) => c.group === 'resident').map((c) => c.name).sort()).toEqual(ROSTER_DAYS.flatMap((d) => d.residents.map((p) => p.name)).sort());
    expect(CAST_WORKS.filter((c) => c.group === 'dachi').map((c) => c.name)).toEqual(['KIMORIN⭐︎']);
    expect(CAST_WITHOUT_WORKS).toEqual(['MIKIE⭐︎DRILL']);
    expect(castByName('MIKIE⭐︎DRILL')).toBeUndefined();
    // the keys are the roster's picture keys (their figures on every planet are public/planets/sample/fig-<planet>-<key>)
    for (const p of [...SUSHIMON, ...ROSTER_DAYS.flatMap((d) => d.residents)]) expect(castByKey(p.pic)?.name, p.name).toBe(p.name);
  });

  it('the words are the story’s, character for character (spot checks against sushi.json / res.json / SAPON)', () => {
    const sapon = castByKey('sapon')!;
    expect(sapon.saturn).toBe('サーモン食べると若返り効果があるポン！');
    expect(sapon.art).toBe('お父さんだポン。');
    expect(sapon.song).toBe('サーモン・トランス');
    expect(sapon.radio).toBe('サーぽんのサーモンまめちしきラジオ');
    expect(sapon.goods).toBe('サーぽんのマグカップ');
    expect(sapon.book).toBe('サーぽんの オレンジいろ');
    expect(sapon.pages[5]).toBe('「ぼくの オレンジは、みんなと つながってる いろだポン！」 おしまい。');
    expect(sapon.game).toBe('ぷるぷるサーぽん');
    expect(castByKey('gari')!.pages[3]).toBe('お酢の おふろに はいったら、ほっぺみたいに ぽっと ピンクに なったんだよ♡');
    expect(castByKey('brother')!.saturn).toBe('たこ焼きは、外はカリッ、中はトロッ！　これが宇宙の真理だZE!!');
    expect(castByKey('monban')!.art).toBe('夜明けの…門だ…。');
    expect(castByKey('kimorin')!.pages).toEqual(['KIMORINは、なんでも せいこうする はつめいかです。', 'きょうの はつめいは、ぜんぶ ばくはつ しました。', '「これは、ばくはつする はつめい です。せいこうです。」 おしまい。']);
    expect(castByKey('kaiser')!.lyrics[0]).toEqual([1.5, 'ダ！']);
  });

  it('a Sushimon’s picture book has six pages, the others’ three; the seven Sushimon have seven different games', () => {
    for (const c of CAST_WORKS) {
      expect(c.pages, c.key).toHaveLength(c.group === 'sushimon' ? 6 : 3);
      expect(GAME_KINDS).toContain(c.gameKind);
      expect(c.lyrics.length).toBeGreaterThan(0);
      for (const t of [c.saturn, c.art, c.song, c.radio, c.goods, c.book, c.game, ...c.pages]) expect(t.trim()).not.toBe('');
    }
    expect(CAST_WORKS.filter((c) => c.group === 'sushimon').map((c) => c.gameKind)).toEqual(['wobble', 'puff', 'jump', 'spin', 'ink', 'scatter', 'snap']);
  });

  it('every sound and picture a work needs is in the build (public/planets/cast/<key>/), nothing empty', () => {
    for (const c of CAST_WORKS) {
      const files = ['saturn.mp3', 'dadv.mp3', 'stitle.mp3', 'goodsv.mp3', 'bookv.mp3', 'gamev.mp3', 'song.mp3', 'radiov.mp3', 'art.webp', 'goods.webp', ...c.pages.flatMap((_, i) => [`page${i + 1}.mp3`, `book-${i + 1}.webp`])];
      if (c.hasJacket) files.push('jacket.webp');
      if (c.hasRadioPic) files.push('radio.webp');
      if (c.hasMv) files.push('mv.mp4');
      for (const f of files) {
        const path = file(castAsset(c.key, f));
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size, path).toBeGreaterThan(1000);
      }
      expect(c.hasMv).toBe(c.group === 'sushimon');
      expect(existsSync(file(castGamePicture(c))), c.key).toBe(true);
    }
  });
});

describe('a cast member’s work on each planet, as a home shows it', () => {
  const at = '2026-11-28T00:00:00.000Z';
  it('one work per planet, each the planet’s kind, on their figure of that planet; never 〔推す〕〔外す〕〔通報〕 (demo)', () => {
    const c = castByKey('gari')!;
    for (const planet of HOME_PLANETS) {
      const w = castWork(planet, c, 'oshi', at);
      expect(w.id).toBe(`cast-gari-${planet}`);
      expect(castOfWork(w)).toEqual({ cast: c, planet });
      expect(w.demo).toBe(true);
      expect(w.author.id).toBe('cast-gari');
      expect(isCastPerson(w.author.id)).toBe(true);
      const fig = planet === 'saturn' ? w.author.ball : w.author.figure;
      expect(fig).toBe(`/planets/sample/fig-${planet}-gari.webp`);
      expect(existsSync(file(fig!))).toBe(true);
      if (w.url) expect(existsSync(file(w.url)), w.url).toBe(true);
      if (w.thumbUrl) expect(existsSync(file(w.thumbUrl)), w.thumbUrl).toBe(true);
    }
    expect(castWork('saturn', c, 'oshi', at)).toMatchObject({ kind: 'saturn_post', text: 'お寿司の合間に、ガリをひとくち。お口がリセットされるんだよ♡', url: '/planets/cast/gari/saturn.mp3' });
    expect(castWork('jupiter', c, 'oshi', at)).toMatchObject({ kind: 'jupiter_post', title: 'ガリみの、ふるさとだよ♡', url: '/planets/cast/gari/art.webp' });
    expect(castWork('mercury', c, 'oshi', at)).toMatchObject({ title: 'ガリガリ・ラブ', url: '/planets/cast/gari/song.mp3', thumbUrl: '/planets/cast/gari/jacket.webp' });
    expect(castWork('venus', c, 'oshi', at)).toMatchObject({ kind: 'radio_show', title: 'ガリみの、ガリまめちしきラジオ', url: '/planets/cast/gari/radiov.mp3', thumbUrl: '/planets/cast/gari/radio.webp' });
    expect(castWork('uranus', c, 'oshi', at)).toMatchObject({ kind: 'goods', title: 'ガリみ♡のアクリルキーホルダー', thumbUrl: '/planets/cast/gari/goods.webp' });
    expect(castWork('pluto', c, 'oshi', at)).toMatchObject({ kind: 'book', title: 'ガリみの ピンクの ひみつ', thumbUrl: '/planets/cast/gari/book-1.webp' });
    expect(castWork('neptune', c, 'oshi', at)).toMatchObject({ kind: 'game', title: 'ふわふわガリみ' });
    expect(isCastPerson('u-gari')).toBe(false);
    expect(isCastPerson('cast-nobody')).toBe(false);
    expect(castOfWork({ id: 'cast-gari-earth' })).toBeNull();
    expect(castOfWork({ id: 'mercury-s3' })).toBeNull();
  });

  it('the residents use their Jupiter art as the jacket and the radio picture, and have no film (their MV is the art moving)', () => {
    const k = castByKey('kaiser')!;
    expect(castPicture(k, 'mercury')).toBe('/planets/cast/kaiser/art.webp');
    expect(castPicture(k, 'venus')).toBe('/planets/cast/kaiser/art.webp');
    expect(castMv(k)).toBeNull();
    expect(castMv(castByKey('sapon')!)).toBe('/planets/cast/sapon/mv.mp4');
    expect(castGamePicture(k)).toBe('/planets/sample/chibi-kaiser.webp');
  });

  it('Neptune (story 2026-11-28): the seven Sushimon are tapped as their flat anime picture, everyone else as their chibi', () => {
    for (const c of CAST_WORKS) {
      const sushi = c.key === 'sapon' || ['gari', 'ebi', 'uni', 'ika', 'shari', 'kani'].includes(c.key);
      expect(castGamePicture(c), c.key).toBe(sushi ? `/planets/cast/${c.key}/game.webp` : `/planets/sample/chibi-${c.key}.webp`);
    }
  });

  it('▶ (story 2026-11-28): only a cast member’s picture book is read to its end; their other works keep the planet’s time', () => {
    expect(castReadsToEnd({ id: 'cast-gari-pluto' })).toBe(true);
    expect(castReadsToEnd({ id: 'cast-kimorin-pluto' })).toBe(true);
    for (const p of ['saturn', 'jupiter', 'venus', 'uranus', 'neptune'] as const) expect(castReadsToEnd({ id: `cast-gari-${p}` })).toBe(false);
    expect(castReadsToEnd({ id: 'pluto-s1' })).toBe(false);
    expect(castReadsToEnd(null)).toBe(false);
  });

  it('the voice that starts with the tap: Jupiter the title, Uranus the goods, Pluto the book’s title, Neptune the game’s name', () => {
    const c = castByKey('ebi')!;
    expect(castTapVoice(c, 'jupiter')).toBe('/planets/cast/ebi/dadv.mp3');
    expect(castTapVoice(c, 'uranus')).toBe('/planets/cast/ebi/goodsv.mp3');
    expect(castTapVoice(c, 'pluto')).toBe('/planets/cast/ebi/bookv.mp3');
    expect(castTapVoice(c, 'neptune')).toBe('/planets/cast/ebi/gamev.mp3');
    // Saturn's line, Mercury's song and title, Mars's song and Venus's show are the work's own sound
    for (const p of ['saturn', 'mercury', 'mars', 'venus'] as const) expect(castTapVoice(c, p)).toBeNull();
  });

  it('Mercury: the song the Mercury way — the sound, the jacket, the title in their voice, the words in time; nothing asked of the API', async () => {
    const w = castWork('mercury', castByKey('sapon')!, 'oshi', at);
    const s = castSong(w)!;
    expect(s).toMatchObject({ title: 'サーモン・トランス', url: '/planets/cast/sapon/song.mp3', art: '/planets/cast/sapon/jacket.webp', titleVoice: '/planets/cast/sapon/stitle.mp3' });
    expect(s.lyrics[0]).toEqual({ t: 3.48, end: 13.91, text: 'サーモン！' });
    expect(s.lyrics.at(-1)).toEqual({ t: 53.91, end: undefined, text: 'サーモン！' });
    const api = { planetSong: () => Promise.reject(new Error('never asked')) };
    expect(await songOf(api, w)).toEqual(s);
    expect(castSong({ id: 'x' })).toBeNull();
  });
});

describe('M-R341: who comes, by the member’s journey day', () => {
  it('the roster day: the residents of every day FINISHED; after the journey everyone', () => {
    expect(rosterDayOfMember(null)).toBe(0);
    expect(rosterDayOfMember({ journeyDay: 2, journeyCompletedAt: '2026-11-28T00:00:00Z' })).toBe(2);
    expect(rosterDayOfMember({ journeyDay: 3, journeyCompletedAt: null })).toBe(2);
    expect(rosterDayOfMember({ journeyDay: 3, journeyCompletedAt: '2026-11-28T00:00:00Z' })).toBe(3);
    expect(rosterDayOfMember({ journeyDay: 8, journeyCompletedAt: null })).toBe(7);
    expect(rosterDayOfMember({ journeyDay: 10, journeyCompletedAt: '2026-11-28T00:00:00Z' })).toBe(10);
    expect(rosterDayOfMember({ journeyDay: 11, journeyCompletedAt: null })).toBe(10);
    expect(rosterDayOfMember({ journeyDay: 12, journeyCompletedAt: null })).toBe(10);
  });

  it('before day 3 nobody; then KIMORIN⭐︎ (the only ダチ with works) and the day’s oshi: 9, 10, 11, 12, 15, 16, 17, 18', () => {
    expect(castOn({ day: 2, ordered: false })).toEqual([]);
    const counts = [3, 4, 5, 6, 7, 8, 9, 10].map((day) => castOn({ day, ordered: false }).filter((x) => x.rel === 'oshi').length);
    expect(counts).toEqual([9, 10, 11, 12, 15, 16, 17, 18]);
    for (const day of [3, 6, 10]) {
      const on = castOn({ day, ordered: false });
      expect(on[0]).toMatchObject({ rel: 'dachi', person: { name: 'KIMORIN⭐︎' } });
      expect(on.filter((x) => x.rel === 'dachi')).toHaveLength(1);
      expect(on.slice(1).map((x) => x.person.name)).toEqual(oshiOn(day).map((p) => p.name));
    }
    // an Obolo Order: MIKIE⭐︎DRILL is a ダチ, but she comes only once she has works — today the same nineteen
    expect(castOn({ day: 10, ordered: true }).map((x) => x.person.name)).toEqual(castOn({ day: 10, ordered: false }).map((x) => x.person.name));
  });

  it('the cast come to a member’s real home after their real ダチ・推し; an empty home gets the cast; the far scenery is untouched', () => {
    const now = Date.parse('2026-11-28T12:00:00Z');
    const real = (id: string, name: string, h: number, rel: 'dachi' | 'oshi'): PlanetHomeView['around'][number] => ({ id, kind: 'jupiter_post', author: { id: `u-${id}`, name }, rel, text: '', url: '/x.webp', flownAt: new Date(now - h * 3600_000).toISOString() });
    const stranger = { ...real('f1', 'だれか', 1, 'oshi'), rel: 'stranger' as const };
    const view: PlanetHomeView = { ...emptyHome('jupiter', 'me', 'ミナト', now), around: [real('a', 'さくら', 2, 'dachi'), real('b', 'サーぽん', 50, 'oshi')], far: [stranger] };
    const out = withCast(view, { day: 4, ordered: false }, now);
    expect(out.far).toEqual([stranger]);
    expect(out.own).toEqual([]);
    const people = peopleOf(out);
    // the real people first (a member who happens to be called サーぽん is a different person: ids differ), then KIMORIN⭐︎, then the oshi
    expect(people.slice(0, 4).map((p) => p.id)).toEqual(['u-a', 'u-b', 'cast-kimorin', `cast-${oshiOn(4)[0].pic}`]);
    expect(people).toHaveLength(2 + 1 + 10);
    expect(people.filter((p) => p.name === 'サーぽん')).toHaveLength(2);
    for (const p of people.slice(2)) expect(p.works).toHaveLength(1);
    // an empty home on day 3: only the cast
    const first = withCast(emptyHome('saturn', 'me', 'ミナト', now), { day: 3, ordered: false }, now);
    expect(peopleOf(first).map((p) => p.name)).toEqual(['KIMORIN⭐︎', ...oshiOn(3).map((p) => p.name)]);
    // before the first planet day: nobody (the view is returned as it is)
    const none = emptyHome('saturn', 'me', 'ミナト', now);
    expect(withCast(none, { day: 2, ordered: false }, now)).toBe(none);
    expect(castAround('pluto', { day: 10, ordered: true }, now)).toHaveLength(19);
  });
});
