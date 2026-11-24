import { HOME_PLANETS, type HomePlanet } from '@obolo/shared';
import type { PlanetHomeSkin } from './skin';
import { SaturnPuniScene } from './SaturnPuniScene';
import { TemplateScene } from './TemplateScene';

/**
 * 星のホーム: each planet's scene. Every planet uses the story team's one template (design/home) with its own backdrop,
 * sprite and colour from PLANET_HOMES; Saturn has its own (M-R259: the ぷにぷに kororins on a huge record). A planet that needs its own
 * motion gets its own Scene here (SceneProps in skin.ts).
 */
export const SKINS = Object.fromEntries(HOME_PLANETS.map((p) => [p, { Scene: p === 'saturn' ? SaturnPuniScene : TemplateScene }])) as Record<HomePlanet, PlanetHomeSkin>;
export const skinFor = (p: HomePlanet) => SKINS[p];
