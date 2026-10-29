'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PuniAvatar } from '@/components/puni/PuniAvatar';
import { KororinParty, KororinPartySky, type KororinPartyHandle } from './KororinParty';

/**
 * Saturn's kororins as the story has them since M-R176 (client 2026-10-29):
 *  - the hall: the temple's great hall drawn the kororin way; two big vessels, KIMORIN⭐︎'s and {neo}'s, with name
 *    plates. A new kororin rolls in from the heap of stones into its vessel; each keeps its date and time. A tap
 *    sings it (the party: sky dims, the glasses drop); a kororin in your own vessel flicked up and out of the top of
 *    the screen flies to the plaza (your dachi's plaza too).
 *  - the plaza: outside, the temple made round at the back, a round cobbled plaza with the kororins that flew there.
 *    〔🎤 サイファー〕 is the mic relay (one after another, the mic passing on, the last 「♪オー！」 all together).
 * Nothing of strangers: the hall starts with the two empty vessels.
 */
export interface Kororin {
  id: string;
  owner: 'kimorin' | 'mine' | 'sister' | 'brother' | 'inviter';
  name: string;
  pic?: string | null;
  seed: string;
  text: string;
  url: string | null;
  at: number;
}

const HALL = '/onboarding/s/saturn-hall-kororin.jpg';
const PLAZA = '/onboarding/s/saturn-plaza-kororin.jpg';
const VESSEL = '/onboarding/kororin-vessel.webp';
const stamp = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function KororinVessels({
  scene,
  kimorin,
  mine,
  neo,
  plaza,
  singingId,
  highlightId,
  partyOn,
  flickable,
  flyingIds = [],
  oh,
  onTap,
  onFlick,
  overlay,
}: {
  scene: 'hall' | 'plaza';
  kimorin: Kororin[];
  mine: Kororin[];
  neo: string;
  plaza: Kororin[];
  singingId: string | null;
  highlightId: string | null;
  partyOn: boolean;
  /** your own kororins can be flicked up to the plaza */
  flickable: boolean;
  /** kororins flying up and away by themselves (KIMORIN⭐︎ flicks his three) */
  flyingIds?: string[];
  /** the relay's last 「♪オー！」: every kororin on the plaza at once */
  oh: boolean;
  onTap: (k: Kororin) => void;
  onFlick: (k: Kororin) => void;
  overlay?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const party = useRef<KororinPartyHandle>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const [gone, setGone] = useState<Set<string>>(new Set());
  // the party kit follows the one singing
  useEffect(() => {
    if (!singingId) return party.current?.place(undefined);
    let raf = 0;
    const tick = () => {
      const el = els.current.get(singingId);
      const b = box.current?.getBoundingClientRect();
      if (el && b) {
        const r = el.getBoundingClientRect();
        party.current?.place({ x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, R: r.width / 2 });
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [singingId]);

  // a flick up out of the top: the kororin spins away to the plaza
  const drag = useRef<{ id: string; y: number; t: number } | null>(null);
  const ball = (k: Kororin, size: number, i: number, where: 'vessel' | 'plaza') => {
    const sing = singingId === k.id || (oh && where === 'plaza');
    const lit = highlightId === k.id;
    const flying = gone.has(k.id) || flyingIds.includes(k.id);
    return (
      <button
        key={k.id}
        ref={(el) => {
          if (el) els.current.set(k.id, el);
          else els.current.delete(k.id);
        }}
        onPointerDown={(e) => {
          drag.current = { id: k.id, y: e.clientY, t: Date.now() };
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.id !== k.id) return;
          const up = d.y - e.clientY;
          if (where === 'vessel' && flickable && k.owner === 'mine' && up > 40 && Date.now() - d.t < 700) {
            setGone((s) => new Set(s).add(k.id));
            setTimeout(() => onFlick(k), 900);
            return;
          }
          if (Math.abs(up) < 12) onTap(k);
        }}
        className="relative flex flex-col items-center touch-none select-none"
        style={{
          animation: flying ? `kvFly 0.9s cubic-bezier(.3,.1,.7,1) ${flyingIds.includes(k.id) ? flyingIds.indexOf(k.id) * 0.35 : 0}s forwards` : where === 'plaza' ? `kvLand 0.7s cubic-bezier(.2,1.4,.4,1) ${i * 0.05}s both` : 'kvRoll 0.8s cubic-bezier(.2,1.2,.4,1) both',
        }}
        aria-label={`${k.name}のコロリン`}
      >
        <span className={`relative rounded-full ${lit ? 'animate-[hintGlow_1.6s_ease-in-out_infinite] ring-4 ring-amber-200' : ''}`} style={{ width: size, height: size }}>
          <PuniAvatar seed={k.seed} pic={k.pic} size={size} speaking={sing} bounce={sing ? 'sing' : undefined} />
          {sing && <span className="pointer-events-none absolute -right-2 -top-3 animate-bounce text-[18px] text-amber-200 drop-shadow">♪</span>}
        </span>
        {where === 'vessel' && <span className="pointer-events-none absolute -top-3 left-1/2 z-[4] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-1.5 text-[8px] font-bold leading-[13px] text-[#6a4a8a] shadow-sm">{stamp(k.at)}</span>}
      </button>
    );
  };

  const vessel = (name: string, list: Kororin[], side: 'left' | 'right') => (
    <div className={`absolute bottom-[calc(10%+env(safe-area-inset-bottom))] w-[47%] ${side === 'left' ? 'left-[1.5%]' : 'right-[1.5%]'}`}>
      <div className="relative w-full" style={{ aspectRatio: '620 / 424' }}>
        {/* the bowl behind, the kororins in it (three to a row, newest on top), the bowl's front wall over their lower half */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={VESSEL} alt="" draggable={false} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
        <div className="absolute inset-x-[10%] bottom-[50%] z-[2] flex flex-wrap-reverse items-end justify-center gap-x-0.5">
          {list.map((k, i) => ball(k, list.length > 6 ? 38 : 50, i, 'vessel'))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={VESSEL} alt="" draggable={false} className="pointer-events-none absolute inset-0 z-[3] h-full w-full [clip-path:inset(40%_0_0_0)]" />
      </div>
      <p className="mt-1 text-center">
        <span className="rounded-full border border-amber-200/70 bg-[rgba(60,30,80,0.75)] px-3 py-0.5 text-[12px] font-bold tracking-wider text-amber-50 shadow">{name}</span>
      </p>
    </div>
  );

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#b9a4e8] via-[#f2b9d6] to-[#ffd9b8]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={scene} src={scene === 'hall' ? HALL : PLAZA} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full animate-[fadeUp_0.8s_ease-out] object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
      <KororinPartySky on={partyOn} />
      {scene === 'hall' ? (
        <>
          {vessel('KIMORIN⭐︎', kimorin, 'left')}
          {vessel(neo, mine, 'right')}
        </>
      ) : (
        // the plaza: the kororins that flew here, scattered over the round cobbles
        <div className="absolute inset-x-[4%] bottom-[calc(12%+env(safe-area-inset-bottom))] top-[52%] flex flex-wrap content-end items-end justify-center gap-x-2 gap-y-1">
          {plaza.map((k, i) => ball(k, 58, i, 'plaza'))}
        </div>
      )}
      <KororinParty ref={party} on={!!singingId} />
      {oh && <p className="pointer-events-none absolute inset-x-0 top-[40%] z-[70] animate-[fadeUp_0.4s_ease-out] text-center text-5xl font-black text-amber-100 drop-shadow-[0_0_20px_rgba(255,200,120,0.9)]">♪オー！</p>}
      {overlay}
      <style>{`
        @keyframes kvRoll { 0% { transform: translate(var(--kx, 0), -38vh) scale(.5) rotate(-200deg); opacity: 0 } 60% { opacity: 1 } 100% { transform: none; opacity: 1 } }
        @keyframes kvLand { 0% { transform: translateY(-60vh) scale(.7); opacity: 0 } 100% { transform: none; opacity: 1 } }
        @keyframes kvFly { 0% { transform: none } 100% { transform: translateY(-110vh) rotate(720deg) scale(.6); opacity: .6 } }
      `}</style>
    </div>
  );
}
