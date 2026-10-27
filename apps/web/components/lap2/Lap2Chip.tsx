'use client';

import { LAP2_DONE, lap2Done } from '@obolo/shared';
import { LAP2_LATER, LAP2_OPEN } from '@/components/HomeGate';
import { useAuth } from '@/lib/auth';

/** 〔🚀 旅の続き〕 on the map: an Obolo Order who left the second journey for today can go on at once */
export function Lap2Chip() {
  const { me } = useAuth();
  if (!me?.orderedAt || lap2Done(me.story) >= LAP2_DONE) return null;
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
      🚀 旅の続き
    </button>
  );
}
