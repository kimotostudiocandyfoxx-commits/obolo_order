/**
 * Still-based cuts (client 2026-11-28, design/refs/2026-11-28-rocket/storyboard.md): day 2 from 「待ちなさい。」 to the
 * rocket is told with painted stills and background plates instead of generated video. A `still` step may name a shot
 * here; the stage (components/story/Shot.tsx) then moves the picture like a film camera:
 *   cam     Ken Burns from → to over `dur` seconds (scale; x / y = the point of the picture at the centre of the screen,
 *           % of the picture). The next still step on the SAME picture with another shot reframes smoothly from where
 *           the camera is (`reframe` seconds) — the over-the-shoulder shot moving to whoever speaks.
 *   layers  cut-outs (onboarding/<src>.webp) standing on the plate: x = their centre, y = their feet, h = their height,
 *           all % of the picture; `drift` moves a layer a little more than the plate (parallax, % of its own size);
 *           `reflect` mirrors it faintly on a polished floor; `anim` a move of its own.
 *   fx      light effects in picture coordinates (they move with the camera); `at` / `dur` in seconds from the cut.
 *   enter   how the cut comes in when it is not a plain cross-fade.
 *   cast    who is in the picture: the cinema brings no close-up of them while they speak (OBOLON and MONBAN in the
 *           over-the-shoulder shot are filmed there, KIMORIN from behind speaks from behind).
 * Everything moves with transform / opacity only; with prefers-reduced-motion the camera rests on `to`, layers stand
 * at their last place and the particles are not drawn.
 */
export interface ShotCam {
  s: number;
  x: number;
  y: number;
}

export type ShotLayerAnim =
  /** walks away from us into the picture: smaller and higher, a small bob each step */
  | 'walk-away'
  /** fades in */
  | 'in'
  /** dissolves into rising light (OBOLON leaving for the Moon) */
  | 'vanish';

export interface ShotLayer {
  src: string;
  x: number;
  y: number;
  h: number;
  /** parallax: how far it moves beyond the plate over the shot, [dx, dy] in % of its own size */
  drift?: [number, number];
  flip?: boolean;
  /** soft focus (px), e.g. the foreground shoulder of an over-the-shoulder shot */
  blur?: number;
  /** a faint mirror image on the polished floor under the feet */
  reflect?: boolean;
  /** darken / tint to sit in the plate's light (CSS filter after the blur) */
  tone?: string;
  /** the plate's key light on the figure: a warm gradient laid over the cut-out only (soft-light), e.g. from the ring */
  key?: string;
  /** a thin warm rim of light around the silhouette (the light behind it) */
  rim?: string;
  /** the halo layer behind MONBAN's head, as on the stage */
  halo?: boolean;
  anim?: ShotLayerAnim;
  /** seconds the anim takes (walk-away 3.2, vanish 2.2) */
  animDur?: number;
  /** OBOLON's slow float */
  float?: boolean;
}

export type ShotFx =
  /** a pillar of light drops from the top to (x, y) */
  | { k: 'beam'; x: number; y: number; w: number; at?: number }
  /** a star glint at (x, y) */
  | { k: 'glint'; x: number; y: number; at?: number; size?: number }
  /** a soft band of light running up a region (the rocket's lines): x, y = top left, w, h in % of the picture */
  | { k: 'sweep'; x: number; y: number; w: number; h: number; period?: number }
  /** a ring of light breathing and flaring at (x, y), r = radius % of the picture's width */
  | { k: 'ring'; x: number; y: number; r: number }
  /** a warm glow breathing at (x, y) (the mana gem) */
  | { k: 'glow'; x: number; y: number; r: number; color?: string }
  /** dust motes drifting in the light */
  | { k: 'dust'; n?: number }
  /** stars twinkling in the upper part */
  | { k: 'stars'; n?: number; top?: number; bottom?: number }
  /** warm light spilling over the floor from (x, y) */
  | { k: 'spill'; x: number; y: number; at?: number }
  /** a point of light flying from (x, y) to (x2, y2) */
  | { k: 'streak'; x: number; y: number; x2: number; y2: number; at?: number; dur?: number; grow?: boolean };

