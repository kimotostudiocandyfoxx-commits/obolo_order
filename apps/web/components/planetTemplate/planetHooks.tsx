'use client';

import type { GameView, HomePlanet, HomeWork, PlanetSongView } from '@obolo/shared';
import type { SkySource } from '@/lib/planetTemplate/sky';
import { jupiterHooks } from './jupiter/jupiterHooks';
import { templateConfig } from '@/lib/planetTemplate/config';
import { isFivePlanet } from '@/lib/planetTemplate/five';
import { fiveHooks } from './five/fiveHooks';
import { mercuryHooks } from './mercury/mercuryHooks';
import type { ProfilePerson } from './Profile';
import { saturnHooks } from './saturn/saturnHooks';
import { skyHookOf } from './sky/skyKits';
import type { TemplateHooks, TemplateMe } from './PlanetTemplateHome';

/** what a planet's hooks may need from the page: how to load a work's song, the sky's data, you */
export interface PlanetHookDeps {
  load: (w: HomeWork) => Promise<PlanetSongView | null>;
  sky: SkySource | null;
  me: TemplateMe;
  /** a person's past works on the planet for their profile (Saturn's 2D stage); none: what the home feed has */
  past?: (p: ProfilePerson) => Promise<HomeWork[]>;
  /** 05 Neptune: a flown game to play when PRESS START is pressed (none: PRESS START only blinks) */
  game?: (w: HomeWork) => Promise<GameView | null>;
}

/**
 * Each planet's own hooks over the common template (the 02〜 documents). Mercury: 02 (its opener, the beach, the sky). Jupiter: 03 (the wings, the scroll, the atelier).
 * Saturn: 04 (the pop, the groove, the 2D stage). Mars, Venus, Uranus, Pluto, Neptune: 05 (each one's viewer and shelf).
 * Every planet with a sky: 06 (pinch in → じぶんの空, search, travel, the continents).
 */
export function planetHooks(planet: HomePlanet, deps: PlanetHookDeps): TemplateHooks {
  // 06 the sky: the same SkyExplore on every planet with a sky, with the planet's figures and opener (sky/skyKits.tsx)
  return { ...ownHooks(planet, deps), sky: skyHookOf(planet, deps) };
}

function ownHooks(planet: HomePlanet, deps: PlanetHookDeps): TemplateHooks {
  if (planet === 'mercury') return mercuryHooks(deps);
  if (planet === 'jupiter') return jupiterHooks();
  if (planet === 'saturn') return saturnHooks({ past: deps.past ?? (async (p) => p.works), room: templateConfig('saturn').art.profile });
  if (isFivePlanet(planet)) return fiveHooks(planet, { game: deps.game });
  return {};
}
