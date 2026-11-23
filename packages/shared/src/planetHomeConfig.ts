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
  /** tapping your place: 'enter' goes inside; 'play' starts it in place (Saturn's play button on the rim) */
  placeTap: 'enter' | 'play';
  /** the one-line description at the top (big the first time, small after) */
  line: string;
  /** {bati}'s line after 〔○○へ飛ばす〕 ({neo} = the member's name) */
  flown: string;
  /** the art keys the web app resolves (placeholders until the story team's art arrives) */
  art: { backdrop: string; place: string; around: string; far?: string };
  /** M-R258 §5: the day it goes out (Saturn first) */
  releaseOrder: number;
}

const flown = (place: string) => `{neo}の${place}と、ダチ・推してくれている人の${place}に届いたよ`;
const line = (place: string) => `あなたの${place}のまわりに、ダチと推しの作品が88時間あつまる。${place}の中には、あなたの作品がずっと飾られる。`;

export const PLANET_HOMES: Record<HomePlanet, PlanetHomeConfig> = {
  saturn: {
    planet: 'saturn',
    store: 'saturn_post',
    work: 'コロリン',
    place: 'レコード',
    inside: 'レコード',
    around: '空から降ってきてレコードに乗るコロリン',
    far: null,
    leave: 'up-to-sky',
    open: 'sing',
    placeTap: 'play',
    line: 'あなたのレコードに、ダチと推しのコロリンが88時間降ってくる。再生すると、針のマイクの前で歌う。',
    flown: '{neo}のレコードと、ダチ・推してくれている人のレコードに降ったよ',
    art: { backdrop: 'saturn-records', place: 'saturn-my-record', around: 'kororin' },
    releaseOrder: 1,
  },
  jupiter: {
    planet: 'jupiter',
    store: 'jupiter_post',
    work: 'アート',
    place: '木',
    inside: 'アトリエ',
    around: 'アートの羽の蝶',
    far: '遠くの木々を舞う小さな蝶',
    leave: 'fly-away',
    open: 'view',
    placeTap: 'enter',
    line: line('木'),
    flown: flown('木'),
    art: { backdrop: 'jupiter-forest', place: 'jupiter-my-tree', around: 'butterfly', far: 'butterfly-far' },
    releaseOrder: 2,
  },
  mercury: {
    planet: 'mercury',
    store: 'planet_post',
    storePlanet: 'mercury',
    work: '曲',
    place: '島',
    inside: '島の家',
    around: '帆にジャケットの音船',
    far: '沖を行く小さな船',
    leave: 'sail-off',
    open: 'play-audio',
    placeTap: 'enter',
    line: line('島'),
    flown: flown('島'),
    art: { backdrop: 'mercury-sea', place: 'mercury-my-island', around: 'sound-ship', far: 'ship-far' },
    releaseOrder: 3,
  },
  mars: {
    planet: 'mars',
    store: 'planet_post',
    storePlanet: 'mars',
    work: '映像',
    place: 'スタジオ',
    inside: '上映室',
    around: 'ダチ・推しが乗ったUFO',
    far: '遠くの空の小さなUFOの光',
    leave: 'ufo-up',
    open: 'play-video',
    placeTap: 'enter',
    line: line('スタジオ'),
    flown: flown('スタジオ'),
    art: { backdrop: 'mars-city', place: 'mars-my-studio', around: 'ufo', far: 'ufo-far' },
    releaseOrder: 4,
  },
  venus: {
    planet: 'venus',
    store: 'radio_show',
    work: 'ラジオ',
    place: '放送ブース',
    inside: 'ブース',
    around: '漂う電波の輪',
    far: '遠くの雲の小さな電波',
    leave: 'fade',
    open: 'play-audio',
    placeTap: 'enter',
    line: line('放送ブース'),
    flown: flown('放送ブース'),
    art: { backdrop: 'venus-clouds', place: 'venus-my-booth', around: 'radio-ring', far: 'radio-far' },
    releaseOrder: 4,
  },
  // Uranus / Pluto / Neptune: words are placeholders until their homes are designed (no store of works yet)
  uranus: {
    planet: 'uranus',
    store: null,
    work: 'グッズ',
    place: '店',
    inside: '天空のアトリエの店',
    around: '空に浮かぶ宝石',
    far: '遠くの店の小さな光',
    leave: 'fade',
    open: 'view',
    placeTap: 'enter',
    line: line('店'),
    flown: flown('店'),
    art: { backdrop: 'uranus-sky-town', place: 'uranus-my-shop', around: 'gem', far: 'gem-far' },
    releaseOrder: 9,
  },
  pluto: {
    planet: 'pluto',
    store: null,
    work: '物語',
    place: '図書館',
    inside: '氷の書庫',
    around: '暗い空にともる灯り',
    far: '遠くの氷原の小さな灯り',
    leave: 'dim',
    open: 'read',
    placeTap: 'enter',
    line: line('図書館'),
    flown: flown('図書館'),
    art: { backdrop: 'pluto-plain', place: 'pluto-my-library', around: 'lantern', far: 'lantern-far' },
    releaseOrder: 9,
  },
  // Neptune has no my場所 in M-R191 (games are played, not kept): the island and its 遊び場 are placeholders
  neptune: {
    planet: 'neptune',
    store: null,
    work: 'ゲーム',
    place: '島',
    inside: '遊び場',
    around: '波間に浮かぶゲームの札',
    far: '遠くの島の小さな札',
    leave: 'sail-off',
    open: 'view',
    placeTap: 'enter',
    line: line('島'),
    flown: flown('島'),
    art: { backdrop: 'neptune-islands', place: 'neptune-my-island', around: 'game-card', far: 'game-card-far' },
    releaseOrder: 9,
  },
};

/** the planet whose home a work kind flies to (Moon atelier / Bluena 〔○○へ飛ばす〕) */
export const HOME_OF_WORK: Record<string, HomePlanet> = { voice: 'saturn', art: 'jupiter', song: 'mercury', video: 'mars', radio: 'venus' };
