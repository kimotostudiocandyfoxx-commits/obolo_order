/**
 * R18 (client 2026-11-25, docs/マナの値段.md 12.): who pays for the small costs, and what stops at 0 mana.
 *
 *  - Members (Obolo Order, ¥88 a month with 88 mana): never stopped from talking to {bati} at 0 mana (their ¥88 covers the
 *    small costs: absorbed); a soft daily ceiling on {bati}'s replies (BATI_DAILY_CAP_MEMBER) after which {bati} says it
 *    is tired and comes back tomorrow. Making still needs mana.
 *  - Non-members past the first journey (residents, ended subscriptions): every small cost draws mana as for members; at
 *    0 mana, making and talking to {bati} stop — {bati} says the no-mana line once a day, then keeps quiet (the chat's
 *    mic / typing show a calm hint). Viewing and listening to their own works, past talks and ダチ stay open.
 *  - During the first journey (days 1–11, not yet finished; eleven days since M-R341) nothing stops: the story must be finishable (the first gem
 *    is sized for it); what the gem cannot cover is absorbed, as in R17.
 *  - ダチ chat: free for everyone, even at 0 mana (the network effect). Its costs are not charged: recorded under the
 *    feature 'dachi' and reported as an unrecovered marketing cost. Non-members get a soft daily cap
 *    (DACHI_DAILY_CAP_FREE) against abuse. A read-aloud in the ダチ talk (KIMORIN⭐︎'s voice) falls back to text for a
 *    non-member at 0 mana.
 */
import { JOURNEY_DONE, JOURNEY_PAYMENT } from './journey';
import { FISH_USD_PER_MBYTE, textUsd } from './manaPrice';
import { normalizeBatiPersonality, type BatiPersonality } from './batiPersona';

/** a member's {bati} replies a day before {bati} is tired (config BATI_DAILY_CAP_MEMBER) */
export const BATI_DAILY_CAP_MEMBER = 300;
/** a non-member's ダチ messages a day (config DACHI_DAILY_CAP_FREE) */
export const DACHI_DAILY_CAP_FREE = 200;

/** why {bati} is quiet: no mana (a non-member) or tired (the day's ceiling) */
export type BatiRest = 'noMana' | 'tired';

export interface SpendState {
  /** an Obolo Order member right now (isActiveMember) */
  member: boolean;
  /** the first journey's day (1–11 to play; 12 = done) and whether today's story was finished */
  journeyDay: number;
  journeyCompletedAt?: Date | string | null;
  /** the wallet's mana */
  balance: number;
}

/** still on the first journey: day 1–11, the Sun day (11) not finished yet */
export function onFirstJourney(s: Pick<SpendState, 'journeyDay' | 'journeyCompletedAt'>): boolean {
  if (s.journeyDay >= JOURNEY_DONE) return false;
  return !(s.journeyDay >= JOURNEY_PAYMENT && !!s.journeyCompletedAt);
}

/** a non-member past the first journey with no mana left: making and talking to {bati} stop */
export function outOfMana(s: SpendState): boolean {
  return !s.member && !onFirstJourney(s) && Math.floor(s.balance) <= 0;
}

/**
 * {bati}'s voice at 0 mana — ONE rule for everyone (client 2026-11-27, with M-R342: every {bati} speaks in the same
 * fixed voice, so the rule no longer looks at recorded / not recorded, nor at Obolo Order):
 *  - during the first journey (onFirstJourney: the journey's constants, never a day number) everyone hears {bati};
 *  - after it, with no mana left, {bati}'s read-aloud is not made — the words stay (the Moon chat answers in text,
 *    a post read by {bati} falls back to the device's reading voice).
 * The price is unchanged: the small cost 'voice', taken a whole mana at a time as it adds up.
 */
export function batiVoiceSilent(s: Pick<SpendState, 'journeyDay' | 'journeyCompletedAt' | 'balance'>): boolean {
  return !onFirstJourney(s) && Math.floor(s.balance) <= 0;
}

export type BatiGate = { allow: true } | { allow: false; rest: BatiRest };

/**
 * {bati}'s chat: `usedToday` = the replies before this one today. A non-member at 0 → noMana; a member past the ceiling
 * → tired. (A non-member's own daily count is BUDDY_FREE_DAILY, checked by the chat as before.)
 */
export function batiChatGate(s: SpendState, usedToday: number, memberCap: number = BATI_DAILY_CAP_MEMBER): BatiGate {
  if (outOfMana(s)) return { allow: false, rest: 'noMana' };
  if (s.member && usedToday >= memberCap) return { allow: false, rest: 'tired' };
  return { allow: true };
}

/** a non-member's ダチ message over the day's soft cap (`sentToday` counts this one) */
export function dachiCapped(member: boolean, sentToday: number, cap: number = DACHI_DAILY_CAP_FREE): boolean {
  return !member && sentToday > cap;
}

/**
 * The requests a non-member at 0 mana may not make (writes only): the free features around making (spells, lyrics,
 * the compass, novel chapters, pictures in the talk, song and video edits) and reading aloud. {bati}'s chat is decided
 * by batiChatGate; viewing (GET), ダチ, the wallet and the story are never in here.
 */
