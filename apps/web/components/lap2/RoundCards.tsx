'use client';

import { useEffect, useState } from 'react';

/**
 * The round's cards (L2-RETURN-S005): MONBAN lays one card per planet on the board — only what was made
 * (or chosen) there; elsewhere just the planet's little picture. No numbers, no ranks.
 */
const ROWS: { planet: string; icon: string; what: (a: Record<string, string>, look?: string) => string | null }[] = [
  { planet: '月', icon: '🌙', what: (a, look) => (a.l2_earth_look === 'change' || look ? 'プロフィールの姿' : null) },
  { planet: '土星', icon: '🪐', what: (a) => (a.l2_saturn_plaza === 'make' ? '作った広場' : null) },
  { planet: '木星', icon: '🌳', what: (a) => (a.l2_jupiter_jacket_text ? `『${a.l2_jupiter_jacket_text}』` : null) },
  { planet: '水星', icon: '🏝️', what: (a) => (a.l2_mercury_place && a.l2_mercury_place !== 'none' ? '島に並べた曲' : null) },
  { planet: '火星', icon: '🎬', what: (a) => (a.l2_mars_theater ? '上映館に並べた映像' : null) },
  { planet: '金星', icon: '🎧', what: (a) => (a.l2_venus_l2_synced === 'yes' ? 'ブースから見せた一曲' : null) },
  { planet: '天王星', icon: '🎨', what: (a) => (a.l2_uranus_goods === 'display' ? 'アトリエに飾ったグッズ' : null) },
  { planet: '海王星', icon: '🎲', what: (a) => (a.l2_neptune_road ? '『キモリンの帰り道』' : null) },
];

export function RoundCards({ answers, look, onDone }: { answers: Record<string, string>; look?: string; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= ROWS.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 450);
    return () => clearTimeout(t);
  }, [shown]);
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-3xl border border-amber-100/25 bg-[#120e08]/95 p-5 text-amber-50">
        <div className="grid grid-cols-4 gap-2">
          {ROWS.map((r, k) => {
            const w = r.what(answers, look);
            return (
              <div key={r.planet} className={`flex aspect-[3/4] flex-col items-center justify-center rounded-xl p-1 text-center transition-all duration-500 ${k < shown ? 'opacity-100' : 'translate-y-2 opacity-0'} ${w ? 'bg-amber-100/15 ring-1 ring-amber-200/50' : 'bg-white/[0.03]'}`}>
                <span className={w ? 'text-2xl' : 'text-xl opacity-50'}>{r.icon}</span>
                <span className="mt-1 text-[10px] text-amber-100/70">{r.planet}</span>
                {w && <span className="mt-0.5 line-clamp-2 text-[10px] leading-tight">{w}</span>}
              </div>
            );
          })}
        </div>
        <button onClick={onDone} disabled={shown < ROWS.length} className="mt-4 w-full rounded-full border border-amber-200/50 bg-amber-200/10 py-3 text-[14px] disabled:opacity-40">
          つぎへ
        </button>
      </div>
    </div>
  );
}
