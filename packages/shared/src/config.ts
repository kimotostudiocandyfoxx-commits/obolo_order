import { PLANET_FLY_HOURS } from './flying';
/**
 * Product constants shared by web + api. Values marked PLACEHOLDER are listed in
 * docs/placeholders.md and are expected to move to the admin console later (spec §8).
 */
export const LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';

/** Spec §2.3 — 280-char class posts. */
export const SATURN_MAX_CHARS = 280;
/** Saturn kororins spin on everyone's DJ record this long, then go back to their maker's own record (M-R208). */
export const SATURN_LIFETIME_HOURS = PLANET_FLY_HOURS;
/** ひろば names stay short enough for the label over the island. */
export const PLAZA_NAME_MAX = 16;
/** The landmark standing on a ひろば's island (PLACEHOLDER P-SAT-13: drawn art later). */
export const PLAZA_ICONS = ['⭐', '🏯', '⛄', '🗽', '🌸', '⛩️', '🎤', '💜', '🎮', '🍜', '⚽', '🎵', '🐱', '🌊', '📚', '🎨', '🏔️', '🍰'] as const;
/** PLACEHOLDER (P-SAT-1): max voice length for a Saturn post. */
export const VOICE_MAX_SECONDS = 60;
/** PLACEHOLDER (P-SAT-1): max upload size for a voice clip. */
export const VOICE_MAX_BYTES = 3 * 1024 * 1024;
export const VOICE_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/x-m4a'] as const;

/** Spec §2.2 — default free daily quota (admin-tunable). */
export const BUDDY_FREE_DAILY_MESSAGES = 30;
/** Spec §2.2 — cost per message beyond the quota. */
export const BUDDY_OVERAGE_MANA = 1;
/** Spec §3.4 — monthly grant included in the ¥88 subscription. */
export const MONTHLY_GRANT_MANA = 88;
/**
 * The mana gems a member can buy when the mana runs short (P-BILL-1, client 2026-11-24). Exactly three prices (JPY, tax
 * included). Client decision 2026-11-24: 1 yen = 1 mana, no bonus (88 → 88, 888 → 888, 8,888 → 8,888), the same ratio
 * as the monthly grant (MONTHLY_GRANT_MANA for ORDER_PRICE_JPY). To change the mana, change the `mana` numbers here and
 * only here (the API's checkout, the sheet in the app and /tokushoho all read this table).
 */
export const MANA_GEMS = [
  { id: 'gem88', priceJpy: 88, mana: 88 },
  { id: 'gem888', priceJpy: 888, mana: 888 },
  { id: 'gem8888', priceJpy: 8888, mana: 8888 },
] as const;
export type ManaGem = (typeof MANA_GEMS)[number];
export type ManaGemId = ManaGem['id'];
/** the gem with this id, or undefined */
export const findManaGem = (id: string): ManaGem | undefined => MANA_GEMS.find((g) => g.id === id);
/**
 * The first mana gem, the inviter's gift (story M-R124/M-R132): enough to make everything on the first journey
 * once and redo each once (look 3+3, kororin design 3+3, jacket art 3+3, song 2+2, MV 8+8 = 38) and a little more.
 * PLACEHOLDER (P-WALLET-2): the operator decides the number.
 */
export const STARTER_GEM_MANA = 88;
/**
 * What making costs: client 2026-11-25 — no fixed numbers any more. MAKE_COST (manaPrice.ts) is the fallback of the price
 * rule (manaFor: cost + Stripe's fee + 8%); the API serves and charges the live prices. Voice kororins, photo /
 * words-only jackets, delivering and DJ spend no mana with a yes (their small costs are added up: manaPrice.ts accrueUsage).
 */
/**
 * R13 (client 2026-11-25, docs/動画の作り方.md): a video is pictures that move — no video-generation model. `mv` paints a
 * new picture per scene (FLUX.2 klein, ~0.2 yen a picture) and moves them; `mvPictures` moves the member's own pictures
 * (nothing painted: CPU only); `mvRedraw` paints one scene again. A change of how it moves (camera, fades, lyrics, order,
 * length, the part of the song) is a re-render on the CPU: free, capped a day (VIDEO_EDITS_PER_DAY). PROPOSED numbers.
 */
export const VIDEO_EDITS_PER_DAY = 20;
/**
 * client 2026-11-25 (本・ゲーム): the costs above — a game's first build (MAKE_COST.game) and each recast / tweak after
 * it (MAKE_COST.gameTweak) spend mana, with the member's yes; a book's chapters are free (no confirm card) and capped per
 * day instead, to keep the model's cost sane. PROPOSED numbers for the client (change them here only).
 */
