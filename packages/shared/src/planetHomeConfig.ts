import type { PlanetWorkKind } from './flying';

/**
 * 星のホーム: the one per-planet config (M-R258 §2 table; Saturn M-R257; Uranus / Pluto / Neptune M-R188・M-R189・M-R191).
 * Everything that changes from planet to planet lives here as data — the words, which store its works come from, the
 * shape of the things that float around your place and how they leave after 88 hours. The art itself (backdrop, your
 * place, the floating things) is plugged in by the web app by `art` key, so the look can be swapped without touching
 * the rules (apps/web/components/planetHome).
 *
 * `store: null` = the planet has no store of works yet (Uranus goods, Pluto stories, Neptune games): its home opens with
 * your place and an empty sky, and the feed API answers with nothing until a store is wired in.
 */
export const HOME_PLANETS = ['saturn', 'jupiter', 'mercury', 'mars', 'venus', 'uranus', 'pluto', 'neptune'] as const;
export type HomePlanet = (typeof HOME_PLANETS)[number];
export const isHomePlanet = (v: string): v is HomePlanet => (HOME_PLANETS as readonly string[]).includes(v);

/** how a dachi's / 推し's work leaves after 88 hours (M-R258 §3) */
export type HomeLeave = 'up-to-sky' | 'fly-away' | 'sail-off' | 'ufo-up' | 'fade' | 'dim';
/** what a work does when tapped in front of you */
export type HomeOpen = 'sing' | 'view' | 'play-audio' | 'play-video' | 'read';

export interface PlanetHomeConfig {
  planet: HomePlanet;
  /** the planet's name on screen (Japanese, big) and in English (small, above it) */
  name: string;
  en: string;
  /** the planet's colour (buttons, the inside's light, the emphasis in the line) */
  accent: string;
  /** the one big button at the bottom (M-R263: Saturn 〔▶ 全部流す〕, every other planet 〔中に入る〕; nothing else — making
   * and flying are on the Moon) */
  cta: string;
  /** what the sheet's button does to a work: 聞く / 見る / 読む / 遊ぶ */
  verb: string;
  /** the Moon atelier's kind for this planet's works (M-R263: no 〔＋ 飛ばす〕 on the planets any more) */
  make?: 'voice' | 'art' | 'song' | 'video' | 'radio';
  /** the store the works come from; null = not wired yet */
  store: PlanetWorkKind | null;
  /** for planet_posts (Mercury / Mars share one table) */
  storePlanet?: 'mercury' | 'mars';
  /** what a work is called on this planet */
  work: string;
  /** your own place (name plate on it) */
  place: string;
  /** inside your place (your works, forever) */
  inside: string;
  /** a dachi's / 推し's work, as it floats around your place */
  around: string;
  /** strangers' works in the far scenery; null = no far scenery on this planet (Saturn) */
  far: string | null;
  leave: HomeLeave;
  open: HomeOpen;
  /** M-R259 (Saturn): the new works roll about on your place to be touched (poke / flick / throw); heard ones go into
   * the grooves, and the big button plays the grooves in one go */
  roll?: boolean;
  /** tapping your place: 'enter' goes inside; 'play' starts it in place (Saturn's play button on the rim) */
  placeTap: 'enter' | 'play';
  /** the explainer strip at the top (shown 4.5 s when the home opens, then folded; 〔？〕 toggles it); **…** = emphasis */
  line: string;
  /** {bati}'s line after 〔○○へ飛ばす〕 ({neo} = the member's name) */
  flown: string;
  /** the planet's art (design/home, the anime version chosen in M-R259: each planet in its own style): the backdrop
   * with your place painted in, and the sprite that floats around it (a dachi's / 推し's face goes on top of it) */
  art: { backdrop: string; sprite: string };
  /** the residents standing beside your place (each says one line when tapped); see HOME_RESIDENTS */
  residents: HomeResident[];
  /** M-R258 §5: the day it goes out (Saturn first) */
  releaseOrder: number;
}

export interface HomeResident {
  id: string;
  name: string;
  /** said when tapped (design/home/template.html, verbatim) */
  line: string;
  /** which side of your place they stand on */
  side: 'l' | 'r';
  art: string;
}

/**
 * The residents (design/home: res-<planet>-<name>; served as res-<name> so a move needs no new file). Which planet each one lives on is decided here only — サーモン,
 * ラジカセの侍 and リボンのもこもこ may still move (the user has not decided): moving one is changing its planet below.
 */
