'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { MarsWorld } from '@/components/mars/MarsWorld';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';

/**
 * Mars — the planet of video: friends' videos arrive as UFOs for 88 hours, every user has a studio
 * (client design 2026-10-05, docs/mars.md; spec §2.7's long-form video lives on in the studio).
 */
export function MarsView() {
  return (
    <PlanetShell id="mars" bare>
      <DemoBanner />
      <RequireAuth>
        <div className="h-[calc(100svh-56px-env(safe-area-inset-top))]">
          <MarsWorld live />
        </div>
      </RequireAuth>
    </PlanetShell>
  );
}
