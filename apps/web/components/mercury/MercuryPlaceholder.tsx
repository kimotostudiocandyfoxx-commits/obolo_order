'use client';

import { spriteUrl } from '@/lib/onboarding/media';

/**
 * Day 6: the Mercury play screen. PLACEHOLDER (P-MER-1): the client's UI is ready and arrives next;
 * until then this stands in so the day can be played through.
 */
export function MercuryPlaceholder({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0b2a4a] via-[#14507a] to-[#0a1d33] px-6 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl('freezy')} alt="" className="h-48 w-auto drop-shadow-2xl" aria-hidden />
      <p className="text-sm tracking-[0.4em] text-cyan-100/80">MERCURY · 水星</p>
      <p className="text-lg font-bold">水星で遊ぶ画面</p>
      <p className="text-xs text-white/55">（クライアントのデザインが届いたら、ここに入ります）</p>
      <button onClick={onDone} className="mt-4 rounded-full bg-cyan-400/90 px-6 py-2.5 text-sm font-bold text-[#06223a]">
        水星をあとにする
      </button>
    </div>
  );
}
