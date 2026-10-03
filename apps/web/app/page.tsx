'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { LangToggle } from '@/components/LangToggle';
import { ManaChip } from '@/components/ManaChip';
import { SolarSystem } from '@/components/SolarSystem';
import { useI18n } from '@/lib/i18n/client';

export default function HomePage() {
  const { m } = useI18n();
  return (
    <main className="pt-safe pb-safe flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-3">
        <h1 className="bg-gradient-to-r from-sky-200 via-white to-violet-200 bg-clip-text text-xl font-black tracking-wide text-transparent">
          Obolo Order
        </h1>
        <div className="flex items-center gap-2">
          <ManaChip />
          <LangToggle />
        </div>
      </header>
      <p className="mt-1 text-center text-xs text-white/55">{m.home.tagline}</p>
      <DemoBanner />
      <div className="flex flex-1 items-center justify-center py-2">
        <SolarSystem />
      </div>
      <p className="text-center text-xs text-white/45">{m.home.hint}</p>
      <p className="pb-4 pt-1 text-center text-[11px] text-white/40">
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 align-middle" />
        {m.home.liveLegend}
      </p>
    </main>
  );
}
