'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';
import { KororinWorld } from '@/components/saturn/KororinWorld';

/** Saturn (spec §2.3) — the voice microblog, presented as the ころりん world (client concept 2026-10-04). */
export function SaturnView() {
  return (
    <PlanetShell id="saturn" bare>
      <DemoBanner />
      <RequireAuth>
        <div className="h-[calc(100svh-56px-env(safe-area-inset-top))]">
          <KororinWorld />
        </div>
      </RequireAuth>
    </PlanetShell>
  );
}
