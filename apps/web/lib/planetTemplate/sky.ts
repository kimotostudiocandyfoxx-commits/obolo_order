import {
  DRIFT_MIN_SCORE,
  favouritesOf,
  pickTravel,
  rankContinents,
  toggleFavourite,
  workScore,
  type ContinentLandingView,
  type ContinentRule,
  type ContinentSkyView,
  type ContinentView,
  type FavouriteSlots,
  type HomePlanet,
  type HomeWork,
  type PlanetSongView,
  type WorkTags,
} from '@obolo/shared';
import type { Api } from '@/lib/api';
import { SAMPLE_LYRICS, SAMPLE_SONGS, sampleSongOf, sampleSongUrl, shipStandIn } from './mercury';

/**
 * 空から探す on Mercury (decisions M-R295〜M-R312; prototype expOpen / drawSky / openSearch / tripGo / expLand): じぶんの空
 * (your island and five favourite continents), 〔🔍 大陸をさがす〕, 〔✈ 旅〕, landing on a continent and the songs that
 * drifted there. The screens read a SkySource: the API (docs/planets.md 2-4 / 2-5) or, in the preview's sample mode,
 * the prototype's continents and songs kept in the browser.
 */

/** じぶんの空: the five islands' places (x, y, width — fractions) and your own island's (ESLOT / EME) */
export const SKY_SLOTS: readonly (readonly [number, number, number])[] = [
  [0.25, 0.2, 0.37],
  [0.76, 0.23, 0.37],
  [0.5, 0.37, 0.32],
  [0.21, 0.55, 0.42],
  [0.8, 0.57, 0.42],
];
export const SKY_ME = [0.5, 0.85, 0.56] as const;
/** 旅の空: six islands (TSLOT), no island of yours */
export const TRIP_SLOTS: readonly (readonly [number, number, number])[] = [
  [0.25, 0.2, 0.37],
  [0.76, 0.23, 0.37],
  [0.5, 0.39, 0.33],
  [0.21, 0.57, 0.42],
  [0.79, 0.6, 0.42],
  [0.5, 0.8, 0.5],
];
/** a pinch closer than this (ratio of the fingers' distance) goes up to the sky / back from a continent; wider comes home */
export const PINCH_IN = 0.72;
export const PINCH_OUT = 1.35;
export const pinchOf = (ratio: number): 'in' | 'out' | null => (ratio < PINCH_IN ? 'in' : ratio > PINCH_OUT ? 'out' : null);

/** a work on a continent */
export type LandWork = ContinentLandingView['works'][number];

export interface SkySource {
  sky(): Promise<ContinentSkyView>;
  /** ☆ / ★ one continent; 'FULL' when the five are taken and no slot was said */
  favourite(key: string, on: boolean, slot?: number): Promise<FavouriteSlots | 'FULL'>;
  search(q: string, tag?: string | null): Promise<ContinentView[]>;
  travel(): Promise<ContinentView[]>;
  land(key: string): Promise<ContinentLandingView>;
  visit(key: string): Promise<void>;
  /** a work's song (sound, jacket, lyrics) */
  song(w: HomeWork): Promise<PlanetSongView | null>;
  /** ☆ the work into Bluena / ♡ its maker / 🙈 / ⚑ */
  save(w: HomeWork, on: boolean): Promise<boolean>;
  oshi(personId: string, on: boolean): Promise<void>;
  hidePerson(personId: string): Promise<void>;
  report(w: HomeWork): Promise<void>;
}

// --- a song, from the API or the sample ----------------------------------------------------------------------------

/** the sample's song (its sound is the prototype's; lyrics for songs 1 and 3) */
export function sampleSong(w: HomeWork): PlanetSongView | null {
  const k = sampleSongOf(w.url);
  if (!k || !w.url) return null;
  return { kind: 'planet_post', id: w.id, title: w.title ?? SAMPLE_SONGS[k - 1], url: w.url, art: w.thumbUrl ?? null, seconds: null, titleVoice: null, lyrics: SAMPLE_LYRICS[k] ?? [] };
}

