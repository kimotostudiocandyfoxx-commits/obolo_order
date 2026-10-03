'use client';

import { useState } from 'react';
import { Artwork } from '@/components/Artwork';
import { PlanetShell } from '@/components/PlanetShell';
import { useI18n } from '@/lib/i18n/client';
import { compact, REELS, tr, type SampleReel } from '@/lib/samples';

/** Venus (spec §2.6): SQUARE (1:1) short reels, swipe feed. VISUAL DEMO — animated placeholders, no video (P-DEMO-1). */
export function VenusView() {
  const { m } = useI18n();
  return (
    <PlanetShell id="venus" bare>
      <p className="mx-auto max-w-xl px-4 pt-2 text-center text-xs text-white/55">{m.venus.lead}</p>
      <div className="no-scrollbar h-[calc(100svh-56px-40px-32px-env(safe-area-inset-top))] snap-y snap-mandatory overflow-y-scroll">
        {REELS.map((r) => (
          <Reel key={r.id} reel={r} />
        ))}
      </div>
    </PlanetShell>
  );
}

function Reel({ reel }: { reel: SampleReel }) {
  const { m, locale } = useI18n();
  const [starred, setStarred] = useState(false);
  return (
    <section className="flex h-full snap-start flex-col items-center justify-center px-4">
      <div className="relative" style={{ width: 'min(100vw - 32px, 100svh - 260px, 520px)' }}>
        <div className="overflow-hidden rounded-3xl">
          <Artwork hue={reel.hues[0]} hue2={reel.hues[1]} emoji={reel.emoji} animated />
        </div>
        <div className="absolute -right-1 bottom-4 flex translate-x-full flex-col items-center gap-4 max-sm:right-3 max-sm:translate-x-0">
          <button onClick={() => setStarred(!starred)} className="flex flex-col items-center text-xs">
            <span className={`text-2xl ${starred ? 'text-[color:var(--color-star)]' : 'text-white'}`}>{starred ? '★' : '☆'}</span>
            {compact(reel.stars + (starred ? 1 : 0), locale)}
          </button>
          <span className="flex flex-col items-center text-xs">
            <span className="text-2xl">💬</span>
            {compact(reel.comments, locale)}
          </span>
          <span className="flex flex-col items-center text-xs" aria-label={m.venus.share}>
            <span className="text-2xl">↗</span>
          </span>
        </div>
      </div>
      <div className="mt-4 w-full max-w-[520px]">
        <div className="font-bold">@{reel.author}</div>
        <p className="text-sm text-white/80">{tr(reel.caption, locale)}</p>
      </div>
    </section>
  );
}
