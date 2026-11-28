'use client';

import type { HomePlanet } from '@obolo/shared';
import type { ReactNode } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { PlanetGate } from '@/components/PlanetLock';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';
import { LivePlanetHome } from './LivePlanetHome';

/**
 * M-R326: a live planet route showing the new common home in place of the planet's screen of before (only when
 * lib/planetHomes.ts says so: off by default). The frame around it is the route's own of before — the same header,
 * the same sign-in wall (`auth`) and the same journey lock (`gate`: the planet's name on the lock) — so who may come
 * in, and when, does not change with the screen. Pluto has no header of its own yet (it is not in the planet list).
 */
export function NewPlanetScreen({ planet, auth = false, gate }: { planet: HomePlanet; auth?: boolean; gate?: string }) {
  const home = <LivePlanetHome planet={planet} emptyAsSample={false} hrefOf={(p) => `/${p}`} className="relative h-full w-full overflow-hidden bg-[#04050d]" />;
  const wall = (x: ReactNode) => (auth ? <RequireAuth>{x}</RequireAuth> : x);
  const lock = (x: ReactNode) =>
    gate ? (
      <PlanetGate planet={planet} name={gate}>
        {x}
      </PlanetGate>
    ) : (
      x
    );
  // Pluto has no header (it is not in the planet list): the same wall and journey lock (day 8, M-R341), full height
  if (planet === 'pluto') return wall(lock(<div className="h-svh">{home}</div>));
  return (
    <PlanetShell id={planet} bare>
      <DemoBanner />
      {wall(lock(<div className="h-[calc(100svh-56px-env(safe-area-inset-top))]">{home}</div>))}
    </PlanetShell>
  );
}
