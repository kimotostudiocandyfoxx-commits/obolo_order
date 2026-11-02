'use client';

import { getApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';
import { useEffect, useState } from 'react';

/** Visible whenever the app runs without a backend, so demo data is never mistaken for real data. */
export function DemoBanner() {
  const { m } = useI18n();
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(getApi().mode === 'demo'), []);
  if (!demo) return null;
  return (
    // laid over the top, taking no room: the worlds are sized to the screen minus the nav (story chat 2026-11-02:
    // the banner pushed their bottom buttons off the screen)
    <div className="pointer-events-none fixed left-1/2 top-[calc(2px+env(safe-area-inset-top))] z-[60] w-fit max-w-[92vw] -translate-x-1/2 rounded-full bg-black/55 px-3 py-0.5 text-center text-[10px] text-amber-200 backdrop-blur">
      ⚠︎ {m.common.demoMode} — {m.common.demoModeHint}
    </div>
  );
}
