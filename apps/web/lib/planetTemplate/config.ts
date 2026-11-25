import { PLANET_HOMES, type HomePlanet } from '@obolo/shared';
import { anywhere, PLAY_HOLD_MS, PLAY_INTRO_MS, type AllowedArea } from './layout';

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
  /** 3-2: where a figure may stay (Mercury: the sea only — the hook; its numbers come with 02) */
  allowed: AllowedArea;
  /** 3-3: ▶ → the first work arrives (ms). Saturn: 2.3 s (M-R304) */
  introMs: number;
  /** 3-3: how long one work stays in front of you (ms) */
  holdMs: number;
}

/** the prototype's places (G5[pl].home, JTREE, MHOUSE, the record's label) */
const PLACE: Record<HomePlanet, [number, number]> = {
  saturn: [0.72, 0.52],
  jupiter: [0.74, 0.62],
  mercury: [0.77, 0.53],
  mars: [0.79, 0.54],
  venus: [0.72, 0.38],
  uranus: [0.8, 0.48],
  pluto: [0.68, 0.36],
  neptune: [0.84, 0.44],
};

const art = (p: HomePlanet) => ({ home: `/planets/bg-${p}.webp`, view: `/planets/hv-${p}.webp`, profile: `/planets/prof-${p}.webp` });

export function templateConfig(planet: HomePlanet, over: Partial<Omit<PlanetTemplateConfig, 'planet'>> = {}): PlanetTemplateConfig {
  const h = PLANET_HOMES[planet];
  return {
    planet,
    name: h.name,
    accent: h.accent,
    icon: `/planets/icon-${planet}.webp`,
    art: art(planet),
    place: { x: PLACE[planet][0], y: PLACE[planet][1] },
    allowed: anywhere,
    introMs: planet === 'saturn' ? 2300 : PLAY_INTRO_MS,
    holdMs: planet === 'mars' ? PLAY_HOLD_MS.long : PLAY_HOLD_MS.default,
    ...over,
  };
}
