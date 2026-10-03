/**
 * Product constants shared by web + api. Values marked PLACEHOLDER are listed in
 * docs/placeholders.md and are expected to move to the admin console later (spec §8).
 */
export const LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';

/** Spec §2.3 — 280-char class posts. */
export const SATURN_MAX_CHARS = 280;
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
/** Spec §1.1 — subscription price in JPY. */
export const SUBSCRIPTION_PRICE_JPY = 88;

/** Buddy memory: summarise every N new messages (PLACEHOLDER P-MOON-3). */
export const BUDDY_SUMMARY_EVERY = 10;
/** Buddy memory: number of recent messages sent verbatim to the LLM. */
export const BUDDY_CONTEXT_MESSAGES = 20;

/** Business-day boundary for daily quotas. Spec does not say; PLACEHOLDER (P-MOON-2). */
export const QUOTA_TIMEZONE = 'Asia/Tokyo';
