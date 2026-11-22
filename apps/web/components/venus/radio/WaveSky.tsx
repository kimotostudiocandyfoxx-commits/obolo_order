'use client';

import type { RadioShowView } from '@obolo/shared';
import { hoursLeft } from '@obolo/shared';
import { ShowArt } from './ShowArt';

/**
 * M-R208 (Venus): a published show drifts above the clouds as a little radio for 88 hours. Coming near one (a tap)
 * makes it audible; everyone's shows drift together, your own with a soft glow. After 88 hours it goes back to its
 * owner's booth. Drawn with shapes only (no new pictures).
 */
export function WaveSky({ shows, onOpen }: { shows: RadioShowView[]; onOpen: (s: RadioShowView) => void }) {
  // your own first, so they always get a place in the sky
  const list = [...shows.filter((s) => s.mine), ...shows.filter((s) => !s.mine)].slice(0, SLOTS.length);
  return (
    <div className="relative h-[440px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a0f3a] via-[#3a1f5c] to-[#8a4a7a]">
      {/* stars */}
      {STARS.map(([x, y, s, d], i) => (
        <span key={i} className="absolute rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animation: `twinkle 3s ease-in-out ${d}s infinite` }} />
      ))}
      {/* the clouds of Venus, at the bottom */}
      <div className="cloud-slide pointer-events-none absolute inset-x-[-10%] bottom-[-40px] h-40" aria-hidden>
        {CLOUDS.map(([x, w, h, o], i) => (
          <span key={i} className="absolute bottom-0 rounded-full bg-[#f6d9c8]" style={{ left: `${x}%`, width: `${w}%`, height: h, opacity: o, filter: 'blur(2px)' }} />
        ))}
      </div>

      {list.map((s, i) => {
        const at = SLOTS[i];
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s)}
            className="radio-wave-drift absolute flex w-[92px] flex-col items-center"
            style={{ left: `${at.x}%`, top: `${at.y}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${8 + (i % 3) * 2}s`, zIndex: s.mine ? 5 : 1 }}
            aria-label={`${s.title}を聴く`}
          >
            <span className="relative flex h-16 w-16 items-center justify-center">
              {[0, 1.2, 2.4].map((d) => (
                <span key={d} className={`radio-ripple-ring absolute h-full w-full rounded-full border-2 ${s.mine ? 'border-amber-200/80' : 'border-white/45'}`} style={{ animationDelay: `${d + i * 0.3}s` }} />
              ))}
              {/* the little radio: antenna + body with the show's picture as its speaker */}
              <span className="absolute -top-3 left-1/2 h-4 w-px origin-bottom -translate-x-1/2 rotate-[24deg] bg-white/70" aria-hidden />
              <span className={`relative h-12 w-14 overflow-hidden rounded-xl border-2 ${s.mine ? 'mine-glow border-amber-200' : 'border-white/70'} bg-[#2a1640] p-[3px] shadow-lg`}>
                <ShowArt url={s.thumbUrl} loop={s.loop} playing={false} className="!rounded-lg" />
              </span>
            </span>
            <span className={`mt-1 max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight ${s.mine ? 'bg-amber-200 text-amber-950' : 'bg-black/45 text-white'}`}>
              {s.mine ? 'あなた' : s.host.displayName || s.host.handle}
            </span>
            <span className="mt-0.5 max-w-full truncate text-[10px] text-white/75">
              {s.title}
              {s.publishedAt ? `・あと${hoursLeft(s.publishedAt)}時間` : ''}
            </span>
          </button>
        );
      })}

      {list.length === 0 && (
        <p className="absolute inset-x-6 top-1/3 rounded-2xl bg-black/40 px-4 py-3 text-center text-sm text-white/75 backdrop-blur">いま、雲の上をただよう電波はない。</p>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-[#4a2340]/80">近づくと、聴こえる（88時間、雲の上をただよう）</p>
    </div>
  );
}

/** where the radios drift (centre, in %) */
const SLOTS = [
  { x: 50, y: 30 },
  { x: 22, y: 50 },
  { x: 78, y: 48 },
  { x: 30, y: 16 },
  { x: 72, y: 15 },
  { x: 50, y: 64 },
  { x: 16, y: 76 },
  { x: 84, y: 74 },
];

const STARS: [number, number, number, number][] = [
  [8, 8, 2, 0],
  [20, 30, 2, 0.8],
  [42, 6, 3, 1.4],
  [61, 26, 2, 0.4],
  [88, 10, 2, 2],
  [93, 36, 3, 1.1],
  [6, 44, 2, 1.7],
  [55, 44, 2, 2.4],
];

/** cloud puffs: left %, width %, height px, opacity */
const CLOUDS: [number, number, number, number][] = [
  [-4, 36, 110, 0.85],
  [22, 30, 140, 0.95],
  [44, 34, 120, 0.9],
  [70, 40, 150, 0.85],
  [8, 26, 80, 0.6],
  [58, 28, 90, 0.6],
];