const RES = (planet: string, id: string, name: string, line: string, side: 'l' | 'r'): HomeResident & { planet: string } => ({ planet, id, name, line, side, art: `/planet-home/res-${id}.webp` });
export const HOME_RESIDENTS = [
  RES('venus', 'longg', 'ロングG', '……いい音だろ。', 'l'),
  RES('venus', 'bossg', 'ボスG', '誰だ、お前ら。……ネオか。', 'r'),
  RES('mercury', 'freezie', 'フリージー', '音に乗っけると、100倍だ。', 'l'),
  RES('mercury', 'salmon', 'サーモン', 'おかえり。おかえり。', 'r'),
  RES('mars', 'hippo', 'ヒポキン', '……いい画だ。また見せに来い。', 'l'),
  RES('uranus', 'croco', 'クロコパトラ', 'あら、いらっしゃい。', 'l'),
  RES('neptune', 'boombox', 'ラジカセの侍', '遊んでいくか。', 'r'),
  RES('pluto', 'ribbon', 'リボンのもこもこ', 'おはなし、きかせて！', 'l'),
];
const residentsOf = (planet: string): HomeResident[] => HOME_RESIDENTS.filter((r) => r.planet === planet).map(({ planet: _p, ...r }) => r);

const flown = (place: string) => `{neo}の${place}と、ダチ・推してくれている人の${place}に届いたよ`;

