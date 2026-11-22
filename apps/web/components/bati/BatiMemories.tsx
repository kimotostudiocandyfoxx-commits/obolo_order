'use client';

import { useState } from 'react';
import { MEMORY_PER_BATI, type Me } from '@obolo/shared';
import { getApi } from '@/lib/api';

/**
 * 「覚えてること」 on {bati}'s card (M-R222): what the member asked it to remember in the chat (「覚えといて」), five at
 * most — forget one, or all. {bati} never asks to remember; nothing is added here but by the chat's request.
 */
export function BatiMemories({ me, onMe }: { me: Me; onMe: (m: Me) => void }) {
  const [busy, setBusy] = useState(false);
  const list = me.bati?.memories ?? [];
  const run = async (f: () => Promise<Me>) => {
    setBusy(true);
    try {
      onMe(await f());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="w-64 rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-amber-50">
      <p className="mb-2 text-xs font-bold tracking-widest text-amber-200/80">
        覚えてること（{list.length}／{MEMORY_PER_BATI}）
      </p>
      {list.length ? (
        <ul className="space-y-1.5">
          {list.map((m) => (
            <li key={m.id} className="flex items-start gap-2">
              <span className="flex-1 break-all">{m.text}</span>
              <button disabled={busy} onClick={() => void run(() => getApi().batiForget(m.id))} aria-label="わすれる" className="shrink-0 text-xs text-white/50">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-white/50">チャットで「覚えといて」と言うと、ここに並びます</p>
      )}
      {list.length > 1 && (
        <button disabled={busy} onClick={() => confirm('ぜんぶ、わすれてもいい？') && void run(() => getApi().batiForget())} className="mt-2 w-full text-xs text-rose-300/80 underline">
          ぜんぶわすれる
        </button>
      )}
    </div>
  );
}
