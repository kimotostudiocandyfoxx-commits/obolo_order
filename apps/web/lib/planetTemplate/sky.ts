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
 * 空から探す (handoff 06; decisions M-R295〜M-R312; prototype expOpen / drawSky / openSearch / tripGo / expLand): じぶんの空
 * (your island and five favourite continents), 〔🔍 大陸をさがす〕, 〔✈ 旅〕, landing on a continent and the songs that
 * drifted there. The screens read a SkySource: the API (docs/planets.md 2-4 / 2-5) or, in the preview's sample mode,
 * the prototype's continents and works (Mercury's songs, Jupiter's arts, Saturn's voices) kept in the browser.
 */

/**
 * 〔🔍 大陸をさがす〕's words. No tags are ever shown (M-R310: the classification stays hidden): the genre chips are the
 * words alone (no 「#」), and under each continent only how many works drifted there, counted the planet's way.
 */
export const SEARCH_PLACEHOLDER = '大陸の名前・ジャンル';
export const SKY_COUNT_UNIT: Record<HomePlanet, string> = { mercury: '曲', jupiter: '作品', saturn: '人', mars: '作品', venus: '作品', uranus: '作品', pluto: '作品', neptune: '作品' };
export const countLine = (planet: HomePlanet, n: number | null | undefined) => `🌊 ${n ?? 0}${SKY_COUNT_UNIT[planet]}`;

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
/** the pinch's numbers and detection live in pinch.ts (the home and the sky share them) */
export { PINCH_IN, PINCH_OUT, pinchOf } from './pinch';

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

/** a sample continent: the operator's (creator null — the prototype's 「by Nagi」 are not members, M-R317) with its three pictures */
const continentOf =
  (planet: HomePlanet) =>
  (key: string, name: string, tags: string[], rule: ContinentRule): ContinentView => ({
    key,
    planet,
    name,
    creator: null,
    rule,
    tags,
    pictures: { sky: `/planets/continents/${planet}/${key}-sky.webp`, land: `/planets/continents/${planet}/${key}-land.webp`, shore: `/planets/continents/${planet}/${key}-shore.webp` },
  });
const C = continentOf('mercury');
const J = continentOf('jupiter');
const S = continentOf('saturn');
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
/** the prototype's CONT.jupiter / RULE.jupiter (the API's seed, migration 0056; pictures 0059) */
export const SAMPLE_GLADES: ContinentView[] = [
  J('watercolor', '水彩の森', ['水彩', 'やさしい', 'パステル'], { g: ['水彩'], m: ['やさしい', 'パステル'] }),
  J('anime', 'アニメ塗りの丘', ['アニメ塗り', 'キラキラ', '人物'], { g: ['アニメ塗り'], m: ['キラキラ', '人物'] }),
  J('pixel', 'ドット絵の村', ['ドット絵', 'レトロ', 'ゲーム'], { g: ['ドット絵'], m: ['ゲーム', 'レトロ'] }),
  J('oil', '油絵の金の森', ['油絵', 'あたたか', '風景'], { g: ['油絵'], m: ['あたたか'] }),
  J('yumekawa', 'ゆめかわの花畑', ['ゆめかわ', 'パステル', 'かわいい'], { g: ['ゆめかわ'], m: ['パステル', 'かわいい'] }),
  J('cats', 'ねこの森', ['ねこ', 'どうぶつ', 'かわいい'], { g: [], m: ['ねこ', 'どうぶつ'] }),
  J('nightview', '夜景の丘', ['夜', '夜景', 'つめたい'], { g: [], m: ['夜景', '夜'] }),
  J('wamodern', '和モダンの庭', ['和風', '和モダン', '花'], { g: ['和モダン'], m: ['和風'] }),
  J('retropop', 'レトロポップ広場', ['レトロ', 'ポップ', 'あざやか'], { g: ['レトロ', 'ポップ'], m: ['ポップ', 'あざやか'] }),
  J('mono', 'モノクロの森', ['モノクロ', '白黒', 'かっこいい'], { g: ['モノクロ'], m: ['白黒'] }),
];
/** the prototype's CONT.saturn / RULE.saturn (M-R316's plazas: the API's seed, migration 0057; pictures 0060) */
export const SAMPLE_PLAZAS: ContinentView[] = [
  S('chat', 'おしゃべり広場', ['雑談', 'ゆるい', '日常'], { g: ['雑談'], m: ['ゆるい', '日常'] }),
  S('koi', '恋バナの部屋', ['恋バナ', 'ドキドキ', '好きな人'], { g: ['恋バナ'], m: ['好きな人', 'ドキドキ'] }),
  S('oshi', '推し語りステージ', ['推し', 'アイドル', 'ライブ'], { g: ['推し'], m: ['アイドル', 'ライブ'] }),
  S('school', '放課後テラス', ['学校', '部活', 'テスト'], { g: ['学校'], m: ['部活', 'テスト'] }),
  S('night', '夜ふかしラウンジ', ['夜', '眠れない', '深夜'], { g: ['夜'], m: ['深夜', '眠れない'] }),
  S('game', 'ゲーム実況の島', ['ゲーム', '実況', '対戦'], { g: ['ゲーム'], m: ['対戦', '実況'] }),
  S('warai', 'お笑い劇場', ['お笑い', 'ボケ', 'ツッコミ'], { g: ['お笑い'], m: ['ボケ', 'ツッコミ'] }),
  S('anime', 'アニメ語りカフェ', ['アニメ', 'マンガ', '名シーン'], { g: ['アニメ'], m: ['名シーン', 'マンガ'] }),
  S('asa', 'おはよう広場', ['朝', 'おはよう', '元気'], { g: ['朝'], m: ['おはよう', '元気'] }),
  S('nemui', 'ねむねむ星', ['眠い', 'ゆるい', 'おやすみ'], { g: ['眠い'], m: ['おやすみ'] }),
];
/** the sample continents of a planet (the five have none yet: 06 leaves them to 05's worlds) */
export const sampleContinentsOf = (planet: HomePlanet): ContinentView[] => (planet === 'mercury' ? SAMPLE_CONTINENTS : planet === 'jupiter' ? SAMPLE_GLADES : planet === 'saturn' ? SAMPLE_PLAZAS : []);

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

