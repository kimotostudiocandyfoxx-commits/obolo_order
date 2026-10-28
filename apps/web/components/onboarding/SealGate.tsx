'use client';

import { useEffect, useState } from 'react';

/**
 * E-0 招待状を開く前の確認 (story D01-S000, M-R131): only the first time the invitation is opened. A golden seal
 * pulses in the dark; two marks to touch — 〔音が出せる場所にいる〕〔声を出せる（話しても大丈夫な）場所にいる〕 —
 * then 〔封を開く準備ができた〕 lights up. 〔あとで開く〕 in the corner leaves it waiting. A secret society's
 * opening rite, not a contract: no small print, no table of checkboxes. Nothing is checked or asked of the
 * browser here (no mic permission); it is the visitor's own word. M-R150: the year they were born is chosen here
 * too (for the protective settings; nobody else sees it) and kept until the account exists (BIRTH_YEAR_KEY).
 * Client 2026-10-29: the golden eclipse as the whole background (fitted to the phone's width), the words typed in one
 * letter at a time, the two marks rising one by one, then the year, then 〔開封準備完了〕 — which opens on the film.
 */
export const SEAL_GATE_KEY = 'obolo.sealGate';
export const BIRTH_YEAR_KEY = 'obolo.birthYear';
export function sealGateSeen(): boolean {
  try {
    return localStorage.getItem(SEAL_GATE_KEY) === '1';
  } catch {
    return false;
  }
}

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const LINES = ['この世界は音と共に', 'あなたの声で進みます', '周りに誰もいない環境で', '開封準備してください'];
const TYPE_MS = 85;

/** the words come in one letter at a time, line after line; `onDone` once the last letter is in */
function Typed({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const total = lines.reduce((n, l) => n + l.length, 0);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= total) {
      const t = setTimeout(onDone, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 700 : TYPE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, total]);
  let left = n;
  return (
    <div className="text-center text-[16px] leading-[2] tracking-[0.14em] [@media(max-height:700px)]:text-[14px] [@media(max-height:700px)]:leading-[1.75] text-amber-50/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">
      {lines.map((l, k) => {
        const shown = Math.max(0, Math.min(l.length, left));
        left -= l.length;
        return (
          <p key={k} className={k === 2 ? 'mt-3 [@media(max-height:700px)]:mt-1.5' : ''}>
            {l.slice(0, shown)}
            {/* the rest held in place, so the lines do not move while they type */}
            <span className="invisible">{l.slice(shown)}</span>
          </p>
        );
      })}
    </div>
  );
}

export function SealGate({ onOpen }: { onOpen: () => void }) {
  const [typed, setTyped] = useState(false);
  const [voice, setVoice] = useState(false);
  const [sound, setSound] = useState(false);
  const [later, setLater] = useState(false);
  const [year, setYear] = useState('');
  const marked = voice && sound;
  const ready = marked && !!year;
  const thisYear = new Date().getFullYear();
  const mark = (on: boolean, set: (v: boolean) => void, label: string, delay: number) => (
    <button onClick={() => set(!on)} className="flex w-full items-center gap-3 text-left text-[15px] tracking-[0.1em] text-amber-50/90 opacity-0 animate-[fadeUp_0.9s_ease-out_both]" style={{ animationDelay: `${delay}s` }}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${on ? 'border-amber-200 bg-amber-200/30 shadow-[0_0_14px_rgba(255,214,140,0.8)]' : 'border-amber-200/60 bg-black/40'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-amber-100" />}</span>
      {label}
    </button>
  );
  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-black" style={{ fontFamily: SERIF }}>
      {/* the golden eclipse, always the phone's full width, from the top (a very tall picture: on a taller phone the black
          shows below it, on a wider screen its bottom is cut); the words start under the ring (76% of the width down),
          moving up over it only on a short screen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/s/d1-gate-bg.webp" alt="" className="pointer-events-none absolute left-0 top-0 h-auto w-full select-none" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
      <div className="relative flex h-full flex-col items-center px-8 pt-[min(76vw,calc(100dvh-470px))] [@media(max-height:700px)]:pt-[min(76vw,calc(100dvh-420px))]">
        {later ? (
          <p className="text-center text-[15px] leading-loose tracking-[0.15em] text-amber-100/80">招待状は、届いたまま待っています</p>
        ) : (
          <>
            <Typed lines={LINES} onDone={() => setTyped(true)} />
            <div className="mt-7 flex min-h-[260px] w-full max-w-xs flex-col gap-4 [@media(max-height:700px)]:mt-4 [@media(max-height:700px)]:gap-2.5">
              {typed && (
                <>
                  {mark(voice, setVoice, '声を出せる場所にいる', 0)}
                  {mark(sound, setSound, '音声をONにした', 0.6)}
                </>
              )}
              {marked && (
                <label className="mt-2 block text-[13px] tracking-[0.1em] text-amber-50/85 opacity-0 animate-[fadeUp_0.9s_ease-out_both]">
                  生まれた年を教えてください
                  <select value={year} onChange={(e) => setYear(e.target.value)} className="mt-2 block w-full rounded-full border border-amber-200/50 bg-black/70 px-4 py-2 text-[15px] text-amber-50">
                    <option value="">年を選ぶ</option>
                    {Array.from({ length: 90 }, (_, k) => thisYear - 3 - k).map((y) => (
                      <option key={y} value={y}>
                        {y}年
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] leading-relaxed text-white/45 [@media(max-height:700px)]:text-[10px]">年齢に合わせて、守りの設定と、あとで作る姿の絵を合わせるためです。ほかの人には見えません</span>
                </label>
              )}
              {ready && (
                <button
                  onClick={() => {
                    try {
                      localStorage.setItem(SEAL_GATE_KEY, '1');
                      localStorage.setItem(BIRTH_YEAR_KEY, year);
                    } catch {
                      /* private mode: asked again next time */
                    }
                    onOpen();
                  }}
                  className="mx-auto mt-3 rounded-full border border-amber-200 bg-amber-200/15 px-8 py-3 text-[16px] tracking-[0.25em] text-amber-50 opacity-0 shadow-[0_0_30px_rgba(255,214,140,0.5)] animate-[fadeUp_0.9s_ease-out_both,hintGlow_2.2s_ease-in-out_0.9s_infinite]"
                >
                  開封準備完了
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {!later && (
        <button onClick={() => setLater(true)} className="pb-safe absolute bottom-6 right-5 text-[12px] tracking-[0.2em] text-white/40 underline">
          あとで開く
        </button>
      )}
    </div>
  );
}
