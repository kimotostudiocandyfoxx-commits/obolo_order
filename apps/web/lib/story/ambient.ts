/**
 * The living backgrounds of the story from day 3 on (the row scenes, D04 onward and the members' days m1–m3): what
 * moves a little in the sky behind the figures, and what drifts in front of them, per planet — the story team's spec
 * (2026-11-23), word for word in the comments below. Drawn by components/story/Ambient.tsx.
 *
 * All the effects are small and slow. They never sit over a face or the subtitles: the front layer fades out over the
 * lower third and inside any `avoid` box (Ambient.tsx).
 *
 * Coordinates are fractions of the background picture (x of its width, y of its height); `rx`/`ry`/`r`/`radius` are
 * fractions of its WIDTH. Colours are '#rrggbb', taken from the stills' own palette. Speeds are slow on purpose: about
 * one picture-width per minute or less.
 *
 * Lookup: ambientFor(planet, still, sceneId) = the planet's entry, then the still's (sky mask, painted objects, anchor
 * points), then the scene's. Positions of painted things (the Earth, rings, lanterns, neon screens) are measured on the
 * current 720×1280 stills (STILL_AMBIENT); a plate (lib/onboarding/plates.ts, `plate-<still>`) has its own entry in
 * PLATE_AMBIENT (measured on the plate), or else keeps only its still's planet and sky rule.
 */

export const PLANETS = ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun', 'pluto', 'earth', 'space'] as const;
export type Planet = (typeof PLANETS)[number];

type XY = [number, number];

/** a layer of the sky (behind the figures; one WebGL pass). `mask: false` = drawn everywhere, not only in the sky. */
export type SkyLayer = { alpha: number; mask?: boolean } & (
  /** small stars that twinkle; only where the picture is dark. drift = slow flow (picture per second) */
  | { kind: 'stars'; color: string; density: number; twinkle: number; size?: number; drift?: XY }
  /** aurora curtains: a sharp lower edge at y, fading up over height; colour → color2 upward */
  | { kind: 'aurora'; color: string; color2: string; y: number; height: number; speed: number }
  /** soft clouds (they cover what is behind) between y0 and y1, drifting by speed */
  | { kind: 'clouds'; color: string; scale: number; speed: XY; cover: number; y0: number; y1: number }
  /** a coloured haze drifting (red sand, steam) between y0 and y1 */
  | { kind: 'haze'; color: string; scale: number; speed: XY; y0: number; y1: number }
  /** big stripe bands crawling sideways between y0 and y1 */
  | { kind: 'bands'; color: string; color2: string; scale: number; speed: number; y0: number; y1: number }
  /** dappled light (komorebi) wavering over the bright parts of the picture */
  | { kind: 'komorebi'; color: string; scale: number; speed: number }
  /** a light that slowly undulates around `at` (or over every bright part when `at` is missing) */
  | { kind: 'glow'; color: string; speed: number; at?: XY; radius?: number }
  /** flares rising slowly from a disc at `at` */
  | { kind: 'flares'; color: string; at: XY; radius: number; speed: number }
  /** rings spreading from `at`, flattened (flat = height/width of a ring) as if far away */
  | { kind: 'ripples'; color: string; at: XY; speed: number; spacing: number; reach: number; flat: number }
  /** a painted ring (Saturn, Uranus): a glint and the ring's grain travel round it; drawn only on its bright paint */
  | { kind: 'ring'; color: string; at: XY; rx: number; ry: number; angle: number; speed: number; planetR: number }
  /** a river of stars flowing along a band through `at` (angle in degrees, width a fraction of the width) */
  | { kind: 'river'; color: string; at: XY; angle: number; width: number; speed: number }
  /** a small light crossing the distant sky now and then (every `period` s), between y0 and y1 */
  | { kind: 'ufo'; color: string; y0: number; y1: number; period: number }
  /** lightning far away: a flash and a thin bolt every `period` s somewhere in the box */
  | { kind: 'lightning'; color: string; period: number; x0: number; x1: number; y0: number; y1: number }
);

/** a painted object animated on its own (a masked copy of the picture, moved by a DOM transform only) */
export type SkyRegion = {
  at: XY;
  /** radius, fraction of the width (the mask is feathered over the outer third) */
  r: number;
  /** float: drifts by amp px; turn: rotates ±amp degrees round `at` */
  motion: 'float' | 'turn';
  amp: number;
  /** seconds for one swing */
  period: number;
};

