import type { PlanetId } from './planets';

/**
 * The journey every invited person goes through before becoming an ORDER member. One day unlocks 24 h
 * after the previous one is finished (or immediately with "明日まで待てない").
 *
 * The first journey is seven days (story 2026-10-14, docs/story-rewrite/土星まで_UI引き継ぎ.md): KIMORIN
 * is no longer a guide but a fellow NEO who travels with you, and the Moon moved into day 2, so every
 * later day came one day earlier:
 *   1 Earth (the invitation, MONBAN, OBOLON) · 2 Earth → the Moon (KIMORIN, the NEO look, name, Bati) ·
 *   3 Saturn · 4 Jupiter · 5 Mercury · 6 Mars · 7 back to Earth, the Eclipse (¥88/month inside the story).
 * Venus is not on the first journey.
 *
 * Stored on the user as `journeyDay` (1–6 = day to play, 7 = the Eclipse day, 8 = ORDER member)
 * plus `journeyCompletedAt` (set when the current day is finished, cleared when the next starts).
 * Day 7 can only be finished after paying; after its countdown the visitor is an ORDER (8).
 */
export const JOURNEY_LAST_DAY = 6;
/** Days that exist in the numbering but are not played (none since the seven-day journey). */
export const SKIPPED_DAYS: readonly number[] = [];
export function nextJourneyDay(day: number): number {
  let d = day + 1;
  while (SKIPPED_DAYS.includes(d)) d++;
  return d;
}

/**
 * Planets that open after joining (client decision 2026-10-07): one more each week after the
 * Eclipse — Neptune after 2 weeks, Pluto after 3 (Pluto is not built yet).
 * PLACEHOLDER (P-JOURNEY-1): which planet opens in which week.
 */
export const LATER_PLANETS: readonly { planet: 'venus' | 'uranus' | 'neptune' | 'pluto'; afterDays: number }[] = [
  // Uranus (your atelier) is the second journey: it opens with ORDER (client 2026-10-15)
  { planet: 'uranus', afterDays: 0 },
  // (Venus is not on the first journey since 2026-10-14; ORDER members can visit it like the other planets)
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
export const JOURNEY_PAYMENT = 7;
export const JOURNEY_DONE = 8;
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
  { day: 1, planet: 'earth', guides: ['MONBAN', 'OBOLON'], title: '招待状が届く', beats: ['招待状が届く', '本部の門でMONBAN', '地球の神殿でOBOLON', '8つの謎の札と謎の書', '招待者からの手紙とマナジェム'] },
  {
    day: 2,
    planet: 'moon',
    guides: ['KIMORIN', 'OBOLON'],
    title: 'KIMORINと、月へ',
    beats: [
      '宇宙行きの切符が届く',
      '本部の門で、KIMORIN（同じ招待客）が後ろから現れる',
      'KIMORINと宇宙へ行くことにする',
      'ロケットで月へ',
      'ネオの姿を4枚から選び、ネオの名前を決める',
      '好きな食べ物を答えて、バティが生まれ、名前をつける',
    ],
  },
  {
    day: 3,
    planet: 'saturn',
    guides: ['たこ焼きブラザー', 'たこ焼きシスター'],
    title: '土星へ',
    beats: ['Bluenaを手に入れる', '土星へ行く', 'たこ焼きブラザー・シスターに出会う', 'コロリンで遊ぶ（自分の部屋に飛ばす）', '謎2「OBOLO ORDERは全員、表現者」が解ける'],
  },
  { day: 4, planet: 'jupiter', guides: ['KIMORIN', '大根カイザー'], title: '木星へ', beats: ['木星に行く', '大根カイザーに出会う', '木星（パタパタ）で遊ぶ'] },
  { day: 5, planet: 'mercury', guides: ['KIMORIN', 'フリージー'], title: '水星へ', beats: ['水星に行く', 'フリージーに出会う', '水星（船の海と島）で遊ぶ'] },
  { day: 6, planet: 'mars', guides: ['KIMORIN', 'ヒポキン'], title: '火星へ', beats: ['火星に行く', '未来都市でヒポキンに出会う', '火星（映像の惑星）で遊ぶ'] },
];

/** Day 7 (the Eclipse day): not a planet visit — the way to ORDER. (Old wording: still to be rewritten in the new story.) */
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
 * After day 7's countdown the visitor is an ORDER and the journey goes on in the solar system.
 * Bati receiving mana / evolving into its ORDER form is not scripted yet.
 */
export const AFTER_JOURNEY = ['ORDER として旅の続きへ（太陽系）', 'バティにマナが渡り、ORDERの姿に進化する（台本待ち）'] as const;

/** Monthly price of the Eclipse / ORDER membership in yen (client, 2026-10-06). */
export const ORDER_PRICE_JPY = 88;