export interface Shot {
  from: ShotCam;
  to: ShotCam;
  /** seconds from `from` to `to` */
  dur: number;
  /** seconds to reframe from the shot before on the same picture (default 0.9) */
  reframe?: number;
  layers?: ShotLayer[];
  fx?: ShotFx[];
  /** whip: a fast sideways slide with motion blur; bloom: out of a white-gold glow; flash: a white flash; settle: a quick
   * push that settles (someone turning to us) */
  enter?: 'whip' | 'bloom' | 'flash' | 'settle';
  /** ends in a white-gold glow (pushing through a door into light) at this second */
  bloomOut?: number;
  /** who is in the picture (speaker names) */
  cast?: string[];
}

const C = (s: number, x = 50, y = 50): ShotCam => ({ s, x, y });

/** OBOLON (the client's own picture) and MONBAN standing small before the rocket's steps */
const OBOLON_FAR: ShotLayer = { src: 'obolon', x: 43, y: 69, h: 5.5, float: true };
const MONBAN_FAR: ShotLayer = { src: 'monban', x: 58, y: 75.5, h: 11, reflect: true, tone: 'brightness(0.85)', halo: true };
/** KIMORIN from behind on the plaza, warmed to the dusk light */
// graded to the plate (client 2026-11-28: it read darker and greyer than the evening light): warmer, a touch of
// contrast, the ring's and lanterns' warm key from his right, a thin gold rim
const KIMORIN_BACK: ShotLayer = {
  src: 'kb-back',
  x: 27,
  y: 106,
  h: 40,
  drift: [-4, -2],
  tone: 'brightness(1.0) contrast(1.08) sepia(0.32) saturate(1.3)',
  key: 'linear-gradient(255deg, rgba(255,190,110,.85) 0%, rgba(255,170,100,.35) 40%, rgba(40,50,110,.35) 100%)',
  rim: 'rgba(255,205,140,.75)',
};
/** the over-the-shoulder shot: KIMORIN's shoulder soft in front, OBOLON and MONBAN before the rocket's steps */
const OTS = (obolon?: ShotLayer['anim']): ShotLayer[] => [
  { src: 'obolon', x: 47, y: 49, h: 8.5, float: !obolon, anim: obolon, animDur: 2.2 },
  { src: 'monban', x: 68, y: 72, h: 30, reflect: true, tone: 'brightness(0.88)', halo: true },
  {
    src: 'kb-ots',
    x: 11,
    y: 106,
    h: 58,
    blur: 2.5,
    drift: [-3, 0],
    tone: 'brightness(0.86) contrast(1.06) sepia(0.34) saturate(1.3)',
    key: 'linear-gradient(260deg, rgba(255,186,105,.8) 0%, rgba(255,160,95,.3) 45%, rgba(30,40,95,.45) 100%)',
    rim: 'rgba(255,200,130,.6)',
  },
];

/**
 * Foregrounds laid over a background motion ('fore' steps): KIMORIN's back, large, soft and low in the frame, so the
 * film reads as KIMORIN watching (client playtest 2026-11-28: day 2's universe in the Earth temple is the day-1 film).
 */
export const FOREGROUNDS: Record<string, ShotLayer[]> = {
  'kimorin-watch': [
    {
      src: 'kb-back',
      x: 24,
      y: 122,
      h: 62,
      blur: 3,
      drift: [-2, -1],
      tone: 'brightness(0.62) contrast(1.05) saturate(0.9)',
      key: 'linear-gradient(200deg, rgba(150,175,255,.55) 0%, rgba(255,205,140,.35) 45%, rgba(10,14,40,.6) 100%)',
      rim: 'rgba(190,210,255,.55)',
    },
  ],
};

