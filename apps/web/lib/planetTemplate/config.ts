import { PLANET_HOMES, type HomePlanet } from '@obolo/shared';
import { anywhere, PLAY_HOLD_MS, PLAY_INTRO_MS, type AllowedArea } from './layout';
import { ALL_SEEN, JTREE, PORCH_HOLD_MS, PORCH_INTRO_MS, PORCH_PATH } from './jupiter';
import { ALL_HEARD, HOME_SEA, MHOUSE, PIER_PATH, sailMotion, seaOnly, shipStandIn } from './mercury';
import { driftMotion, type FigureMotion } from './motion';
import { ALL_SEEN_FIVE, FIVE_HOLD_MS, FIVE_PLANETS, type FivePlanet } from './five';
import { ALL_HEARD as KORORIN_ALL_HEARD, DROP_MS, firstVoiceMs, floorMotion, NEEDLE, TONEARM } from './saturn';

/** a point of the play view (fractions of the screen) and the size there */
export interface PathPoint {
  x: number;
  y: number;
  size: number;
}
/** 3-3: how a visitor comes to you in the play view: from → sit (the work opens; `front`: then it comes closer) → away */
export interface PlayPath {
  from: PathPoint;
  sit: PathPoint;
  front?: PathPoint;
  away: PathPoint;
  arriveMs: number;
  leaveMs: number;
}

/**
 * 惑星ホームの共通の型 — what changes per planet, as data and hooks. The per-planet documents (02〜) fill the hooks
 * (how a work opens, where a figure may stay, the profile's middle); until then each planet gets the defaults.
 * Art: the prototype's template pictures (design/home, public/planets/).
 */
export interface PlanetTemplateConfig {
  planet: HomePlanet;
  name: string;
  /** the play button's colour */
  accent: string;
  icon: string;
  /** the home, the view from your place (▶), the profile room */
  art: { home: string; view: string; profile: string };
  /** your place on the backdrop (fractions of the 9:16 picture), back right; tapped → your profile */
  place: { x: number; y: number };
  /** 3-1 / 3-2: how the figures move and how many float at once (Mercury: the ships' sea lanes, 02 §1) */
  motion: FigureMotion;
  /** 3-2: where a figure may stay (Mercury: the sea only) */
  allowed: AllowedArea;
  /** a figure not painted yet (null: the planet's sprite with their face) */
  standIn: ((personId: string) => string) | null;
  /** a work opened: how far the home behind it zooms and dims (`dim` false: the home stays as it is, Saturn's pop) */
  openLook: { scale: number; blur: number; bright: number; dim?: boolean };
  /** your own figure on the home too, with the others (Saturn: your kororin is on the floor; no name on it) */
  ownOnHome: boolean;
  /** a second tap target for your place (fractions of the 9:16 picture, from → to; Saturn: the tonearm) */
  placeArm: { x0: number; y0: number; x1: number; y1: number } | null;
  /** 3-3: ▶ → the first work arrives (ms). Saturn: 2.3 s (M-R304) */
  introMs: number;
  /** 3-3: how long one work stays in front of you (ms); `untilDone`: until it has finished (Mercury: the whole song) */
  holdMs: number;
  play: {
    path: PlayPath;
    untilDone: boolean;
    /** the view at night, fireworks over it (Mercury's pier, 02 §3) */
    night: boolean;
    fireworks: boolean;
    /** fireflies over the view (Jupiter's porch, 03 §3) */
    fireflies: boolean;
    /** you dance out of your place first (fractions of the screen), then the view turns. `from: 'sky'`: you fall onto it
     * instead (Saturn: onto the record), `ms`: how long before the view turns */
    dance: { x: number; y: number; from?: 'place' | 'sky'; ms?: number } | null;
    /** who comes out: your dancing picture (Mercury) or your figure on this planet (Jupiter: your butterfly) */
    danceAs: 'dance' | 'figure';
    /** said when every work has been seen (null: nothing) */
    doneLine: string | null;
  };
  /** the sky (handoff 06, the five 07): the sea seen from above and your island on it (public/planets/continents/<planet>/);
   * null = no sky */
  sky: { sea: string; me: string } | null;
}

/** the prototype's places (G5[pl].home, JTREE, MHOUSE, the record's label) */
const PLACE: Record<HomePlanet, [number, number]> = {
  saturn: [0.72, 0.52],
  jupiter: [0.74, 0.62],
  mercury: [MHOUSE.x, MHOUSE.y],
  mars: [0.79, 0.54],
  venus: [0.72, 0.38],
  uranus: [0.8, 0.48],
  pluto: [0.68, 0.36],
  neptune: [0.84, 0.44],
};

const art = (p: HomePlanet) => ({ home: `/planets/bg-${p}.webp`, view: `/planets/hv-${p}.webp`, profile: `/planets/prof-${p}.webp` });

