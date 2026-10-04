import type { PlanetId } from './planets';

/**
 * The 8-day journey every invited person goes through before becoming an ORDER member
 * (client decision 2026-10-04). One day unlocks 24 h after the previous one is finished
 * (or immediately with "明日まで待てへん"). After day 8 comes the payment step
 * ("ORDERになるか？"); members who paid are "order".
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
    beats: ['宇宙行きの切符が届く', 'KIMORINと月に行く', '月の神殿につく', '月の案内人OBOLONと出会う', 'プロフィールを作る', 'バティを作る'],
  },
  {
    day: 4,
    planet: 'saturn',
    guides: ['たこ焼きブラザー', 'たこ焼きシスター'],
    title: '土星へ',
    beats: ['土星に行く', '案内人たこ焼きブラザー・たこ焼きシスターに出会う', '土星の楽しみ方（声の出るTwitter）を教わる', '投稿してみる'],
  },
  { day: 5, planet: 'jupiter', guides: [], title: '木星へ', beats: ['木星に行く'] },
  { day: 6, planet: 'mercury', guides: [], title: '水星へ', beats: ['水星に行く'] },
  { day: 7, planet: 'venus', guides: [], title: '金星へ', beats: ['金星に行く'] },
  { day: 8, planet: 'mars', guides: [], title: '火星へ', beats: ['火星に行く'] },
];

export function journeyMeta(day: number): JourneyDayMeta | undefined {
  return JOURNEY.find((d) => d.day === day);
}
