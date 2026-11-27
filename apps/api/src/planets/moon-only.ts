import { HttpStatus } from '@nestjs/common';
import { MADE_ON_MOON, planetHomeIsNew, type HomePlanet, type PlanetHomesEnv } from '@obolo/shared';
import { apiError } from '../common/errors';

/**
 * Story session 2026-11-27 (M-R331): once a planet shows its new home, nothing is made or posted ON the planet any more
 * — making is on the Moon only, and a work reaches its planet by 〔星へ飛ばす〕. The posting doors of the screens of
 * before (Saturn's 〔つぶやく〕 / 〔器〕 / 〔広場〕, Jupiter's / Mercury's / Mars's own posting, Venus's booth and live
 * broadcast) answer 403 MADE_ON_MOON. Reading what was posted before stays as it is.
 *
 * The server's flag mirrors the web's (docs/planets.md 「新しい家への切り替え」) and is OFF by default:
 *   PLANET_HOMES=new            every planet           (web: NEXT_PUBLIC_PLANET_HOMES)
 *   PLANET_HOMES_NEW=saturn,…   only these             (web: NEXT_PUBLIC_PLANET_HOMES_NEW)
 *   PLANET_HOMES_OLD=venus,…    these stay as before   (web: NEXT_PUBLIC_PLANET_HOMES_OLD)
 * Read from the environment at each call (a Cloud Run variable: a new revision, no build).
 */
export const serverPlanetHomes = (env: NodeJS.ProcessEnv = process.env): PlanetHomesEnv => ({ all: env.PLANET_HOMES, only: env.PLANET_HOMES_NEW, except: env.PLANET_HOMES_OLD });

export const planetIsMoonOnly = (planet: HomePlanet, env: PlanetHomesEnv = serverPlanetHomes()): boolean => planetHomeIsNew(planet, env);

/**
 * Refuse a posting door of the screen of before when the planet has its new home. `fromMoon`: the call is the Moon's own
 * (it carries `via: 'moon'`, or it only keeps a thing in Bluena) — those always pass.
 */
export function moonOnly(planet: HomePlanet, fromMoon = false, env: PlanetHomesEnv = serverPlanetHomes()): void {
  if (fromMoon || !planetIsMoonOnly(planet, env)) return;
  throw apiError(HttpStatus.FORBIDDEN, MADE_ON_MOON, 'Works are made on the Moon and flown to this planet');
}
