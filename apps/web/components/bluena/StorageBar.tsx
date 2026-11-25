'use client';

import { storageBarText, type StorageView } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';

/** R18: Bluena's room changed (a 保存の魔法, a work thrown away) — the bar reads it again */
export const STORAGE_EVENT = 'obolo:storage';

/**
 * R18 (client 2026-11-25): Bluena's room, calm and small under its header — 「ブルーナ：2.1GB / 5GB」 and a thin line.
 * No warning colours, no numbers about people; at 100% the line is only a little brighter (Bati says the rest).
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
  const share = Math.min(1, v.usedBytes / v.quotaBytes);
  return (
    <div className={`pointer-events-none mx-auto w-full max-w-[260px] ${className}`} data-testid="bluena-storage" aria-label={storageBarText(v.usedBytes, v.quotaBytes)}>
      <p className="text-center text-[10.5px] tracking-[0.04em] text-sky-100/70 [text-shadow:0_1px_4px_#000]">{storageBarText(v.usedBytes, v.quotaBytes)}</p>
      <span className="mt-0.5 block h-[3px] w-full overflow-hidden rounded-full bg-white/10">
        <span className="block h-full rounded-full bg-sky-200/60" style={{ width: `${Math.max(1.5, share * 100)}%`, opacity: v.level === 'ok' ? 0.75 : 1 }} />
      </span>
    </div>
  );
}
