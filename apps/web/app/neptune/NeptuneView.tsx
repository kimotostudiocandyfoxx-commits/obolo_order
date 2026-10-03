'use client';

import { Artwork } from '@/components/Artwork';
import { PlanetShell } from '@/components/PlanetShell';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n/client';
import { compact, GAMES, tr } from '@/lib/samples';

/** Neptune (spec §2.9): HTML5 game store, 92% to developers. VISUAL DEMO (P-DEMO-1). */
export function NeptuneView() {
  const { m, locale } = useI18n();
  const toast = useToast();
  const [hero, ...rest] = GAMES;
  return (
    <PlanetShell id="neptune">
      <p className="mb-4 text-xs text-white/55">🎮 {m.neptune.lead}</p>
      <article className="card mb-4 overflow-hidden">
        <Artwork hue={hero.hue} emoji={hero.emoji} animated />
        <div className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="truncate font-black">{tr(hero.title, locale)}</div>
            <div className="text-xs text-white/50">
              {hero.dev} · ★ {hero.rating} · {compact(hero.plays, locale)}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => toast.show(m.common.comingSoon)}>
            {m.neptune.play}
          </button>
        </div>
      </article>
      <ul className="space-y-3">
        {rest.map((g) => (
          <li key={g.id} className="card flex items-center gap-3 p-3">
            <div className="w-16 shrink-0 overflow-hidden rounded-2xl">
              <Artwork hue={g.hue} emoji={g.emoji} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{tr(g.title, locale)}</div>
              <div className="truncate text-[11px] text-white/45">
                {g.dev} · {tr(g.genre, locale)} · ★ {g.rating}
              </div>
              <span className="chip mt-1 bg-emerald-300/15 text-emerald-200">{m.neptune.devShare}</span>
            </div>
            <button className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold" onClick={() => toast.show(m.common.comingSoon)}>
              {g.priceMana ? `✦ ${g.priceMana}` : m.neptune.free}
            </button>
          </li>
        ))}
      </ul>
      {toast.node}
    </PlanetShell>
  );
}
