'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';
import { PlanetHome } from '@/components/planetHome/PlanetHome';

/** Saturn: your own record (M-R257), the first 星のホーム (M-R258). */
export function SaturnView() {
  return (
    <PlanetShell id="saturn" bare>
      <DemoBanner />
      <RequireAuth>
        <div className="h-[calc(100svh-56px-env(safe-area-inset-top))]">
          <PlanetHome planet="saturn" />
        </div>
      </RequireAuth>
    </PlanetShell>
  );
}