export const SHOTS: Record<string, Shot> = {
  // A — the gate
  // heading through the open gate toward the Earth temple (playtest 2026-11-28): a steady push past MONBAN; it is cut
  // off by the black of 「待ちなさい。」 before it arrives anywhere
  'gate-go': { from: C(1.0, 50, 52), to: C(1.32, 50, 47), dur: 3.2, cast: ['MONBAN'] },
  'reveal-whip': { from: C(1.0), to: C(1.06, 50, 46), dur: 5, enter: 'whip', fx: [{ k: 'glint', x: 47, y: 37, at: 0.55, size: 7 }], cast: ['KIMORIN'] },
  // the gate exchange as shot / reverse shot (client playtest 2026-11-28, story M-R347): MONBAN over KIMORIN's shoulder —
  // KIMORIN's back big and soft in the foreground, MONBAN before the open gate in focus; a slow push on MONBAN
  'gate-ots-monban': {
    from: C(1.08, 50, 62),
    to: C(1.17, 52, 60),
    dur: 7,
    reframe: 0.9,
    layers: [
      { src: 'monban', x: 52, y: 86, h: 34, reflect: true, tone: 'brightness(0.86)', halo: true },
      {
        src: 'kb-ots',
        x: 11,
        y: 112,
        h: 62,
        blur: 4,
        drift: [-3, 0],
        tone: 'brightness(0.62) contrast(1.06) sepia(0.4) saturate(1.25)',
        key: 'linear-gradient(250deg, rgba(255,190,110,.85) 0%, rgba(255,160,95,.3) 45%, rgba(30,30,60,.5) 100%)',
        rim: 'rgba(255,205,140,.7)',
      },
    ],
    cast: ['MONBAN'],
  },
  'gate-two': { from: C(1.05, 50, 50), to: C(1.0), dur: 6, cast: ['KIMORIN', 'MONBAN'] },
  'invite-hand': { from: C(1.0), to: C(1.12, 50, 52), dur: 4, cast: ['KIMORIN', 'MONBAN'] },
  'kimorin-turn': { from: C(1.1, 50, 42), to: C(1.0), dur: 0.6, enter: 'settle', cast: ['KIMORIN'] },
  'gate-through': { from: C(1.0, 50, 55), to: C(1.38, 50, 52), dur: 2.4, bloomOut: 1.6 },

  // B — the Earth temple
  'temple-dark': { from: C(1.0, 50, 55), to: C(1.05, 50, 55), dur: 4, fx: [{ k: 'beam', x: 50, y: 84, w: 8, at: 0.9 }] },
  // the Earth temple exchange as shot / reverse shot (playtest 2026-11-28, story M-R347 addendum): OBOLON over KIMORIN's
  // shoulder — OBOLON (the client's picture, laid over the painted orb in its place) floating in the hall, KIMORIN's back
  // big and soft in the gold-lit foreground; a slow push on OBOLON
  'tr-obolon': {
    from: C(1.14, 55, 56),
    to: C(1.26, 53, 56),
    dur: 7,
    layers: [
      { src: 'obolon', x: 50.1, y: 62.5, h: 11.3, float: true },
      {
        src: 'kb-ots',
        x: 7,
        y: 116,
        h: 68,
        blur: 4.5,
        drift: [-3, 0],
        tone: 'brightness(0.5) contrast(1.08) sepia(0.45) saturate(1.3)',
        key: 'linear-gradient(240deg, rgba(255,186,100,.85) 0%, rgba(230,150,70,.3) 45%, rgba(10,8,20,.6) 100%)',
        rim: 'rgba(255,196,120,.7)',
      },
    ],
    cast: ['OBOLON'],
  },
  'temple-sky': { from: C(1.24, 50, 72), to: C(1.0, 50, 45), dur: 6.5, fx: [{ k: 'stars', n: 40, top: 0, bottom: 45 }] },
  'leave-gate': {
    from: C(1.0, 50, 55),
    to: C(1.04, 50, 50),
    dur: 6,
    layers: [{ src: 'kb-walk', x: 50, y: 98, h: 46, anim: 'walk-away', animDur: 3.2, tone: 'contrast(1.05) sepia(0.3) saturate(1.2)', rim: 'rgba(255,214,150,.8)' }],
    fx: [{ k: 'streak', x: 50, y: 73, x2: 55, y2: 2, at: 3.0, dur: 1.1 }],
    cast: ['KIMORIN'],
  },
  'back-gate': { from: C(1.04, 50, 50), to: C(1.04, 50, 50), dur: 1, fx: [{ k: 'streak', x: 47, y: 6, x2: 50, y2: 55, at: 0.2, dur: 0.7, grow: true }] },
  'wall-push': { from: C(1.0, 50, 50), to: C(1.08, 50, 46), dur: 2.2 },
  'wall-open': {
    from: C(1.08, 50, 46),
    to: C(1.12, 50, 46),
    dur: 3,
    layers: [{ src: 'obolon', x: 50.1, y: 62.5, h: 11.3, float: true }],
    fx: [{ k: 'spill', x: 50, y: 52, at: 0.2 }, { k: 'dust', n: 26 }],
    cast: ['OBOLON'],
  },
  'wall-through': { from: C(1.12, 50, 46), to: C(1.55, 50, 44), dur: 2.4, bloomOut: 1.7, layers: [{ src: 'obolon', x: 50.1, y: 62.5, h: 11.3, float: true }] },

  // C — the rocket plaza
  'plaza-wide': {
    from: C(1.35, 50, 80),
    to: C(1.0, 50, 50),
    dur: 5.5,
    enter: 'bloom',
    layers: [OBOLON_FAR, MONBAN_FAR, KIMORIN_BACK],
    fx: [{ k: 'ring', x: 50, y: 41.5, r: 33 }, { k: 'sweep', x: 44, y: 6, w: 12, h: 52 }, { k: 'dust', n: 30 }],
    cast: ['KIMORIN', 'OBOLON', 'MONBAN'],
  },
  'plaza-low': {
    from: C(1.25, 50, 78),
    to: C(1.0, 50, 50),
    dur: 5,
    fx: [{ k: 'sweep', x: 42, y: 4, w: 16, h: 66 }],
    cast: ['OBOLON'],
  },
  'ots-monban': {
    from: C(1.06, 60, 52),
    to: C(1.14, 64, 52),
    dur: 7,
    reframe: 0.9,
    layers: OTS(),
    fx: [{ k: 'dust', n: 18 }],
    cast: ['OBOLON', 'MONBAN'],
  },
  'ots-obolon': {
    from: C(1.08, 48, 46),
    to: C(1.18, 47, 45),
    dur: 7,
    reframe: 0.9,
    layers: OTS(),
    fx: [{ k: 'dust', n: 18 }],
    cast: ['OBOLON', 'MONBAN'],
  },
  'ots-vanish': {
    from: C(1.18, 47, 45),
    to: C(1.12, 52, 48),
    dur: 3,
    reframe: 0.6,
    layers: OTS('vanish'),
    fx: [{ k: 'dust', n: 30 }],
    cast: ['OBOLON', 'MONBAN'],
  },
  reverse: { from: C(1.04, 50, 50), to: C(1.0, 50, 50), dur: 6 },
  'gem-monban': { from: C(1.0, 50, 60), to: C(1.1, 50, 62), dur: 6, fx: [{ k: 'glow', x: 50, y: 62, r: 16 }, { k: 'dust', n: 20 }], cast: ['MONBAN'] },
  'gem-kimorin': { from: C(1.08, 50, 55), to: C(1.0, 50, 52), dur: 1.2, enter: 'settle', fx: [{ k: 'glow', x: 50, y: 66, r: 14 }], cast: ['KIMORIN'] },
  'plaza-after': {
    from: C(1.0, 50, 50),
    to: C(1.08, 50, 52),
    dur: 7,
    layers: [MONBAN_FAR, KIMORIN_BACK],
    fx: [{ k: 'ring', x: 50, y: 41.5, r: 33 }, { k: 'sweep', x: 44, y: 6, w: 12, h: 52 }, { k: 'dust', n: 30 }],
    cast: ['KIMORIN', 'MONBAN'],
  },
};