export const STOPPED_AT_ZERO: RegExp[] = [
  /^\/moon\/(spell|lyrics|incant|compass|novel)(\/|$)/,
  /^\/buddy\/(compass|picture|story)(\/|$)/,
  /^\/compose\//,
  /^\/mars\//,
  /^\/voice\/speak$/,
];
export function stoppedAtZero(method: string, path: string): boolean {
  if (/^(GET|HEAD|OPTIONS)$/i.test(method)) return false;
  const p = path.toLowerCase().split('?')[0];
  return STOPPED_AT_ZERO.some((re) => re.test(p));
}

// ───────────────────────────── {bati}'s lines (story chat: provisional, to be checked) ─────────────────────────────

/** 「マナがなくなっちゃった…。オボロオーダーになると、毎月88マナが湧くよ。」 in each style (mild) */
export const BATI_NO_MANA_LINES: Record<BatiPersonality, string> = {
  genki: 'マナがなくなっちゃった…。オボロオーダーになると、毎月88マナが湧くよ。',
  teinei: 'マナがなくなってしまいマシタ…。オボロオーダーになると、毎月88マナが湧きマス。',
  kansai: 'マナがなくなってもうた…。オボロオーダーになると、毎月88マナが湧くで。',
  cool: 'マナがなくなった…。オボロオーダーになると、毎月88マナが湧く。',
  mellow: 'マナがなくなっちゃったねぇ…。オボロオーダーになると、毎月88マナが湧くよぉ。',
  amae: 'マナがなくなっちゃった…。オボロオーダーになると、毎月88マナが湧くよね。',
  hakata: 'マナがなくなってしもうた…。オボロオーダーになると、毎月88マナが湧くばい。',
  tohoku: 'マナがなくなっちまった…。オボロオーダーになると、毎月88マナが湧くべ。',
  okinawa: 'マナがなくなっちゃった…。オボロオーダーになると、毎月88マナが湧くさー。',
  bushi: 'マナが尽きてしまったでござる…。オボロオーダーになると、毎月88マナが湧くでござる。',
  butler: 'マナがなくなってしまいました…。オボロオーダーになられますと、毎月88マナが湧いてまいります。',
  king: 'マナが尽きてしまったのである…。オボロオーダーになると、毎月88マナが湧くのである。',
  gal: 'マナ、なくなっちゃった…。オボロオーダーになると、毎月88マナ湧くじゃん。',
  galfuwa: 'マナ、なくなっちゃったよ〜…。オボロオーダーになるとね、毎月88マナが湧くよ〜。',
  galane: 'マナ、なくなっちゃった…。オボロオーダーになれば、毎月88マナが湧くよ。',
  galcool: 'マナ、なくなった…。オボロオーダーになると、毎月88マナが湧く。',
  galkansai: 'マナ、なくなってもうた…。オボロオーダーになったら、毎月88マナ湧くやん。',
};

/** a member's {bati} past the day's ceiling: 「今日はいっぱい話したから、ちょっと疲れちゃった…。また明日ね。」 */
export const BATI_TIRED_LINES: Record<BatiPersonality, string> = {
  genki: '今日はいっぱい話したから、ちょっと疲れちゃった…。また明日ね。',
  teinei: '今日はたくさんお話ししたので、少し疲れマシタ…。また明日デス。',
  kansai: '今日はぎょうさん話したから、ちょっと疲れてもうた…。また明日な。',
  cool: '今日はたくさん話した。少し疲れた…。また明日。',
  mellow: '今日はいっぱい話したねぇ。ちょっと疲れちゃった…。また明日ねぇ。',
  amae: '今日はいっぱい話したから、ちょっと疲れちゃった…。また明日、話してくれるよね？',
  hakata: '今日はいっぱい話したけん、ちょっと疲れてしもうた…。また明日ね。',
  tohoku: '今日はいっぺぇ話したから、ちょっと疲れちまった…。また明日な。',
  okinawa: '今日はいっぱい話したから、ちょっと疲れちゃったさー…。また明日ね。',
  bushi: '今日はたくさん語り合ったゆえ、少し疲れたでござる…。また明日でござる。',
  butler: '本日はたくさんお話しいたしましたので、少々疲れてしまいました…。また明日、お待ちしております。',
  king: '今日はたくさん話したのである。少し疲れたぞ…。また明日である。',
  gal: '今日いっぱい話したから、ちょっと疲れちゃった…。また明日ね。',
  galfuwa: '今日いっぱい話したね〜。ちょっと疲れちゃった…。また明日ね〜。',
  galane: '今日はいっぱい話したから、ちょっと疲れた…。また明日おいで。',
  galcool: '今日いっぱい話した。ちょっと疲れた…。また明日。',
  galkansai: '今日いっぱい話したから、ちょっと疲れてもうた…。また明日な。',
};

const EN: Record<BatiRest, string> = {
  noMana: "My mana ran out... With Obolo Order, 88 mana wells up every month.",
  tired: "We talked a lot today, so I'm a little tired... See you tomorrow.",
};