export const PLANET_HOMES: Record<HomePlanet, PlanetHomeConfig> = {
  saturn: {
    planet: 'saturn',
    en: 'SATURN',
    accent: '#ffb36b',
    cta: '▶ 全部流す',
    verb: '聞く',
    make: 'voice',
    name: '土星',
    store: 'saturn_post',
    work: 'コロリン',
    place: 'レコード',
    inside: 'レコード',
    around: 'コロリン',
    far: null,
    leave: 'up-to-sky',
    open: 'sing',
    placeTap: 'play',
    roll: true,
    line: 'あなたの**レコード**に、ダチと推しのコロリンが降ってくる。**つつく・はじく・投げる**と喋って、溝にしまわれる。',
    flown: '{neo}のレコードと、ダチ・推してくれている人のレコードに降ったよ',
    art: { backdrop: '/planet-home/bg-saturn.webp', sprite: '/planet-home/sp-korolin.webp' },
    residents: residentsOf('saturn'),
    releaseOrder: 1,
  },
  jupiter: {
    planet: 'jupiter',
    en: 'JUPITER',
    accent: '#b6e36b',
    cta: '中に入る',
    verb: '見る',
    make: 'art',
    name: '木星',
    store: 'jupiter_post',
    work: 'アート',
    place: '木',
    inside: 'アトリエ',
    around: 'アートの蝶',
    far: '遠くの木々を舞う小さな蝶',
    leave: 'fly-away',
    open: 'view',
    placeTap: 'enter',
    line: 'あなたの**木**のまわりに、ダチと推しのアートが**88時間**、蝶になって舞う。木の中のアトリエには、あなたのアートがずっと飾られる。',
    flown: flown('木'),
    art: { backdrop: '/planet-home/bg-jupiter.webp', sprite: '/planet-home/sp-butterfly.webp' },
    residents: residentsOf('jupiter'),
    releaseOrder: 2,
  },
  mercury: {
    planet: 'mercury',
    en: 'MERCURY',
    accent: '#7fe0ff',
    cta: '中に入る',
    verb: '聞く',
    make: 'song',
    name: '水星',
    store: 'planet_post',
    storePlanet: 'mercury',
    work: '曲',
    place: '島',
    inside: '島の家',
    around: '音船',
    far: '沖を行く小さな船',
    leave: 'sail-off',
    open: 'play-audio',
    placeTap: 'enter',
    line: 'あなたの**島**のまわりに、ダチと推しの曲が**88時間**、音船になってやってくる。島の家には、あなたの曲がずっと並ぶ。',
    flown: flown('島'),
    art: { backdrop: '/planet-home/bg-mercury.webp', sprite: '/planet-home/sp-ship.webp' },
    residents: residentsOf('mercury'),
    releaseOrder: 3,
  },
  mars: {
    planet: 'mars',
    en: 'MARS',
    accent: '#ff8a7a',
    cta: '中に入る',
    verb: '見る',
    make: 'video',
    name: '火星',
    store: 'planet_post',
    storePlanet: 'mars',
    work: '映像',
    place: 'スタジオ',
    inside: '上映室',
    around: 'UFO',
    far: '遠くの空の小さなUFOの光',
    leave: 'ufo-up',
    open: 'play-video',
    placeTap: 'enter',
    line: 'あなたの**スタジオ**の空に、ダチと推しが映像を連れて、UFOで**88時間**やってくる。タップすると、空に映す。',
    flown: flown('スタジオ'),
    art: { backdrop: '/planet-home/bg-mars.webp', sprite: '/planet-home/sp-ufo.webp' },
    residents: residentsOf('mars'),
    releaseOrder: 4,
  },
  venus: {
    planet: 'venus',
    en: 'VENUS',
    accent: '#ffd36b',
    cta: '中に入る',
    verb: '聞く',
    make: 'radio',
    name: '金星',
    store: 'radio_show',
    work: '番組',
    place: 'ブース',
    inside: 'ブース',
    around: '電波',
    far: '遠くの雲の小さな電波',
    leave: 'fade',
    open: 'play-audio',
    placeTap: 'enter',
    line: 'あなたの**ブース**のまわりに、ダチと推しの番組が**88時間**、電波になって漂う。近づくと聞こえる。',
    flown: flown('ブース'),
    art: { backdrop: '/planet-home/bg-venus.webp', sprite: '/planet-home/sp-radio.webp' },
    residents: residentsOf('venus'),
    releaseOrder: 4,
  },
  // Uranus / Pluto / Neptune: words from the story team's template (design/home); no store of works yet
  uranus: {
    planet: 'uranus',
    en: 'URANUS',
    accent: '#7fffd0',
    cta: '中に入る',
    verb: '見る',
    name: '天王星',
    store: null,
    work: 'グッズ',
    place: 'お店',
    inside: 'お店',
    around: 'グッズの気球',
    far: '遠くの店の小さな光',
    leave: 'fade',
    open: 'view',
    placeTap: 'enter',
    line: 'あなたの**お店**の空に、ダチと推しのグッズが**88時間**、気球で届く。お店の棚には、あなたのグッズがずっと並ぶ。',
    flown: flown('お店'),
    art: { backdrop: '/planet-home/bg-uranus.webp', sprite: '/planet-home/sp-balloon.webp' },
    residents: residentsOf('uranus'),
    releaseOrder: 9,
  },
  pluto: {
    planet: 'pluto',
    en: 'PLUTO',
    accent: '#a9b8ff',
    cta: '中に入る',
    verb: '読む',
    name: '冥王星',
    store: null,
    work: '物語',
    place: '図書館',
    inside: '図書館',
    around: '光る本',
    far: '遠くの氷原の小さな灯り',
    leave: 'dim',
    open: 'read',
    placeTap: 'enter',
    line: 'あなたの**図書館**のまわりに、ダチと推しの物語が**88時間**、光る本になって飛んでくる。図書館には、あなたの本がずっと並ぶ。',
    flown: flown('図書館'),
    art: { backdrop: '/planet-home/bg-pluto.webp', sprite: '/planet-home/sp-book.webp' },
    residents: residentsOf('pluto'),
    releaseOrder: 9,
  },
  neptune: {
    planet: 'neptune',
    en: 'NEPTUNE',
    accent: '#c39bff',
    cta: '中に入る',
    verb: '遊ぶ',
    name: '海王星',
    store: null,
    work: 'ゲーム',
    place: 'ゲーム小屋',
    inside: 'ゲーム小屋',
    around: 'ゲームの泡',
    far: '遠くの島の小さな札',
    leave: 'sail-off',
    open: 'view',
    placeTap: 'enter',
    line: 'あなたの**ゲーム小屋**のまわりに、ダチと推しのゲームが**88時間**、泡になって浮かぶ。小屋の中では、あなたのゲームがいつでも遊べる。',
    flown: flown('ゲーム小屋'),
    art: { backdrop: '/planet-home/bg-neptune.webp', sprite: '/planet-home/sp-bubble.webp' },
    residents: residentsOf('neptune'),
    releaseOrder: 9,
  },
};

/** the planet whose home a work kind flies to (Moon atelier / Bluena 〔○○へ飛ばす〕) */
export const HOME_OF_WORK: Record<string, HomePlanet> = { voice: 'saturn', art: 'jupiter', song: 'mercury', video: 'mars', radio: 'venus' };