/** sprite shapes of the front particles */
export type Sprite = 'dot' | 'glint' | 'fluff' | 'streak' | 'ring';

/** a layer in front of the figures (canvas2D; screen space unless `at` points into the picture) */
export type FrontLayer = { alpha: number } & (
  /**
   * particles. size in CSS px at depth 1 (the near ones are bigger and softer); speed = [vx, vy] in screen heights per
   * second (+y falls); sway = side-to-side amplitude (screen heights); twinkle = how fast they flicker (0 = steady);
   * y0..y1 = where they live (fractions of the screen height)
   */
  | { kind: 'particles'; sprite: Sprite; color: string; count: number; size: XY; speed: XY; sway: number; twinkle: number; y0?: number; y1?: number; spin?: boolean }
  /** a white sheet of mist flowing across now and then (every `every` s), centred at y with the given height */
  | { kind: 'mist'; color: string; y: number; height: number; speed: number; every: number }
  /** light from painted lamps / screens: soft glows at picture points [x, y, r, colour?] that flicker and sway a little */
  | { kind: 'glows'; color: string; at: [number, number, number, string?][]; flicker: number; sway: number }
  /** rings of light like sound waves, expanding from `at` every `every` s; size = the last radius (fraction of the width) */
  | { kind: 'rings'; color: string; at: XY; every: number; size: number }
  /** heat shimmer between y0 and y1 */
  | { kind: 'shimmer'; color: string; y0: number; y1: number }
  /** a small butterfly crossing now and then */
  | { kind: 'butterfly'; color: string; every: number }
  /** a warm haze breathing over the screen (a DOM gradient, opacity only) */
  | { kind: 'haze'; color: string; y0: number; y1: number }
);

/**
 * Which part of the picture is sky, when there is no hand-made mask: the part above y (the plate's horizonY wins),
 * keeping only pixels that are 'dark' (space through a window), 'bright' (light between trees, a window's clouds),
 * 'notdark', 'cool' (blue/purple storm clouds, not the island) or 'all'; t = the luminance threshold.
 */
export type SkyKeep = 'dark' | 'bright' | 'notdark' | 'cool' | 'all';
export type SkyMaskRule = { y: number; keep: SkyKeep; t?: number };

export type Ambient = {
  sky: SkyLayer[];
  front: FrontLayer[];
  regions?: SkyRegion[];
  skyMask: SkyMaskRule;
  /** the sky's own slow drift, px (default 2; the camera's parallax adds to it); 0 = no moving sky copy (when painted
   *  objects reach into the sky mask and would wobble) */
  drift?: number;
};

/** the overrides of a still or a scene: whole lists replace, add* lists append */
export type AmbientPatch = Partial<Ambient> & { addSky?: SkyLayer[]; addFront?: FrontLayer[]; night?: boolean };

const NIGHT_STARS: SkyLayer = { kind: 'stars', color: '#e8eeff', density: 0.45, twinkle: 0.35, alpha: 0.75 };

