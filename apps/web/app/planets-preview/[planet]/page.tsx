'use client';

import { isHomePlanet, type HomePlanet } from '@obolo/shared';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LivePlanetHome } from '@/components/planetTemplate/LivePlanetHome';

/**
 * /planets-preview/<planet> — the new common planet home (handoff 01 3章) with real data, for the story session to
 * compare with the prototype. Not linked from the app; the live planet screens stay as they are until each planet is
 * switched over (M-R326: lib/planetHomes.ts, off by default). ?sample=1 forces the sample cast.
 * ?sample=1&day=3…10 (M-R341): the cast as it is on that day of the first journey — KIMORIN⭐︎ and that day's oshi (9 on
 * day 3 … 18 on day 10; lib/planetTemplate/roster.ts). Without a day: the journey done as an Obolo Order (all of them).
 */
function Preview() {
  const params = useParams<{ planet: string }>();
  const q = useSearchParams();
  const planet: HomePlanet = isHomePlanet(params.planet ?? '') ? (params.planet as HomePlanet) : 'jupiter';
  const forced = q.get('sample') === '1';
  const d = Number(q.get('day'));
  const day = Number.isInteger(d) && d >= 3 && d <= 10 ? d : undefined;
  return <LivePlanetHome planet={planet} forced={forced} sampleDay={day} hrefOf={(p) => `/planets-preview/${p}${forced ? `?sample=1${day ? `&day=${day}` : ''}` : ''}`} />;
}

export default function PlanetsPreviewPage() {
  return (
    <Suspense fallback={<main className="h-svh bg-[#04050d]" />}>
      <Preview />
    </Suspense>
  );
}