/** the prototype's WORKS.jupiter: strangers' arts (title, by, style, moods) */
const ARTS: [string, string, string, string[]][] = [
  ['雨上がりの町', 'みお', '水彩', ['やさしい', '風景']], ['花びらの午後', 'はるか', '水彩', ['パステル', '花']], ['にじむ夕焼け', 'そら', '水彩', ['あたたか', '風景']], ['窓辺のねこ', 'みお', '水彩', ['ねこ', 'やさしい']],
  ['放課後の屋上', 'ショウ', 'アニメ塗り', ['人物', '青春']], ['星の魔法少女', 'ぽんず', 'アニメ塗り', ['キラキラ', '人物']], ['夏の約束', 'YUZU', 'アニメ塗り', ['人物', '夏']], ['桜の帰り道', 'ことね', 'アニメ塗り', ['花', '人物']],
  ['8bitの勇者', 'タク', 'ドット絵', ['ゲーム', 'レトロ']], ['ピクセル商店街', 'kei', 'ドット絵', ['レトロ', '夜']], ['ドットのねこ', 'ぽんず', 'ドット絵', ['ねこ', 'かわいい']],
  ['金色の森', 'REN', '油絵', ['あたたか', '風景']], ['ひまわりの丘', 'そら', '油絵', ['花', '夏']], ['港の朝', 'Nagi', '油絵', ['風景', 'あたたか']],
  ['ゆめかわユニコーン', 'ぽんず', 'ゆめかわ', ['パステル', 'かわいい']], ['わたあめの空', 'はるか', 'ゆめかわ', ['パステル', '空']], ['ハートの雲', 'YUZU', 'ゆめかわ', ['かわいい', '空']],
  ['こたつねこ', 'みお', 'アニメ塗り', ['ねこ', 'どうぶつ']], ['ねこの昼寝', 'はるか', '水彩', ['ねこ', 'どうぶつ']],
  ['ネオンの夜', 'REN', 'アニメ塗り', ['夜景', '夜']], ['屋上から見た街', 'Nagi', '油絵', ['夜景', 'つめたい']], ['真夜中の駅', 'kei', 'モノクロ', ['夜', 'つめたい']],
  ['鳥居と月', 'ことね', '和モダン', ['和風', '夜']], ['金魚と風鈴', 'はるか', '水彩', ['和風', '夏']], ['椿の庭', 'ことね', '和モダン', ['花', '和風']],
  ['レコード少女', 'YUZU', 'レトロ', ['ポップ', 'あざやか']], ['70sドライブ', 'Rio', 'レトロ', ['ポップ', '夏']], ['ソーダ水', 'そら', 'ポップ', ['あざやか', '夏']],
  ['影のダンス', 'kei', 'モノクロ', ['白黒', 'かっこいい']], ['墨の龍', 'タク', 'モノクロ', ['和風', 'かっこいい']], ['白い朝', 'REN', 'モノクロ', ['白黒', '風景']],
];
/** the prototype's WORKS.saturn: strangers' kororins (their words, by, topic, moods) */
const VOICES: [string, string, string, string[]][] = [
  ['今日なにしてた？', 'Rio', '雑談', ['ゆるい', '日常']], ['コンビニの新作、当たりだった', 'そら', '雑談', ['日常']], ['雨の日ってなんか好き', 'みお', '雑談', ['ゆるい']], ['最近ハマってること聞いて', 'YUZU', '雑談', ['日常']],
  ['好きな人と目が合った…！', 'はるか', '恋バナ', ['ドキドキ', '好きな人']], ['LINEの返事が来ない', 'ことね', '恋バナ', ['好きな人']], ['告白ってどうやるの', 'REN', '恋バナ', ['ドキドキ']], ['片思い3か月目', 'みお', '恋バナ', ['好きな人', '夜']],
  ['推しのライブ当たった！', 'YUZU', '推し', ['ライブ', 'アイドル']], ['推しの新曲、神すぎる', 'ぽんず', '推し', ['アイドル']], ['推しが尊い、以上', 'はるか', '推し', ['アイドル']], ['ペンライトの色、何にする？', 'ことね', '推し', ['ライブ']],
  ['部活おわった〜', 'そら', '学校', ['部活']], ['明日テストなの忘れてた', 'ショウ', '学校', ['テスト']], ['文化祭の準備たのしい', 'Nagi', '学校', ['日常']], ['先生の口ぐせがツボ', 'kei', '学校', ['お笑い']],
  ['眠れない人、いる？', 'REN', '夜', ['眠れない', '深夜']], ['深夜のラーメンは正義', 'タク', '夜', ['深夜']], ['星がきれいだよ', 'Nagi', '夜', ['夜']], ['2時なのに目が冴えてる', 'kei', '夜', ['眠れない']],
  ['ランクやっと上がった！', 'タク', 'ゲーム', ['対戦']], ['このボス強すぎない？', 'ショウ', 'ゲーム', ['実況']], ['一緒にやる人募集〜', 'Rio', 'ゲーム', ['対戦']],
  ['今日いちばん笑ったこと', 'ショウ', 'お笑い', ['ボケ']], ['ツッコミ待ちです', 'kei', 'お笑い', ['ツッコミ', 'ボケ']], ['犬が靴下を盗んでいった', 'そら', 'お笑い', ['日常', 'ボケ']],
  ['最終回で泣いた', 'ぽんず', 'アニメ', ['名シーン']], ['今期いちばん好きなアニメ', 'ことね', 'アニメ', ['マンガ']], ['あのシーン、何回も見ちゃう', 'YUZU', 'アニメ', ['名シーン']],
  ['おはよう！今日もがんばろ', 'はるか', '朝', ['おはよう', '元気']], ['朝ごはん、パン派？ごはん派？', 'Rio', '朝', ['おはよう']], ['今日は晴れ！', 'そら', '朝', ['元気']],
  ['もう眠い…おやすみ', 'みお', '眠い', ['おやすみ', 'ゆるい']], ['布団から出られない', 'kei', '眠い', ['ゆるい']], ['いい夢みてね', 'はるか', '眠い', ['おやすみ']],
];
/** a sample stranger's look: one of the prototype's five cast pictures, the same for the same name */
const LOOKS = ['mikie', 'kimorin', 'monban', 'brother', 'sister'] as const;
export const sampleLookOf = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return LOOKS[h % LOOKS.length];
};