// ---------------------------------------------------------------------------------------------------------------
// per planet — the story team's spec (2026-11-23)
// ---------------------------------------------------------------------------------------------------------------
export const AMBIENT: Record<Planet, Ambient> = {
  // 月：背景＝黒い宇宙と浮かぶ地球、ゆっくり瞬く星。静かで冷たい。前景＝細かな銀色の月の砂、かすかな光の粒がゆっくり漂う。
  moon: {
    skyMask: { y: 0.6, keep: 'dark', t: 0.2 },
    sky: [{ kind: 'stars', color: '#dfe8ff', density: 0.5, twinkle: 0.3, alpha: 0.8 }],
    front: [
      { kind: 'particles', sprite: 'dot', color: '#e4eaf4', count: 28, size: [0.7, 1.7], speed: [0.004, -0.0015], sway: 0.004, twinkle: 0.3, alpha: 0.55, y0: 0.25, y1: 0.75 },
      { kind: 'particles', sprite: 'dot', color: '#cfe0ff', count: 6, size: [2.5, 5], speed: [0.002, -0.004], sway: 0.008, twinkle: 0.15, alpha: 0.22 },
    ],
  },
  // 水星：背景＝冷たい青空に揺れるオーロラ。前景＝細かな氷の粒ときらめく雪、ときどき白い息のような冷気が流れる。
  mercury: {
    skyMask: { y: 0.45, keep: 'all' },
    sky: [
      { kind: 'aurora', color: '#4ff0c0', color2: '#8a7dff', y: 0.3, height: 0.22, speed: 0.05, alpha: 0.6 },
      { kind: 'stars', color: '#e6f2ff', density: 0.35, twinkle: 0.4, alpha: 0.55 },
    ],
    front: [
      { kind: 'particles', sprite: 'glint', color: '#eaf6ff', count: 16, size: [1.4, 3], speed: [0.003, 0.004], sway: 0.004, twinkle: 0.9, alpha: 0.75, spin: true },
      { kind: 'particles', sprite: 'dot', color: '#ffffff', count: 22, size: [0.9, 2.6], speed: [0.006, 0.022], sway: 0.012, twinkle: 0.2, alpha: 0.55 },
      { kind: 'mist', color: '#eef6ff', y: 0.52, height: 0.16, speed: 0.035, every: 16, alpha: 0.16 },
    ],
  },
  // 金星：背景＝夕焼け色の厚い金色の雲がゆっくり流れ、遠くでラジオの電波の波紋が広がる。前景＝音の波のような光の輪がふわっと広がって消える、暖かな靄。
  venus: {
    skyMask: { y: 0.36, keep: 'all' },
    sky: [
      { kind: 'clouds', color: '#ffb46a', scale: 2.2, speed: [0.004, 0], cover: 0.5, y0: 0, y1: 0.36, alpha: 0.4 },
      { kind: 'ripples', color: '#ffe0a8', at: [0.5, 0.335], speed: 0.025, spacing: 0.09, reach: 0.55, flat: 0.28, alpha: 0.3, mask: false },
    ],
    front: [
      { kind: 'rings', color: '#ffe2ac', at: [0.5, 0.45], every: 6, size: 0.55, alpha: 0.2 },
      { kind: 'haze', color: '#ffb070', y0: 0, y1: 0.6, alpha: 0.14 },
    ],
  },
  // 火星：背景＝赤い砂の霞、ときどき遠い空をUFOの光が横切る。前景＝横に流れる赤い砂粒、ネオンの光がわずかに揺らぐ。
  mars: {
    skyMask: { y: 0.55, keep: 'notdark', t: 0.14 },
    drift: 0,
    sky: [
      { kind: 'haze', color: '#c8553c', scale: 3, speed: [0.012, 0], y0: 0.15, y1: 0.62, alpha: 0.28 },
      { kind: 'ufo', color: '#c6f6ff', y0: 0.08, y1: 0.22, period: 21, alpha: 0.9 },
    ],
    front: [
      { kind: 'particles', sprite: 'dot', color: '#e2845a', count: 40, size: [0.6, 1.6], speed: [0.075, 0.004], sway: 0.003, twinkle: 0, alpha: 0.5, y0: 0.2, y1: 0.75 },
      { kind: 'particles', sprite: 'dot', color: '#d86a48', count: 6, size: [3, 6], speed: [0.11, 0.003], sway: 0.004, twinkle: 0, alpha: 0.18 },
      // neon: the screens' glow (points per still)
      { kind: 'glows', color: '#ff5fd2', at: [[0.1, 0.45, 0.09], [0.88, 0.42, 0.09, '#5fe8ff']], flicker: 0.18, sway: 0, alpha: 0.2 },
    ],
  },
  // 木星：背景＝木漏れ日が揺らぎ、空の高いところに大きな縞模様。前景＝光る胞子と蝶の鱗粉のような金の粒、ときどき小さな蝶が横切る。
  jupiter: {
    skyMask: { y: 0.75, keep: 'bright', t: 0.45 },
    sky: [
      { kind: 'komorebi', color: '#fff0b0', scale: 6, speed: 0.12, alpha: 0.4 },
      { kind: 'bands', color: '#e8f2c8', color2: '#a6c98a', scale: 1, speed: 0.004, y0: 0, y1: 0.16, alpha: 0.14 },
    ],
    front: [
      { kind: 'particles', sprite: 'dot', color: '#dcff9e', count: 14, size: [1.6, 4], speed: [0.003, -0.007], sway: 0.016, twinkle: 0.45, alpha: 0.55 },
      { kind: 'particles', sprite: 'glint', color: '#ffd66c', count: 16, size: [1, 2.4], speed: [0.004, 0.003], sway: 0.01, twinkle: 1.3, alpha: 0.7 },
      { kind: 'butterfly', color: '#ffcf6a', every: 15, alpha: 0.8 },
    ],
  },
  // 土星：背景＝土星の輪がゆっくり回り、星の川が流れる。前景＝きらめく輪のかけら（小さな氷片）、赤い提灯の明かりがかすかに揺れる。
  saturn: {
    skyMask: { y: 0.5, keep: 'dark', t: 0.14 },
    sky: [{ kind: 'river', color: '#ffe9c4', at: [0.5, 0.25], angle: 32, width: 0.3, speed: 0.008, alpha: 0.55 }],
    front: [
      { kind: 'particles', sprite: 'glint', color: '#fff2d4', count: 16, size: [1.2, 2.8], speed: [0.004, 0.002], sway: 0.006, twinkle: 1.4, alpha: 0.75, spin: true },
      // the lanterns (points per still)
      { kind: 'glows', color: '#ff4a2a', at: [[0.12, 0.3, 0.07], [0.86, 0.3, 0.07]], flicker: 0.12, sway: 0.004, alpha: 0.26 },
    ],
  },
  // 天王星：背景＝青緑の空にやわらかな雲が流れ、横倒しの輪が見える。前景＝たんぽぽの綿毛のような光がふわふわ浮かぶ。
  uranus: {
    skyMask: { y: 0.5, keep: 'all' },
    sky: [{ kind: 'clouds', color: '#effff9', scale: 2.4, speed: [0.006, 0], cover: 0.45, y0: 0, y1: 0.58, alpha: 0.38 }],
    front: [{ kind: 'particles', sprite: 'fluff', color: '#f6fff2', count: 11, size: [3.5, 7.5], speed: [0.007, -0.009], sway: 0.02, twinkle: 0.3, alpha: 0.6 }],
  },
  // 海王星：背景＝紫の嵐雲、遠くで雷が光る。前景＝細かな雨粒、水の泡がゆっくり昇る。
  neptune: {
    skyMask: { y: 0.98, keep: 'cool' },
    sky: [
      { kind: 'clouds', color: '#6a4aac', scale: 2, speed: [0.005, 0.0015], cover: 0.55, y0: 0, y1: 1, alpha: 0.32 },
      { kind: 'lightning', color: '#ddd0ff', period: 9, x0: 0.55, x1: 0.95, y0: 0.02, y1: 0.32, alpha: 0.9 },
    ],
    front: [
      { kind: 'particles', sprite: 'streak', color: '#cfe2ff', count: 38, size: [7, 15], speed: [-0.06, 0.85], sway: 0, twinkle: 0, alpha: 0.2 },
      { kind: 'particles', sprite: 'ring', color: '#c4ecff', count: 8, size: [2.5, 6], speed: [0, -0.02], sway: 0.01, twinkle: 0, alpha: 0.38 },
    ],
  },
  // 太陽：背景＝白金色の光がうねり、太陽フレアがゆっくり立ちのぼる。前景＝火の粉のような金の粒、陽炎。
  sun: {
    skyMask: { y: 0.55, keep: 'all' },
    sky: [
      { kind: 'glow', color: '#fff6e6', speed: 0.18, at: [0.5, 0.31], radius: 0.4, alpha: 0.3, mask: false },
      { kind: 'flares', color: '#ffe3a0', at: [0.5, 0.31], radius: 0.11, speed: 0.03, alpha: 0.5, mask: false },
    ],
    front: [
      { kind: 'particles', sprite: 'glint', color: '#ffd47c', count: 20, size: [0.9, 2.3], speed: [0.002, -0.012], sway: 0.008, twinkle: 1.5, alpha: 0.7 },
      { kind: 'shimmer', color: '#fff2d0', y0: 0.35, y1: 0.62, alpha: 0.07 },
    ],
  },
  // --- not in the spec: natural picks, to be confirmed by the story team ---
  // 冥王星 (M-PLUTO; the script: 白い氷の平原、暗い空の小さな灯り): slow stars and a few small lights, fine snow
  pluto: {
    skyMask: { y: 0.45, keep: 'dark', t: 0.3 },
    sky: [
      { kind: 'stars', color: '#eef2ff', density: 0.55, twinkle: 0.25, alpha: 0.8 },
      { kind: 'stars', color: '#ffe6b8', density: 0.06, twinkle: 0.12, size: 2.2, alpha: 0.7 },
    ],
    front: [{ kind: 'particles', sprite: 'dot', color: '#f4f8ff', count: 20, size: [0.8, 2.4], speed: [0.004, 0.016], sway: 0.01, twinkle: 0.2, alpha: 0.5 }],
  },
  // Earth (day 8's launch hall): dust in the light shaft, the shaft breathing
  earth: {
    skyMask: { y: 0.7, keep: 'bright', t: 0.5 },
    sky: [{ kind: 'glow', color: '#fff4dc', speed: 0.12, alpha: 0.2 }],
    front: [{ kind: 'particles', sprite: 'dot', color: '#fff0d0', count: 18, size: [0.8, 2.2], speed: [0.002, -0.003], sway: 0.008, twinkle: 0.3, alpha: 0.45 }],
  },
  // the rocket cabin between planets: stars drifting past the porthole, dust in the lamp light
  space: {
    skyMask: { y: 0.75, keep: 'dark', t: 0.16 },
    sky: [{ kind: 'stars', color: '#f2ecff', density: 0.55, twinkle: 0.3, drift: [-0.004, 0.001], alpha: 0.8 }],
    front: [{ kind: 'particles', sprite: 'dot', color: '#ffd9a0', count: 14, size: [0.8, 2.2], speed: [0.002, -0.002], sway: 0.008, twinkle: 0.25, alpha: 0.4 }],
  },
};

