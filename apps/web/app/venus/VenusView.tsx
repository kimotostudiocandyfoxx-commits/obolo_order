'use client';

import { NewPlanetScreen } from '@/components/planetTemplate/NewPlanetScreen';
import { showsNewHome } from '@/lib/planetHomes';
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
  const params = useSearchParams();
  const practice = params.get('dj') === '1';
  // ?booth=1: straight into the broadcast booth (from the Moon atelier's 〔ラジオ〕)
  const booth = params.get('booth') === '1';
  const router = useRouter();
  // M-R326: the new common home in place of this screen, only when the switch says so (lib/planetHomes.ts; off by default).
  // Story 2026-11-27: with the switch on, the doors of before are closed too — ?dj=1 (the practice console) and ?booth=1
  // (the broadcast booth) show the new home: a show is recorded on the Moon and flown (the API refuses the booth's posting)
  if (showsNewHome('venus')) return <NewPlanetScreen planet="venus" auth gate="金星" />;
  return (
    <PlanetShell id="venus" bare>
      <DemoBanner />
      <RequireAuth>
        <PlanetGate planet="venus" name="金星">
          {practice ? <VenusDj backHref="/venus" /> : <RadioWorld startInBooth={booth} practice={() => router.push('/venus?dj=1')} />}
        </PlanetGate>
      </RequireAuth>
    </PlanetShell>
  );
}
