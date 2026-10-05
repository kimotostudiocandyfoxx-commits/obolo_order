'use client';

import { spriteUrl } from '@/lib/onboarding/media';

/**
 * A butterfly in the sky: the resident's cut-out art (from the client's パタパタ mock) or, for
 * anyone without art (e.g. the visitor's OBOLO NEO), their emblem between two flapping wings.
 */
export function Butterfly({ art, emoji, wing = '#e9b98a', size }: { art?: string; emoji?: string; wing?: string; size: number }) {
  if (art) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={spriteUrl(art)} alt="" draggable={false} style={{ width: size }} className="pointer-events-none select-none drop-shadow-[0_8px_14px_rgba(120,80,40,0.25)]" />;
  }
  return (
    <div className="relative" style={{ width: size, height: size * 0.82 }}>
      {[-1, 1].map((side) => (
        <div
          key={side}
          className="absolute top-0"
          style={{ width: size * 0.56, [side < 0 ? 'left' : 'right']: 0, transform: side < 0 ? 'scaleX(-1)' : undefined }}
        >
          <svg viewBox="0 0 60 70" className="w-full origin-left animate-[flap_1.6s_ease-in-out_infinite]" aria-hidden>
            <path d="M2 34 C 10 4, 52 -6, 56 18 C 60 36, 30 38, 2 36 Z" fill={wing} stroke="#8a6440" strokeWidth="2" opacity="0.95" />
            <path d="M2 38 C 26 40, 50 46, 44 62 C 38 74, 12 64, 2 40 Z" fill={wing} stroke="#8a6440" strokeWidth="2" opacity="0.85" />
            <circle cx="38" cy="20" r="5" fill="#fff" opacity="0.6" />
          </svg>
        </div>
      ))}
      <span className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 drop-shadow" style={{ fontSize: size * 0.4 }}>
        {emoji}
      </span>
    </div>
  );
}
