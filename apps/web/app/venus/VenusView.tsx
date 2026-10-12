'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { PlanetGate } from '@/components/PlanetLock';
import { RequireAuth } from '@/components/RequireAuth';
import { VenusDj } from '@/components/dj/VenusDj';

/**
 * Venus — the DJ / VJ planet: mix your own Mercury songs (and, later, Mars MVs) on two decks
 * (client decision 2026-10-12, docs/venus.md). The goods shop of 2026-10-05 is retired.
 */
export function VenusView() {
  return (
    <PlanetShell id="venus" bare>
      <DemoBanner />
      <RequireAuth>
        <PlanetGate planet="venus" name="金星">
        <VenusDj backHref="/" />
        </PlanetGate>
      </RequireAuth>
    </PlanetShell>
  );
}
