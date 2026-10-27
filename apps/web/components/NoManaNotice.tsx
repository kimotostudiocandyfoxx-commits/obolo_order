'use client';

import { useEffect, useState } from 'react';
import { EclipseGuide, useResident } from '@/components/onboarding/EclipseGuide';

/**
 * The gem ran dry (402 NO_MANA from a making — M-R132). A resident is offered the Eclipse (its gem fills each
 * month); an Obolo Order is told plainly, with no number. Both close with a tap.
 */
export function NoManaNotice() {
  const [on, setOn] = useState(false);
  const resident = useResident();
  useEffect(() => {
    const show = () => setOn(true);
    window.addEventListener('obolo:nomana', show);
    return () => window.removeEventListener('obolo:nomana', show);
  }, []);
  if (!on) return null;
  if (resident) return <EclipseGuide what="マナを使って新しく作るの" onClose={() => setOn(false)} />;
  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/65 px-4 pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={() => setOn(false)}>
      <div className="w-full max-w-sm rounded-3xl border border-sky-200/30 bg-[#0b1020] p-6 text-center text-sky-50" onClick={(e) => e.stopPropagation()}>
        <p className="text-3xl">💎</p>
        <p className="mt-2 text-[15px] leading-relaxed">マナジェムが、光らなくなった。今は、魔法は唱えられない。</p>
        <p className="mt-1 text-[12px] text-sky-100/60">つぎの月になると、また光りだすよ。</p>
        <button onClick={() => setOn(false)} className="mt-5 w-full rounded-full border border-sky-200/50 py-3 tracking-[0.2em]">
          とじる
        </button>
      </div>
    </div>
  );
}
