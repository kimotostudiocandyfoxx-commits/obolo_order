import type { PlanetId } from './planets';

/**
 * The journey every invited person goes through before becoming an ORDER member
 * (client decisions 2026-10-04 / 10-06). One day unlocks 24 h after the previous one is finished
 * (or immediately with "明日まで待てへん"). Days 1–8 visit the planets; day 9 is the Eclipse day:
 * Bati runs out of mana, MONBAN explains the Eclipse (linking your soul to the Sun) and asks for
 * the ¥88/month for the secret rocket (payment inside the story). Paying makes you an ORDER member.
 * Until then the visitor is an apprentice, an "OBOLO NEO".
 *
 * Stored on the user as `journeyDay` (1–8 = day to play, 9 = the Eclipse day, 10 = ORDER member)
 * plus `journeyCompletedAt` (set when the current day is finished, cleared when the next starts).
 * Day 9 has no countdown: finishing it after paying moves straight to 10.
 */
export const JOURNEY_LAST_DAY = 8;
export const JOURNEY_PAYMENT = 9;
export const JOURNEY_DONE = 10;
export const JOURNEY_WAIT_MS = 24 * 3600_000;

export interface JourneyDayMeta {
  day: number;
  planet: PlanetId;
  /** Guides met that day (client's names). */
  guides: string[];
  /** Short title + what happens, in the client's words (Japanese source of truth). */
  title: string;
  beats: string[];
}

export const JOURNEY: readonly JourneyDayMeta[] = [
  { day: 1, planet: 'earth', guides: ['MONBAN', 'OBOLON'], title: '招待状が届く', beats: ['招待状が届く', '本部に行く'] },
  {
    day: 2,
    planet: 'earth',
    guides: ['KIMORIN'],
    title: 'もう一度、招待状',
    beats: ['もう一度招待状が届く', '本部に行く', '案内人KIMORINがいる', '説明を受ける', '宇宙に行くことを同意する'],
  },
  {
    day: 3,
    planet: 'moon',
    guides: ['KIMORIN', 'OBOLON'],
    title: '月へ',
    beats: [
      '宇宙行きの切符が届く',
      'KIMORINと月に行く',
      '月の神殿につく',
      'OBOLO NEO（見習いの姿）を質問から生成して選ぶ',
      'ネオとしての名前を決める',
      '好きな食べ物を答えて、バティのたまごを受け取る',
    ],
  },
  {
    day: 4,
    planet: 'saturn',
    guides: ['たこ焼きブラザー', 'たこ焼きシスター'],
    title: '土星へ',
    beats: ['たまごからバティが生まれ、名前をつける', '土星に行く', '案内人たこ焼きブラザー・たこ焼きシスターに出会う', '土星の楽しみ方（声の出るTwitter）を教わる', '投稿してみる'],
  },
  { day: 5, planet: 'jupiter', guides: ['KIMORIN', '大根カイザー'], title: '木星へ', beats: ['木星に行く', '大根カイザーに出会う', '木星（パタパタ）で遊ぶ'] },
  { day: 6, planet: 'mercury', guides: ['KIMORIN', 'フリージー'], title: '水星へ', beats: ['水星に行く', 'フリージーに出会う', '水星（船の海と島）で遊ぶ'] },
  // Mars comes before Venus (client, 2026-10-05)
  { day: 7, planet: 'mars', guides: ['KIMORIN', 'ヒポキン'], title: '火星へ', beats: ['火星に行く', '未来都市でヒポキンに出会う', '火星（映像の惑星）で遊ぶ'] },
  { day: 8, planet: 'venus', guides: ['KIMORIN', 'ロングG', 'ハットG', 'ボスG'], title: '金星へ', beats: ['金星に行く', 'ゴリラ3人組に出会う', '金星（グッズをつくって星で売り買い）で遊ぶ'] },
];

/** Day 9 (client, 2026-10-06): not a planet visit — the way to ORDER. */
export const ECLIPSE_DAY_BEATS = [
  '金星で目を覚ます。今日は冥王星へ……のはずが、バティの元気がない',
  'バティは太陽の力「マナ」で生きている。マナが切れかけているので地球の本部へ戻る',
  'MONBAN：太陽の神殿で、太陽と君の魂の一部をつなぐ「エクリプス」が必要',
  'エクリプスに成功した人がORDER。バティにマナを渡せて、自由に宇宙を旅できる',
  '太陽の神殿へは結社の秘密ロケット。リンクの経費は月88円 → OK で支払い',
  'エクリプス用のロケットへ案内される',
] as const;

export function journeyMeta(day: number): JourneyDayMeta | undefined {
  return JOURNEY.find((d) => d.day === day);
}

/**
 * After paying on day 9: the Eclipse itself at the Sun temple (Bati receives mana and evolves into
 * its ORDER form), then the solar system. Script not delivered yet.
 */
export const AFTER_JOURNEY = ['エクリプス用のロケットで太陽の神殿へ → エクリプス', 'バティにマナが渡り、ORDERの姿に進化する'] as const;

/** Monthly price of the Eclipse / ORDER membership in yen (client, 2026-10-06). */
export const ORDER_PRICE_JPY = 88;
