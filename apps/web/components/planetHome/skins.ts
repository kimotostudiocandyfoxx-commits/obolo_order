import type { HomePlanet } from '@obolo/shared';
import { GenericPlaceholderScene, SaturnPlaceholderScene } from './PlaceholderScenes';
import type { PlanetHomeSkin } from './skin';

/**
 * 星のホーム: each planet's look. Placeholders until the story team's art and motion arrive; to add a planet's art,
 * write its Scene (SceneProps in skin.ts) and put it here — the rules, the feed and the frame stay as they are.
 */
const generic: PlanetHomeSkin = { Scene: GenericPlaceholderScene };
export const SKINS: Record<HomePlanet, PlanetHomeSkin> = {
  saturn: { Scene: SaturnPlaceholderScene },
  jupiter: generic,
  mercury: generic,
  mars: generic,
  venus: generic,
  uranus: generic,
  pluto: generic,
  neptune: generic,
};
export const skinFor = (p: HomePlanet) => SKINS[p];
