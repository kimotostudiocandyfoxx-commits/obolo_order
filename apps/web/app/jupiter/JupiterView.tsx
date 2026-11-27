'use client';

import { NewPlanetScreen } from '@/components/planetTemplate/NewPlanetScreen';
import { showsNewHome } from '@/lib/planetHomes';
import { DemoBanner } from '@/components/DemoBanner';
import { PatapataWorld } from '@/components/jupiter/PatapataWorld';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';

/** Jupiter — パタパタ: butterflies for 88 hours, your tree, your roots (client design 2026-10-05, docs/jupiter.md). */
export function JupiterView() {
  // M-R326: the new common home in place of this screen, only when the switch says so (lib/planetHomes.ts; off by default)
  if (showsNewHome('jupiter')) return <NewPlanetScreen planet="jupiter" auth />;
  return (
    <PlanetShell id="jupiter" bare>
      <DemoBanner />
      <RequireAuth>
        <div className="h-[calc(100svh-56px-env(safe-area-inset-top))]">
          <PatapataWorld live />
        </div>
      </RequireAuth>
    </PlanetShell>
  );
}