/** the sample's strangers' works on a planet as the API would send them (Mercury's songs, Jupiter's arts, Saturn's voices) */
export function sampleWorksOf(planet: HomePlanet, now = Date.now()): (HomeWork & { tags: WorkTags })[] {
  const at = (i: number) => new Date(now - i * 3_600_000).toISOString();
  if (planet === 'jupiter')
    return ARTS.map(([title, by, style, moods], i) => ({
      id: `sky-j${i}`,
      kind: 'jupiter_post',
      author: { id: `sky-${by}`, name: by, pic: null, figure: `/planets/sample/fig-jupiter-${sampleLookOf(by)}.webp` },
      rel: 'stranger',
      text: '',
      title,
      url: `/planets/sample/art-${(i % 5) + 1}.webp`,
      thumbUrl: `/planets/sample/art-${(i % 5) + 1}.webp`,
      flownAt: at(i),
      demo: true,
      tags: { main: style, moods },
    }));
  if (planet === 'saturn')
    return VOICES.map(([words, by, topic, moods], i) => ({
      id: `sky-s${i}`,
      kind: 'saturn_post',
      author: { id: `sky-${by}`, name: by, pic: null, figure: `/planets/sample/chibi-${sampleLookOf(by)}.webp`, ball: `/planets/sample/fig-saturn-${sampleLookOf(by)}.webp` },
      rel: 'stranger',
      text: words,
      url: null,
      thumbUrl: null,
      flownAt: at(i),
      demo: true,
      tags: { main: topic, moods },
    }));
  if (planet === 'mercury') return sampleSkyWorks(now);
  return [];
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
  const cs = sampleContinentsOf(planet);
  let favs = favouritesOf(store.get(planet), cs);
  const seen = new Map<string, number>();
  const works = sampleWorksOf(planet);
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
      const c = cs.find((x) => x.key === key);
      if (!c) throw new Error('Unknown continent');
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
