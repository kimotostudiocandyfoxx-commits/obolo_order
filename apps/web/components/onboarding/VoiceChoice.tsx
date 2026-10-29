'use client';

import { useEffect, useRef, useState } from 'react';
import { ReplyChips } from '@/components/story/Chat';

/**
 * A choice answered by voice (D01-S006, story M-R169): a big mic button 〔話してみよう〕 with the answers as a small
 * example; the corner ⌨ (for when one cannot speak) shows them as buttons. A tap listens at once — the phone asks for
 * the mic itself (client 2026-10-29: the 「声は残しません…［いいよ］［やめる］」 step is gone). What is heard is matched to
 * the nearest answer (the browser's own speech recognition; nothing is sent or kept). A miss stays on the mic with a
 * word of why (it used to drop to the buttons, which looked like the old choice coming back); only a mic that cannot
 * be used goes to the buttons, saying so.
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
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

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
  // 「秘密結社は、初めてか？」〔1回目〕〔2回目〕〔3回目以上〕 (client 2026-10-29): counts said any way
  if (options.length === 3 && options.every((o) => o.includes('回目'))) {
    if (/[3-9３-９]|三|四|五|六|七|八|九|十|さん|よん|何回|なんかい|何度|たくさん|いっぱい|以上|いじょう/.test(h)) return 2;
    if (/[2２]|二|にかい|にど|二度|いいえ|ちがう|違う|初めてじゃない|はじめてじゃない/.test(h)) return 1;
    return 0;
  }
  const neg = /たくない|いかない|行かない|いや|嫌|むり|無理|やだ/.test(h);
  const unsure = /わかん|わから|分から|まだ|どう|かな|迷/.test(h);
  const yes = /行き|いき|いく|行く|たい|うん|はい|もちろん|ぜひ/.test(h);
  const find = (re: RegExp) => options.findIndex((o) => re.test(o));
  if (neg) return Math.max(0, find(/たくない|ない$/));
  if (unsure) return Math.max(0, find(/わかん|まだ/));
  if (yes) return Math.max(0, find(/^行きたい$|たい$/));
  return Math.max(0, find(/わかん|まだ/));
}

export function VoiceChoice({ options, onPick }: { options: string[]; onPick: (k: number, words?: string) => void }) {
  const [mode, setMode] = useState<'mic' | 'listen' | 'keys'>('mic');
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState('');
  const rec = useRef<Rec | null>(null);
  const done = useRef(false);
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
    // iOS ends a one-shot recognition almost at once: listen on and stop ourselves after a short quiet
    r.continuous = true;
    let said = '';
    let quiet: ReturnType<typeof setTimeout> | undefined;
    let blocked = false;
    r.onresult = (e) => {
      const all = Array.from(e.results);
      said = all.map((x) => x[0].transcript).join('');
      setHeard(said);
      clearTimeout(quiet);
      quiet = setTimeout(() => r.abort(), all[all.length - 1]?.isFinal ? 400 : 1400);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') blocked = true;
    };
    const timer = setTimeout(() => r.abort(), 9000);
    r.onend = () => {
      clearTimeout(timer);
      clearTimeout(quiet);
      rec.current = null;
      if (said.trim() && !done.current) {
        done.current = true;
        const k = matchAnswer(said, options);
        setTimeout(() => onPick(k, said.trim().slice(0, 120)), 500);
        return;
      }
      if (blocked) {
        setNote('マイクが使えないので、ボタンで選んでください');
        setMode('mic');
        setTimeout(() => setMode('keys'), 1800);
        return;
      }
      setNote('うまく聞き取れませんでした。もう一度どうぞ');
      setMode('mic');
    };
    rec.current = r;
    setHeard('');
    setNote('');
    setMode('listen');
    try {
      r.start();
    } catch {
      setMode('keys');
    }
  };

  if (mode === 'keys') return <ReplyChips options={options} onPick={onPick} />;
  const on = mode === 'listen';
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-5 pb-8">
      <p className="mb-4 min-h-[2rem] rounded-full border border-amber-200/15 bg-black/55 px-4 py-1.5 text-center text-[12px] tracking-[0.08em] text-amber-50/85 backdrop-blur" style={{ fontFamily: SERIF }}>
        {on ? heard || '聞いています……' : note || `例：${options.join('・')}`}
      </p>
      <button onClick={on ? () => rec.current?.abort() : listen} className="relative flex h-24 w-24 items-center justify-center rounded-full active:scale-95" aria-label="話してみよう">
        {/* rings of light going out while it listens; a slow breath while it waits */}
        {on ? (
          [0, 0.6, 1.2].map((d) => <span key={d} className="absolute inset-0 rounded-full border border-amber-200/70" style={{ animation: `micRing 1.8s ${d}s ease-out infinite` }} />)
        ) : (
          <span className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,206,120,0.28),transparent_70%)]" style={{ animation: 'micBreath 2.6s ease-in-out infinite' }} />
        )}
        <span className={`absolute inset-0 rounded-full border transition-colors duration-300 ${on ? 'border-amber-100 bg-[radial-gradient(circle_at_50%_35%,rgba(255,214,140,0.35),rgba(40,26,8,0.92)_70%)] shadow-[0_0_34px_rgba(255,204,120,0.65)]' : 'border-amber-200/70 bg-[radial-gradient(circle_at_50%_30%,rgba(70,48,18,0.95),rgba(8,6,12,0.95)_72%)] shadow-[0_0_22px_rgba(255,204,120,0.3)]'}`} />
        <span className="absolute inset-[7px] rounded-full border border-amber-200/25" />
        <svg viewBox="0 0 24 24" className={`relative h-9 w-9 transition-colors ${on ? 'text-amber-50' : 'text-amber-200'}`} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? 'currentColor' : 'none'} />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21M9 21h6" />
        </svg>
      </button>
      <p className="mt-3 text-[12px] tracking-[0.4em] text-amber-100/90" style={{ fontFamily: SERIF }}>
        {on ? '話してください' : '話してみよう'}
      </p>
      <button onClick={() => setMode('keys')} className="absolute bottom-[calc(12px+env(safe-area-inset-bottom))] right-4 rounded-lg bg-white/10 px-2 py-1 text-[16px] text-white/60" aria-label="文字で答える">
        ⌨
      </button>
    </div>
  );
}
