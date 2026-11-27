'use client';

import { isHomePlanet, type HomePlanet } from '@obolo/shared';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LivePlanetHome } from '@/components/planetTemplate/LivePlanetHome';

/**
 * /planets-preview/<planet> — the new common planet home (handoff 01 3章) with real data, for the story session to
 * compare with the prototype. Not linked from the app; the live planet screens stay as they are until each planet is
 * switched over (M-R326: lib/planetHomes.ts, off by default). ?sample=1 forces the sample cast.
 */
function Preview() {
  const params = useParams<{ planet: string }>();
  const q = useSearchParams();
  const planet: HomePlanet = isHomePlanet(params.planet ?? '') ? (params.planet as HomePlanet) : 'jupiter';
  const forced = q.get('sample') === '1';
  return <LivePlanetHome planet={planet} forced={forced} hrefOf={(p) => `/planets-preview/${p}${forced ? '?sample=1' : ''}`} />;
}

export default function PlanetsPreviewPage() {
  return (
    <Suspense fallback={<main className="h-svh bg-[#04050d]" />}>
      <Preview />
    </Suspense>
  );
}
