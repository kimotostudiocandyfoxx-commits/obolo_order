'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { PatapataWorld } from '@/components/jupiter/PatapataWorld';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';

/** Jupiter — パタパタ: butterflies for 88 hours, your tree, your roots (client design 2026-10-05, docs/jupiter.md). */
export function JupiterView() {
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
