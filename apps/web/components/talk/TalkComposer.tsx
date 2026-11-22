'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MicGlyph, SendGlyph } from '@/components/dachi/HoldMic';
import { micTrouble, useDictation } from '@/lib/useDictation';

/**
 * The talk's bottom (M-R232 §3): the mic button in the middle; the keyboard only when answering in letters (⌨ at the
 * side). What is heard shows above the mic with 〔送る〕. `onState` tells the talk when you are speaking or typing (the
 * others turn to you) and when the keyboard is up (the people go chest up and move up).
 */
export function TalkComposer({
  onSend,
  placeholder,
  disabled = false,
  maxLength = 2000,
  onState,
  side,
  initial = '',
  startTyping = false,
}: {
  onSend: (text: string) => void | Promise<void>;
  placeholder: string;
  disabled?: boolean;
  maxLength?: number;
  onState?: (s: { listening: boolean; keyboard: boolean }) => void;
  /** something small at the left of the mic (〔作品を送る〕 …) */
  side?: ReactNode;
  initial?: string;
  /** open with the keyboard (the review page) */
  startTyping?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [typing, setTyping] = useState(startTyping);
  const [focus, setFocus] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const mic = useDictation({ field, value: text, onChange: setText, maxLength });
  useEffect(() => {
    onState?.({ listening: mic.listening || (typing && !!text.trim()), keyboard: typing && focus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.listening, typing, focus, text]);
  const go = async () => {
    const t = text.trim();
    if (!t || disabled) return;
    if (mic.listening) mic.toggle();
    setText('');
    await onSend(t);
  };
  const trouble = micTrouble(mic.code);

  if (typing)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
        className="pb-safe flex items-center gap-2 px-3 pb-2.5 pt-2"
      >
        <button type="button" onClick={() => setTyping(false)} aria-label="声で話す" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-200/35 bg-black/40 text-amber-100">
          <MicGlyph />
        </button>
        <input
          ref={field}
          autoFocus
          value={text}
          maxLength={maxLength}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-full border border-amber-200/30 bg-[rgba(12,9,22,0.82)] px-4 text-[15px] text-amber-50 outline-none placeholder:text-amber-50/35"
        />
        <button disabled={!text.trim() || disabled} aria-label="送る" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fbe9b7] to-[#d79d45] text-[#2b1b06] disabled:opacity-35">
          <SendGlyph />
        </button>
      </form>
    );

  return (
    <div className="pb-safe relative flex flex-col items-center px-3 pb-3 pt-1">
      {/* what was heard, with 〔送る〕 */}
      {(text.trim() || mic.interim) && (
        <div className="mb-2 flex w-full max-w-sm items-center gap-2 rounded-2xl border border-amber-200/25 bg-[rgba(12,9,22,0.82)] px-3 py-2 backdrop-blur">
          <p className="min-w-0 flex-1 text-[14px] leading-snug text-amber-50/90">
            {text}
            <span className="text-amber-50/45">{mic.interim}</span>
          </p>
          {text.trim() && !mic.listening && (
            <>
              <button onClick={() => setText('')} aria-label="けす" className="text-[12px] text-amber-50/55">
                けす
              </button>
              <button onClick={() => void go()} disabled={disabled} className="rounded-full bg-gradient-to-br from-[#fbe9b7] to-[#d79d45] px-3 py-1.5 text-[13px] font-bold text-[#2b1b06] disabled:opacity-40">
                送る
              </button>
            </>
          )}
        </div>
      )}
      {trouble && <p className="mb-1.5 text-center text-[11px] text-amber-100/70">{trouble}</p>}
      <div className="relative flex w-full items-center justify-center">
        {side && <div className="absolute left-0 top-1/2 -translate-y-1/2">{side}</div>}
        {/* the hidden field the dictation writes into */}
        <input ref={field} value={text} onChange={(e) => setText(e.target.value)} className="sr-only" tabIndex={-1} aria-hidden />
        <button
          onClick={() => (mic.supported ? mic.toggle() : setTyping(true))}
          disabled={disabled}
          aria-label={mic.listening ? '話し終わる' : '話す'}
          className={`relative flex h-[66px] w-[66px] items-center justify-center rounded-full text-[#2b1b06] shadow-[0_6px_22px_rgba(0,0,0,0.45)] transition active:scale-95 disabled:opacity-40 ${mic.listening ? 'bg-gradient-to-br from-rose-300 to-pink-500 text-white' : 'bg-gradient-to-br from-[#fbe9b7] via-[#f0c873] to-[#d79d45]'}`}
        >
          {mic.listening && <span className="absolute inset-0 animate-ping rounded-full bg-pink-400/35" />}
          <MicGlyph className="relative h-7 w-7" />
        </button>
        <button onClick={() => setTyping(true)} aria-label="文字で答える" className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200/30 bg-black/40 text-[15px] text-amber-100/85">
          ⌨
        </button>
      </div>
    </div>
  );
}
