import { HOME_PLANETS, PLANET_HOMES_ON_BY_DEFAULT, planetHomeIsNew, type HomePlanet, type PlanetHomesEnv } from '@obolo/shared';

/**
 * M-R326: which screen a live planet route (/saturn, /jupiter, /mercury, /mars, /venus, /uranus, /neptune, and /pluto)
 * shows — the planet's screen of before, or the new common home (components/planetTemplate).
 *
 * Client 2026-11-28: one planet at a time, from the code — PLANET_HOMES_ON_BY_DEFAULT (@obolo/shared planetHomesSwitch.ts,
 * the API reads the same list) names the planets on with nothing set: Pluto now. The variables still work on top:
 *   NEXT_PUBLIC_PLANET_HOMES       new   every planet shows the new home (unset / anything else: the code's list)
 *   NEXT_PUBLIC_PLANET_HOMES_NEW   saturn,jupiter   these show the new home too
 *   NEXT_PUBLIC_PLANET_HOMES_OLD   venus            these keep the screen of before (a planet of the code's list too)
 *
 * A planet named in both lists keeps the screen of before (the careful side). The values are read when the web app is
 * built (NEXT_PUBLIC_*): changing one needs a new build.
 */
export { PLANET_HOMES_ON_BY_DEFAULT, planetHomeIsNew, type PlanetHomesEnv };

/** the build's own values (each named in full: Next.js inlines NEXT_PUBLIC_* only when written out) */
export const PLANET_HOMES_ENV: PlanetHomesEnv = {
  all: process.env.NEXT_PUBLIC_PLANET_HOMES,
  only: process.env.NEXT_PUBLIC_PLANET_HOMES_NEW,
  except: process.env.NEXT_PUBLIC_PLANET_HOMES_OLD,
};

/**
 * Does this visit of a live planet route show the new home? `keep`: queries the screen of before still answers while
 * the planet is switched (none now — story 2026-11-27: with the switch on, the posting doors of before are closed at
 * once, Venus's ?dj=1 and ?booth=1 too; making is on the Moon only).
 */
export function showsNewHome(planet: HomePlanet, query?: { get(name: string): string | null } | null, keep: readonly string[] = [], env: PlanetHomesEnv = PLANET_HOMES_ENV): boolean {
  if (!planetHomeIsNew(planet, env)) return false;
  return !keep.some((k) => query?.get(k) != null);
}

/** the planets that show the new home in this build (for the readiness notes and the tests) */
export const newHomePlanets = (env: PlanetHomesEnv = PLANET_HOMES_ENV): HomePlanet[] => HOME_PLANETS.filter((p) => planetHomeIsNew(p, env));
