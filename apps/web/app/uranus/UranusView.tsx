'use client';

import { Artwork } from '@/components/Artwork';
import { PlanetShell } from '@/components/PlanetShell';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n/client';
import { PRODUCTS, tr } from '@/lib/samples';

/** Uranus (spec §2.8): multi-vendor POD mall, prices in MANA. VISUAL DEMO — no purchases (P-DEMO-1). */
export function UranusView() {
  const { m, locale } = useI18n();
  const toast = useToast();
  const shops = [...new Set(PRODUCTS.map((p) => p.shop))];
  return (
    <PlanetShell id="uranus" wide>
      <p className="mb-4 text-xs text-white/55">📦 {m.uranus.lead}</p>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {shops.map((s) => (
          <span key={s} className="chip shrink-0 bg-white/10 px-3 py-1.5 text-white/80">
            🏪 {s}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PRODUCTS.map((p) => (
          <article key={p.id} className="card overflow-hidden">
            <div className="relative">
              <Artwork hue={p.hue} emoji={p.emoji} />
              <span className="chip absolute left-2 top-2 bg-black/55 text-white">{m.uranus.pod}</span>
            </div>
            <div className="p-3">
              <div className="truncate text-sm font-bold">{tr(p.name, locale)}</div>
              <div className="truncate text-[11px] text-white/45">{p.shop}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-black text-[color:var(--color-mana)]">✦ {p.priceMana.toLocaleString()}</span>
                <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold" onClick={() => toast.show(m.common.comingSoon)}>
                  {m.uranus.buy}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {toast.node}
    </PlanetShell>
  );
}
