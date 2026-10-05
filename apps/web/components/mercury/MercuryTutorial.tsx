'use client';

import { useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { MercuryWorld } from './MercuryWorld';

/**
 * Day 6 tutorial on Mercury, coached by フリージー (lines provisional, P-OB-15).
 * Steps: tap a friend's ship → give a star → visit your island → dig up a demo → set it sailing.
 */
type Wait = 'ship' | 'star' | 'island' | 'soil' | 'release' | 'done';
const STEPS: { text: string; wait: Wait; hint?: string }[] = [
  { text: '海を渡っているのは、ダチの船だ。\n船には、88時間以内に作った曲が積まれてる。\nひとつタップしてみろ。', wait: 'ship', hint: '🚢 船をタップ' },
  { text: 'いい音だろう。曲が何曲かあれば、\n横にスワイプで次の曲だ。\n気に入ったら、星を贈れ。星は3段階だ。', wait: 'star', hint: '☆ をタップ' },
  { text: '贈った星の曲は、お前の島の宝箱にたまる。\n下の「島」を押してみろ。', wait: 'island', hint: '👇「島」をタップ' },
  { text: 'これがお前の島だ。\n発表していないデモ曲は、島の土に埋まってる。\n掘ってみろ。', wait: 'soil', hint: '⛏ 土の中をタップ' },
  { text: '曲を出航させると、船になって\n88時間、ダチやフォロワーの海を渡る。\nやってみろ。', wait: 'release', hint: '🚢「出航させる」' },
  { text: '88時間の航海を終えた船は、島に戻ってきて\nレコードとして飾られる。\nこれが水星の遊び方だ。', wait: 'done' },
];

export function MercuryTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const advanceOn = (w: Wait) => setI((cur) => (STEPS[cur]?.wait === w ? cur + 1 : cur));

  return (
    <div className="fixed inset-0 z-[150]">
      <MercuryWorld
        events={{
          onShip: () => advanceOn('ship'),
          onStar: () => advanceOn('star'),
          onIsland: () => advanceOn('island'),
          onSoil: () => advanceOn('soil'),
          onRelease: () => advanceOn('release'),
        }}
        overlay={
          step && (
            <div
              className={`pointer-events-none absolute inset-x-0 z-[80] flex justify-center px-3 ${
                step.wait === 'release' || step.wait === 'star' ? 'top-[calc(8px+env(safe-area-inset-top))]' : 'bottom-[calc(96px+env(safe-area-inset-bottom))]'
              }`}
            >
              <div className="pointer-events-auto flex w-full max-w-md items-end gap-2 animate-[fadeUp_0.4s_ease-out]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spriteUrl('freezy-face')} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-violet-300/80 shadow-xl" aria-hidden />
                <div className="relative flex-1 rounded-2xl bg-[#101935]/95 p-3 text-white shadow-xl ring-1 ring-violet-300/40">
                  <p className="text-[11px] font-black text-violet-300">フリージー</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] font-bold leading-snug">{step.text}</p>
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
