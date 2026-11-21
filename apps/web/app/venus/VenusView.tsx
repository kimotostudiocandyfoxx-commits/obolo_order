'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { PlanetGate } from '@/components/PlanetLock';
import { RequireAuth } from '@/components/RequireAuth';
import { VenusDj } from '@/components/dj/VenusDj';
import { RadioWorld } from '@/components/venus/radio/RadioWorld';

/**
 * Venus — the radio planet (client decision 2026-11-21, docs/工房とブルーナ_設計.md §9–10): shows
 * ON AIR and recorded, and the broadcast booth. The DJ console of 2026-10-12 stays as the booth's
 * 〔DJの練習〕 (just you; files from the device are allowed there and never go on air).
 */
export function VenusView() {
  return (
    <Suspense>
      <Venus />
    </Suspense>
  );
}

function Venus() {
  const practice = useSearchParams().get('dj') === '1';
  const router = useRouter();
  return (
    <PlanetShell id="venus" bare>
      <DemoBanner />
      <RequireAuth>
        <PlanetGate planet="venus" name="金星">
          {practice ? <VenusDj backHref="/venus" /> : <RadioWorld practice={() => router.push('/venus?dj=1')} />}
        </PlanetGate>
      </RequireAuth>
    </PlanetShell>
  );
}
