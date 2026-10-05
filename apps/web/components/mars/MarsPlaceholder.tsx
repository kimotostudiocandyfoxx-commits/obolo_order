'use client';

import { spriteUrl, stillUrl } from '@/lib/onboarding/media';

/**
 * Day 7: the Mars play screen. PLACEHOLDER (P-MARS-1): the client's UI arrives next; until then this
 * stands in so the day can be played through.
 */
export function MarsPlaceholder({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-end overflow-hidden bg-[#1a0806] px-6 pb-[calc(40px+env(safe-area-inset-bottom))] text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stillUrl('mars-city')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl('hipokin')} alt="" className="relative h-[42vh] w-auto drop-shadow-2xl" aria-hidden />
      <p className="relative mt-4 text-sm tracking-[0.4em] text-orange-200/80">MARS · 火星</p>
      <p className="relative text-lg font-bold">火星で遊ぶ画面</p>
      <p className="relative text-xs text-white/60">（クライアントのデザインが届いたら、ここに入ります）</p>
      <button onClick={onDone} className="relative mt-5 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-bold">
        火星をあとにする
      </button>
    </div>
  );
}
