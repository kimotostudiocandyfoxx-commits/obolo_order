import type { HomePlanet } from './planetHomeConfig';

/**
 * Client decision 2026-11-25: every member gets a deformed (chibi) figure of their own look for each home planet, made
 * from their profile look (art/lab/runware-planet-avatar, scripts/art-lab/planet_avatar_prompts.json):
 *  - saturnChibi: the 2-heads 2D anime chibi that jumps out of the popped ball (M-R262 / M-R275; FLUX.2 klein 4B),
 *  - saturnBall: the member's kororin ball in their own pattern (M-R279; Qwen-Image 2.1 Turbo),
 *  - one chibi for each of the other seven home planets (Qwen-Image 2.1 Turbo): the Jupiter butterfly, the Mercury
 *    music-note boat, the Mars UFO, the Venus radio DJ, the Uranus balloons, the Pluto flying book, the Neptune bubble.
 * Made in the background after the first look (free) and after every profile look change (its price covers them:
 * MakeKind 'profileLook').
 */
export const PLANET_FIGURES = ['saturnChibi', 'saturnBall', 'jupiter', 'mercury', 'mars', 'venus', 'uranus', 'pluto', 'neptune'] as const;
export type PlanetFigure = (typeof PLANET_FIGURES)[number];
export const isPlanetFigure = (v: string): v is PlanetFigure => (PLANET_FIGURES as readonly string[]).includes(v);

/** the figure each home planet shows of a member (Saturn: the chibi out of the ball; its ball is `saturnBall`) */
export const PLANET_FIGURE_OF: Record<HomePlanet, PlanetFigure> = {
  saturn: 'saturnChibi',
  jupiter: 'jupiter',
  mercury: 'mercury',
  mars: 'mars',
  venus: 'venus',
  uranus: 'uranus',
  pluto: 'pluto',
  neptune: 'neptune',
};

/** a member's figures of the look worn now (figure → picture URL; a missing one is still being made, or failed) */
export type PlanetFigures = Partial<Record<PlanetFigure, string>>;

/**
 * 03 §1 (Jupiter): where the butterfly figure is cut into its wings and body, in percent of the picture's width — the
 * left wing 0 → l, the right wing r → 100, the body l → r (never a wing over the face). Measured on the painted figure
 * by the look code (apps/api/src/look/wings.ts); none = not measured or could not be: the default cut.
 */
export interface FigureWings {
  l: number;
  r: number;
}

/** which picture use paints a figure: the Saturn chibi on SATURN_CHIBI_MODEL (klein 4B), the rest on PLANET_CHIBI_MODEL / SATURN_BALL_MODEL (Qwen) */
export const FIGURE_PAINTER: Record<PlanetFigure, 'saturnChibi' | 'saturnBall' | 'planetChibi'> = {
  saturnChibi: 'saturnChibi',
  saturnBall: 'saturnBall',
  jupiter: 'planetChibi',
  mercury: 'planetChibi',
  mars: 'planetChibi',
  venus: 'planetChibi',
  uranus: 'planetChibi',
  pluto: 'planetChibi',
  neptune: 'planetChibi',
};
