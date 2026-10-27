'use client';

import type { StampId } from '@/components/onboarding/StoryExtras';

/**
 * The space ticket (client art 2026-10-21): the blank ticket picture the Seedance motion ends on, shown
 * the same way (whole picture, blurred copy behind) so the motion hands straight over to it; its words are
 * set in code in the places the design has them — 「宇宙行きの切符」, the day's destination (no 同行者 line:
 * client 2026-10-21) — and the four star stamp outlines along the bottom fill in gold as the planets are
 * visited. Words seep in like the invitation's.
 */
const ART = '/onboarding/s/d2-ticket.jpg';
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

const STARS: { id: StampId; x: number; label: string }[] = [
  { id: 'saturn', x: 33.6, label: '土星' },
  { id: 'jupiter', x: 44.2, label: '木星' },
  { id: 'mercury', x: 55, label: '水星' },
  { id: 'mars', x: 65.6, label: '火星' },
  // not in the picture: drawn in code, floating up once Mars is stamped (draft 21)
  { id: 'venus', x: 76.2, label: '金星' },
];

export function TicketArt({ dest, stamped, fresh, pressed, leaving }: { dest?: string; stamped: (id: StampId) => boolean; fresh?: StampId; pressed?: boolean; leaving?: boolean }) {
  const ink = (k: number) => (leaving ? { animation: `wordsOff 0.8s ${k * 0.06}s ease-in forwards` } : { animation: `inkBleed 2.2s ${0.4 + k * 0.4}s cubic-bezier(.3,.1,.2,1) both`, WebkitMaskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' });
  const at = (top: number, x = 50) => ({ top: `${top}%`, left: `${x}%`, transform: 'translateX(-50%)' });
  return (
    <div className={`absolute inset-0 overflow-hidden bg-black transition-opacity duration-500 ${leaving ? 'opacity-0 delay-700' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ART} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative aspect-[9/16]" style={{ width: 'min(100%, calc(100dvh * 9 / 16))', fontFamily: SERIF, containerType: 'inline-size' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ART} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <p className="absolute whitespace-nowrap text-[2.2cqw] tracking-[0.45em] text-[#7a5c2c]" style={{ ...at(23.6), ...ink(0) }}>
            SPACE TICKET
          </p>
          <p className="absolute whitespace-nowrap text-[5.2cqw] font-semibold tracking-[0.14em] text-[#3a2914]" style={{ ...at(27.4), ...ink(1) }}>
            宇宙行きの切符
          </p>
          {dest && (
            <>
              <p className="absolute whitespace-nowrap text-[2.9cqw] tracking-[0.3em] text-[#7a5c2c]" style={{ ...at(42.6), ...ink(2) }}>
                本日の目的地
              </p>
              <p className="absolute whitespace-nowrap text-[6.4cqw] font-semibold tracking-[0.12em] text-[#3a2914]" style={{ ...at(46.4), ...ink(3) }}>
                {dest}
              </p>
            </>
          )}
          {/* the star stamps along the bottom */}
          {STARS.map((s) => {
            const on = stamped(s.id);
            if (s.id === 'venus' && !on && !stamped('mars')) return null;
            return (
              <span key={s.id} className="absolute flex flex-col items-center" style={{ top: '82%', left: `${s.x}%`, transform: 'translateX(-50%)' }}>
                <span
                  className={`block h-[6.2cqw] w-[6.2cqw] transition-all duration-500 [clip-path:polygon(50%_0,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] ${on ? 'scale-110 bg-gradient-to-b from-[#ffe7a3] to-[#c8902e] shadow-[0_0_14px_rgba(255,214,140,0.9)]' : 'bg-transparent'} ${s.id === fresh && pressed ? 'animate-[stampIn_0.6s_cubic-bezier(.2,1.6,.4,1)_both]' : ''}`}
                />
                {s.id === 'venus' && !on && (
                  <svg viewBox="0 0 24 24" className="absolute top-0 h-[6.2cqw] w-[6.2cqw] animate-[fadeUp_1.2s_ease-out]" aria-hidden>
                    <path d="M12 0.5 14.6 8.4 23 8.4 16.3 13.4 18.9 21.6 12 16.6 5.1 21.6 7.7 13.4 1 8.4 9.4 8.4Z" fill="none" stroke="#a8823f" strokeWidth="0.9" />
                  </svg>
                )}
                {(on || s.id === 'venus') && <span className="mt-[0.6cqw] text-[1.9cqw] tracking-[0.1em] text-[#7a5c2c]">{s.label}</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
