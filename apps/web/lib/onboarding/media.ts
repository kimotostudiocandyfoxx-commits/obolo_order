/**
 * Onboarding motion videos (vertical 1080×1920, made by the client).
 * Encode new ones with scripts/encode-onboarding.sh <video> <motion-number>, then add the number here.
 * PLACEHOLDER (P-OB-4): served from apps/web/public/onboarding for the demo; move to Bunny CDN by
 * setting NEXT_PUBLIC_ONBOARDING_MEDIA_BASE (e.g. https://obolo.b-cdn.net/onboarding).
 */
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_ONBOARDING_MEDIA_BASE || '/onboarding').replace(/\/$/, '');

/** Motions that have been delivered. Missing ones render a placeholder so the whole story is testable. */
export const AVAILABLE_MOTIONS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 27, 28, 29]);

export const motionUrl = (n: number) => `${MEDIA_BASE}/m${n}.mp4`;
export const posterUrl = (n: number) => `${MEDIA_BASE}/m${n}.jpg`;
export const hasMotion = (n: number) => AVAILABLE_MOTIONS.has(n);

/** Background music tracks (by the client, DJ SHACHO). Converted to AAC 128 kbps. */
export const bgmUrl = (track: string) => `${MEDIA_BASE}/bgm-${track}.m4a`;
/** PLACEHOLDER (P-OB-8): BGM level under the motions' own sound (0–1). */
export const BGM_VOLUME = 0.55;
