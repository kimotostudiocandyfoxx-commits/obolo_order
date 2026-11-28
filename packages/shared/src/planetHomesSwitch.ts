import type { HomePlanet } from './planetHomeConfig';

/**
 * Client decision 2026-11-28: the new homes are switched on ONE PLANET AT A TIME, in the code — the planets named here
 * show the new home with no variable set anywhere (web and API read this same list, so they always agree; the client
 * cannot reach the Cloud Run or Vercel settings). To turn the next planet on: add it here and release. To turn one back:
 * take it out and release (or, without a release of the web, `…_OLD=<planet>` on both sides; see below).
 * docs/planets.md 「スイッチを入れる時の確認表（1つずつ）」.
 */
export const PLANET_HOMES_ON_BY_DEFAULT: readonly HomePlanet[] = ['pluto'];

/**
 * M-R326 / story 2026-11-27: the switch from the planets' screens of before to the new homes — one rule for the web
 * (NEXT_PUBLIC_PLANET_HOMES*, read at build: apps/web/lib/planetHomes.ts) and the API (PLANET_HOMES*, read at run:
 * apps/api/src/planets/moon-only.ts). Set both the same way.
 *
 *   (none)   —               the planets of PLANET_HOMES_ON_BY_DEFAULT show the new home, the others the screen of before
 *   all      new             every planet shows the new home (unset / anything else: as above)
 *   only     saturn,jupiter  these show the new home too (added to PLANET_HOMES_ON_BY_DEFAULT)
 *   except   venus           these keep the screen of before, whatever else says (a planet of the default list too)
 *
 * A planet named in both lists keeps the screen of before (the careful side).
 */
export interface PlanetHomesEnv {
  all?: string | null;
  only?: string | null;
  except?: string | null;
}
const listed = (v: string | null | undefined): Set<string> =>
  new Set(
    (v ?? '')
      .split(/[\s,]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );

export function planetHomeIsNew(planet: HomePlanet, env: PlanetHomesEnv): boolean {
  if (listed(env.except).has(planet)) return false;
  if (listed(env.only).has(planet) || PLANET_HOMES_ON_BY_DEFAULT.includes(planet)) return true;
  return (env.all ?? '').trim().toLowerCase() === 'new';
}

/** the code the API answers when a posting door of the screen of before is used after the switch (making is on the Moon) */
export const MADE_ON_MOON = 'MADE_ON_MOON';
/** what the Moon's own calls carry on the endpoints the screens of before used too (`via`), so the API can tell them apart */
export const VIA_MOON = 'moon';
