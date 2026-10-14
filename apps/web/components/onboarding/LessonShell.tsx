'use client';

import type { ReactNode } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';

/**
 * The frame of a planet lesson (first journey, story 2026-10-14): the planet's picture, the resident who
 * teaches (a small standing picture and a speech bubble at the top) and the play area below. The
 * residents explain in their own words, short and plain (a 15-year-old understands at once); anything
 * that opens on the second journey is only named ("二周目から").
 */
export interface CoachLine {
  /** sprite name in public/onboarding, or an image url; omitted = a plain guide card (〔画面〕 note) */
  sprite?: string;
  name?: string;
  text: string;
}

export function LessonShell({ bg, tint = 'from-black/10 via-transparent to-black/60', coach, actions, children }: { bg: string; tint?: string; coach: CoachLine | null; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[150] overflow-hidden bg-black text-white" style={{ fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bg} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className={`absolute inset-0 bg-gradient-to-b ${tint}`} />
      <div className="absolute inset-0">{children}</div>
      {coach && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(14px+env(safe-area-inset-top))] z-[200] flex justify-center px-3">
          <div className="pointer-events-auto flex w-full max-w-md animate-[fadeUp_0.4s_ease-out] items-end gap-2" key={coach.text}>
            {coach.sprite && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coach.sprite.includes('/') ? coach.sprite : spriteUrl(coach.sprite)} alt="" className="h-28 w-auto max-w-[30%] shrink-0 object-contain drop-shadow-xl" aria-hidden />
            )}
            <div className={`relative mb-2 flex-1 rounded-2xl p-3 shadow-xl ${coach.name ? 'bg-white/95 text-slate-800' : 'bg-[#1d1630]/90 text-white'}`}>
              {coach.name && <p className="text-[11px] font-black text-violet-600">{coach.name}</p>}
              <p className={`mt-0.5 whitespace-pre-wrap leading-snug ${coach.name ? 'text-[15px] font-bold' : 'text-[13px] font-bold'}`}>{coach.text}</p>
              {actions && <div className="mt-2 flex flex-wrap items-center justify-end gap-2">{actions}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NextButton({ onClick, label = 'つぎへ' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white">
      {label}
    </button>
  );
}

/** A play-area panel at the bottom of the screen. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[180] max-h-[64svh] overflow-y-auto rounded-t-3xl bg-white/95 px-5 pb-6 pt-4 text-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.25)]">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}

export function Big({ children, onClick, disabled, tone = 'violet' }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'violet' | 'amber' | 'sky' | 'rose' }) {
  const bg = { violet: 'from-violet-500 to-fuchsia-500', amber: 'from-amber-400 to-orange-500', sky: 'from-sky-500 to-cyan-500', rose: 'from-rose-500 to-pink-500' }[tone];
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full rounded-full bg-gradient-to-r ${bg} py-3.5 text-base font-black text-white shadow disabled:opacity-40`}>
      {children}
    </button>
  );
}

export function Soft({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-full bg-slate-100 py-3 text-sm font-bold text-slate-600 disabled:opacity-40">
      {children}
    </button>
  );
}

/** "Opens on the second journey": visible, greyed, not pressable. */
export function Later({ label }: { label: string }) {
  return (
    <div className="mt-2 text-center">
      <button disabled className="w-full rounded-full bg-slate-100 py-2.5 text-sm font-black text-slate-300">
        {label}
      </button>
      <p className="mt-1 text-[11px] font-bold text-slate-400">二周目の旅から</p>
    </div>
  );
}
