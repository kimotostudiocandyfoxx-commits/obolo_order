import type { HomePlanet } from './planetHomeConfig';

/**
 * M-R326 / story 2026-11-27: the switch from the planets' screens of before to the new homes — one rule for the web
 * (NEXT_PUBLIC_PLANET_HOMES*, read at build: apps/web/lib/planetHomes.ts) and the API (PLANET_HOMES*, read at run:
 * apps/api/src/planets/moon-only.ts). Set both the same way.
 *
 *   all      new             every planet shows the new home (unset / anything else: the screens of before — the default)
 *   only     saturn,jupiter  these show the new home even while the switch is off
 *   except   venus           these keep the screen of before even while the switch is on
 *
 * A planet named in both lists keeps the screen of before (the careful side). With nothing set, nothing changes anywhere.
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
  if (listed(env.only).has(planet)) return true;
  return (env.all ?? '').trim().toLowerCase() === 'new';
}

/** the code the API answers when a posting door of the screen of before is used after the switch (making is on the Moon) */
export const MADE_ON_MOON = 'MADE_ON_MOON';
/** what the Moon's own calls carry on the endpoints the screens of before used too (`via`), so the API can tell them apart */
export const VIA_MOON = 'moon';
