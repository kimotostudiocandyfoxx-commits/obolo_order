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
    <div className="mx-auto mt-2 w-fit max-w-[92vw] rounded-full bg-amber-300/15 px-3 py-1 text-center text-[11px] text-amber-200">
      ⚠︎ {m.common.demoMode} — {m.common.demoModeHint}
    </div>
  );
}
