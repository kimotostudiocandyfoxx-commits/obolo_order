'use client';

import type { StampId } from '@/components/onboarding/StoryExtras';

/**
 * The space ticket. M-R343 (D02-S001): the eight-slot ticket painted by the story session
 * (design/mv-art/out/props/ticket-8stars.jpg on their branch, cut to the ticket with a little of its sky →
 * public/onboarding/s/ticket-8stars.jpg): a wide gold-edged ticket with the rocket in the middle and, along the bottom,
 * eight star-shaped slots with their planets painted in — 土星・木星・水星・火星・金星・冥王星・海王星・天王星, in the order
 * they are visited. A stamp is pressed ON its slot: a gold star over the planet, which still shows through.
 * Its words are set in code in the free paper left and right of the rocket — 「宇宙行きの切符」, the day's destination
 * (no 同行者 line: client 2026-10-21). Words seep in like the invitation's.
 *
 * (Before: the tall four-slot ticket of 2026-10-21, s/d2-ticket.jpg — the picture the day-2 motion still ends on, so
 * that motion no longer hands over to the very same picture.)
 *
 * TICKET is the one place that knows the picture: its file, its shape, where the slots and the words are (% of the
 * picture; sizes in % of its width).
 */
export const TICKET: {
  art: string;
  /** width / height of the picture */
  aspect: number;
  slots: { id: StampId; label: string; x: number }[];
  /** the slots' row: its centre (% of the height) and a slot's width (% of the picture's width) */
  row: { y: number; size: number };
  /** the words: centre x and top (%) */
  words: { title: [x: number, top: number]; dest: [x: number, top: number] };
} = {
  art: '/onboarding/s/ticket-8stars.jpg',
  aspect: 960 / 510,
  slots: [
    { id: 'saturn', label: '土星', x: 13.4 },
    { id: 'jupiter', label: '木星', x: 24.2 },
    { id: 'mercury', label: '水星', x: 34.8 },
    { id: 'mars', label: '火星', x: 45.2 },
    { id: 'venus', label: '金星', x: 55.6 },
    { id: 'pluto', label: '冥王星', x: 66.3 },
    { id: 'neptune', label: '海王星', x: 76.7 },
    { id: 'uranus', label: '天王星', x: 87.3 },
  ],
  row: { y: 81, size: 8.3 },
  words: { title: [24.5, 21], dest: [76, 21] },
};
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
/** the stamp: a five-pointed star (24 × 24) */
const STAR = 'M12 0.5 14.6 8.4 23 8.4 16.3 13.4 18.9 21.6 12 16.6 5.1 21.6 7.7 13.4 1 8.4 9.4 8.4Z';

export function TicketArt({ dest, stamped, fresh, pressed, leaving }: { dest?: string; stamped: (id: StampId) => boolean; fresh?: StampId; pressed?: boolean; leaving?: boolean }) {
  const ink = (k: number) => (leaving ? { animation: `wordsOff 0.8s ${k * 0.06}s ease-in forwards` } : { animation: `inkBleed 2.2s ${0.4 + k * 0.4}s cubic-bezier(.3,.1,.2,1) both`, WebkitMaskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)', WebkitMaskSize: '260% 260%', maskSize: '260% 260%', WebkitMaskPosition: 'center', maskPosition: 'center' });
  const at = ([x, top]: [number, number], down = 0) => ({ top: `${top + down}%`, left: `${x}%`, transform: 'translateX(-50%)' });
  const { row } = TICKET;
  return (
    <div className={`absolute inset-0 overflow-hidden bg-black transition-opacity duration-500 ${leaving ? 'opacity-0 delay-700' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TICKET.art} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" data-testid="ticket-art" style={{ aspectRatio: String(TICKET.aspect), width: `min(100%, calc(100dvh * ${TICKET.aspect}))`, fontFamily: SERIF, containerType: 'inline-size' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TICKET.art} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <p className="absolute whitespace-nowrap text-[2cqw] tracking-[0.4em] text-[#7a5c2c]" style={{ ...at(TICKET.words.title), ...ink(0) }}>
            SPACE TICKET
          </p>
          <p className="absolute whitespace-nowrap text-[3.7cqw] font-semibold tracking-[0.1em] text-[#3a2914]" style={{ ...at(TICKET.words.title, 7.5), ...ink(1) }}>
            宇宙行きの切符
          </p>
          {dest && (
            <>
              <p className="absolute whitespace-nowrap text-[2.2cqw] tracking-[0.3em] text-[#7a5c2c]" style={{ ...at(TICKET.words.dest), ...ink(2) }}>
                本日の目的地
              </p>
              <p className="absolute whitespace-nowrap text-[5cqw] font-semibold tracking-[0.12em] text-[#3a2914]" style={{ ...at(TICKET.words.dest, 7.5), ...ink(3) }}>
                {dest}
              </p>
            </>
          )}
          {/* the eight slots (the planets are in the picture): a gold star stamp over the ones visited */}
          {TICKET.slots.map((s) => {
            const on = stamped(s.id);
            return (
              <span
                key={s.id}
                data-testid={`ticket-slot-${s.id}`}
                data-on={on ? '1' : '0'}
                aria-label={on ? `${s.label}のスタンプ` : undefined}
                className="absolute"
                style={{ top: `${row.y}%`, left: `${s.x}%`, width: `${row.size}cqw`, height: `${row.size}cqw`, transform: 'translate(-50%, -50%)' }}
              >
                {on && (
                  <span className={`absolute inset-0 ${s.id === fresh && pressed ? 'animate-[stampIn_0.6s_cubic-bezier(.2,1.6,.4,1)_both]' : ''}`} style={{ filter: 'drop-shadow(0 0 1.2cqw rgba(255,214,140,0.95))' }}>
                    {/* the stamp's gold edge, and its gold wash over the planet (the planet shows through) */}
                    <svg viewBox="-2 -2 28 28" className="absolute inset-[-14%] h-[128%] w-[128%]" aria-hidden>
                      <path d={STAR} fill="rgba(255,214,120,0.22)" stroke="#f3c75a" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d={STAR} fill="none" stroke="#fff3c9" strokeWidth="0.5" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
