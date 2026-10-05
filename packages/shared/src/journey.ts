import type { PlanetId } from './planets';

/**
 * The 8-day journey every invited person goes through before becoming an ORDER member
 * (client decision 2026-10-04). One day unlocks 24 h after the previous one is finished
 * (or immediately with "明日まで待てへん"). After day 8 comes the Sun temple, where the visitor is
 * asked "ORDERになるか？" (payment); members then return to the Moon temple to create Bati.
 * Until then the visitor is an apprentice, an "OBOLO NEO" (form chosen on day 3).
 *
 * Stored on the user as `journeyDay` (1–8 = day to play, 9 = payment, 10 = ORDER member)
 * plus `journeyCompletedAt` (set when the current day is finished, cleared when the next starts).
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

export function journeyMeta(day: number): JourneyDayMeta | undefined {
  return JOURNEY.find((d) => d.day === day);
}

/**
 * After the 8 days: the Sun temple ("ORDERになるか？" → membership), then a second visit to the
 * Moon temple. Bati is now born on day 4 (client decision 2026-10-05), so the second visit is where
 * the new member's Bati awakens and grows into its true form. Not built yet.
 */
export const AFTER_JOURNEY = ['太陽の神殿で「ORDERになるか？」→ 会員になる', 'もう一度月の神殿へ → バティが目覚めて成長する'] as const;