// ---------------------------------------------------------------------------------------------------------------
// per still: which planet, where its sky is, its painted objects (measured on the 720×1280 stills)
// ---------------------------------------------------------------------------------------------------------------
export type StillAmbient = AmbientPatch & { planet: Planet };

const SATURN_LANTERNS: [number, number, number][] = [
  [0.12, 0.24, 0.06], [0.2, 0.32, 0.05], [0.235, 0.44, 0.045], [0.15, 0.62, 0.05],
  [0.8, 0.23, 0.06], [0.9, 0.24, 0.06], [0.73, 0.35, 0.05], [0.765, 0.44, 0.045], [0.845, 0.62, 0.05],
];

export const STILL_AMBIENT: Record<string, StillAmbient> = {
  // the Moon temple: the Earth in the round window (float), space only through the window
  'moon-temple': { planet: 'moon', skyMask: { y: 0.6, keep: 'dark', t: 0.2 }, regions: [{ at: [0.505, 0.37], r: 0.07, motion: 'float', amp: 1.6, period: 14 }], addSky: [{ kind: 'glow', color: '#8fc4ff', speed: 0.1, at: [0.505, 0.37], radius: 0.09, alpha: 0.12, mask: false }] },
  'moon-night': { planet: 'moon', night: true, skyMask: { y: 0.66, keep: 'dark', t: 0.2 }, regions: [{ at: [0.51, 0.43], r: 0.15, motion: 'float', amp: 1.8, period: 16 }], addSky: [{ kind: 'glow', color: '#8fc4ff', speed: 0.1, at: [0.51, 0.43], radius: 0.18, alpha: 0.12, mask: false }] },
  bluena: { planet: 'moon' },
  // Saturn: the painted planet and rings (a slow turn of the region + a glint going round), the lanterns
  'saturn-inside': {
    planet: 'saturn',
    skyMask: { y: 0.52, keep: 'dark', t: 0.12 },
    regions: [{ at: [0.505, 0.43], r: 0.24, motion: 'turn', amp: 0.5, period: 36 }],
    sky: [
      { kind: 'river', color: '#ffe9c4', at: [0.5, 0.36], angle: 32, width: 0.22, speed: 0.008, alpha: 0.5 },
      { kind: 'ring', color: '#fff2cf', at: [0.505, 0.43], rx: 0.23, ry: 0.05, angle: -30, speed: 0.08, planetR: 0.1, alpha: 0.7, mask: false },
    ],
    front: [
      { kind: 'particles', sprite: 'glint', color: '#fff2d4', count: 14, size: [1.2, 2.8], speed: [0.004, 0.002], sway: 0.006, twinkle: 1.4, alpha: 0.75, spin: true },
      { kind: 'glows', color: '#ff4a2a', at: SATURN_LANTERNS.map(([x, y, r]) => [x, y, r * 1.5]), flicker: 0.14, sway: 0.003, alpha: 0.42 },
    ],
  },
  'saturn-night': {
    planet: 'saturn',
    night: true,
    skyMask: { y: 0.5, keep: 'dark', t: 0.16 },
    regions: [{ at: [0.51, 0.26], r: 0.48, motion: 'turn', amp: 0.4, period: 40 }],
    addSky: [{ kind: 'ring', color: '#fff2cf', at: [0.51, 0.26], rx: 0.45, ry: 0.1, angle: 28, speed: 0.06, planetR: 0.19, alpha: 0.7, mask: false }],
    front: [
      { kind: 'particles', sprite: 'glint', color: '#fff2d4', count: 16, size: [1.2, 2.8], speed: [0.004, 0.002], sway: 0.006, twinkle: 1.4, alpha: 0.75, spin: true },
      { kind: 'glows', color: '#ffac48', at: [[0.07, 0.6, 0.06], [0.93, 0.6, 0.06], [0.26, 0.56, 0.04], [0.74, 0.56, 0.04]], flicker: 0.12, sway: 0.003, alpha: 0.25 },
    ],
  },
  'saturn-outside': {
    planet: 'saturn',
    skyMask: { y: 0.45, keep: 'dark', t: 0.25 },
    regions: [{ at: [0.5, 0.27], r: 0.5, motion: 'turn', amp: 0.4, period: 40 }],
    addSky: [{ kind: 'ring', color: '#fff2cf', at: [0.5, 0.27], rx: 0.5, ry: 0.12, angle: 16, speed: 0.06, planetR: 0.2, alpha: 0.6, mask: false }],
    front: [
      { kind: 'particles', sprite: 'glint', color: '#fff2d4', count: 16, size: [1.2, 2.8], speed: [0.004, 0.002], sway: 0.006, twinkle: 1.4, alpha: 0.75, spin: true },
      { kind: 'glows', color: '#ffac48', at: [[0.42, 0.6, 0.04], [0.6, 0.6, 0.04], [0.3, 0.64, 0.04], [0.7, 0.64, 0.04]], flicker: 0.12, sway: 0.003, alpha: 0.25 },
    ],
  },
  // Jupiter: the forest (light between the trees), the canopy (the planet's green bands overhead)
  'jupiter-forest': { planet: 'jupiter' },
  'jupiter-daikon': { planet: 'jupiter' },
  'arr-jupiter-canopy': {
    planet: 'jupiter',
    skyMask: { y: 0.24, keep: 'all' },
    sky: [
      { kind: 'bands', color: '#e6f6dc', color2: '#5fae7a', scale: 1, speed: 0.004, y0: 0, y1: 0.22, alpha: 0.28 },
      { kind: 'komorebi', color: '#fff0b0', scale: 6, speed: 0.12, alpha: 0.18, mask: false },
    ],
  },
  // Mercury: the ice plain under a starry sky, the port under a bright cold sky, the sea
  'mercury-ice': { planet: 'mercury', skyMask: { y: 0.46, keep: 'dark', t: 0.5 } }, // dark: not the rocket
  'mercury-port': { planet: 'mercury', skyMask: { y: 0.31, keep: 'all' }, sky: [{ kind: 'aurora', color: '#58f5c8', color2: '#9b8cff', y: 0.24, height: 0.2, speed: 0.05, alpha: 0.5 }] },
  'arr-mercury-sea': { planet: 'mercury', skyMask: { y: 0.42, keep: 'dark', t: 0.45 } },
  'rocket-over-sea': { planet: 'mercury', skyMask: { y: 0.42, keep: 'dark', t: 0.45 } },
  // Mars: the screens' neon, the red sky above the spires
  'mars-screens': {
    planet: 'mars',
    skyMask: { y: 0.5, keep: 'notdark', t: 0.14 },
    drift: 0, // the screens reach into the sky: no sky copy drifting over them
    front: [
      { kind: 'particles', sprite: 'dot', color: '#e2845a', count: 40, size: [0.6, 1.6], speed: [0.075, 0.004], sway: 0.003, twinkle: 0, alpha: 0.5, y0: 0.2, y1: 0.75 },
      { kind: 'particles', sprite: 'dot', color: '#d86a48', count: 6, size: [3, 6], speed: [0.11, 0.003], sway: 0.004, twinkle: 0, alpha: 0.18 },
      { kind: 'glows', color: '#ff5fd2', at: [[0.13, 0.43, 0.08], [0.51, 0.31, 0.07, '#5fe8ff'], [0.87, 0.45, 0.08, '#ffd25f'], [0.51, 0.56, 0.06, '#ff7a5f']], flicker: 0.18, sway: 0, alpha: 0.22 },
    ],
  },
  'arr-mars-city': { planet: 'mars', skyMask: { y: 0.55, keep: 'notdark', t: 0.2 }, drift: 0 },
  // Venus: the golden record at sunset (sky above the far edge), and at night
  'venus-stage': { planet: 'venus', skyMask: { y: 0.36, keep: 'notdark', t: 0.3 } }, // not the dark tone arm
  'venus-night': {
    planet: 'venus',
    night: true,
    skyMask: { y: 0.3, keep: 'dark', t: 0.25 },
    sky: [
      { kind: 'clouds', color: '#7a5f8a', scale: 2.2, speed: [0.004, 0], cover: 0.5, y0: 0, y1: 0.3, alpha: 0.3 },
      { kind: 'ripples', color: '#ffd28a', at: [0.6, 0.4], speed: 0.025, spacing: 0.09, reach: 0.5, flat: 0.3, alpha: 0.22, mask: false },
    ],
  },
  // the Sun
  'sun-inside': { planet: 'sun' },
  // Uranus: the sky field with the sideways ring; the shop's round window of pink clouds; the press
  'uranus-field': {
    planet: 'uranus',
    skyMask: { y: 0.46, keep: 'all' }, // above the floating house
    regions: [{ at: [0.46, 0.33], r: 0.18, motion: 'float', amp: 1.6, period: 18 }],
    addSky: [{ kind: 'ring', color: '#f2fffb', at: [0.47, 0.33], rx: 0.47, ry: 0.07, angle: -28, speed: 0.05, planetR: 0.17, alpha: 0.35, mask: false }],
  },
  'uranus-shop': { planet: 'uranus', skyMask: { y: 0.42, keep: 'bright', t: 0.5 }, sky: [{ kind: 'clouds', color: '#ffe0ec', scale: 2.4, speed: [0.006, 0], cover: 0.45, y0: 0, y1: 0.42, alpha: 0.35 }] },
  'uranus-press': { planet: 'uranus', skyMask: { y: 0.55, keep: 'all' } },
  // Neptune: the storm around the floating islands
  'neptune-town': { planet: 'neptune' },
  'neptune-islands': { planet: 'neptune' },
  // Earth and the rocket
  'launch-pit': { planet: 'earth' },
  'earth-hall': { planet: 'earth' },
  'rec3-warm-city': { planet: 'earth', skyMask: { y: 0.5, keep: 'bright', t: 0.55 } },
  'rec3-space': { planet: 'space', skyMask: { y: 1, keep: 'dark', t: 0.25 } },
  'rocket-space': { planet: 'space' },
  'rocket-earth': { planet: 'space' },
  'rocket-saturn': { planet: 'space' },
  'rocket-jupiter': { planet: 'space' },
  'rocket-mars': { planet: 'space' },
  'rocket-venus': { planet: 'space' },
  'rocket-sun': { planet: 'space' },
};

