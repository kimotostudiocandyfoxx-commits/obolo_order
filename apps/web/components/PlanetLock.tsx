'use client';

import { planetIsOpen, planetOpenDay } from '@obolo/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { LineIcon } from '@/components/LineIcon';

/**
 * When an outer planet opens for the signed-in person. M-R341 (2026-11-27): Pluto, Neptune and Uranus are days 8, 9 and
 * 10 of the first journey — open from that day for everyone, an Obolo Order or not (before: members only, Uranus with
 * ORDER and Neptune / Pluto 2 / 3 weeks after it; an ended subscription closed them — it no longer does). Everyone
 * whose journey is done has all three.
 */
export function planetLockOf(planet: string, journeyDay: number | null | undefined): { locked: boolean; note: string } {
  if (planetIsOpen(planet, journeyDay)) return { locked: false, note: '' };
  return { locked: true, note: `旅の${planetOpenDay(planet)}日目にひらく` };
}

export function usePlanetLock(planet: string): { locked: boolean; note: string } {
  const { me } = useAuth();
  return planetLockOf(planet, me?.journeyDay);
}

/** Until its day of the first journey, an outer planet's page shows this instead of the planet. */
export function PlanetGate({ planet, name, children }: { planet: string; name: string; children: ReactNode }) {
  const { locked, note } = usePlanetLock(planet);
  if (!locked) return <>{children}</>;
  return (
    <div className="flex h-[calc(100svh-56px-env(safe-area-inset-top))] flex-col items-center justify-center px-8 text-center">
      <LineIcon id="lock" className="h-12 w-12" />
      <p className="mt-4 text-lg font-black">{name}は、まだひらいていない</p>
      <p className="mt-2 text-sm text-white/70">{note}</p>
      <p className="mt-1 text-xs text-white/50">旅を進めると、1日に1つずつ、新しい星がひらいていくよ</p>
      <Link href="/" className="mt-3 rounded-full bg-white/15 px-6 py-2 text-sm">
        宇宙地図にもどる
      </Link>
    </div>
  );
}
