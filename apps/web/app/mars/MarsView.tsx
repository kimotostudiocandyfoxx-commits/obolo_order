'use client';

import { useState } from 'react';
import { Artwork } from '@/components/Artwork';
import { PlanetShell } from '@/components/PlanetShell';
import { useI18n } from '@/lib/i18n/client';
import { SERIES, tr } from '@/lib/samples';

/** Mars (spec §2.7): long-form video in a SQUARE player. VISUAL DEMO (P-DEMO-1). */
export function MarsView() {
  const { m, t, locale } = useI18n();
  const [current, setCurrent] = useState(SERIES[0]);
  const [playing, setPlaying] = useState(false);
  return (
    <PlanetShell id="mars" wide>
      <p className="mb-3 text-xs text-white/55">{m.mars.lead}</p>
      <h2 className="mb-2 text-sm font-bold text-white/70">{m.mars.featured}</h2>
      <div className="card overflow-hidden">
        <button className="relative block w-full" onClick={() => setPlaying(!playing)}>
          <Artwork hue={current.hue} emoji={current.emoji} animated={playing}>
            {!playing && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-2xl text-slate-900">▶</span>
              </span>
            )}
            {playing && (
              <span className="absolute inset-x-4 bottom-4 h-1 overflow-hidden rounded-full bg-white/25">
                <span className="block h-full w-1/3 animate-pulse bg-rose-400" />
              </span>
            )}
          </Artwork>
        </button>
        <div className="p-4">
          <div className="text-lg font-black">{tr(current.title, locale)}</div>
          <div className="text-xs text-white/55">
            {current.creator} · {tr(current.genre, locale)} · {t(m.mars.episodes, { n: current.episodes })}
          </div>
        </div>
      </div>
      <h2 className="mb-2 mt-6 text-sm font-bold text-white/70">{m.mars.series}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {SERIES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setCurrent(s);
              setPlaying(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-36 shrink-0 snap-start text-left"
          >
            <div className={`overflow-hidden rounded-2xl ${s.id === current.id ? 'ring-2 ring-rose-300' : ''}`}>
              <Artwork hue={s.hue} emoji={s.emoji} />
            </div>
            <div className="mt-1.5 line-clamp-2 text-xs font-bold">{tr(s.title, locale)}</div>
            <div className="text-[10px] text-white/45">{t(m.mars.episodes, { n: s.episodes })}</div>
          </button>
        ))}
      </div>
    </PlanetShell>
  );
}
