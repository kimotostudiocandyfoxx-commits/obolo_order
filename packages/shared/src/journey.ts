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
 * Day 9 can only be finished after paying; after its countdown the visitor is an ORDER (10).
 */
export const JOURNEY_LAST_DAY = 8;
/**
 * Venus left the journey (client decision 2026-10-07, before the 10/10 demo): the route is
 * Moon → Saturn → Jupiter → Mercury → Mars → back to Earth → the Sun temple (Eclipse) → ORDER.
 * Day 8 (Venus) is skipped: finishing day 7 opens the Eclipse day (9). Venus opens later.
 */
export const SKIPPED_DAYS: readonly number[] = [8];
export function nextJourneyDay(day: number): number {
  let d = day + 1;
  while (SKIPPED_DAYS.includes(d)) d++;
  return d;
}

/**
 * Planets that open after joining (client decision 2026-10-07): one more each week after the
 * Eclipse — Venus after 1 week, Neptune after 2, Pluto after 3 (Pluto is not built yet).
 * PLACEHOLDER (P-JOURNEY-1): which planet opens in which week.
 */
export const LATER_PLANETS: readonly { planet: 'venus' | 'neptune' | 'pluto'; afterDays: number }[] = [
  { planet: 'venus', afterDays: 7 },
  { planet: 'neptune', afterDays: 14 },
  { planet: 'pluto', afterDays: 21 },
];
/** When a later planet opens for this member (null = not a member yet); undefined = always open. */
export function planetOpensAt(planet: string, orderedAt: string | null | undefined): Date | null | undefined {
  const rule = LATER_PLANETS.find((p) => p.planet === planet);
  if (!rule) return undefined;
  if (!orderedAt) return null;
  return new Date(new Date(orderedAt).getTime() + rule.afterDays * 24 * 3600_000);
}
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
  // day 8 (Venus) is skipped since 2026-10-07 — Venus opens a week after joining (kept for later)
  { day: 8, planet: 'venus', guides: ['KIMORIN', 'ロングG', 'ハットG', 'ボスG'], title: '金星へ', beats: ['金星に行く', 'ゴリラ3人組に出会う', '金星（グッズをつくって星で売り買い）で遊ぶ'] },
];

/** Day 9 (client, 2026-10-06): not a planet visit — the way to ORDER. */
export const ECLIPSE_DAY_BEATS = [
  '火星で目を覚ます。今日はもっと遠くの星へ……のはずが、バティの元気がない',
  'バティは太陽の力「マナ」で生きている。マナが切れかけているので地球の本部へ戻る',
  'MONBAN：太陽の神殿で、太陽と君の魂の一部をつなぐ「エクリプス」が必要',
  'エクリプスに成功した人がORDER。バティにマナを渡せて、自由に宇宙を旅できる',
  '太陽の神殿へは結社の秘密ロケット。リンクの経費は月88円 → OK で支払い',
  'エクリプス用のロケットで太陽へ。太陽の神殿で KIMORIN がアカシックレコードのようなものを見せる',
  'OBOLON「最初から、つながってるんだ。…それを感じる」',
  '白くフェードアウトして地球の結社へ。KIMORIN「旅の続きは明日から。また明日！」',
] as const;

export function journeyMeta(day: number): JourneyDayMeta | undefined {
  return JOURNEY.find((d) => d.day === day);
}

/**
 * After day 9's countdown the visitor is an ORDER and the journey goes on in the solar system.
 * Bati receiving mana / evolving into its ORDER form is not scripted yet.
 */
export const AFTER_JOURNEY = ['ORDER として旅の続きへ（太陽系）', 'バティにマナが渡り、ORDERの姿に進化する（台本待ち）'] as const;

/** Monthly price of the Eclipse / ORDER membership in yen (client, 2026-10-06). */
export const ORDER_PRICE_JPY = 88;