/** a work's song: the sample's, or the API's (a song with no lyrics, or an error, plays as it is: no lyrics) */
export async function songOf(api: Pick<Api, 'planetSong'> | null, w: HomeWork): Promise<PlanetSongView | null> {
  const s = sampleSong(w);
  if (s || w.demo || !api) return s;
  try {
    return await api.planetSong(w.id);
  } catch {
    return w.url ? { kind: 'planet_post', id: w.id, title: w.title ?? '', url: w.url, art: w.thumbUrl ?? null, seconds: w.seconds ?? null, titleVoice: null, lyrics: [] } : null;
  }
}

// --- the API --------------------------------------------------------------------------------------------------------

export function apiSky(api: Api, planet: HomePlanet): SkySource {
  return {
    sky: () => api.continentSky(planet),
    async favourite(key, on, slot) {
      try {
        return (await api.continentFavourite(planet, key, on, slot)).favourites;
      } catch (e) {
        if ((e as { code?: string }).code === 'FULL' || (e as { status?: number }).status === 409) return 'FULL';
        throw e;
      }
    },
    search: (q, tag) => api.continentSearch(planet, q, tag),
    travel: () => api.continentTravel(planet),
    land: (key) => api.continentLand(planet, key),
    visit: async (key) => void (await api.continentVisit(planet, key).catch(() => undefined)),
    song: (w) => songOf(api, w),
    save: async (w, on) => (await api.savePlanetWork(w.kind, w.id, on)).saved,
    oshi: async (id, on) => void (await api.setOshi(id, on)),
    hidePerson: async (id) => void (await api.blockPerson(id, true)),
    report: (w) => api.reportPlanetWork(w.kind, w.id, { reason: 'other' }),
  };
}

// --- the sample (the prototype's ten continents and their songs, kept in this browser) ------------------------------

