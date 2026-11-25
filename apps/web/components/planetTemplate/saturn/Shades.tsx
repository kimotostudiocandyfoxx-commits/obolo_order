import type { Shades as ShadesKind } from '@/lib/planetTemplate/saturn';

/** a five-pointed star path (the prototype's STAR) */
function star(x: number, y: number, s: number): string {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? s * 0.48 : s;
    d += (k ? 'L' : 'M') + (x + Math.cos(a) * r).toFixed(1) + ' ' + (y + Math.sin(a) * r).toFixed(1);
  }
  return d + 'z';
}
const LENS = '#141018';
const BRIDGE = { stroke: LENS, strokeWidth: 3, fill: 'none' } as const;
const GLINT = { stroke: 'rgba(255,255,255,.7)', strokeWidth: 2, strokeLinecap: 'round', fill: 'none' } as const;

/** 04 §1 a kororin's sunglasses (the prototype's SHADES: round, wayfarer, star, heart), over the ball's face */
export function Shades({ kind, className }: { kind: ShadesKind; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      {kind === 'round' && (
        <g>
          <circle cx="35" cy="51" r="10.5" fill={LENS} />
          <circle cx="65" cy="51" r="10.5" fill={LENS} />
          <path d="M45.5 49 q4.5 -4 9 0" {...BRIDGE} />
          <path d="M29 46 q3 -3 6 -3 M59 46 q3 -3 6 -3" {...GLINT} />
        </g>
      )}
      {kind === 'way' && (
        <g>
          <path
            fill={LENS}
            d="M22 44 h22 a4 4 0 0 1 4 4 v3 a9 9 0 0 1 -9 9 h-6 a11 11 0 0 1 -11 -11 v-1 a4 4 0 0 1 0 -4z M78 44 h-22 a4 4 0 0 0 -4 4 v3 a9 9 0 0 0 9 9 h6 a11 11 0 0 0 11 -11 v-1 a4 4 0 0 0 0 -4z"
          />
          <path d="M46 49 h8" {...BRIDGE} />
          <path d="M27 48 l6 0 M61 48 l6 0" {...GLINT} />
        </g>
      )}
      {kind === 'star' && (
        <g>
          <path fill="#3a1238" d={star(34, 51, 13)} />
          <path fill="#3a1238" d={star(66, 51, 13)} />
          <path d="M45 50 h10" {...BRIDGE} />
          <path d="M30 47 l3 -2 M62 47 l3 -2" {...GLINT} />
        </g>
      )}
      {kind === 'heart' && (
        <g>
          <path fill="#3d0f22" d="M35 61 C24 53 23 44 29 42 C32 41 34 43 35 45 C36 43 38 41 41 42 C47 44 46 53 35 61z" />
          <path fill="#3d0f22" d="M65 61 C54 53 53 44 59 42 C62 41 64 43 65 45 C66 43 68 41 71 42 C77 44 76 53 65 61z" />
          <path d="M45 48 h10" {...BRIDGE} />
          <path d="M29 46 l3 -2 M59 46 l3 -2" {...GLINT} />
        </g>
      )}
    </svg>
  );
}
