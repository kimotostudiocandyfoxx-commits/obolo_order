'use client';

import type { StickerMade } from '@/lib/onboarding/made';
import { Sticker } from './JupiterLesson';

/**
 * 🌳 myツリー (story D05-S008b, draft 21): your own tree on the hill at the forest's edge — one shape, one
 * colour and one ornament (none picked = the first of each), a tag of up to 8 letters on a branch, and
 * your jackets resting on the branches. Drawn in code, so it grows on the spot.
 */
export type TreeLook = { shape: 'round' | 'tall' | 'willow'; color: 'green' | 'pink' | 'gold' | 'blue'; deco: 'lights' | 'fruit' | 'ribbon'; tag: string };
export const TREE_DEFAULT: TreeLook = { shape: 'round', color: 'green', deco: 'lights', tag: '' };
export const TREE_SHAPES: { v: TreeLook['shape']; label: string }[] = [
  { v: 'round', label: 'まんまる' },
  { v: 'tall', label: 'のっぽ' },
  { v: 'willow', label: 'しだれ' },
];
export const TREE_COLORS: { v: TreeLook['color']; label: string; c: [string, string] }[] = [
  { v: 'green', label: 'みどり', c: ['#7bc96f', '#3f8f4a'] },
  { v: 'pink', label: 'さくら', c: ['#ffc1d9', '#e77fa8'] },
  { v: 'gold', label: 'こがね', c: ['#ffe08a', '#d9a227'] },
  { v: 'blue', label: 'ほしぞら', c: ['#9fd3ff', '#4a6fd6'] },
];
export const TREE_DECOS: { v: TreeLook['deco']; label: string; icon: string }[] = [
  { v: 'lights', label: 'あかり', icon: '✨' },
  { v: 'fruit', label: '木の実', icon: '🍎' },
  { v: 'ribbon', label: 'リボン', icon: '🎀' },
];

const SPOTS = [
  [38, 30],
  [62, 28],
  [28, 48],
  [72, 46],
  [50, 18],
  [46, 44],
];

/** grow: 0 seed → 1 sprout → 2 grown (with the ornaments lit) */
export function MyTree({ look, grow = 2, jackets = [], width = 260, onJacket }: { look: TreeLook; grow?: 0 | 1 | 2; jackets?: StickerMade[]; width?: number; onJacket?: () => void }) {
  const [light, dark] = TREE_COLORS.find((c) => c.v === look.color)!.c;
  const deco = TREE_DECOS.find((d) => d.v === look.deco)!.icon;
  const h = width * 1.15;
  return (
    <div className="relative" style={{ width, height: h }}>
      <svg viewBox="0 0 100 115" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <ellipse cx="50" cy="108" rx="34" ry="6" fill="#5b3a22" opacity="0.55" />
        {grow === 0 && <ellipse cx="50" cy="104" rx="4" ry="3" fill="#7a4e2d" />}
        {grow === 1 && (
          <g className="origin-bottom animate-[fadeUp_0.6s_ease-out]">
            <path d="M50 106 C50 98 50 94 50 90" stroke="#4f7a32" strokeWidth="2.4" fill="none" />
            <ellipse cx="45" cy="90" rx="5" ry="2.6" fill={light} transform="rotate(-25 45 90)" />
            <ellipse cx="55" cy="89" rx="5" ry="2.6" fill={light} transform="rotate(25 55 89)" />
          </g>
        )}
        {grow === 2 && (
          <g className="animate-[fadeUp_0.8s_ease-out]">
            <path d="M46 107 C47 90 45 76 42 64 M54 107 C53 90 55 76 58 64 M50 80 C44 70 36 62 30 56 M50 76 C57 66 64 60 70 54" stroke="#6b4428" strokeWidth="5" strokeLinecap="round" fill="none" />
            <defs>
              <radialGradient id={`crown-${look.color}`} cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor={light} />
                <stop offset="100%" stopColor={dark} />
              </radialGradient>
            </defs>
            {look.shape === 'round' && <ellipse cx="50" cy="40" rx="40" ry="34" fill={`url(#crown-${look.color})`} />}
            {look.shape === 'tall' && <path d="M50 2 C70 22 80 52 74 70 C64 78 36 78 26 70 C20 52 30 22 50 2Z" fill={`url(#crown-${look.color})`} />}
            {look.shape === 'willow' && (
              <g fill={`url(#crown-${look.color})`}>
                <ellipse cx="50" cy="30" rx="38" ry="22" />
                {[18, 30, 42, 58, 70, 82].map((x, k) => (
                  <path key={x} d={`M${x} 34 C${x - 3} 50 ${x + 3} 62 ${x - 1} ${72 + (k % 2) * 6}`} stroke={dark} strokeWidth="4" strokeLinecap="round" fill="none" />
                ))}
              </g>
            )}
          </g>
        )}
      </svg>
      {grow === 2 &&
        SPOTS.slice(0, 5).map(([x, y], k) => (
          <span key={k} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-[fadeUp_0.5s_ease-out] text-[20px] drop-shadow" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${0.5 + k * 0.25}s`, animationFillMode: 'both' }}>
            {deco}
          </span>
        ))}
      {grow === 2 && look.tag && (
        <span className="absolute left-[70%] top-[58%] rotate-6 rounded-sm bg-[#f6ead2] px-1.5 py-0.5 text-[11px] font-bold text-stone-700 shadow">{look.tag}</span>
      )}
      {grow === 2 &&
        jackets.slice(0, 2).map((j, k) => (
          <button key={k} onClick={onJacket} className="absolute -translate-x-1/2 animate-[fadeUp_0.6s_ease-out]" style={{ left: `${k ? 30 : 58}%`, top: `${k ? 46 : 40}%` }}>
            <Sticker s={j} size={width * 0.22} />
          </button>
        ))}
    </div>
  );
}
