'use client';

import { HOME_PLANETS, PLANET_HOMES, isHomePlanet, type HomePlanet } from '@obolo/shared';
import { useEffect, useMemo, useState } from 'react';
import { PlanetHome } from '@/components/planetHome/PlanetHome';
import { sampleView } from '@/lib/planetHome/sample';

/**
 * /lab/planet-home — 星のホーム with sample works, for checking the look and the touch at phone width (not linked from
 * the app). ?p=<planet> picks the planet, ?young=1 a viewer under 15, ?first=1 the first visit, ?n=<new arrivals>.
 */
export default function PlanetHomeLab() {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  useEffect(() => setQ(new URLSearchParams(location.search)), []);
  const p = q?.get('p') ?? 'saturn';
  const planet: HomePlanet = isHomePlanet(p) ? p : 'saturn';
  const young = q?.get('young') === '1';
  const first = q?.get('first') === '1';
  const n = Number(q?.get('n') ?? 2);
  const crowd = Number(q?.get('crowd') ?? 0);
  const voices = q?.get('voice') === '1';
  const view = useMemo(() => sampleView(planet, { young, firstTime: first, arrivals: n, crowd, voices }), [planet, young, first, n, crowd, voices]);
  if (!q) return <main className="h-svh bg-[#140f22]" />;
  return (
    <main className="flex h-svh flex-col bg-[#140f22]">
      {q.get('shot') !== '1' && (
        <nav className="flex shrink-0 gap-1 overflow-x-auto px-2 py-1.5" aria-label="星を切りかえる">
          {HOME_PLANETS.map((k) => (
            <a
              key={k}
              href={`?p=${k}${young ? '&young=1' : ''}`}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${k === planet ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
            >
              {PLANET_HOMES[k].name}
            </a>
          ))}
        </nav>
      )}
      <div className="relative min-h-0 flex-1">
        <PlanetHome key={`${planet}${young}${first}${n}${crowd}${voices}`} planet={planet} view={view} />
      </div>
    </main>
  );
}
