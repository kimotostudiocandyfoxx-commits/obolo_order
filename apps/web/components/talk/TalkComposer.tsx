'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MicGlyph, SendGlyph } from '@/components/dachi/HoldMic';
import { MicNotice } from '@/components/mic/MicCheck';
import { micAdvice, type MicPath } from '@/lib/mic/core';
import { currentEnv } from '@/lib/mic/env';
import type { HearPhase } from '@/lib/mic/hear';
import { useDictation } from '@/lib/useDictation';
import { bargeIn } from '@/lib/voice/barge';

/**
 * The talk's bottom (M-R232 §3): the mic button in the middle; the keyboard only when answering in letters (⌨ at the
 * side). What is heard shows above the mic with 〔送る〕. `onState` tells the talk when you are speaking or typing (the
 * others turn to you) and when the keyboard is up (the people go chest up and move up).
 *
 * Client 2026-11-27 (phones: 「マイクが反応しないことが多い」): the mic never opens the keyboard by itself any more — where
 * the browser has no speech recognition (iPhone Chrome, in-app browsers) it records and the server makes the words
 * (lib/mic/hear.ts). While it listens a ring follows the loudness and a line says what it is doing; when it cannot,
 * one line says what to do, with 〔マイクをためす〕.
 */
/** PROVISIONAL wording: what the mic is doing now */
export const MIC_PHASE_WORDS: Record<HearPhase, string> = {
  opening: 'マイクをひらいているよ…',
  listening: '聞いているよ。話してね',
  hearing: '聞こえているよ',
  thinking: '文字にしているよ…',
};
export function TalkComposer({
  onSend,
  placeholder,
  disabled = false,
  maxLength = 2000,
  onState,
  side,
  initial = '',
  startTyping = false,
  onVoice,
  hint,
  micPath = 'bati',
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
  /** the mic button beside the field goes back to the caller's own mic (the ダチ talk's held mic) instead of dictation */
  onVoice?: () => void;
  /** R18: the talk is resting ({bati} has no mana / is tired): a calm hint where the mic and typing are (not an error) */
  hint?: string;
  /** where this mic is (the diagnostics) */
  micPath?: MicPath;
}) {
  const [text, setText] = useState(initial);
  const [typing, setTyping] = useState(startTyping);
  const [focus, setFocus] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const mic = useDictation({ field, value: text, onChange: setText, maxLength, path: micPath });
  // this browser has no mic way at all: said in a line (the keyboard is one tap away, never opened by itself)
  const [noMic, setNoMic] = useState(false);
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
  const advice = mic.listening ? null : (mic.advice ?? (noMic ? micAdvice('unsupported', currentEnv()) : null));
  // the ring around the mic: the real loudness (the recorder), or a set size while the recogniser hears a voice
  const loud = !mic.listening ? 0 : mic.level !== null ? Math.min(1, mic.level * 1.5) : mic.phase === 'hearing' ? 0.6 : 0.12;

  if (hint)
    return (
      <div className="pb-safe flex flex-col items-center px-4 pb-[18px] pt-1" data-testid="composer-rest">
        <div aria-disabled="true" className="grid h-[74px] w-[74px] place-items-center rounded-full text-[#070b24] opacity-30" style={{ background: 'radial-gradient(circle at 35% 30%,#ffffff,#cdd8ff 55%,#9fb2ff)' }}>
          <MicGlyph className="h-[30px] w-[30px]" />
        </div>
        <p className="mt-2 max-w-sm text-center text-[12px] leading-relaxed text-[#cdd3f5]/80">{hint}</p>
      </div>
    );

  if (typing)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
        className="pb-safe flex items-center gap-2 px-3 pb-2.5 pt-2"
      >
        <button type="button" onClick={() => (onVoice ? onVoice() : setTyping(false))} aria-label="声で話す" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] backdrop-blur-[10px] text-[#f4f1ff]">
          <MicGlyph />
        </button>
        <input
          ref={field}
          autoFocus
          value={text}
          maxLength={maxLength}
          onChange={(e) => {
            // R14: starting to type takes the turn (a voice still speaking stops)
            if (!text && e.target.value) bargeIn();
            setText(e.target.value);
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] backdrop-blur-[10px] px-4 text-[16px] font-bold text-[#f4f1ff] outline-none placeholder:text-[#b9bde6]/60"
        />
        <button disabled={!text.trim() || disabled} aria-label="送る" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#070b24] disabled:opacity-35" style={{ background: 'radial-gradient(circle at 35% 30%,#ffffff,#cdd8ff 55%,#9fb2ff)' }}>
          <SendGlyph />
        </button>
      </form>
    );

  return (
    <div className="pb-safe relative flex flex-col items-center px-4 pb-[18px] pt-1">
      {/* what was heard, with 〔送る〕 */}
      {(text.trim() || mic.interim) && (
        <div className="mb-2 flex w-full max-w-sm items-center gap-2 rounded-2xl border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] backdrop-blur-[10px] px-3 py-2">
          <p className="min-w-0 flex-1 text-[14px] font-bold leading-snug text-[#f4f1ff]">
            {text}
            <span className="text-[#b9bde6]">{mic.interim}</span>
          </p>
          {text.trim() && !mic.listening && (
            <>
              <button onClick={() => setText('')} aria-label="けす" className="text-[12px] text-amber-50/55">
                けす
              </button>
              <button onClick={() => void go()} disabled={disabled} className="rounded-full bg-[#dfe6ff] px-3 py-1.5 text-[13px] font-bold text-[#070b24] disabled:opacity-40">
                送る
              </button>
            </>
          )}
        </div>
      )}
      <MicNotice advice={advice} className="mb-2 max-w-sm text-center text-[12px] leading-relaxed text-amber-100/90 [text-shadow:0_1px_4px_#000]" linkClass="ml-1 rounded-full border border-amber-100/50 px-2 py-0.5 text-[11px] font-bold text-amber-50" />
      {mic.listening && mic.phase && (
        <p className="mb-2 text-center text-[12px] font-bold text-[#dfe6ff] [text-shadow:0_1px_4px_#000]" data-testid="mic-phase" data-phase={mic.phase} data-engine={mic.engine ?? ''} role="status">
          {MIC_PHASE_WORDS[mic.phase]}
          {mic.engine === 'record' && (mic.phase === 'listening' || mic.phase === 'hearing') && <span className="ml-1 font-normal text-[#b9bde6]">（話し終わったら、もう一度タップ）</span>}
        </p>
      )}
      <div className="relative flex w-full items-center justify-center">
        {side && <div className="absolute left-0 top-1/2 -translate-y-1/2">{side}</div>}
        {/* the hidden field the dictation writes into */}
        <input ref={field} value={text} onChange={(e) => setText(e.target.value)} className="sr-only" tabIndex={-1} aria-hidden />
        {/* it hears you: a ring that grows with the loudness */}
        {mic.listening && <span aria-hidden data-testid="mic-ring" className="pointer-events-none absolute left-1/2 top-1/2 h-[74px] w-[74px] rounded-full border-2 border-[#ffd0dc]/70 bg-[rgba(255,170,190,.14)]" style={{ transform: `translate(-50%,-50%) scale(${(1.12 + loud * 0.75).toFixed(3)})`, transition: 'transform 90ms linear', opacity: mic.phase === 'thinking' ? 0.35 : 1 }} />}
        {/* the prototype's big glowing mic (design/talk/proto.html .mic) */}
        <button
          data-testid="talk-mic"
          onClick={() => {
            // R14 (client 2026-11-25): the mic pressed while {bati} speaks — {bati} stops, its words show whole, you talk
            if (!mic.listening) bargeIn({ mic: true });
            if (mic.supported) mic.toggle();
            else setNoMic(true);
          }}
          disabled={disabled}
          aria-label={mic.listening ? '話し終わる' : '話す'}
          className="relative grid h-[74px] w-[74px] place-items-center rounded-full text-[#070b24] transition active:scale-95 disabled:opacity-40"
          style={{ background: 'radial-gradient(circle at 35% 30%,#ffffff,#cdd8ff 55%,#9fb2ff)', boxShadow: '0 0 0 6px rgba(223,230,255,.16),0 0 32px rgba(160,180,255,.55)', animation: mic.listening ? 'talk-pulse 1.2s ease-in-out infinite' : undefined }}
        >
          <MicGlyph className="h-[30px] w-[30px]" />
        </button>
        <button onClick={() => (bargeIn(), setTyping(true))} aria-label="文字で答える" className="absolute right-0 top-1/2 grid h-[42px] w-[42px] -translate-y-1/2 place-items-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] backdrop-blur-[10px] text-[15px] text-[#f4f1ff]">
          ⌨
        </button>
      </div>
    </div>
  );
}
