'use client';

import type { SaturnPostView } from '@obolo/shared';
import { hoursLeft } from '@obolo/shared';
import { KORORIN_BASE } from './KororinVessels';

/**
 * M-R208 (Saturn): a flown kororin spins on the giant DJ record — everyone's, for 88 hours — and the cipher passes
 * the mic from one to the next. After 88 hours it goes back to its maker's own record. The record is drawn with
 * shapes; the kororins are the existing base art (yours with the orange band, everyone else's sky blue), and yours
 * on everyone's record wear a soft glow.
 */
export function KororinRecord({
  posts,
  myId,
  singingId,
  own = false,
  onTap,
}: {
  posts: SaturnPostView[];
  myId?: string;
  singingId: string | null;
  /** your own record: smaller label, no time left (they are home) */
  own?: boolean;
  onTap: (p: SaturnPostView) => void;
}) {
  const list = posts.slice(0, RINGS.reduce((n, r) => n + r.n, 0));
  // fill the outer ring first, then the inner ones
  const placed: { p: SaturnPostView; r: number; a: number }[] = [];
  let k = 0;
  for (const ring of RINGS) {
    const here = list.slice(k, k + ring.n);
    here.forEach((p, i) => placed.push({ p, r: ring.r, a: (i / here.length) * 360 + ring.off }));
    k += ring.n;
  }
  return (
    <div className="relative mx-auto aspect-square w-[min(92vw,420px)]">
      {/* the platter's shadow and rim */}
      <div className="absolute inset-0 rounded-full bg-black/40 blur-md" aria-hidden />
      <div className="record-spin absolute inset-[2%] rounded-full">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <radialGradient id="vinyl" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2b2238" />
              <stop offset="100%" stopColor="#120c1c" />
            </radialGradient>
            <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0.14" />
              <stop offset="55%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="99" fill="url(#vinyl)" />
          {GROOVES.map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#ffffff" strokeOpacity={0.06} strokeWidth={0.6} />
          ))}
          <circle cx="100" cy="100" r="99" fill="url(#shine)" />
          {/* the label in Saturn's colours */}
          <circle cx="100" cy="100" r={own ? 20 : 24} fill="#f6e3b4" />
          <circle cx="100" cy="100" r={own ? 20 : 24} fill="none" stroke="#b88a4a" strokeWidth={2} />
          <text x="100" y={own ? 98 : 97} textAnchor="middle" fontSize={own ? 6 : 7} fontWeight={900} fill="#7a5520">
            {own ? 'MY RECORD' : 'SATURN'}
          </text>
          <text x="100" y={own ? 106 : 107} textAnchor="middle" fontSize={5} fill="#7a5520">
            {own ? 'おかえり' : 'みんなのレコード'}
          </text>
          <circle cx="100" cy="100" r="2.4" fill="#120c1c" />
        </svg>

        {placed.map(({ p, r, a }) => {
          const mine = !!myId && p.author.id === myId;
          const sing = singingId === p.id;
          const rad = (a * Math.PI) / 180;
          return (
            <div key={p.id} className="absolute" style={{ left: `${50 + r * Math.cos(rad) * 50}%`, top: `${50 + r * Math.sin(rad) * 50}%` }}>
              {/* stays upright while the record turns */}
              <button onClick={() => onTap(p)} className="record-counter absolute left-0 top-0 flex flex-col items-center" aria-label={`${p.author.displayName || p.author.handle}のコロリン`}>
                <span className={`relative block h-12 w-12 rounded-full ${mine && !own ? 'mine-glow' : ''} ${sing ? 'scale-125' : ''} transition-transform`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mine ? (sing ? KORORIN_BASE.mineSing : KORORIN_BASE.mine) : sing ? KORORIN_BASE.dachiSing : KORORIN_BASE.dachi}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,.45)]"
                  />
                </span>
                <span className={`mt-0.5 max-w-[76px] truncate rounded-full px-1.5 text-[10px] font-bold leading-[16px] ${mine ? 'bg-amber-200 text-amber-950' : 'bg-white/85 text-[#4a3a6a]'}`}>
                  {mine ? 'あなた' : p.author.displayName || p.author.handle}
                  {!own && <span className="ml-1 font-normal opacity-70">{hoursLeft(p.createdAt)}h</span>}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {/* the tonearm (does not turn) */}
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute -right-[4%] -top-[4%] h-[42%] w-[42%]" aria-hidden>
        <circle cx="78" cy="18" r="9" fill="#d9c7a3" stroke="#8a6a3a" strokeWidth="2" />
        <path d="M78 18 L46 70 L40 80" fill="none" stroke="#e8dcc4" strokeWidth="4" strokeLinecap="round" />
        <rect x="32" y="76" width="14" height="9" rx="2" transform="rotate(-30 39 80)" fill="#b88a4a" />
      </svg>
    </div>
  );
}

/** rings of kororins: radius (fraction of the record's radius), how many, start angle */
const RINGS = [
  { r: 0.8, n: 12, off: -90 },
  { r: 0.55, n: 8, off: -70 },
  { r: 0.36, n: 4, off: -45 },
];
const GROOVES = [30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 95];
