'use client';

import { changeableById } from '@obolo/shared';
import { RecordTint } from '@/components/planetHome/SaturnBallScene';

/**
 * M-R263: the card {bati} shows after a change — the changed thing, small (Saturn: the record in its new colour, the
 * same mask and screen blend as the planet). `big`: the opened card.
 */
export function ChangePreview({ change, big = false }: { change: { id: string; to: string; from: string; undone?: boolean }; big?: boolean }) {
  const item = changeableById(change.id);
  const now = change.undone ? change.from : change.to;
  const name = item?.choices.find((c) => c.id === now)?.name ?? '';
  if (item?.preview !== 'saturn-record') return null;
  return (
    <div className={`relative overflow-hidden rounded-xl ${big ? 'aspect-[9/16] w-[min(80vw,320px)]' : 'aspect-square w-24'}`} data-testid="change-preview" data-colour={now}>
      {/* the record's part of the Saturn backdrop (its lower part), tinted as on the planet */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: big ? '100%' : '178%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/planet-home/bg-saturn.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        <RecordTint colour={now} />
      </div>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-[#2a1630]">
        {item.label}・{name}
      </span>
    </div>
  );
}