/** the common play path (the template's default: the visitor flies down to you, the work opens, it flies off) */
export const DEFAULT_PLAY_PATH: PlayPath = { from: { x: 0.4, y: 0.2, size: 0.3 }, sit: { x: 0.18, y: 0.86, size: 1 }, away: { x: 0.9, y: 0.15, size: 0.3 }, arriveMs: 900, leaveMs: 800 };

/**
 * 05 the five (Mars, Venus, Uranus, Pluto, Neptune): the common template as it is (JSLOT, drift), a work opens with the
 * deep zoom (popG5's zoomart), ▶ you pop out of your place (playG5's popOut) and the works come one at a time — Mars's
 * MV until it has played to the end (05: 曲の長さ), the others 5.2 s (05: 5〜7 秒)
 */
const fiveOwn = (p: FivePlanet): Partial<Omit<PlanetTemplateConfig, 'planet'>> => ({
  openLook: { scale: 1.65, blur: 5, bright: 0.55 },
  holdMs: FIVE_HOLD_MS,
  play: { path: DEFAULT_PLAY_PATH, untilDone: p === 'mars', night: false, fireworks: false, fireflies: false, dance: { x: PLACE[p][0], y: PLACE[p][1] }, danceAs: 'dance', doneLine: ALL_SEEN_FIVE },
  // 07: their skies (the continents and pictures of migration 0063)
  sky: skyOf(p),
});

/** 06: the sky's two pictures (the sea from above, your island) */
const skyOf = (p: HomePlanet) => ({ sea: `/planets/continents/${p}/sea.webp`, me: `/planets/continents/${p}/me.webp` });

/** each planet's own numbers (the 02〜 documents) over the common template */
const OWN: Partial<Record<HomePlanet, Partial<Omit<PlanetTemplateConfig, 'planet'>>>> = {
  ...Object.fromEntries(FIVE_PLANETS.map((p) => [p, fiveOwn(p)])),
  // 03 木星: the butterflies drift on JSLOT (the template's own); an art opens with a deep zoom (zoomart); ▶ is the porch at night
  jupiter: {
    openLook: { scale: 1.65, blur: 5, bright: 0.55 },
    introMs: PORCH_INTRO_MS,
    holdMs: PORCH_HOLD_MS,
    play: { path: PORCH_PATH, untilDone: false, night: true, fireworks: false, fireflies: true, dance: JTREE, danceAs: 'figure', doneLine: ALL_SEEN },
    sky: skyOf('jupiter'),
  },
  // 02 水星: seven ships on the sea lanes (MSLOT), on the sea only; a song opens with a deep zoom; ▶ is the pier at night
  mercury: {
    motion: sailMotion(HOME_SEA),
    allowed: seaOnly(HOME_SEA),
    standIn: shipStandIn,
    openLook: { scale: 1.65, blur: 5, bright: 0.55 },
    play: { path: PIER_PATH, untilDone: true, night: true, fireworks: true, fireflies: false, dance: MHOUSE, danceAs: 'dance', doneLine: ALL_HEARD },
    sky: skyOf('mercury'),
  },
  // 04 土星: not the rows — eight kororins hop on the record floor with depth (your own among them); a tap pops one where
  // it is (the home stays); ▶ you fall onto the record and the kororins ride its groove (the first talks at ~2.3 s)
  saturn: {
    motion: floorMotion,
    ownOnHome: true,
    placeArm: TONEARM,
    openLook: { scale: 1, blur: 0, bright: 1, dim: false },
    introMs: Math.round(firstVoiceMs()),
    play: { path: DEFAULT_PLAY_PATH, untilDone: true, night: false, fireworks: false, fireflies: false, dance: { ...NEEDLE, from: 'sky', ms: DROP_MS }, danceAs: 'dance', doneLine: KORORIN_ALL_HEARD },
    sky: skyOf('saturn'),
  },
};

export function templateConfig(planet: HomePlanet, over: Partial<Omit<PlanetTemplateConfig, 'planet'>> = {}): PlanetTemplateConfig {
  const h = PLANET_HOMES[planet];
  return {
    planet,
    name: h.name,
    accent: h.accent,
    icon: `/planets/icon-${planet}.webp`,
    art: art(planet),
    place: { x: PLACE[planet][0], y: PLACE[planet][1] },
    motion: driftMotion,
    allowed: anywhere,
    standIn: null,
    openLook: { scale: 1.12, blur: 2.5, bright: 0.7 },
    ownOnHome: false,
    placeArm: null,
    introMs: PLAY_INTRO_MS,
    holdMs: planet === 'mars' ? PLAY_HOLD_MS.long : PLAY_HOLD_MS.default,
    play: { path: DEFAULT_PLAY_PATH, untilDone: false, night: false, fireworks: false, fireflies: false, dance: null, danceAs: 'dance', doneLine: null },
    sky: null,
    ...OWN[planet],
    ...over,
  };
}