/**
 * per plate (lib/onboarding/plates.ts; the file name without extension): the painted objects measured again on the plate.
 * A plate without an entry here keeps its still's planet, sky rule and night flag, but none of its positions (painted
 * objects, rings, lamp glows) — they would sit in the wrong place — and takes the planet's own layers instead.
 */
export const PLATE_AMBIENT: Record<string, StillAmbient> = {
  'plate-moon-temple': {
    planet: 'moon',
    skyMask: { y: 0.6, keep: 'dark', t: 0.2 },
    regions: [{ at: [0.5, 0.41], r: 0.055, motion: 'float', amp: 1.6, period: 14 }],
    addSky: [{ kind: 'glow', color: '#8fc4ff', speed: 0.1, at: [0.5, 0.41], radius: 0.07, alpha: 0.12, mask: false }],
  },
  'plate-saturn-inside': {
    planet: 'saturn',
    skyMask: { y: 0.6, keep: 'dark', t: 0.12 },
    regions: [{ at: [0.5, 0.42], r: 0.28, motion: 'turn', amp: 0.5, period: 36 }],
    sky: [
      { kind: 'river', color: '#ffe9c4', at: [0.5, 0.36], angle: 32, width: 0.22, speed: 0.008, alpha: 0.5 },
      { kind: 'ring', color: '#fff2cf', at: [0.5, 0.42], rx: 0.26, ry: 0.045, angle: -36, speed: 0.08, planetR: 0.125, alpha: 0.7, mask: false },
    ],
    front: [
      { kind: 'particles', sprite: 'glint', color: '#fff2d4', count: 14, size: [1.2, 2.8], speed: [0.004, 0.002], sway: 0.006, twinkle: 1.4, alpha: 0.75, spin: true },
      { kind: 'glows', color: '#ff4a2a', at: [[0.12, 0.24, 0.09], [0.2, 0.33, 0.075], [0.235, 0.45, 0.07], [0.15, 0.63, 0.075], [0.805, 0.24, 0.09], [0.9, 0.24, 0.09], [0.735, 0.35, 0.075], [0.765, 0.45, 0.07], [0.845, 0.63, 0.075]], flicker: 0.14, sway: 0.003, alpha: 0.42 },
    ],
  },
};

