'use client';

import { changeableById, kororinOf, TALK_TONES } from '@obolo/shared';
import { KororinPic } from '@/components/planetHome/KororinFace';
import { RecordTint } from '@/components/planetHome/SaturnBallScene';

/**
 * M-R263: the card {bati} shows after a change — the changed thing, small (Saturn: the record in its new colour, the
 * same mask and screen blend as the planet; M-R275: the kororin, its new picture; iPad feedback: your bubble in
 * its new colour). `big`: the opened card.
 */
export function ChangePreview({ change, big = false }: { change: { id: string; to: string; from: string; undone?: boolean }; big?: boolean }) {
  const item = changeableById(change.id);
  const now = change.undone ? change.from : change.to;
  const name = item?.choices.find((c) => c.id === now)?.name ?? '';
  const label = (
    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-[#2a1630]">{item?.preview === 'saturn-record' ? name : `${item?.label}・${name}`}</span>
  );
  if (item?.preview === 'kororin-pic') {
    const pic = kororinOf({ pic: now })?.pic ?? 1;
    return (
      <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_40%,#5b3f86,#1c1230)] ${big ? 'aspect-square w-[min(80vw,320px)]' : 'aspect-square w-24'}`} data-testid="change-preview" data-pic={pic}>
        <span className={big ? '-mt-6' : '-mt-4'}>
          <KororinPic pic={pic} size={big ? 180 : 56} />
        </span>
        {label}
      </div>
    );
  }
  if (item?.preview === 'talk-bubble') {
    const t = TALK_TONES[now] ?? TALK_TONES.pearl;
    return (
      <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_35%,#2a3470,#0b1027)] ${big ? 'aspect-square w-[min(80vw,320px)]' : 'aspect-square w-24'}`} data-testid="change-preview" data-colour={now}>
        {/* the same bubble as in the talk (TalkScene): the faint gradient, the 1.5 px line, the deepened words */}
        <span
          className={`${big ? '-mt-8 px-5 py-3 text-[18px]' : '-mt-5 px-2.5 py-1.5 text-[11px]'} font-bold`}
          style={{ background: `linear-gradient(170deg,${t.a},${t.b})`, border: `1.5px solid ${t.line}`, color: t.ink, borderRadius: '16px 13px 17px 12px / 13px 16px 12px 15px' }}
        >
          やっほー
        </span>
        {label}
      </div>
    );
  }
  if (item?.preview !== 'saturn-record') return null;
  return (
    <div className={`relative overflow-hidden rounded-xl ${big ? 'aspect-[9/16] w-[min(80vw,320px)]' : 'aspect-square w-24'}`} data-testid="change-preview" data-colour={now}>
      {/* the record's part of the Saturn backdrop (its lower part), tinted as on the planet */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: big ? '100%' : '178%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/planet-home/bg-saturn.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        <RecordTint colour={now} />
      </div>
      {label}
    </div>
  );
}
