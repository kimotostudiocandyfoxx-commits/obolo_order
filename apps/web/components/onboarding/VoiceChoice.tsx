'use client';

import { useEffect, useRef, useState } from 'react';
import { ReplyChips } from '@/components/story/Chat';

/**
 * A choice answered by voice (D01-S006, story M-R169): a big 〔🎙 話してみよう〕 with the answers as a small example;
 * the corner ⌨ (for when one cannot speak) shows them as buttons. The first tap ever asks once —
 * 「話した声は、答えを聞き取るためだけに使い、残しません　［いいよ］［やめる］」 — then the phone's mic permission;
 * ［やめる］ goes to the buttons. What is heard is matched to the nearest answer (the browser's own speech
 * recognition; nothing is sent or kept).
 */
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
export const VOICE_OK_KEY = 'obolo.voiceOk';

function recognizer(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** heard words → the answer they mean: a "not" wins over a "yes", unsure over nothing */
export function matchAnswer(heard: string, options: string[]): number {
  const h = heard.replace(/\s/g, '');
  const exact = options.findIndex((o) => h.includes(o));
  if (exact >= 0 && !options.some((o, k) => k !== exact && o.includes(options[exact]) && h.includes(o))) return exact;
  const neg = /たくない|いかない|行かない|いや|嫌|むり|無理|やだ/.test(h);
  const unsure = /わかん|わから|分から|まだ|どう|かな|迷/.test(h);
  const yes = /行き|いき|いく|行く|たい|うん|はい|もちろん|ぜひ/.test(h);
  const find = (re: RegExp) => options.findIndex((o) => re.test(o));
  if (neg) return Math.max(0, find(/たくない|ない$/));
  if (unsure) return Math.max(0, find(/わかん|まだ/));
  if (yes) return Math.max(0, find(/^行きたい$|たい$/));
  return Math.max(0, find(/わかん|まだ/));
}

export function VoiceChoice({ options, onPick }: { options: string[]; onPick: (k: number) => void }) {
  const [mode, setMode] = useState<'mic' | 'ask' | 'listen' | 'keys'>('mic');
  const [heard, setHeard] = useState('');
  const rec = useRef<Rec | null>(null);
  useEffect(() => {
    if (!recognizer()) setMode('keys');
    return () => rec.current?.abort();
  }, []);

  const listen = () => {
    const R = recognizer();
    if (!R) return setMode('keys');
    const r = new R();
    r.lang = 'ja-JP';
    r.interimResults = true;
    r.continuous = false;
    let said = '';
    r.onresult = (e) => {
      said = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join('');
      setHeard(said);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMode('keys');
    };
    r.onend = () => {
      if (said.trim()) {
        const k = matchAnswer(said, options);
        setTimeout(() => onPick(k), 500);
      } else setMode((m) => (m === 'listen' ? 'mic' : m));
    };
    rec.current = r;
    setHeard('');
    setMode('listen');
    try {
      r.start();
    } catch {
      setMode('keys');
    }
  };
  const tap = () => {
    let ok = false;
    try {
      ok = localStorage.getItem(VOICE_OK_KEY) === '1';
    } catch {
      /* private mode */
    }
    if (ok) listen();
    else setMode('ask');
  };

  if (mode === 'keys') return <ReplyChips options={options} onPick={onPick} />;
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-5 pb-8">
      {mode === 'ask' ? (
        <div className="w-full max-w-sm rounded-3xl border border-amber-200/40 bg-black/80 p-4 text-center text-amber-50 backdrop-blur">
          <p className="text-[14px] leading-relaxed">話した声は、答えを聞き取るためだけに使い、残しません</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                try {
                  localStorage.setItem(VOICE_OK_KEY, '1');
                } catch {
                  /* private mode */
                }
                listen();
              }}
              className="rounded-full border border-amber-200/70 bg-amber-200/15 py-2.5 text-[14px] font-bold"
            >
              いいよ
            </button>
            <button onClick={() => setMode('keys')} className="rounded-full border border-white/20 py-2.5 text-[14px]">
              やめる
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 rounded-2xl bg-black/60 px-4 py-2 text-center text-[12px] text-amber-50/80 backdrop-blur">{mode === 'listen' ? heard || '聞いています……' : `例：${options.join('・')}`}</p>
          <button
            onClick={mode === 'listen' ? () => rec.current?.abort() : tap}
            className={`relative flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 text-white shadow-[0_8px_30px_rgba(60,20,90,0.45)] active:scale-95 ${mode === 'listen' ? 'border-rose-200 bg-gradient-to-b from-rose-400 to-rose-600' : 'animate-[hintGlow_2.2s_ease-in-out_infinite] border-amber-100 bg-gradient-to-b from-amber-300 to-orange-500'}`}
            aria-label="話してみよう"
          >
            {mode === 'listen' && <span className="absolute inset-0 animate-ping rounded-full bg-rose-300/50" />}
            <span className="relative text-4xl">🎙</span>
          </button>
          <p className="mt-2 text-[13px] font-bold tracking-wider text-amber-50">話してみよう</p>
          <button onClick={() => setMode('keys')} className="absolute bottom-[calc(12px+env(safe-area-inset-bottom))] right-4 rounded-lg bg-white/10 px-2 py-1 text-[16px] text-white/60" aria-label="文字で答える">
            ⌨
          </button>
        </>
      )}
    </div>
  );
}