/** per scene: a scene whose place is not its still's (the members' days stand in other planets' stills) */
export const SCENE_AMBIENT: Record<string, AmbientPatch & { planet?: Planet }> = {
  // Pluto's day stands in Uranus's field and Mercury's ice (after.ts): Pluto's own air over them
  'M-PLUTO-S001': { planet: 'pluto' },
  'M-PLUTO-S002': { planet: 'pluto' },
  // Neptune's morning still is the Pluto ice plain of the day before (after.ts: s/mercury-ice as pluto-plain)
  'M-NEPTUNE-S001': { planet: 'pluto' },
};

/** the still's key from a still id ('s/moon-temple'), a file ('/onboarding/s/moon-temple.jpg') or a plate ('plate-moon-temple') */
export function stillKey(src: string | null | undefined): string | null {
  if (!src) return null;
  const base = src.split('?')[0].split('/').pop()!.replace(/\.(jpe?g|png|webp|avif)$/i, '');
  return base.replace(/^plate-/, '') || null;
}

/** 'plate-moon-temple' when the source is a plate, else null */
export function plateKey(src: string | null | undefined): string | null {
  const base = src?.split('?')[0].split('/').pop()?.replace(/\.(jpe?g|png|webp|avif)$/i, '');
  return base && base.startsWith('plate-') ? base : null;
}

