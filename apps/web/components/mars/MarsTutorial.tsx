'use client';

import { useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { MarsWorld } from './MarsWorld';

/**
 * Day 7 tutorial on Mars, coached by ヒポキン (lines provisional, P-OB-16).
 * Steps: watch a friend's UFO → open your studio → the locker → release a video → done.
 */
type Wait = 'ufo' | 'studio' | 'locker' | 'release' | 'done';
const STEPS: { text: string; wait: Wait; hint?: string }[] = [
  { text: 'とんでいるUFOには、ダチが88時間以内に撮った映像が乗っている。\nひとつタップして見てみろ。', wait: 'ufo', hint: '🛸 UFOをタップ' },
  { text: 'いい映像だろう。\n次は、お前のスタジオだ。\n下の「スタジオ」を押してみろ。', wait: 'studio', hint: '👇「スタジオ」' },
  { text: 'ここがお前のスタジオだ。\nまだ公開していない映像は、ロッカーにしまってある。\n開けてみろ。', wait: 'locker', hint: '🔒「ロッカー」' },
  { text: '公開すると、UFOになって88時間、\nダチやフォロワーの星図をとぶ。\nやってみろ。', wait: 'release', hint: '🛸「公開する」' },
  { text: 'とび終えた映像は、スタジオに並ぶ。\n「スタジオを飾る」で、郊外か街中かも選べるぞ。\nこれが火星の遊び方だ。', wait: 'done' },
];

export function MarsTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const advanceOn = (w: Wait) => setI((cur) => (STEPS[cur]?.wait === w ? cur + 1 : cur));
  const top = step?.wait === 'release';

  return (
    <div className="fixed inset-0 z-[150]">
      <MarsWorld
        events={{
          onUfo: () => advanceOn('ufo'),
          onStudio: () => advanceOn('studio'),
          onLocker: () => advanceOn('locker'),
          onRelease: () => advanceOn('release'),
        }}
        overlay={
          step && (
            <div className={`pointer-events-none absolute inset-x-0 z-[80] flex justify-center px-3 ${top ? 'top-[calc(8px+env(safe-area-inset-top))]' : 'bottom-[calc(96px+env(safe-area-inset-bottom))]'}`}>
              <div className="pointer-events-auto flex w-full max-w-md items-end gap-2 animate-[fadeUp_0.4s_ease-out]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spriteUrl('hipokin-face')} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-amber-400/80 shadow-xl" aria-hidden />
                <div className="relative flex-1 rounded-2xl bg-[#1c0d08]/95 p-3 text-white shadow-xl ring-1 ring-amber-400/40">
                  <p className="text-[11px] font-black text-amber-300">ヒポキン</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] font-bold leading-snug">{step.text}</p>
                  <div className="mt-1.5 flex items-center justify-end gap-3">
                    {step.hint && <span className="animate-pulse text-[11px] font-bold text-orange-300">{step.hint}</span>}
                    {step.wait === 'done' && (
                      <button onClick={onDone} className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-bold text-white">
                        火星をあとにする
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
