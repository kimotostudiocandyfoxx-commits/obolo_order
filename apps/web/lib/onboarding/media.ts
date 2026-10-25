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
  // motion 7 in two (client 2026-10-15): the doors close / MONBAN appears in the smoke
  '7-a', '7-b',
  // Day 1 without the words painted in (production 2026-10-19): the words are set in code
  '1-c', '5-f', '27-c',
  // loops without their fade to black at both ends (no dark flash where they loop)
  '9-l', '28-l',
  // made with Seedance 2.5 (2026-10-20): the joins of day 1
  'd1-open', 'd1-fold', 'd1-arrive', 'd1-gate-loop', 'd1-monban',
  // made with Seedance 2.5 (2026-10-21): day 2 (docs/story-rewrite/day2-video-plan.md)
  'd2-ticket', 'd2-ticket-give', 'd2-kimorin-turn', 'd2-kimorin-face', 'd2-glasses-up', 'd2-kimorin-startle',
  'd2-kimorin-leave', 'd2-kimorin-back', 'd2-floor-open', 'd2-descend', 'd2-gem', 'd2-cards', 'd2-book',
  'd2-launch', 'd2-rocket-in', 'd2-landing', 'd2-moon-enter', 'd2-pinpon', 'd2-transform', 'd2-dragon',
  'd2-kimorin-back-normal', 'd2-altar', 'd2-hatch-sun', 'd2-hatch-earth', 'd2-pinpon-earth', 'd2-pinpon-sun',
  'd2-moon-night',
  // the gate of the script of 2026-10-22
  'd2-step-in', 'd2-monban-smoke',
  // motion 12 in two (client 2026-10-22, day 2): through the gate | on into the hall — KIMORIN calls in between
  '12-a', '12-b', 'd2-sky', 'd2-monban-walkin',
  // the paper airplane (Seedance) and the look back through the gate (a whip pan made from its two pictures)
  'd2-plane', 'd2-look-back',
  // KIMORIN's entrance up the avenue, his walk into the temple, OBOLON's light (client 2026-10-22)
  'd2-kimorin-walkup', 'd2-walk-in', 'd2-obolon-appear',
  // Day 3
  '3-1', '3-3', '3-4', '3-6', '3-7',
  // Day 4
  '4-1',
]);

/**
 * Motions planned and being made (Seedance, docs/story-rewrite/day2-video-plan.md): until they arrive the
 * story shows a placeholder; the test of days 1–3 lets these through and nothing else.
 */
export const PLANNED_MOTIONS: ReadonlySet<MotionId> = new Set<MotionId>([]);

/**
 * Sound effects that have a made file (onboarding/se-<id>.mp3, design/story-audio-queue.json). Others are
 * synthesised in the browser (lib/story/sfx.ts).
 */
export const SE_FILES: ReadonlySet<string> = new Set<string>([
  'bell', 'blip', 'boing', 'chime', 'crackers', 'ding', 'egg-crack', 'footsteps', 'gate-close', 'gong', 'heartbeat', 'knock', 'magic', 'paper', 'pop', 'portal', 'rocket', 'smoke', 'sparkle', 'stamp', 'thud', 'whoosh',
]);
export const seUrl = (id: string) => `${MEDIA_BASE}/se-${id}.mp3`;

/**
 * Who is already drawn in a still (so their standee is not added over it while they speak). Stills named
 * with kimorin / monban show them; the rest are listed.
 */
const STILL_CAST: Record<string, string[]> = {
  's/d2-gate-two-inside': ['KIMORIN', 'MONBAN'],
  's/d2-hall-run': ['KIMORIN', 'MONBAN', 'OBOLON'],
  's/d2-moon-bed': ['KIMORIN'],
  's/d2-launch-pit': [],
};
export function stillShows(still: string, who: string): boolean {
  const w = who.startsWith('KIMORIN') ? 'KIMORIN' : who;
  if (STILL_CAST[still]) return STILL_CAST[still].includes(w);
  return (w === 'KIMORIN' && still.includes('kimorin')) || (w === 'MONBAN' && still.includes('monban'));
}

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
