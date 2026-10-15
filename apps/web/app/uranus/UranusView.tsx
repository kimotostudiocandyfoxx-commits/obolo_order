'use client';

import { PlanetGate } from '@/components/PlanetLock';
import { PlanetShell } from '@/components/PlanetShell';
import { Atelier } from '@/components/uranus/Atelier';

/**
 * Uranus (client decision 2026-10-15): the planet of ateliers. Each member has an atelier of their own to
 * decorate (second journey, from ORDER). The OBOLO商店 in the middle of Uranus — buying, and selling your own
 * goods by application — opens on the third journey; until then its shutter is down.
 */
export function UranusView() {
  return (
    <PlanetShell id="uranus">
      <PlanetGate planet="uranus" name="天王星">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[repeating-linear-gradient(0deg,#8b8fa3_0_4px,#6d7186_4px_8px)] text-xl">🏪</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-sm font-black">OBOLO商店</div>
            <div className="text-[11px] text-white/55">天王星のまんなかのお店。シャッターは、まだ閉まっている</div>
          </div>
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/50">三周目の旅から</span>
        </div>
        <h1 className="mb-2 text-center text-sm font-black tracking-widest text-cyan-100">わたしのアトリエ</h1>
        <Atelier />
      </PlanetGate>
    </PlanetShell>
  );
}
