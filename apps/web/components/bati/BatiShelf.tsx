'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getApi } from '@/lib/api';
import { JOURNEY_DONE, type BatiCard, type Me } from '@obolo/shared';
import { BatiCardView, exportCard } from './BatiCard';
import { SmallEgg } from './SmallEgg';
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
    <>
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
      {me?.batiEgg && <SmallEgg growth={(me.batiEgg.growth ?? 0)} size={18} className="mb-2 shrink-0" />}
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
    {me && <PastLooks me={me} onMe={setMe} />}
    </>
  );
}

/** M-R223: from day 3 (Bluena received), the first shelf also lists the looks worn before — your own and {bati}'s */
export function showPastLooks(me: Me): boolean {
  return !!me.story?.['d3.f_d04_bluena'] || me.journeyDay >= JOURNEY_DONE;
}

function PastLooks({ me, onMe }: { me: Me; onMe: (me: Me) => void }) {
  const [busy, setBusy] = useState(false);
  if (!showPastLooks(me)) return null;
  const own = me.lookHistory ?? [];
  const bati = me.bati?.looks ?? [];
  if (own.length < 2 && bati.length < 2) return null;
  const wear = async (f: () => Promise<Me>) => {
    if (busy) return;
    setBusy(true);
    try {
      onMe(await f());
    } catch {
      /* stays as it is */
    } finally {
      setBusy(false);
    }
  };
  const row = (urls: string[], now: string | null | undefined, restore: (url: string) => Promise<Me>, round: boolean, label: string) =>
    urls.length > 1 && (
      <div className="flex gap-1.5 overflow-x-auto" aria-label={label}>
        {[...urls].reverse().map((u) => (
          <button
            key={u}
            type="button"
            disabled={busy || u === now}
            onClick={() => void wear(() => restore(u))}
            aria-label={u === now ? 'いまの姿' : 'この姿にもどす'}
            className={`h-11 w-11 shrink-0 overflow-hidden ${round ? 'rounded-full' : 'rounded-xl'} border ${u === now ? 'border-sky-200' : 'border-white/10 opacity-80'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className={`h-full w-full ${round ? 'object-cover' : 'object-contain'}`} />
          </button>
        ))}
      </div>
    );
  return (
    <div className="mb-3 space-y-1.5 rounded-2xl bg-white/[0.04] p-2" aria-label="前の姿">
      {row(own, me.avatarUrl, (u) => getApi().lookRestore(u), true, '自分の前の姿')}
      {row(bati, me.bati?.imageUrl, (u) => getApi().batiLookRestore(u), false, `${me.bati?.name ?? 'バティ'}の前の姿`)}
    </div>
  );
}
