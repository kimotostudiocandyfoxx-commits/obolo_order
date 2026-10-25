/**
 * Every number of the characters' "alive" motion in one place (client 2026-10-25: the strength and speed
 * are tuned here after the client has seen them). Times in ms, sizes in % of the character's height
 * unless noted. 0 turns a motion off.
 */
export const MOTION = {
  /** breathing while not speaking: a slow rise and fall */
  breath: { period: 3200, amount: 0.9 },
  /** the speaker takes the floor: a small hop */
  hop: { height: 2.2, ms: 320 },
  /** a new pose for the line: a small lift and settle */
  pose: { lift: 2, ms: 280 },
  /** lip sync: the voice's loudness (0–1) above which the mouth is open, and the shortest open / shut */
  lip: { open: 0.06, holdMs: 70 },
  /** KIMORIN's eye slits: a soft glow that breathes (never while the sunglasses are on) */
  eyes: { period: 2600, min: 0.35, max: 0.95 },
  /** the tail feathers, a layer of their own: a slow sway (degrees) */
  tail: { deg: 2.2, period: 2400 },
  /** reactions picked from the line */
  react: {
    /** surprise: a jump and a quick shiver */
    shock: { jump: 5, ms: 520 },
    /** a silent stare 「……」: the camera leans in slowly */
    stare: { zoom: 1.06, ms: 1800 },
    /** shaken 「もももちろん」: a small tremble */
    tremble: { px: 1.6, ms: 90 },
  },
  /** the ones not speaking step back into the dark */
  dim: { brightness: 0.45, saturate: 0.7 },
} as const;
