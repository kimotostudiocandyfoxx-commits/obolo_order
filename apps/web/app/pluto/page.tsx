'use client';

import { notFound } from 'next/navigation';
import { NewPlanetScreen } from '@/components/planetTemplate/NewPlanetScreen';
import { showsNewHome } from '@/lib/planetHomes';

/**
 * /pluto — M-R326: Pluto (books) has no screen of before, so its live route exists only where the new homes are
 * switched on (lib/planetHomes.ts; off by default: this address is "not found", as it always was).
 */
export default function PlutoPage() {
  if (!showsNewHome('pluto')) notFound();
  // the journey lock of the other outer planets: Pluto opens on day 8 of the first journey (M-R341)
  return <NewPlanetScreen planet="pluto" gate="冥王星" />;
}
