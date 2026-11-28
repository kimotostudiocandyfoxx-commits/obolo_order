'use client';

import type { StampId } from '@/components/onboarding/StoryExtras';

/**
 * The space ticket. Client 2026-11-28: back to the tall ticket of 2026-10-21 (s/d2-ticket.jpg — the blank picture the
 * day-2 Seedance motion ends on, shown the same way, whole picture with a blurred copy behind, so the motion hands
 * straight over to it). The wide eight-slot picture of M-R343 (s/ticket-8stars.jpg) stays in the repo, unused.
 * Its words are set in code in the places the design has them — 「宇宙行きの切符」, the day's destination (no 同行者
 * line: client 2026-10-21); they seep in like the invitation's.
 * Eight stamps (M-R343, eight planets): 土星・木星・水星・火星 are the four star outlines painted along the bottom and fill
 * in gold; 金星・冥王星・海王星・天王星 are drawn in code, two by two, in the stub's empty panel left of the Moon window
 * (as the interim of 2026-11-27 did: the picture has only four).
 *
 * TICKET is the one place that knows the picture: its file, its shape and where each slot is (% of the picture; sizes
 * in % of its width).
 */
export const TICKET: {
  art: string;
  /** width / height of the picture */
  aspect: number;
  /** painted: the outline is in the picture (it fills in gold); otherwise the star is drawn in code */
  slots: { id: StampId; label: string; x: number; y: number; size: number; painted: boolean }[];
  /** the words: centre x and top (%) */
  words: { title: [x: number, top: number]; dest: [x: number, top: number] };
} = {
  art: '/onboarding/s/d2-ticket.jpg',
  aspect: 9 / 16,
  slots: [
    { id: 'saturn', label: '土星', x: 33.6, y: 83.7, size: 6.2, painted: true },
    { id: 'jupiter', label: '木星', x: 44.2, y: 83.7, size: 6.2, painted: true },
    { id: 'mercury', label: '水星', x: 55, y: 83.7, size: 6.2, painted: true },
    { id: 'mars', label: '火星', x: 65.6, y: 83.7, size: 6.2, painted: true },
    // the stub's left panel (x ≈ 26–46 %, y ≈ 68–80 %), two rows of two
    { id: 'venus', label: '金星', x: 31.4, y: 70.2, size: 4.6, painted: false },
    { id: 'pluto', label: '冥王星', x: 41, y: 70.2, size: 4.6, painted: false },
    { id: 'neptune', label: '海王星', x: 31.4, y: 75.6, size: 4.6, painted: false },
    { id: 'uranus', label: '天王星', x: 41, y: 75.6, size: 4.6, painted: false },
  ],
  words: { title: [50, 23.6], dest: [50, 42.6] },
};
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
/** the stamp: a five-pointed star (24 × 24) */
const STAR = 'M12 0.5 14.6 8.4 23 8.4 16.3 13.4 18.9 21.6 12 16.6 5.1 21.6 7.7 13.4 1 8.4 9.4 8.4Z';

export function TicketArt({ dest, stamped, fresh, pressed, leaving }: { dest?: string; stamped: (id: StampId) => boolean; fresh?: StampId; pressed?: boolean; leaving?: boolean }) {
  const ink = (k: number) => (leaving ? { animation: `wordsOff 0.8s ${k * 0.06}s ease-in forwards` } : { animation: `inkBleed 2.2s ${0.4 + k * 0.4}s cubic-bezier(.3,.1,.2,1) both`, WebkitMaskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' });
  const at = ([x, top]: [number, number], down = 0) => ({ top: `${top + down}%`, left: `${x}%`, transform: 'translateX(-50%)' });
  return (
    <div className={`absolute inset-0 overflow-hidden bg-black transition-opacity duration-500 ${leaving ? 'opacity-0 delay-700' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TICKET.art} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" data-testid="ticket-art" style={{ aspectRatio: String(TICKET.aspect), width: `min(100%, calc(100dvh * ${TICKET.aspect}))`, fontFamily: SERIF, containerType: 'inline-size' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TICKET.art} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <p className="absolute whitespace-nowrap text-[2.2cqw] tracking-[0.45em] text-[#7a5c2c]" style={{ ...at(TICKET.words.title), ...ink(0) }}>
            SPACE TICKET
          </p>
          <p className="absolute whitespace-nowrap text-[5.2cqw] font-semibold tracking-[0.14em] text-[#3a2914]" style={{ ...at(TICKET.words.title, 3.8), ...ink(1) }}>
            宇宙行きの切符
          </p>
          {dest && (
            <>
              <p className="absolute whitespace-nowrap text-[2.9cqw] tracking-[0.3em] text-[#7a5c2c]" style={{ ...at(TICKET.words.dest), ...ink(2) }}>
                本日の目的地
              </p>
              <p className="absolute whitespace-nowrap text-[6.4cqw] font-semibold tracking-[0.12em] text-[#3a2914]" style={{ ...at(TICKET.words.dest, 3.8), ...ink(3) }}>
                {dest}
              </p>
            </>
          )}
          {/* the eight stamps: the painted four fill in gold, the drawn four in the stub's panel are outlined until stamped */}
          {TICKET.slots.map((s) => {
            const on = stamped(s.id);
            const press = s.id === fresh && pressed ? 'animate-[stampIn_0.6s_cubic-bezier(.2,1.6,.4,1)_both]' : '';
            return (
              <span
                key={s.id}
                data-testid={`ticket-slot-${s.id}`}
                data-on={on ? '1' : '0'}
                aria-label={on ? `${s.label}のスタンプ` : undefined}
                className="absolute flex flex-col items-center"
                style={{ top: `${s.y}%`, left: `${s.x}%`, transform: 'translate(-50%, -50%)' }}
              >
                {s.painted ? (
                  <span
                    className={`block transition-all duration-500 [clip-path:polygon(50%_0,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] ${on ? 'scale-110 bg-gradient-to-b from-[#ffe7a3] to-[#c8902e] shadow-[0_0_14px_rgba(255,214,140,0.9)]' : 'bg-transparent'} ${press}`}
                    style={{ width: `${s.size}cqw`, height: `${s.size}cqw` }}
                  />
                ) : (
                  <span className={`relative block ${press}`} style={{ width: `${s.size}cqw`, height: `${s.size}cqw` }}>
                    <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full" aria-hidden style={on ? { filter: 'drop-shadow(0 0 0.8cqw rgba(255,214,140,0.9))' } : undefined}>
                      {on && (
                        <defs>
                          <linearGradient id={`stamp-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#ffe7a3" />
                            <stop offset="1" stopColor="#c8902e" />
                          </linearGradient>
                        </defs>
                      )}
                      {/* the outline in the painted ones' thin brown line, so the four drawn in sit with the four painted */}
                      <path d={STAR} fill={on ? `url(#stamp-${s.id})` : 'none'} stroke="#a8823f" strokeWidth="0.9" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {on && <span className="absolute top-full mt-[0.3cqw] whitespace-nowrap text-[1.7cqw] tracking-[0.06em] text-[#7a5c2c]">{s.label}</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
