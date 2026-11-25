'use client';

import { bagBar, type StorageView } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { BagRow } from './BagRow';

/** R18: Bluena's room changed (a ふくろの魔法, a work thrown away) — the bar reads it again */
export const STORAGE_EVENT = 'obolo:storage';

/**
 * R18 (client 2026-11-25): Bluena's room, calm and small under its header — a row of bags (1袋 = 1GB: 5 for a member,
 * 1 for everyone else, more with ふくろの魔法), filled as it is used. No numbers, no 「GB」, no warning colours; at
 * 80% and more the bags are only a little brighter (Bati says the rest).
 */
export function StorageBar({ className = '' }: { className?: string }) {
  const [v, setV] = useState<StorageView | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      void getApi()
        .storage()
        .then((x) => live && setV(x))
        .catch(() => undefined);
    load();
    window.addEventListener(STORAGE_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(STORAGE_EVENT, load);
    };
  }, []);
  if (!v || !(v.quotaBytes > 0)) return null;
  return (
    <div className={`pointer-events-none mx-auto w-full max-w-[260px] ${className}`} data-testid="bluena-storage">
      <BagRow bar={bagBar(v.usedBytes, v.quotaBytes)} bright={v.level !== 'ok'} />
    </div>
  );
}
