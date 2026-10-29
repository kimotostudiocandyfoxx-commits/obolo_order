'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PuniAvatar } from '@/components/puni/PuniAvatar';
import { KororinParty, KororinPartySky, type KororinPartyHandle } from './KororinParty';

/**
 * Saturn's kororins as the story has them since M-R176 (client 2026-10-29):
 *  - the hall: the temple's great hall drawn the kororin way; during the practice one big vessel holds everyone's
 *    kororins (KIMORIN⭐︎'s too); at its end the sister gives {neo} their own, which holds only theirs (client
 *    2026-10-29, also from lap 2 on). A new kororin rolls in from the heap of stones into its vessel; each keeps its date and time. A tap
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
  own = false,
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
  /** {neo}'s own vessel (theirs only), from the end of the practice on; before it, one big shared one (client 2026-10-29) */
  own?: boolean;
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
  const [size, setSize] = useState({ w: 390, h: 844 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
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
  const ball = (k: Kororin, size: number, i: number, where: 'vessel' | 'plaza', at?: { left: number; top: number }) => {
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
          // the release comes back here even far above the ball (a flick ends off it)
          e.currentTarget.setPointerCapture?.(e.pointerId);
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
        className={`${at ? 'absolute' : 'relative'} flex flex-col items-center touch-none select-none`}
        style={{
          // the pile settles smoothly when a bowl changes (the gift of {neo}'s own vessel)
          ...(at ? { left: at.left, top: at.top, zIndex: 5 + Math.round(at.top), transition: 'left 0.9s cubic-bezier(.3,1.3,.5,1), top 0.9s cubic-bezier(.3,1.3,.5,1)' } : {}),
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

  /**
   * A big round bowl like a pile of tsum-tsum (client 2026-10-29): its glossy rim curves down across the screen and the
   * kororins pile up on it, the first ones in the middle at the bottom, each row a little wider.
   */
  const bowl = (list: Kororin[], box2: { x: number; y: number; w: number; h: number }, label: string | null, key: string) => {
    const s0 = Math.min(64, box2.w / 6.2);
    const curve = (xn: number) => box2.y + box2.h * ((10 + 100 * xn * (1 - xn)) / 60);
    const placed: { k: Kororin; left: number; top: number }[] = [];
    let row = 0;
    let slot = 0;
    for (const k of list) {
      const cap = 3 + row;
      const xc = box2.x + box2.w / 2 + (slot - (cap - 1) / 2) * s0 * 0.98;
      const bottom = curve(Math.min(0.97, Math.max(0.03, (xc - box2.x) / box2.w))) - row * s0 * 0.8 - 4;
      placed.push({ k, left: xc - s0 / 2, top: bottom - s0 });
      slot++;
      if (slot >= cap) {
        row++;
        slot = 0;
      }
    }
    const gid = `bowl-${key}`;
    return (
      <>
        <svg className="pointer-events-none absolute" style={{ left: box2.x, top: box2.y, width: box2.w, height: box2.h }} viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6d9ff" />
              <stop offset="0.45" stopColor="#c99af0" />
              <stop offset="1" stopColor="#7e4fc0" />
            </linearGradient>
            <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#ffb3dc" />
            </linearGradient>
          </defs>
          {/* the inside curve on top, a round underside below (a real bowl, also when small) */}
          <path d="M0,10 Q50,60 100,10 C100,44 82,60 50,60 C18,60 0,44 0,10 Z" fill={`url(#${gid}-body)`} />
          {/* a soft shine inside the curve, and the glossy rim along it */}
          <path d="M6,16 Q50,54 94,16" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M0,10 Q50,60 100,10" fill="none" stroke={`url(#${gid}-rim)`} strokeWidth="3.4" strokeLinecap="round" />
        </svg>
        {placed.map((p, n) => ball(p.k, s0, n, 'vessel', { left: p.left, top: p.top }))}
        {label && (
          <p className="pointer-events-none absolute z-[60] text-center" style={{ left: box2.x, width: box2.w, top: box2.y + box2.h * 0.66 }}>
            <span className="rounded-full border border-white/70 bg-[rgba(90,40,140,0.7)] px-3 py-0.5 text-[12px] font-bold tracking-wider text-white shadow">{label}</span>
          </p>
        )}
      </>
    );
  };
  const W = size.w;
  const H = size.h;

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#b9a4e8] via-[#f2b9d6] to-[#ffd9b8]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={scene} src={scene === 'hall' ? HALL : PLAZA} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full animate-[fadeUp_0.8s_ease-out] object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
      <KororinPartySky on={partyOn} />
      {scene === 'hall' ? (
        own ? (
          // {neo}'s own vessel, the sister's present: only their kororins
          bowl(mine, { x: -W * 0.08, y: H * 0.6, w: W * 1.16, h: H * 0.42 }, `${neo}の器`, 'mine')
        ) : (
          // one big bowl everyone shares during the practice
          bowl([...kimorin, ...mine].sort((a, b) => a.at - b.at), { x: -W * 0.08, y: H * 0.6, w: W * 1.16, h: H * 0.42 }, null, 'shared')
        )
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
