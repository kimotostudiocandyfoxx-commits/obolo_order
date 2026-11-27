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
  /**
   * the tail feathers, a layer of their own. Client 2026-11-27: they do NOT sway — the sway moved badly cut edges with
   * them and opened a gap to the body, so the tail is simply shown (0 = off)
   */
  tail: { deg: 0, period: 2400 },
  /** reactions picked from the line */
  react: {
    /** surprise: a jump and a quick shiver */
    shock: { jump: 5, ms: 520 },
    /** a silent stare 「……」: the camera leans in slowly */
    stare: { zoom: 1.06, ms: 1800 },
    /** shaken 「もももちろん」: a small tremble */
    tremble: { px: 1.6, ms: 90 },
  },
  /** a character alone on stage comes up close while speaking, like two do (false: stays standing) */
  soloBust: true,
  /**
   * days 1–2 (lib/onboarding/stage.ts 'cinema'): the one speaking alone on screen, pushed in close. zoom: how far
   * (×, capped per character by bustMax × smallBoost); faceAt: where the face lands (% from the top); push: the
   * camera's move onto a new speaker (from `from`× and `panPct` % to the side, `ms`); drift: the slow push while they
   * talk (to `scale`×, `ms` each way); cutMs: how fast the one before leaves; punch: a shout zooms this much more
   * and shakes; muse: a 「……」 line drifts in further and slower
   */
  cinema: { zoom: 2.5, smallBoost: 1.35, faceAt: 33, push: { from: 0.78, panPct: 9, ms: 560 }, drift: { scale: 1.045, px: 1.2, ms: 6500 }, cutMs: 110, punch: { zoom: 1.1, shakeMs: 360 }, muse: { scale: 1.1, ms: 5200 } },
  /**
   * the ones who do not move like the rest (client 2026-11-27; components/story/Stage.tsx CharSpec.poise, and the row's
   * figures in components/story/StoryTalk.tsx):
   *   still   MONBAN — no bob with the voice, no hop, no breathing; eyeLight: how bright the small light on his golden
   *           eye is (0–1; it never flares with the voice), eyeLayer: how much of the poses' painted eye glow is
   *           left (0 = none); halo: the golden disc behind his head (components/story/Halo.tsx) — its opacity breathes
   *           between opacity[0] and opacity[1] once every ms (kept faint: no strong glow; it never turns or moves),
   *           dim: what is left of it while he stands back in the dark. prefers-reduced-motion: it does not breathe
   *   divine  OBOLON — no shaking: the orb floats floatPct % of its height up and down once every floatMs (very slow),
   *           its corona breathes between corona[0] and corona[1] (opacity) every coronaMs, and `motes` small lights
   *           drift up risePct % of the orb's height, one trip in about moteMs. prefers-reduced-motion: none of it moves
   */
  poise: {
    still: { eyeLight: 0.45, eyeLayer: 0.12, halo: { opacity: [0.22, 0.32], ms: 9000, dim: 0.45 } },
    divine: { floatPct: 1.6, floatMs: 9000, corona: [0.55, 0.95], coronaMs: 7000, motes: 6, moteMs: 11000, risePct: 26 },
  },
  /** the ones not speaking step back into the dark */
  dim: { brightness: 0.45, saturate: 0.7 },
} as const;
