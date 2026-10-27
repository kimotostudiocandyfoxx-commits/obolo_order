'use client';

import { useState } from 'react';

/**
 * E-0 招待状を開く前の確認 (story D01-S000, M-R131): only the first time the invitation is opened. A golden seal
 * pulses in the dark; two marks to touch — 〔音が出せる場所にいる〕〔声を出せる（話しても大丈夫な）場所にいる〕 —
 * then 〔封を開く準備ができた〕 lights up. 〔あとで開く〕 in the corner leaves it waiting. A secret society's
 * opening rite, not a contract: no small print, no table of checkboxes. Nothing is checked or asked of the
 * browser here (no mic permission); it is the visitor's own word.
 */
export const SEAL_GATE_KEY = 'obolo.sealGate';
export function sealGateSeen(): boolean {
  try {
    return localStorage.getItem(SEAL_GATE_KEY) === '1';
  } catch {
    return false;
  }
}

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

export function SealGate({ onOpen }: { onOpen: () => void }) {
  const [sound, setSound] = useState(false);
  const [voice, setVoice] = useState(false);
  const [later, setLater] = useState(false);
  const ready = sound && voice;
  const mark = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button onClick={() => set(!on)} className="flex w-full items-center gap-3 text-left text-[15px] tracking-[0.08em] text-amber-50/90">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${on ? 'border-amber-200 bg-amber-200/30 shadow-[0_0_14px_rgba(255,214,140,0.8)]' : 'border-amber-200/50'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-amber-100" />}</span>
      {label}
    </button>
  );
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black px-8" style={{ fontFamily: SERIF }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,80,20,0.25),transparent_65%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/s/d1-seal.webp" alt="" className={`relative h-36 w-36 animate-[sealPulse_3s_ease-in-out_infinite] drop-shadow-[0_0_30px_rgba(255,200,110,0.6)] ${ready ? 'brightness-125' : ''}`} />
      {later ? (
        <p className="relative mt-10 text-center text-[15px] leading-loose tracking-[0.15em] text-amber-100/80">招待状は、届いたまま待っています</p>
      ) : (
        <>
          <p className="relative mt-8 text-[13px] tracking-[0.4em] text-amber-200/80">この招待状を開く前に</p>
          <div className="relative mt-5 flex w-full max-w-xs flex-col gap-4">
            {mark(sound, setSound, '音が出せる場所にいる')}
            {mark(voice, setVoice, '声を出せる（話しても大丈夫な）場所にいる')}
          </div>
          <p className="relative mt-6 max-w-xs text-center text-[12px] leading-relaxed tracking-[0.06em] text-white/55">この先は、あなたの声で進みます。電車やバスの中ではなく、家など、ゆっくりできる場所で開いてください</p>
          <button
            disabled={!ready}
            onClick={() => {
              try {
                localStorage.setItem(SEAL_GATE_KEY, '1');
              } catch {
                /* private mode: asked again next time */
              }
              onOpen();
            }}
            className={`relative mt-8 rounded-full border px-8 py-3 text-[16px] tracking-[0.25em] transition ${ready ? 'animate-[hintGlow_2.2s_ease-in-out_infinite] border-amber-200 bg-amber-200/15 text-amber-50 shadow-[0_0_30px_rgba(255,214,140,0.5)]' : 'border-amber-200/25 text-amber-100/35'}`}
          >
            封を開く準備ができた
          </button>
        </>
      )}
      {!later && (
        <button onClick={() => setLater(true)} className="pb-safe absolute bottom-6 right-5 text-[12px] tracking-[0.2em] text-white/40 underline">
          あとで開く
        </button>
      )}
    </div>
  );
}