const C = (key: string, name: string, tags: string[], rule: ContinentRule): ContinentView => ({
  key,
  planet: 'mercury',
  name,
  creator: null,
  rule,
  tags,
  pictures: { sky: `/planets/continents/mercury/${key}-sky.webp`, land: `/planets/continents/mercury/${key}-land.webp`, shore: `/planets/continents/mercury/${key}-shore.webp` },
});
/** the prototype's CONT.mercury / RULE.mercury (the same as the API's seed, migration 0056) */
export const SAMPLE_CONTINENTS: ContinentView[] = [
  C('edm', 'EDM大陸', ['EDM', 'ダンス', 'フェス', 'アゲ'], { g: ['EDM'], m: ['ダンス', 'フェス'], bpm: [118, 999] }),
  C('hiphop', 'ヒップホップ王国', ['ヒップホップ', 'ラップ', 'ストリート'], { g: ['ヒップホップ'], m: ['ストリート'] }),
  C('ballad', 'バラード島', ['バラード', 'しっとり', '泣ける'], { g: ['バラード'], m: ['しっとり'], bpm: [0, 90] }),
  C('rock', 'ロック火山', ['ロック', 'バンド', '熱い'], { g: ['ロック'], m: ['熱い'] }),
  C('chill', 'チルの環礁', ['チル', 'ローファイ', '作業用'], { g: ['ローファイ'], m: ['チル', '作業用'], bpm: [0, 100] }),
  C('citypop', 'シティポップ湾', ['シティポップ', '80s', '夜ドライブ'], { g: ['シティポップ'], m: ['夜ドライブ', '80s'] }),
  C('anison', 'アニソン諸島', ['アニソン', 'アニメ', 'アゲ'], { g: ['アニソン'], m: ['アニメ'] }),
  C('jazz', 'ジャズの入り江', ['ジャズ', 'おしゃれ', '夜'], { g: ['ジャズ'], m: ['おしゃれ'] }),
  C('matsuri', '夏祭りの島', ['夏', '和風', '祭り', 'アゲ'], { g: [], m: ['祭り', '和風', '夏'] }),
  C('rain', '雨音の島', ['雨', 'チル', '作業用', 'しっとり'], { g: [], m: ['雨'] }),
];
/** the prototype's GSONG: which sample song plays for a genre */
const GSONG: Record<string, number> = { EDM: 3, ヒップホップ: 2, バラード: 4, ロック: 5, ローファイ: 1, シティポップ: 1, アニソン: 3, ジャズ: 4, 'J-POP': 3 };
/** the prototype's WORKS.mercury: strangers' songs with their tags (title, by, genre, bpm, moods) */
const WORKS: [string, string, string, number, string[]][] = [
  ['ネオンダイブ', 'Rio', 'EDM', 128, ['アゲ', '夜']], ['光の洪水', 'YUZU', 'EDM', 126, ['フェス', 'アゲ']], ['BASS SKY', 'タク', 'EDM', 140, ['アゲ']], ['真夏のドロップ', 'REN', 'EDM', 124, ['夏', 'アゲ']], ['ミラーボール惑星', 'ショウ', 'EDM', 122, ['ダンス', '夜']],
  ['路地裏フロウ', 'kei', 'ヒップホップ', 92, ['ストリート', '夜']], ['夕焼けサイファー', 'ショウ', 'ヒップホップ', 88, ['ストリート']], ['BOOM BAP', 'タク', 'ヒップホップ', 90, ['ストリート']], ['放課後ライム', 'そら', 'ヒップホップ', 96, ['青春']], ['チルホップ日和', 'Nagi', 'ヒップホップ', 84, ['チル', '作業用']],
  ['月のうた', 'ことね', 'バラード', 72, ['しっとり', '泣ける', '夜']], ['灯台まで', 'みお', 'バラード', 76, ['しっとり']], ['やさしい夜', 'はるか', 'バラード', 68, ['泣ける', '夜']], ['さよならの駅', 'REN', 'バラード', 74, ['泣ける']], ['雨のあとで', 'みお', 'バラード', 70, ['雨', 'しっとり']],
  ['マグマハート', 'タク', 'ロック', 168, ['熱い']], ['火山ライブ', 'YUZU', 'ロック', 172, ['熱い', 'フェス']], ['走れ', 'そら', 'ロック', 180, ['青春', '熱い']], ['ガレージの夏', 'REN', 'ロック', 160, ['夏', '青春']], ['轟音ダイアリー', 'kei', 'ロック', 176, ['熱い']],
  ['ひるねの午後', 'ぽんず', 'ローファイ', 78, ['チル', '作業用']], ['ラグーン', 'Nagi', 'ローファイ', 82, ['チル']], ['ゆらゆら', 'はるか', 'ローファイ', 80, ['チル', '夏']], ['深夜2時の勉強', 'そら', 'ローファイ', 75, ['作業用', '夜']], ['しずくの部屋', 'みお', 'ローファイ', 72, ['雨', '作業用']],
  ['ミッドナイト湾岸', 'Nagi', 'シティポップ', 112, ['夜ドライブ', '夜', '80s']], ['シーサイドFM', 'はるか', 'シティポップ', 108, ['夏', '80s']], ['PLASTIC', 'Rio', 'シティポップ', 116, ['夜ドライブ', 'おしゃれ']], ['トワイライト通り', 'ことね', 'シティポップ', 104, ['夜', 'おしゃれ']],
  ['きらめき変身', 'ぽんず', 'アニソン', 150, ['アニメ', 'アゲ']], ['最終回のあと', 'ことね', 'アニソン', 138, ['アニメ', '泣ける']], ['START!!', 'YUZU', 'アニソン', 160, ['アニメ', 'アゲ', '青春']], ['魔法少女は眠らない', 'ぽんず', 'アニソン', 146, ['アニメ', '夜']],
  ['ブルーノート', 'kei', 'ジャズ', 96, ['おしゃれ', '夜']], ['月夜のサックス', 'ショウ', 'ジャズ', 88, ['おしゃれ', '夜']], ['Cafe 2AM', 'Nagi', 'ジャズ', 84, ['おしゃれ', '作業用']], ['雨のピアノ', 'みお', 'ジャズ', 80, ['雨', 'しっとり']],
  ['花火のあとで', 'ことね', 'J-POP', 118, ['夏', '祭り', '泣ける']], ['金魚すくい', 'はるか', 'J-POP', 124, ['夏', '祭り', '和風']], ['夏の終わり', 'そら', 'J-POP', 110, ['夏', 'しっとり']], ['盆おどりリミックス', 'タク', 'EDM', 130, ['祭り', '和風', 'アゲ']],
  ['雨やどり', 'みお', 'J-POP', 92, ['雨', 'しっとり']], ['傘の下', 'REN', 'バラード', 78, ['雨', '泣ける']], ['窓のしずく', 'ぽんず', 'ローファイ', 70, ['雨', 'チル']],
];

