import type { PlanetId } from './planets';

/**
 * The journey every invited person goes through before becoming an ORDER member. One day unlocks 24 h
 * after the previous one is finished (or immediately with "明日まで待てない").
 *
 * The first journey is eleven days (story M-R341, 2026-11-27; handoff planets-08): after Venus the three outer planets
 * are visited BEFORE becoming Obolo Order, and the Eclipse moved from day 8 to day 11:
 *   1 Earth (the invitation, MONBAN, OBOLON) · 2 Earth → the Moon (KIMORIN, the NEO look, name, Bati) ·
 *   3 Saturn · 4 Jupiter · 5 Mercury · 6 Mars · 7 Venus · 8 Pluto (クロコパトラ) · 9 Neptune (オニモンク) ·
 *   10 Uranus (MONBAN) · 11 Earth → the Sun.
 * (Before: seven days from 2026-10-14, eight from draft 21 with the Sun on day 8 — migration 0064 moves the accounts.)
 * Draft 21 (M-R124): everyone makes everything on the first journey and lives in space from then on; at the
 * Sun the Eclipse is a choice — 〔エクリプスを受ける〕 (¥88/month: ORDER) or 〔今は、住人のままでいる〕 (free).
 *
 * Stored on the user as `journeyDay` (1–10 = day to play, 11 = the Sun day, 12 = done) plus
 * `journeyCompletedAt` (set when the current day is finished, cleared when the next starts). Day 11 can be
 * finished paid or not; after it the visitor is an ORDER (`orderedAt` set) or a resident (not set).
 */
export const JOURNEY_LAST_DAY = 10;
/** Days that exist in the numbering but are not played (none since the seven-day journey). */
export const SKIPPED_DAYS: readonly number[] = [];
export function nextJourneyDay(day: number): number {
  let d = day + 1;
  while (SKIPPED_DAYS.includes(d)) d++;
  return d;
}

/**
 * The three outer planets open on the first journey's day they are visited (M-R341: Pluto day 8, Neptune day 9, Uranus
 * day 10) — for everyone, an Obolo Order or not. (Before: members only, Uranus with ORDER and Neptune / Pluto 2 / 3
 * weeks after it.) Anyone past those days — every account whose journey is done — has all three open.
 */
export const PLANET_OPEN_DAY: Readonly<Partial<Record<string, number>>> = { pluto: 8, neptune: 9, uranus: 10 };
/** the journey day a planet opens on (undefined: open from the start) */
export function planetOpenDay(planet: string): number | undefined {
  return PLANET_OPEN_DAY[planet];
}
/** a planet is open for someone on `journeyDay` (null / undefined day: not on a journey — open) */
export function planetIsOpen(planet: string, journeyDay: number | null | undefined): boolean {
  const day = PLANET_OPEN_DAY[planet];
  return day === undefined || journeyDay == null || journeyDay >= day;
}
/** the Sun day: the Eclipse (the payment is inside its story) */
export const JOURNEY_PAYMENT = 11;
export const JOURNEY_DONE = 12;
/**
 * The journey of before (eight days: the Sun on day 8, done = 9). Accounts that had reached its day 8 when migration
 * 0064 ran carry `story[JOURNEY_EIGHT_KEY] = '1'`: they never played days 8–10 of now (the outer planets) on the first
 * journey, so the three days after joining (shared LAP2, as before) stay theirs.
 */
export const JOURNEY_EIGHT_KEY = 'j.eight';
export const JOURNEY_WAIT_MS = 24 * 3600_000;
/**
 * Client 2026-11-28: the 24-hour wait after a day can be skipped (〔明日まで待てない〕) after every day except the
 * ones that lead INTO these days — day 3 → 4 and day 7 → 8 are waited out. The fastest path is days 1–3, wait,
 * 4–7, wait, 8–11. One rule for the wait screen (web) and the server (advanceJourney); testers jump past it as before.
 */
export const NO_SKIP_INTO_DAYS: readonly number[] = [4, 8];
/** whether the wait after finishing `day` may be skipped (false past the journey's end) */
export function journeyWaitSkippable(day: number): boolean {
  if (!Number.isInteger(day) || day < 1 || day >= JOURNEY_DONE) return false;
  return !NO_SKIP_INTO_DAYS.includes(nextJourneyDay(day));
}

export interface JourneyDayMeta {
  day: number;
  /** 'pluto' has no page of its own in the registry (PlanetId): only its new home */
  planet: PlanetId | 'pluto';
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
  { day: 7, planet: 'venus', guides: ['KIMORIN', 'ボスG', 'ハットG', 'ロングG'], title: '金星へ', beats: ['金星に行く', 'ボスGたちに出会う', 'かんたんDJで自分の曲を回す', '〔🎤 見せる〕でダチに届ける'] },
  // M-R341: the three outer planets, before becoming Obolo Order
  { day: 8, planet: 'pluto', guides: ['KIMORIN', 'クロコパトラ'], title: '冥王星へ', beats: ['冥王星に行く', 'クロコパトラに出会う', '月の工房でお話を書く', '〔公開する〕で空に灯す'] },
  { day: 9, planet: 'neptune', guides: ['KIMORIN', 'オニモンク'], title: '海王星へ', beats: ['海王星に行く', 'オニモンクに出会う', '『ナガレを越えて』で遊ぶ', '月の工房でゲームを作る'] },
  { day: 10, planet: 'uranus', guides: ['KIMORIN', 'MONBAN'], title: '天王星へ', beats: ['天王星に行く', 'MONBANに出会う', '月の工房でグッズを作ってお店に並べる', 'obolo商店を見る（本物の注文はObolo Orderになってから）'] },
];

/** Day 11 (the Eclipse day; day 8 before M-R341): not a planet visit — the way to ORDER. (Old wording: still to be rewritten in the new story.) */
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
 * After the Eclipse day the visitor is an ORDER and the journey goes on in the solar system.
 * Bati receiving mana / evolving into its ORDER form is not scripted yet.
 */
export const AFTER_JOURNEY = ['ORDER として旅の続きへ（太陽系）', 'バティにマナが渡り、ORDERの姿に進化する（台本待ち）'] as const;

/** Monthly price of the Eclipse / ORDER membership in yen (client, 2026-10-06). */
export const ORDER_PRICE_JPY = 88;
