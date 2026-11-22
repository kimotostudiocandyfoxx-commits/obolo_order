'use client';

import { TALK_FIXED_FACE_KEY } from '@obolo/shared';
import { useMemo, useState } from 'react';
import { useMarkRing } from '@/components/finds/MarkRing';
import { TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { useAuth } from '@/lib/auth';
import { batiDayMsgs } from '@/lib/finds/talks';
import { usePartner } from '@/lib/partner';
import { BATI_COLOR, batiLook, characterLook, PLACE_BG, SELF_COLOR, selfLook, selfTone } from '@/lib/talk/looks';
import { talks } from './shelf';
import { KindMark } from './WorkCard';
import type { Work } from './work';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * M-R237 §3: one day of your talk with {bati}, opened from the past talks' list — the same side-by-side talk, read only
 * (no message bar). ★ and marks can still be put on its lines.
 */
export function BatiDay({ day, at, onBack }: { day: string; /** M-R253 §5: opened at this message (a work from Bluena): the talk up to it, then 〔つづき〕 */ at?: string; onBack: () => void }) {
  const { me } = useAuth();
  const partner = usePartner();
  const ring = useMarkRing();
  const all = useMemo(() => batiDayMsgs(talks(), day), [day]);
  const [whole, setWhole] = useState(!at);
  const cut = at ? all.findIndex((m) => m.id === at || (m.who === 'work' && `m-${m.work.id}` === at)) : -1;
  const msgs = whole || cut < 0 ? all : all.slice(0, cut + 1);
  const people: TalkPerson[] = [
    { id: 'bati', name: partner.name, look: partner.isBati ? batiLook(me?.bati, partner.face) : characterLook('kimorin'), color: BATI_COLOR },
    { id: 'me', name: me?.displayName ?? '', look: selfLook(me), color: SELF_COLOR, tone: selfTone(me), self: true, avatar: me?.lookIcon },
  ];
  const items: TalkItem[] = msgs.map((m) =>
    m.who === 'work'
      ? { id: m.id, who: 'bati', text: m.work.title ?? '', mark: { kind: 'local', id: m.id }, card: { label: m.work.title ?? m.work.prompt, thumb: <Thumb w={m.work} /> } }
      : { id: m.id, who: m.who === 'me' ? 'me' : 'bati', text: m.text, mark: { kind: 'local', id: m.id } },
  );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ fontFamily: SERIF }}>
      <div className="flex items-center gap-2 px-3.5 pb-1.5">
        <button onClick={onBack} aria-label="会話の一覧" className="text-lg text-amber-100/70">
          ‹
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] tracking-[0.18em] text-amber-100/90">{partner.name}</p>
        <span className="text-[11px] tracking-[0.12em] text-amber-100/60">{day.slice(5).replace('-', '/')}</span>
      </div>
      <TalkScene
        people={people}
        items={items}
        place={PLACE_BG.moon}
        top={4}
        fixedSelfFace={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
        onRing={(it, at) => it.mark && ring.open(it.mark.kind, it.mark.id, at)}
      />
      {!whole && cut >= 0 && cut < all.length - 1 && (
        <button onClick={() => setWhole(true)} className="absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-full border border-amber-200/40 bg-black/55 px-4 py-1.5 text-xs tracking-[0.2em] text-amber-100 backdrop-blur">
          つづき
        </button>
      )}
      {ring.node}
    </div>
  );
}

function Thumb({ w }: { w: Work }) {
  const pic = w.image ?? w.poster ?? undefined;
  return (
    <span className="flex items-center gap-2 bg-[rgba(16,11,26,0.7)] p-1.5">
      {pic && !pic.startsWith('idb:') ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pic} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-amber-100/80">
          <KindMark kind={w.kind} className="h-6 w-6" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] text-amber-50">{w.title || w.text || w.prompt}</span>
    </span>
  );
}
