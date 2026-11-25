'use client';

import type { HomePlanet, HomeWork, PlanetSongView } from '@obolo/shared';
import type { SkySource } from '@/lib/planetTemplate/sky';
import { jupiterHooks } from './jupiter/jupiterHooks';
import { mercuryHooks } from './mercury/mercuryHooks';
import type { TemplateHooks, TemplateMe } from './PlanetTemplateHome';

/** what a planet's hooks may need from the page: how to load a work's song, the sky's data, you */
export interface PlanetHookDeps {
  load: (w: HomeWork) => Promise<PlanetSongView | null>;
  sky: SkySource | null;
  me: TemplateMe;
}

/**
 * Each planet's own hooks over the common template (the 02〜 documents). Mercury: 02 (its opener, the beach, the sky). Jupiter: 03 (the wings, the scroll, the atelier).
 * The others keep the template's defaults until their documents come.
 */
export function planetHooks(planet: HomePlanet, deps: PlanetHookDeps): TemplateHooks {
  if (planet === 'mercury') return mercuryHooks(deps);
  if (planet === 'jupiter') return jupiterHooks();
  return {};
}
