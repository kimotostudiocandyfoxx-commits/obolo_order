'use client';

import { useEffect, useState } from 'react';
import { getApi, tokenStore } from '@/lib/api';

/**
 * /reset — start over from the email entry screen (for checking the flow again).
 * Logs out and, in demo mode, deletes everything the demo stored on this device
 * (accounts, journey progress, story progress, local ratings).
 */
export default function ResetPage() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        await getApi().logout();
      } catch {
        /* already logged out */
      }
      tokenStore.clear();
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith('obolo.')) localStorage.removeItem(k);
        sessionStorage.clear();
        indexedDB.deleteDatabase('obolo-demo');
      } catch {
        /* storage unavailable */
      }
      setDone(true);
      setTimeout(() => window.location.replace('/'), 900);
    })();
  }, []);
  return (
    <main className="flex min-h-svh items-center justify-center bg-black text-sm tracking-widest text-amber-100/80">
      {done ? 'リセットしました。最初から始まります…' : 'リセット中…'}
    </main>
  );
}
