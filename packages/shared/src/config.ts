/**
 * Product constants shared by web + api. Values marked PLACEHOLDER are listed in
 * docs/placeholders.md and are expected to move to the admin console later (spec §8).
 */
export const LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';

/** Spec §2.3 — 280-char class posts. */
export const SATURN_MAX_CHARS = 280;
/** Saturn voices vanish this many hours after they are dropped (client decision 2026-10-07). */
export const SATURN_LIFETIME_HOURS = 88;
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
 * The first mana gem, the inviter's gift (story M-R124/M-R132): enough to make everything on the first journey
 * once and redo each once (look 3+3, kororin design 3+3, jacket art 3+3, song 2+2, MV 8+8 = 38) and a little more.
 * PLACEHOLDER (P-WALLET-2): the operator decides the number.
 */
export const STARTER_GEM_MANA = 40;
/**
 * What making costs (the story's table, D08-S002). Voice kororins, photo / words-only jackets, delivering and DJ are free.
 * picture: 〔🖼 絵で見る〕 on the Moon (M-R140) — the first one is free; "少し" = 1 mana (the sources are free; proposed to
 * the story chat 2026-10-28, its answer pending).
 */
export const MAKE_COST = { look: 3, kororinDesign: 3, jacketArt: 3, song: 2, mv: 8, picture: 1 } as const;
export type MakeKind = keyof typeof MAKE_COST;
/** Spec §1.1 — subscription price in JPY. */
export const SUBSCRIPTION_PRICE_JPY = 88;

/** Buddy memory: summarise every N new messages (PLACEHOLDER P-MOON-3). */
export const BUDDY_SUMMARY_EVERY = 10;
/** Buddy memory: number of recent messages sent verbatim to the LLM. */
export const BUDDY_CONTEXT_MESSAGES = 20;

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
export const JUPITER_FLY_HOURS = 88;
/** Videos kept in Mars's 裏スタジオ are cut to this length (the media policy maximum). */
export const MARS_VIDEO_SECONDS = 60;
/** The four branches every tree starts with (renamable). */
export const JUPITER_DEFAULT_BRANCHES = ['旅行', 'ごはん', 'おさんぽ', 'おまつり'];
