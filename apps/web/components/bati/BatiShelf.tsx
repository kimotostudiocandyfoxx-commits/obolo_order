'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { BatiCard } from '@obolo/shared';
import { BatiCardView, exportCard } from './BatiCard';
import { SmallEgg, eggGrowth } from './SmallEgg';
import { BatiMemories } from './BatiMemories';

/**
 * Bluena's first shelf (M-R217 / M-R218): the cards of the member's {bati}, with the small egg beside them (bigger and
 * brighter as the days pass, no number). A tap opens the card (and its 〔画像にする〕). PROVISIONAL look (P-BATI-CARD).
 */
export function BatiShelf() {
  const { me, setMe } = useAuth();
  const [open, setOpen] = useState<BatiCard | null>(null);
  const cards = (me?.batis ?? []).map((b) => b.card).filter(Boolean);
  if (!cards.length && me?.bati?.card) cards.push(me.bati.card);
  if (!cards.length) return null;
  return (
    <div className="mb-3 flex items-end gap-2 overflow-x-auto rounded-2xl bg-white/[0.04] p-2" aria-label="バティのカード">
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 self-center text-sky-200" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="9" cy="10.5" r="0.8" fill="currentColor" />
        <circle cx="15" cy="10.5" r="0.8" fill="currentColor" />
        <path d="M9 14.5q3 2.5 6 0" strokeLinecap="round" />
      </svg>
      {cards.map((c, k) => (
        <button
          key={k}
          onClick={() => setOpen(c)}
          className={`flex w-16 shrink-0 flex-col items-center rounded-xl border p-1 text-[10px] ${c.rare ? 'border-amber-300 shadow-[0_0_10px_rgba(255,205,90,0.6)]' : 'border-white/15'}`}
        >
          {c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt="" className="h-12 w-12 object-contain" />
          ) : (
            <span className="h-12 w-12" />
          )}
          <span className="w-full truncate">{c.name ?? '……'}</span>
        </button>
      ))}
      {me?.batiEgg && <SmallEgg growth={eggGrowth(me.batiEgg.readyAt)} size={18} className="mb-2 shrink-0" />}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70" onClick={() => setOpen(null)}>
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <BatiCardView card={open} onExport={() => void exportCard(open)} />
            {/* the one in the chat: 「覚えてること」 (M-R222) */}
            {me && open.bornAt === me.bati?.card?.bornAt && <BatiMemories me={me} onMe={setMe} />}
          </div>
        </div>
      )}
    </div>
  );
}