/** the planet a scene is on: the scene's override, else its still's, else by the scene id (null = none known) */
export function planetOf(sceneId: string | null | undefined, still?: string | null): Planet | null {
  const sc = sceneId ? SCENE_AMBIENT[sceneId]?.planet : undefined;
  if (sc) return sc;
  const k = stillKey(still);
  if (k && STILL_AMBIENT[k]) return STILL_AMBIENT[k].planet;
  const m = sceneId?.match(/^M-([A-Z]+)-/);
  if (m) return ({ URANUS: 'uranus', PLUTO: 'pluto', NEPTUNE: 'neptune', END: 'space' } as Record<string, Planet>)[m[1]] ?? null;
  return null;
}

function patch(base: Ambient, p: AmbientPatch | undefined): Ambient {
  if (!p) return base;
  const sky = [...(p.sky ?? base.sky), ...(p.addSky ?? [])];
  if (p.night && !sky.some((l) => l.kind === 'stars')) sky.push(NIGHT_STARS);
  return {
    sky,
    front: [...(p.front ?? base.front), ...(p.addFront ?? [])],
    regions: p.regions ?? base.regions,
    skyMask: p.skyMask ?? base.skyMask,
    drift: p.drift ?? base.drift,
  };
}

/**
 * The ambient of a scene: the planet's, then the still's (only when the still is on the same planet — a stand-in
 * still keeps its mask and painted objects but takes the planet's air), then the scene's.
 */
export function ambientFor(planet: Planet, still?: string | null, sceneId?: string | null): Ambient {
  const k = stillKey(still);
  const pk = plateKey(still);
  const bare = (x: StillAmbient | undefined): StillAmbient | undefined => x && { planet: x.planet, skyMask: x.skyMask, night: x.night };
  const st = pk ? (PLATE_AMBIENT[pk] ?? bare(k ? STILL_AMBIENT[k] : undefined)) : k ? STILL_AMBIENT[k] : undefined;
  let a = AMBIENT[planet];
  if (st) {
    a = st.planet === planet ? patch(a, st) : patch(a, { skyMask: st.skyMask, regions: st.regions });
  }
  return patch(a, sceneId ? SCENE_AMBIENT[sceneId] : undefined);
}

/** '#rrggbb' → [r, g, b] in 0..1 */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
