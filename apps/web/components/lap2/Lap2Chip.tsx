'use client';

import { LAP2, LAP2_DONE, lap2Done, lap2OpensAt } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { LAP2_LATER, LAP2_OPEN } from '@/components/HomeGate';
import { useAuth } from '@/lib/auth';

const PLANET_JA: Record<string, string> = { uranus: '天王星', pluto: '冥王星', neptune: '海王星' };

/**
 * On the map, for an Obolo Order in the days after joining (lib/onboarding/after.ts): 〔🚀 天王星へ〕 when today's planet
 * is open (left for later, it goes on at once); before it opens, when it opens (no skipping, M-R199).
 */
export function Lap2Chip() {
  const { me } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const done = lap2Done(me?.story);
  if (!me?.orderedAt || done >= LAP2_DONE) return null;
  const planet = PLANET_JA[LAP2[done].planet] ?? '';
  const opens = lap2OpensAt(me.story);
  if (opens !== null && now < opens) {
    const h = Math.ceil((opens - now) / 3600_000);
    return <span className="chip bg-white/10 px-2.5 py-1 text-xs text-white/60">{planet}は、あと{h}時間でひらきます</span>;
  }
  return (
    <button
      onClick={() => {
        try {
          sessionStorage.removeItem(LAP2_LATER);
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new Event(LAP2_OPEN));
      }}
      className="chip bg-amber-200/15 px-2.5 py-1 text-xs text-amber-100"
    >
      {planet}へ
    </button>
  );
}
