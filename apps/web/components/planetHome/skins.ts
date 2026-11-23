import { HOME_PLANETS, type HomePlanet } from '@obolo/shared';
import type { PlanetHomeSkin } from './skin';
import { TemplateScene } from './TemplateScene';

/**
 * 星のホーム: each planet's scene. Every planet uses the story team's one template (design/home) with its own backdrop,
 * sprite and colour from PLANET_HOMES; a planet that needs its own motion gets its own Scene here (SceneProps in skin.ts).
 */
export const SKINS = Object.fromEntries(HOME_PLANETS.map((p) => [p, { Scene: TemplateScene }])) as Record<HomePlanet, PlanetHomeSkin>;
export const skinFor = (p: HomePlanet) => SKINS[p];