/** the sample's strangers' songs as the API would send them (their ships are the prototype's coloured ones) */
export function sampleSkyWorks(now = Date.now()): (HomeWork & { tags: WorkTags })[] {
  return WORKS.map(([title, by, genre, bpm, moods], i) => {
    const k = GSONG[genre] ?? 1;
    return {
      id: `sky-${i}`,
      kind: 'planet_post',
      author: { id: `sky-${by}`, name: by, pic: null, figure: shipStandIn(by) },
      rel: 'stranger',
      text: '',
      title,
      url: sampleSongUrl(k),
      thumbUrl: `/planets/sample/art-${(i % 5) + 1}.webp`,
      flownAt: new Date(now - i * 3_600_000).toISOString(),
      demo: true,
      tags: { main: genre, moods, bpm },
    };
  });
}

/** where the sample's works drift (the same workScore ≥ 2 as the API), best first, the same score at random */
export function sampleDrift(rule: ContinentRule, works: (HomeWork & { tags: WorkTags })[], rand: () => number = Math.random): LandWork[] {
  return works
    .map((w) => ({ w, s: workScore(w.tags, rule), r: rand() }))
    .filter((x) => x.s >= DRIFT_MIN_SCORE)
    .sort((a, b) => b.s - a.s || a.r - b.r)
    .map((x) => ({ ...x.w, score: x.s }));
}

const KEY = (planet: HomePlanet) => `obolo-planet-sky-${planet}`;
const store = {
  get(planet: HomePlanet): (string | null)[] | null {
    try {
      const v = JSON.parse(localStorage.getItem(KEY(planet)) ?? 'null');
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  },
  set(planet: HomePlanet, v: FavouriteSlots) {
    try {
      localStorage.setItem(KEY(planet), JSON.stringify(v));
    } catch {
      // a private window: the five last as long as the page
    }
  },
};

/** the preview's sky with nobody signed in: the prototype's continents and songs; your five kept in this browser */
export function sampleSky(planet: HomePlanet = 'mercury', rand: () => number = Math.random): SkySource {
  const cs = SAMPLE_CONTINENTS;
  let favs = favouritesOf(store.get(planet), cs);
  const seen = new Map<string, number>();
  const works = sampleSkyWorks();
  const keep = (f: FavouriteSlots) => {
    favs = f;
    store.set(planet, f);
    return f;
  };
  return {
    sky: async () => ({ planet, continents: cs, favourites: favs }),
    async favourite(key, on, slot) {
      const r = toggleFavourite(favs, key, on, slot);
      return r === 'FULL' ? r : keep(r);
    },
    search: async (q, tag) => rankContinents(cs, q, tag, rand).map((c) => ({ ...c, count: sampleDrift(c.rule, works, rand).length })),
    async travel() {
      const keys = pickTravel(
        cs.map((c) => c.key),
        seen,
        undefined,
        rand,
      );
      const t = Date.now();
      keys.forEach((k, i) => seen.set(k, t + i));
      return keys.map((k) => cs.find((c) => c.key === k)!);
    },
    async land(key) {
      const c = cs.find((x) => x.key === key) ?? cs[0];
      seen.set(key, Date.now());
      return { continent: c, young: false, works: sampleDrift(c.rule, works, rand) };
    },
    visit: async () => undefined,
    song: async (w) => sampleSong(w),
    save: async (_w, on) => on,
    oshi: async () => undefined,
    hidePerson: async () => undefined,
    report: async () => undefined,
  };
}
