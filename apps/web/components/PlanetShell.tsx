'use client';

import { PLANETS, type PlanetId } from '@obolo/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { LangToggle } from './LangToggle';
import { ManaChip } from './ManaChip';
import { PlanetSphere } from './PlanetSphere';

/** Common frame for every planet page: header with back-to-home, planet badge, and a sample-data ribbon for mock planets. */
export function PlanetShell({
  id,
  children,
  wide = false,
  bare = false,
}: {
  id: PlanetId;
  children: ReactNode;
  wide?: boolean;
  /** bare = full-bleed content (Mercury feed) */
  bare?: boolean;
}) {
  const { m } = useI18n();
  const meta = PLANETS[id];
  return (
    <div className="min-h-svh">
      <header className="pt-safe sticky top-0 z-30 border-b border-white/5 bg-[color:var(--color-space-950)]/80 backdrop-blur-md">
        <div className={`mx-auto flex h-14 items-center gap-2 px-3 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
          <Link href="/" className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label={m.common.home}>
            ←
          </Link>
          <span className={meta.ring ? 'px-2' : ''}>
            <PlanetSphere id={id} size={30} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-bold">{m.planets[id].name}</div>
            <div className="truncate text-[11px] text-white/55">{m.planets[id].role}</div>
          </div>
          <ManaChip />
          <LangToggle />
        </div>
      </header>
      {meta.demo === 'mock' && (
        <div className="mx-auto mt-2 w-fit rounded-full bg-fuchsia-300/15 px-3 py-1 text-[11px] text-fuchsia-200">
          {m.common.sampleData} · {m.common.sampleDataHint}
        </div>
      )}
      {bare ? children : <main className={`mx-auto px-4 pb-24 pt-4 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>{children}</main>}
    </div>
  );
}
