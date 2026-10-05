'use client';

import { useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { PatapataWorld } from './PatapataWorld';

/**
 * Day 5 tutorial on パタパタ (the client's Jupiter design, docs/jupiter.md), coached by 大根カイザー.
 * Lines are provisional (P-OB-14); Kaiser ends his sentences with 「DA」 (client).
 * Steps: open a butterfly → close it (it flies off, another takes its place) → たまご → pick from the
 * roots → make a round post → visit your tree → done.
 */
type Wait = 'open' | 'close' | 'next' | 'egg' | 'pick' | 'post' | 'tree' | 'done';
const STEPS: { text: string; wait: Wait; hint?: string }[] = [
  { text: '空を舞っているのは、みんなの投稿DA。\n気になる蝶を、タップしてみるのDA。', wait: 'open', hint: '🦋 蝶をタップ' },
  { text: '88時間以内の投稿は、ぜんぶ見られるのDA。\n見終わったら、とじるのDA。', wait: 'close', hint: '「とじる」をタップ' },
  { text: '見終わった蝶は飛んでいき、\nまた別の蝶がやってくるのDA。', wait: 'next' },
  { text: '次は君の番DA。\nたまごを押してみるのDA。', wait: 'egg', hint: '👇 たまごをタップ' },
  { text: 'ここは根っこ。君だけのデータフォルダDA。\n撮った写真や動画は、まずここにしまわれるのDA。\nひとつ選ぶのDA。', wait: 'pick', hint: '写真をひとつ選ぶ' },
  { text: '文字を入れたり、加工したりして、\n丸い投稿をつくるのDA。\nできたら投稿するのDA！', wait: 'post', hint: '👇「投稿する」' },
  { text: '君の投稿が蝶になったのDA。\n88時間、みんなの空を飛ぶのDA。\n「木」をのぞいてみるのDA。', wait: 'tree', hint: '👇「木」をタップ' },
  { text: 'これが君の木DA。\n飛び終えた蝶は、葉っぱになって枝に戻るのDA。\n根っこには、君だけの思い出がたまっていくのDA。', wait: 'done' },
];

export function JupiterTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const advanceOn = (w: Wait) => setI((cur) => (STEPS[cur]?.wait === w ? cur + 1 : cur));

  return (
    <div className="fixed inset-0 z-[150]">
      <PatapataWorld
        topInset={0}
        events={{
          onOpenFlyer: () => advanceOn('open'),
          onCloseViewer: () => advanceOn('close'),
          onEgg: () => advanceOn('egg'),
          onPick: () => advanceOn('pick'),
          onPosted: () => advanceOn('post'),
          onTree: () => advanceOn('tree'),
        }}
        overlay={
          step && (
            <div
              className={`pointer-events-none absolute inset-x-0 z-[80] flex justify-center px-3 ${
                // keep clear of the viewer's buttons and the compose button
                ['close', 'pick', 'post'].includes(step.wait) ? 'top-[calc(10px+env(safe-area-inset-top))]' : 'bottom-[calc(108px+env(safe-area-inset-bottom))]'
              }`}
            >
              <div className="pointer-events-auto flex w-full max-w-md items-end gap-2 animate-[fadeUp_0.4s_ease-out]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spriteUrl('kaiser-face')} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-amber-300/80 shadow-xl" aria-hidden />
                <div className="relative mb-1 flex-1 rounded-2xl bg-white/95 p-3 text-stone-800 shadow-xl">
                  <p className="text-[11px] font-black text-amber-700">大根カイザー</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] font-bold leading-snug">{step.text}</p>
                  <div className="mt-1.5 flex items-center justify-end gap-3">
                    {step.hint && <span className="animate-pulse text-[11px] font-bold text-amber-700">{step.hint}</span>}
                    {step.wait === 'next' && (
                      <button onClick={() => setI(i + 1)} className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white">
                        つぎへ
                      </button>
                    )}
                    {step.wait === 'done' && (
                      <button onClick={onDone} className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white">
                        木星をあとにする
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
