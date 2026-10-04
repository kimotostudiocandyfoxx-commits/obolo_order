'use client';

import { useEffect, useState } from 'react';
import { PhotoGrid, PhotoModal } from '@/app/jupiter/JupiterView';
import { spriteUrl } from '@/lib/onboarding/media';
import type { SamplePhoto } from '@/lib/samples';
import { synth } from '@/lib/synth';

/**
 * Day 5 tutorial on Jupiter, coached by 大根カイザー.
 * PLACEHOLDER (P-JUP-1): the client is designing the real Jupiter play screen; until it arrives this
 * reuses the demo photo grid (spec §2.4: every photo carries a sound). Lines are provisional (P-OB-14);
 * Kaiser ends his sentences with 「DA」 (client).
 */
const STEPS: { text: string; wait: 'open' | 'listen' | 'star' | 'next' | 'done' }[] = [
  { text: 'ここに並んでいるのは、みんなの日常DA。\n気になる一枚を、ひらいてみるのDA。', wait: 'open' },
  { text: '木星の写真には、かならず音が宿るのDA。\n▶ で、その時の音を聴いてみるのDA。', wait: 'listen' },
  { text: '景色も、音も、そのまま残る。\nこうして日常は、思い出になっていくのDA。', wait: 'next' },
  { text: '心が動いたなら、星を贈るのDA。', wait: 'star' },
  { text: 'それが木星の遊び方DA。\n君の日常にも、命は宿っているのDA。', wait: 'done' },
];

export function JupiterTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState<SamplePhoto | null>(null);
  const step = STEPS[i];
  const advanceOn = (w: (typeof STEPS)[number]['wait']) => setI((cur) => (STEPS[cur]?.wait === w ? cur + 1 : cur));
  useEffect(() => () => synth.stop(), []);

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-gradient-to-b from-[#2a1d0e] via-[#3b2a14] to-[#120c05] text-white">
      <div className="mx-auto max-w-md px-3 pb-10 pt-[calc(180px+env(safe-area-inset-top))]">
        <p className="mb-1 text-center text-xs font-bold tracking-[0.3em] text-amber-200/80">JUPITER · 木星</p>
        <p className="mb-3 text-center text-[11px] text-white/50">写真 ＋ 音（仮の画面）</p>
        <PhotoGrid
          onOpen={(p) => {
            setOpen(p);
            advanceOn('open');
          }}
        />
      </div>

      {open && (
        <PhotoModal
          photo={open}
          onPlay={() => advanceOn('listen')}
          onStar={() => advanceOn('star')}
          onClose={() => {
            synth.stop();
            setOpen(null);
          }}
        />
      )}

      {step && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[200] flex justify-center px-3">
          <div className="pointer-events-auto flex w-full max-w-md items-end gap-2 animate-[fadeUp_0.4s_ease-out]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={spriteUrl('kaiser-face')} alt="" className="h-20 w-20 shrink-0 rounded-full border-2 border-amber-300/80 shadow-xl" aria-hidden />
            <div className="relative mb-1 flex-1 rounded-2xl bg-amber-50/95 p-3 text-stone-800 shadow-xl">
              <p className="text-[11px] font-black text-amber-700">大根カイザー</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[15px] font-bold leading-snug">{step.text}</p>
              <div className="mt-2 flex items-center justify-end gap-3">
                {step.wait === 'open' && <span className="animate-pulse text-[11px] font-bold text-amber-700">👇 写真をタップ</span>}
                {step.wait === 'listen' && <span className="animate-pulse text-[11px] font-bold text-amber-700">▶ をタップ</span>}
                {step.wait === 'star' && <span className="animate-pulse text-[11px] font-bold text-amber-700">☆ をタップ</span>}
                {step.wait === 'next' && (
                  <button onClick={() => setI(i + 1)} className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white">
                    つぎへ
                  </button>
                )}
                {step.wait === 'done' && (
                  <button
                    onClick={() => {
                      synth.stop();
                      onDone();
                    }}
                    className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white"
                  >
                    木星をあとにする
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
