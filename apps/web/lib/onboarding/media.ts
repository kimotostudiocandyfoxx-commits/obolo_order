/**
 * Onboarding motion videos (vertical 1080×1920, made by the client).
 * Encode new ones with scripts/encode-onboarding.sh <video> <motion-number>, then add the number here.
 * PLACEHOLDER (P-OB-4): served from apps/web/public/onboarding for the demo; move to Bunny CDN by
 * setting NEXT_PUBLIC_ONBOARDING_MEDIA_BASE (e.g. https://obolo.b-cdn.net/onboarding).
 */
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_ONBOARDING_MEDIA_BASE || '/onboarding').replace(/\/$/, '');

/** Motions that have been delivered. Missing ones render a placeholder so the whole story is testable. */
/** Motion id: Day 1 uses plain numbers (m7.mp4); later days use "<day>-<n>" (m2-1.mp4). */
export type MotionId = number | string;

export const AVAILABLE_MOTIONS: ReadonlySet<MotionId> = new Set<MotionId>([
  // Day 1
  1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 27, 28, 29,
  // Day 2
  '2-1', '2-2', '2-3', '2-9', '2-10',
  // Day 3
  '3-1', '3-3', '3-4', '3-6', '3-7',
  // Day 4
  '4-1',
]);

export const motionUrl = (n: MotionId) => `${MEDIA_BASE}/m${n}.mp4`;
export const posterUrl = (n: MotionId) => `${MEDIA_BASE}/m${n}.jpg`;
export const hasMotion = (n: MotionId) => AVAILABLE_MOTIONS.has(n);

/** Character images shown over the motions (transparent WebP). */
export const spriteUrl = (name: string) => `${MEDIA_BASE}/${name}.webp`;
/** Still background images (JPEG). */
export const stillUrl = (name: string) => `${MEDIA_BASE}/${name}.jpg`;

/** Background music tracks (by the client, DJ SHACHO). Converted to AAC 128 kbps. */
export const bgmUrl = (track: string) => `${MEDIA_BASE}/bgm-${track}.m4a`;
/**
 * PLACEHOLDER (P-OB-8): BGM level under the motions' own sound (0–1). All files are loudness-
 * normalised to −16 LUFS (scripts/normalize-audio.sh); the music now sits about level with the
 * motions' sound (client asked for clearly audible BGM, 2026-10-04).
 */
export const BGM_VOLUME = 0.9;

/** Per-track level (client: the MONBAN music must be clearly audible). */
export const BGM_LEVELS: Record<string, number> = { opening: 0.9, monban: 1, obolon: 0.9 };
export const bgmLevel = (track: string) => BGM_LEVELS[track] ?? BGM_VOLUME;
