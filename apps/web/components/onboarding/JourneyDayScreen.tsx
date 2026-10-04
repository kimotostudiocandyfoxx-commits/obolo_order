'use client';

import { journeyMeta, PLANETS } from '@obolo/shared';
import { useState } from 'react';
import { PlanetSphere } from '@/components/PlanetSphere';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * Days 2–8 of the journey. PLACEHOLDER (P-OB-1): their scripts and motion videos have not been
 * delivered yet, so this screen shows the planned beats (client's outline) and lets the visitor
 * mark the day as experienced. When a day's script arrives it gets its own story like Day 1.
 */
export function JourneyDayScreen({ day }: { day: number }) {
  const { m, t } = useI18n();
  const { setMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const meta = journeyMeta(day);
  if (!meta) return null;

  const finish = async () => {
    setBusy(true);
    try {
      setMe(await getApi().completeJourneyDay(day));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="pt-safe pb-safe flex min-h-svh flex-col items-center justify-center bg-black px-8 text-center text-white"
      style={{ fontFamily: SERIF }}
    >
      <span className="animate-[fadeUp_1s_ease-out] text-xs tracking-[0.6em] text-amber-200/70">{t(m.journey.day, { n: day })}</span>
      <div className="mt-6 animate-[fadeUp_1.4s_ease-out] drop-shadow-[0_0_30px_rgba(255,210,140,0.35)]">
        <PlanetSphere id={meta.planet} size={120} />
      </div>
      <p className="mt-6 text-2xl tracking-[0.25em] text-amber-50">{meta.title}</p>
      <p className="mt-1 text-xs tracking-widest text-white/40">{PLANETS[meta.planet].emoji} {m.planets[meta.planet].name}</p>
      {meta.guides.length > 0 && (
        <p className="mt-4 text-sm text-white/60">
          {m.journey.guides}：{meta.guides.join('・')}
        </p>
      )}
      <div className="mt-8 w-full max-w-xs rounded-2xl border border-amber-200/20 bg-white/[0.03] px-5 py-4 text-left">
        <p className="mb-2 text-[11px] tracking-widest text-amber-200/60">{m.journey.beatsTitle}</p>
        <ol className="space-y-1.5 text-sm text-white/75">
          {meta.beats.map((b, i) => (
            <li key={b} className="flex gap-2">
              <span className="text-amber-200/50">{i + 1}.</span>
              {b}
            </li>
          ))}
        </ol>
      </div>
      <button
        onClick={() => void finish()}
        disabled={busy}
        className="mt-10 rounded-full border border-amber-200/60 bg-black px-7 py-3 text-sm tracking-widest text-amber-100 disabled:opacity-40"
      >
        {t(m.journey.finish, { n: day })}
      </button>
    </main>
  );
}
