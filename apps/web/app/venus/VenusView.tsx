'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { PlanetGate } from '@/components/PlanetLock';
import { RequireAuth } from '@/components/RequireAuth';
import { VenusWorld } from '@/components/venus/VenusWorld';

/**
 * Venus — the planet of making things: make in-game goods, buy and sell them with stars
 * (client decision 2026-10-05, docs/venus.md; replaces spec §2.6's square reels).
 */
export function VenusView() {
  return (
    <PlanetShell id="venus" bare>
      <DemoBanner />
      <RequireAuth>
        <PlanetGate planet="venus" name="金星">
        <div className="h-[calc(100svh-56px-env(safe-area-inset-top))]">
          <VenusWorld />
        </div>
        </PlanetGate>
      </RequireAuth>
    </PlanetShell>
  );
}
