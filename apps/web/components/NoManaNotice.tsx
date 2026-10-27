'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EclipseGuide, useResident } from '@/components/onboarding/EclipseGuide';

/**
 * The gem ran dry (402 NO_MANA from a making — M-R132). A resident is offered the Eclipse (its gem fills each
 * month); an Obolo Order hears from Bati that this month's spring is empty. No numbers. Both close with a tap.
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
  // an Obolo Order's mana wells up from the spring in the chest (D08-S002, L2-EARTH-S001), not from the gem —
  // so Bati says the month's spring is empty, and buying more is offered (no numbers)
  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/65 px-4 pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={() => setOn(false)}>
      <div className="w-full max-w-sm rounded-3xl border border-sky-200/30 bg-[#0b1020] p-6 text-center text-sky-50" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] tracking-[0.3em] text-sky-200/70">バティ</p>
        <p className="mt-2 text-[15px] leading-relaxed">今月の泉は、からっぽになっちゃった。……来月になると、また湧いてくるよ。</p>
        <p className="mt-3 text-[12px] text-sky-100/60">待たずに作りたい時は、マナジェムを買い足すこともできます</p>
        <Link href="/earth" onClick={() => setOn(false)} className="mt-5 block w-full rounded-full border border-sky-200/50 bg-sky-200/10 py-3 tracking-[0.2em]">
          マナジェムを見る
        </Link>
        <button onClick={() => setOn(false)} className="mt-2 w-full py-2 text-sm text-sky-100/60">
          今はいい
        </button>
      </div>
    </div>
  );
}
