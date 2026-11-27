'use client';

import { NewPlanetScreen } from '@/components/planetTemplate/NewPlanetScreen';
import { showsNewHome } from '@/lib/planetHomes';
import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';
import { PlanetHome } from '@/components/planetHome/PlanetHome';

/** Saturn: your own record (M-R257), the first 星のホーム (M-R258). */
export function SaturnView() {
  // M-R326: the new common home in place of this screen, only when the switch says so (lib/planetHomes.ts; off by default)
  if (showsNewHome('saturn')) return <NewPlanetScreen planet="saturn" auth />;
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