/** {bati}'s line for why it is quiet, in its style */
export function batiRestLine(rest: BatiRest, personality?: BatiPersonality | string | null, locale: string = 'ja'): string {
  if (locale === 'en') return EN[rest];
  const p = normalizeBatiPersonality(personality ?? 'genki');
  return (rest === 'noMana' ? BATI_NO_MANA_LINES : BATI_TIRED_LINES)[p];
}

/** the calm hint under the chat's mic / typing while {bati} is quiet (not an error) */
export const BATI_REST_HINT: Record<BatiRest, string> = {
  noMana: 'いまは、マナが湧くのを待っているところ。作品を見たり聞いたり、ダチとのおしゃべりは、いつでもできるよ。',
  tired: 'いまは、ひと休み中。また明日、話そうね。',
};

// ───────────────────────────── the cost of one message (estimates, docs/マナの値段.md 12.) ─────────────────────────────

/** the sizes the estimates assume */
export const SMALL_COST_ASSUMPTIONS = {
  /** {bati}'s reply: Claude Haiku 5.5, the persona + 20 turns + memories in, the reply (with its faces) out */
  batiReply: { model: 'claude-haiku-5-5', in: 3_000, out: 400 },
  /** your own words' faces beside it (talkBeatsMarked, the same model) */
  batiFaces: { model: 'claude-haiku-5-5', in: 600, out: 120 },
  /** the reply read aloud (Gemini Flash TTS: about 40 characters ≈ 6 s of audio ≈ 200 audio tokens) */
  batiVoice: { model: 'gemini-2.5-flash-preview-tts', in: 120, out: 200 },
  /** a ダチ text's moderation (Flash-Lite, the moderator's prompt + the words; "OK") */
  dachiModeration: { model: 'gemini-2.5-flash-lite', in: 160, out: 3 },
  /** KIMORIN⭐︎'s answer in the ダチ talk (Flash-Lite) and its Fish voice (about 60 characters, 3 bytes each) */
  kimorinReply: { model: 'gemini-2.5-flash-lite', in: 1_200, out: 120 },
  kimorinVoiceBytes: 180,
  /** a 60 s voice message (webm / opus ≈ 0.45 MB) kept on Bunny Storage and sent through its CDN */
  voiceMessageMb: 0.45,
  /** Bunny Storage per GB-month and the CDN per GB (USD, Asia) */
  bunnyStorageUsdPerGbMonth: 0.02,
  bunnyCdnUsdPerGb: 0.03,
  /** a message row (Cloud SQL SSD, USD per GB-month) */
  rowKb: 1,
  sqlUsdPerGbMonth: 0.17,
  /** Cloud Run CPU of the request (seconds) */
  requestCpuSeconds: 0.05,
} as const;

export interface SmallCostEstimate {
  /** {bati}'s reply, text only (the reply + your words' faces) */
  batiReplyJpy: number;
  /** the same read aloud */
  batiReplyVoicedJpy: number;
  /** a ダチ text message (moderation, push, the row for a year, the request) */
  dachiTextJpy: number;
  /** a ダチ voice message (no model: storage for a year, one listen, the row, the request) */
  dachiVoiceJpy: number;
  /** a ダチ work card / file card (the row, the request, push) */
  dachiCardJpy: number;
  /** KIMORIN⭐︎'s answer, voiced / text only */
  kimorinVoicedJpy: number;
  kimorinTextJpy: number;
}

/**
 * The estimated yen of one message (push is Web Push / FCM: free). `cpuSecondJpy` = CPU_SECOND_JPY. The recorded costs
 * (gen_costs, kinds 'chat' / 'voice' / 'dachi') replace these in the daily report.
 */
export function smallCostEstimates(usdJpy = 160, cpuSecondJpy = 0.01): SmallCostEstimate {
  const a = SMALL_COST_ASSUMPTIONS;
  const y = (usd: number) => usd * usdJpy;
  const tok = (t: { model: string; in: number; out: number }) => y(textUsd(t.model, t));
  const cpu = a.requestCpuSeconds * cpuSecondJpy;
  const row = y(((a.rowKb / 1e6) * a.sqlUsdPerGbMonth) * 12);
  const voiceFile = y((a.voiceMessageMb / 1e3) * (a.bunnyStorageUsdPerGbMonth * 12 + a.bunnyCdnUsdPerGb));
  const reply = tok(a.batiReply) + tok(a.batiFaces) + cpu + row;
  const kimorin = tok(a.kimorinReply) + cpu + row;
  const r = (x: number) => Math.round(x * 10_000) / 10_000;
  return {
    batiReplyJpy: r(reply),
    batiReplyVoicedJpy: r(reply + tok(a.batiVoice) + voiceFile / 2),
    dachiTextJpy: r(tok(a.dachiModeration) + cpu + row),
    dachiVoiceJpy: r(voiceFile + cpu + row),
    dachiCardJpy: r(cpu + row),
    kimorinTextJpy: r(kimorin),
    kimorinVoicedJpy: r(kimorin + y((a.kimorinVoiceBytes * FISH_USD_PER_MBYTE) / 1e6) + voiceFile / 3),
  };
}
