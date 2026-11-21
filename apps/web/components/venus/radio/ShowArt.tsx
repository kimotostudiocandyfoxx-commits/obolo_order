'use client';

import type { RadioLoop } from '@obolo/shared';
import { Glyph } from '@/components/bluena/glyphs';

/**
 * A show's square picture with its loop (docs/工房とブルーナ_設計.md §9.3). The loop is drawn here,
 * in the listener's app; only the picture and the loop's name travel with the show.
 */
export function ShowArt({ url, loop, playing = true, onAir = false, className = '' }: { url: string | null; loop: RadioLoop; playing?: boolean; onAir?: boolean; className?: string }) {
  const move = playing && loop !== 'still';
  return (
    <div className={`relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-900 via-indigo-950 to-amber-900 ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${move && loop === 'drift' ? 'radio-drift' : ''} ${move && loop === 'pulse' ? 'radio-pulse' : ''}`}
        />
      ) : (
        <div className={`absolute inset-0 flex items-center justify-center text-amber-100/70 ${move && loop === 'pulse' ? 'radio-pulse' : ''}`}>
          <Glyph id="radio" label={false} className="h-1/3 w-1/3" />
        </div>
      )}
      {move && loop === 'ripple' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[0, 1.2, 2.4].map((d) => (
            <span key={d} className="radio-ripple-ring absolute h-3/4 w-3/4 rounded-full border-2 border-white/50" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      )}
      {move && loop === 'stars' && (
        <div className="pointer-events-none absolute inset-0">
          {STARS.map(([x, y, s, d], i) => (
            <span key={i} className="absolute rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animation: `twinkle 2.6s ease-in-out ${d}s infinite` }} />
          ))}
        </div>
      )}
      {onAir && (
        <span className="radio-onair absolute left-2 top-2 rounded-md bg-red-600 px-1.5 py-0.5 font-sans text-[10px] font-black tracking-widest text-white shadow">ON AIR</span>
      )}
    </div>
  );
}

const STARS: [number, number, number, number][] = [
  [12, 18, 3, 0],
  [78, 12, 2, 0.6],
  [64, 70, 3, 1.1],
  [22, 76, 2, 1.7],
  [46, 36, 2, 0.3],
  [88, 52, 3, 2.1],
  [34, 58, 2, 0.9],
  [58, 22, 2, 1.4],
];

export const LOOP_CHOICES: { id: RadioLoop; label: string }[] = [
  { id: 'drift', label: 'ゆらぎ' },
  { id: 'ripple', label: '波紋' },
  { id: 'stars', label: '星' },
  { id: 'pulse', label: '鼓動' },
  { id: 'still', label: '止める' },
];