export const NOVEL_CHAPTERS_PER_DAY = 20;
/** a book's chapters at most (then {bati} says the book is full: start a new one) */
export const NOVEL_MAX_CHAPTERS = 30;
/** game builds and tweaks a day per member (mana is spent too; this is only the model's safety cap) */
export const GAME_BUILDS_PER_DAY = 20;
/** games a member can report as not running (the mana given back) per day */
export const GAME_REFUNDS_PER_DAY = 3;
/**
 * Bati's room (the Moon, P-BATI-ROOM): rounds a day per member of dressing up the Bati, and of Bati's magic on the
 * member's own look. Free during the first journey; after it each round takes the look's mana (MAKE_COST.look).
 * PLACEHOLDER (P-BATI-ROOM): ~3 pictures (restyle) / 4 pictures (look) per round, ~¥6 each.
 */
export const BATI_RESTYLE_PER_DAY = 30; // M-R207: Bati's magic is free and "as often as you like" on day 2 — 30 is only a cost safety cap
export const BATI_MAGIC_PER_DAY = 30;
/**
 * M-R223 (D03-S008): {bati}'s look — opened without a wish, four cards of the {bati} as it is now in four art touches
 * (the script's examples). With a wish, four variations of it. The label is shown under each card.
 */
export const BATI_RESTYLE_TOUCHES = [
  { id: 'anime', label: 'アニメ風' },
  { id: 'yuru', label: 'ゆるキャラ風' },
  { id: '3d', label: '3D風' },
  { id: 'pixel', label: 'ドット絵風' },
] as const;
export type BatiRestyleTouch = (typeof BATI_RESTYLE_TOUCHES)[number]['id'];
/** M-R223: the looks kept per {bati} and of the member's own (〔前に戻す〕, Bluena's first shelf) */
export const LOOK_HISTORY_MAX = 12;
/** Spec §1.1 — subscription price in JPY. */
export const SUBSCRIPTION_PRICE_JPY = 88;

/** Buddy memory: summarise every N new messages (PLACEHOLDER P-MOON-3). */
export const BUDDY_SUMMARY_EVERY = 10;
/**
 * Buddy memory: number of recent messages sent verbatim to the LLM. R12 (client: "it forgets the message from two
 * turns ago"): 40 messages = the last 20 turns, bounded by BUDDY_CONTEXT_CHARS (newest kept).
 */
export const BUDDY_CONTEXT_MESSAGES = 40;
/** the recent turns' size bound (about 4–6k tokens of Japanese): the oldest turns are dropped first */
export const BUDDY_CONTEXT_CHARS = 8000;

/** R12: the recent turns, newest last, cut to the message count and the size bound (the newest are kept whole) */
export function contextWindow<T extends { text: string }>(turns: readonly T[], maxMessages = BUDDY_CONTEXT_MESSAGES, maxChars = BUDDY_CONTEXT_CHARS): T[] {
  const out: T[] = [];
  let size = 0;
  for (let i = turns.length - 1; i >= 0 && out.length < maxMessages; i--) {
    const t = turns[i];
    if (!t.text) continue;
    if (size + t.text.length > maxChars && out.length) break;
    size += t.text.length;
    out.unshift(t);
  }
  return out;
}

/** Business-day boundary for daily quotas. Spec does not say; PLACEHOLDER (P-MOON-2). */
export const QUOTA_TIMEZONE = 'Asia/Tokyo';

/**
 * Upload processing policy (client decision 2026-10-06, docs/media.md). Re-encoding keeps a member
 * who watches the full 88 minutes a day at roughly 30 GB/month of delivery.
 */
export const MEDIA_POLICY = {
  video: {
    /** shorter side */
    maxSide: 720,
    maxrate: '1500k',
    bufsize: '3000k',
    audioBitrate: '96k',
    /** raw upload size accepted before re-encoding */
    maxUploadBytes: 120 * 1024 * 1024,
    /** default / hard cap on length; planets ask for less (Jupiter: 8 s). PLACEHOLDER (P-MEDIA-3). */
    maxSeconds: 60,
  },
  photo: { maxSide: 1600, quality: 80, maxUploadBytes: 25 * 1024 * 1024 },
} as const;

/** Jupiter: a post flies as a butterfly this long, then becomes a leaf on the tree. */
export const JUPITER_FLY_HOURS = PLANET_FLY_HOURS;
/** Videos kept in Mars's 裏スタジオ are cut to this length (the media policy maximum). */
export const MARS_VIDEO_SECONDS = 60;
/** The four branches every tree starts with (renamable). */
export const JUPITER_DEFAULT_BRANCHES = ['旅行', 'ごはん', 'おさんぽ', 'おまつり'];
