'use client';

import { useEffect, useState } from 'react';

/** Shown when the team has suspended this account (after a report review). */
export function SuspendedNotice() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const show = () => setOn(true);
    window.addEventListener('obolo:suspended', show);
    return () => window.removeEventListener('obolo:suspended', show);
  }, []);
  if (!on) return null;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-[#070b1a]/97 px-8 text-center">
      <p className="text-4xl">⛔</p>
      <p className="text-lg font-bold">このアカウントは利用を停止しています</p>
      <p className="max-w-sm text-sm leading-relaxed text-white/65">みんなが安心して使えるように、運営がこのアカウントの利用を止めています。くわしくは運営までお問い合わせください。</p>
    </div>
  );
}
