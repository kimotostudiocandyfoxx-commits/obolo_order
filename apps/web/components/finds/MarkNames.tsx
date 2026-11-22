'use client';

import { ITEM_MARKS, MARK_GLYPH, type MarkNames } from '@obolo/shared';
import { useState } from 'react';
import { markNames, saveMarkNames } from '@/lib/finds/marks';
import { MARK_COLOR } from './MarkRing';

/** the gear at Bluena's top right (M-R236 §4): your own names for ♠♦♥♣ (e.g. ♠ = 仕事, ♥ = プライベート; none is fine) */
export function MarkNamesSheet({ onClose }: { onClose: () => void }) {
  const [n, setN] = useState<MarkNames>(() => ({ ...markNames() }));
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/55 px-3 pt-16" onClick={onClose}>
      <div className="w-full rounded-3xl border border-white/10 bg-[#0e1430] p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-center text-[12px] tracking-[0.2em] text-sky-100/80">しるしの名前</p>
        <div className="space-y-2">
          {ITEM_MARKS.map((k) => (
            <label key={k} className="flex items-center gap-2">
              <span className="w-7 text-center text-[22px]" style={{ color: MARK_COLOR[k] }}>
                {MARK_GLYPH[k]}
              </span>
              <input
                value={n[k] ?? ''}
                maxLength={12}
                onChange={(e) => setN({ ...n, [k]: e.target.value })}
                placeholder="なし"
                className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-sky-200/50"
              />
            </label>
          ))}
        </div>
        <button
          onClick={() => {
            void saveMarkNames(n);
            onClose();
          }}
          className="mt-4 w-full rounded-full bg-sky-300 py-2 text-[13px] font-bold text-slate-950"
        >
          きめる
        </button>
      </div>
    </div>
  );
}

export function GearGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </svg>
  );
}
