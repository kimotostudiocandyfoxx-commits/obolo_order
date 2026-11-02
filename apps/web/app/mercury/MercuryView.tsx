'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { MercuryWorld } from '@/components/mercury/MercuryWorld';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';
import { getApi } from '@/lib/api';

/**
 * Mercury — the planet of music: a sea chart of genre islands; sail to one and swipe through its
 * songs, three-tier stars (client design 2026-10-05, docs/mercury.md; keeps spec §2.5's swipe feed
 * and 3-tier Stars, now entered by island).
 */
export function MercuryView() {
  return (
    <PlanetShell id="mercury" bare>
      <DemoBanner />
      <RequireAuth>
        <div className="h-[calc(100svh-56px-env(safe-area-inset-top))]">
          {/* the demo build keeps its island in this browser (the real one comes from the server) */}
          <MercuryWorld live={getApi().mode === 'live'} />
        </div>
      </RequireAuth>
    </PlanetShell>
  );
}
