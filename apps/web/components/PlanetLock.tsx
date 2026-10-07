'use client';

import { planetOpensAt } from '@obolo/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

/** When a later planet opens for the signed-in member (client decision 2026-10-07). */
export function usePlanetLock(planet: string): { locked: boolean; note: string } {
  const { me } = useAuth();
  const opens = planetOpensAt(planet, me?.orderedAt);
  if (opens === undefined) return { locked: false, note: '' };
  if (opens === null) return { locked: true, note: '入会後にひらく' };
  const left = Math.ceil((opens.getTime() - Date.now()) / (24 * 3600_000));
  return left > 0 ? { locked: true, note: `あと${left}日でひらく` } : { locked: false, note: '' };
}

/**
 * Venus, Neptune and Pluto open one by one after joining (1 / 2 / 3 weeks after the Eclipse).
 * Until then their page shows this instead of the planet.
 */
export function PlanetGate({ planet, name, children }: { planet: string; name: string; children: ReactNode }) {
  const { locked, note } = usePlanetLock(planet);
  if (!locked) return <>{children}</>;
  return (
    <div className="flex h-[calc(100svh-56px-env(safe-area-inset-top))] flex-col items-center justify-center px-8 text-center">
      <p className="text-5xl">🔒</p>
      <p className="mt-4 text-lg font-black">{name}は、まだひらいていない</p>
      <p className="mt-2 text-sm text-white/70">{note}</p>
      <p className="mt-1 text-xs text-white/50">ORDER になると、1週間ごとに新しい星がひらいていくよ</p>
      <Link href="/" className="mt-6 rounded-full bg-white/15 px-6 py-2 text-sm">
        宇宙地図にもどる
      </Link>
    </div>
  );
}
