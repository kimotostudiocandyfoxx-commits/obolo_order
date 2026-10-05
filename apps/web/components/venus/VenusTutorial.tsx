'use client';

import { useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { VenusWorld } from './VenusWorld';

/**
 * Day 8 tutorial on Venus, coached by the gorilla trio (lines provisional, P-OB-17).
 * Steps: buy something with stars → make goods with your Bati and put them in your shop → see your shop.
 */
type Wait = 'buy' | 'make' | 'list' | 'mine' | 'done';
const STEPS: { who: 'bossg' | 'hatg' | 'longg'; text: string; wait: Wait; hint?: string }[] = [
  { who: 'bossg', text: 'ここが金星のマーケットだ。\nみんなが作ったグッズが並んでる。\n気に入ったのを、星で買ってみな。', wait: 'buy', hint: '🛍 グッズをタップ →「★で買う」' },
  { who: 'hatg', text: '星は、ほかの惑星で集めた星だ。\n本物のお金はいらないぜ。\n次は、作る番だ。「つくる」を押してみな。', wait: 'make', hint: '👇「つくる」' },
  { who: 'longg', text: '相棒のバティに、作りたいものを話してみな。\n形になったら、値段をつけて\n店に並べるんだ。', wait: 'list', hint: '🏪「店に並べる」' },
  { who: 'bossg', text: 'いいぞ。売れたら星が入る。\n「自分の店」をのぞいてみな。', wait: 'mine', hint: '👇「自分の店」' },
  { who: 'bossg', text: '作って、売って、集める。\nこれが金星の遊び方だ。', wait: 'done' },
];
const NAMES = { bossg: 'ボスG', hatg: 'ハットG', longg: 'ロングG' };

export function VenusTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const advanceOn = (w: Wait) => setI((cur) => (STEPS[cur]?.wait === w ? cur + 1 : cur));
  const top = step?.wait === 'list';

  return (
    <div className="fixed inset-0 z-[150]">
      <VenusWorld
        events={{ onBuy: () => advanceOn('buy'), onMake: () => advanceOn('make'), onList: () => advanceOn('list'), onMyShop: () => advanceOn('mine') }}
        overlay={
          step && (
            <div className={`pointer-events-none absolute inset-x-0 z-[80] flex justify-center px-3 ${top ? 'top-[calc(52px+env(safe-area-inset-top))]' : 'bottom-[calc(96px+env(safe-area-inset-bottom))]'}`}>
              <div className="pointer-events-auto flex w-full max-w-md items-end gap-2 animate-[fadeUp_0.4s_ease-out]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spriteUrl(`${step.who}-face`)} alt="" className="h-16 w-16 shrink-0 rounded-full shadow-xl" aria-hidden />
                <div className="relative flex-1 rounded-2xl bg-[#2a0f2a]/95 p-3 text-white shadow-xl ring-1 ring-amber-300/40">
                  <p className="text-[11px] font-black text-amber-300">{NAMES[step.who]}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] font-bold leading-snug">{step.text}</p>
                  <div className="mt-1.5 flex items-center justify-end gap-3">
                    {step.hint && <span className="animate-pulse text-[11px] font-bold text-pink-300">{step.hint}</span>}
                    {step.wait === 'done' && (
                      <button onClick={onDone} className="rounded-full bg-pink-600 px-4 py-1.5 text-xs font-bold text-white">
                        金星をあとにする
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
