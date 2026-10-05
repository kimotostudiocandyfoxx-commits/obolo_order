'use client';

import { useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { MercuryWorld } from './MercuryWorld';

/**
 * Day 6 tutorial on the Mercury sea chart, coached by フリージー.
 * Lines are provisional (P-OB-15). Steps: tap an island → sail → swipe to the next song → give a star.
 */
type Wait = 'island' | 'sail' | 'swipe' | 'star' | 'done';
const STEPS: { text: string; wait: Wait; hint?: string }[] = [
  { text: 'これが水星の海図だ。\n島ごとに、音楽のジャンルがちがう。\n聴いてみたい島をタップしてみろ。', wait: 'island', hint: '🏝 島をタップ' },
  { text: '島の住民と、収録された曲の数がわかる。\n「この島を航海する」で、その島の曲が聴けるぞ。', wait: 'sail', hint: '「この島を航海する」' },
  { text: 'いい音だろう。\n横にスワイプすると、次の曲だ。', wait: 'swipe', hint: '👈 スワイプ' },
  { text: '気に入ったら、星を贈れ。\n星は3段階だ。', wait: 'star', hint: '☆ をタップ' },
  { text: 'これが水星の遊び方だ。\nいつかお前の日常も、ここで歌になる。', wait: 'done' },
];

export function MercuryTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const advanceOn = (w: Wait) => setI((cur) => (STEPS[cur]?.wait === w ? cur + 1 : cur));

  return (
    <div className="fixed inset-0 z-[150]">
      <MercuryWorld
        events={{
          onIsland: () => advanceOn('island'),
          onSail: () => advanceOn('sail'),
          onSwipe: () => advanceOn('swipe'),
          onStar: () => advanceOn('star'),
        }}
        overlay={
          step && (
            <div className="pointer-events-none absolute inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-[80] flex justify-center px-3">
              <div className="pointer-events-auto flex w-full max-w-md items-start gap-2 animate-[fadeUp_0.4s_ease-out]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spriteUrl('freezy-face')} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-violet-300/80 shadow-xl" aria-hidden />
                <div className="relative flex-1 rounded-2xl bg-[#101935]/95 p-3 text-white shadow-xl ring-1 ring-violet-300/40">
                  <p className="text-[11px] font-black text-violet-300">フリージー</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] font-bold leading-snug">{step.text}</p>
                  <div className="mt-1.5 flex items-center justify-end gap-3">
                    {step.hint && <span className="animate-pulse text-[11px] font-bold text-cyan-300">{step.hint}</span>}
                    {step.wait === 'done' && (
                      <button onClick={onDone} className="rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white">
                        水星をあとにする
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        }
      />
    </div>
  );
}
