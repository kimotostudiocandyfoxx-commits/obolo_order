import { useId } from 'react';
import type { BagBar, BagIcon } from '@obolo/shared';

/** the sack's outline (viewBox 0 0 16 18): a tied neck, a round body */
const BODY = 'M6 5C3.4 7.2 2.2 10.2 2.6 13.4 2.9 16 4.9 16.9 8 16.9s5.1-.9 5.4-3.5C13.8 10.2 12.6 7.2 10 5Z';
const NECK = 'M6 5h4M6.4 5 5 2.6M9.6 5 11 2.6';
/** the inside of the body (where the fill rises from the bottom) */
const TOP = 5;
const BOTTOM = 16.9;

/** one bag: thin lines of one weight (as Bluena's marks, glyphs.tsx), filled from the bottom as it is used */
function Bag({ icon, id }: { icon: BagIcon; id: string }) {
  const h = (BOTTOM - TOP) * icon.fill;
  const w = icon.big ? 15 : 11;
  return (
    <svg viewBox="0 0 16 18" width={w} height={(w * 18) / 16} aria-hidden data-bag={icon.big ? 'big' : 'one'} data-fill={Math.round(icon.fill * 100)} className="shrink-0 text-sky-100/70">
      <defs>
        <clipPath id={id}>
          <rect x="0" y={BOTTOM - h} width="16" height={h} />
        </clipPath>
      </defs>
      {icon.fill > 0 && <path d={BODY} clipPath={`url(#${id})`} className="fill-sky-200/60" />}
      <path d={BODY} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
      <path d={NECK} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
      {/* a big bag (10袋) wears a small band, so it reads as more than one without a number */}
      {icon.big && <path d="M4.2 9.6h7.6" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" opacity={0.7} />}
    </svg>
  );
}

/**
 * R18 (client 2026-11-25): Bluena's room as a row of small bags (1袋 = 1GB; bagBar in @obolo/shared) — no numbers.
 * A big room is grouped (big bags of 10, then the rest one by one) so the row never overflows a phone.
 */
export function BagRow({ bar, bright = false }: { bar: BagBar; bright?: boolean }) {
  const base = useId().replace(/:/g, '');
  return (
    <div role="img" aria-label={bar.label} data-bags={bar.bags} className="flex items-end justify-center gap-[3px] [filter:drop-shadow(0_1px_3px_#000)]" style={{ opacity: bright ? 1 : 0.85 }}>
      {bar.icons.map((icon, i) => (
        <Bag key={i} icon={icon} id={`${base}-bag-${i}`} />
      ))}
    </div>
  );
}
