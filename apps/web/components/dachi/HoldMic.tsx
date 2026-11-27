'use client';

import { useEffect, useRef, useState } from 'react';
import { useHoldRecorder } from '@/lib/dachi/useHoldRecorder';
import { playClip, type Clip } from '@/lib/voice/webVoice';
import { bargeIn } from '@/lib/voice/barge';
import { MicNotice } from '@/components/mic/MicCheck';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** the mic glyph of the story's message bar (components/story/Chat.tsx MessageBar) */
export function MicGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

/** the send arrow of the story's message bar */
export function SendGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#2b1b06]" aria-hidden>
      <path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z" />
    </svg>
  );
}

/**
 * Hold-to-record voice (M-R212): records only while pressed; on release the take can be heard back, then 〔送る〕 or
 * 〔けす〕. Used in the ダチ threads and for the invitation's voice note. `onSend` gets the take (throw to keep it).
 *
 * Client 2026-11-27 (phones: 「マイクが反応しないことが多い」): while it records, a ring around the mic follows the
 * loudness (it hears you); a mic that would not open says what is wrong on this phone and browser (it used to say
 * 「設定 → Safari → マイク」 for every failure, also in Chrome and on Android) with 〔マイクをためす〕; a take with no sound
 * in it is not offered for sending. The first press of a visit only asks for the microphone: the line then says to
 * press again.
 */
export function HoldMic({
  onSend,
  sendLabel = '送る',
  disabled,
  hint = '押している間だけ、録音されます',
  left,
  right,
  big = false,
}: {
  onSend: (blob: Blob, seconds: number) => Promise<void>;
  sendLabel?: string;
  disabled?: boolean;
  hint?: string;
  /** something at the bar's left (the work-card button in a thread) */
  left?: React.ReactNode;
  /** something at the bar's right, in the big layout (the ダチ talk's keyboard button) */
  right?: React.ReactNode;
  /** the talk's dock (M-R232, design/talk/proto.html): the big glowing mic in the middle */
  big?: boolean;
}) {
  const r = useHoldRecorder(undefined, 'dachi-voice');
  // the ring around the mic while it records: the loudness now
  const loud = r.recording ? Math.min(1, r.level * 1.5) : 0;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // a pointer that leaves the button (or the page losing focus) also lets go
  useEffect(() => {
    if (!r.recording) return;
    const up = () => r.release();
    window.addEventListener('pointerup', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur', up);
    };
  }, [r.recording, r.release]);

  const send = async () => {
    if (!r.take) return;
    setBusy(true);
    setErr(null);
    try {
      await onSend(r.take.blob, r.take.seconds);
      r.discard();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const note = err
    ? err
    : r.advice
      ? null
      : r.asked
        ? 'マイクが使えるようになったよ。もう一度、押したまま話してね'
        : r.recording
          ? `録音中… ${r.elapsed}秒（最長${r.maxSec}秒）`
          : r.tooShort
            ? 'もう少し長く、押したまま話してね'
            : r.take
              ? '聞き直してから、送れます'
              : hint;

  return (
    <div className="pb-safe px-3" style={{ fontFamily: big ? undefined : SERIF }}>
      <div className={`mx-auto max-w-md ${big ? 'mb-[14px]' : 'mb-3'}`}>
        {note === null ? (
          <MicNotice advice={r.advice} className={`mb-1.5 min-h-[18px] px-2 text-xs leading-relaxed text-rose-200 ${big ? 'text-center [text-shadow:0_1px_4px_#000]' : 'text-right'}`} linkClass="ml-1 rounded-full border border-rose-200/60 px-2 py-0.5 text-[11px] font-bold text-rose-50" />
        ) : (
          <p className={`mb-1.5 min-h-[18px] px-2 text-xs ${big ? 'text-center [text-shadow:0_1px_4px_#000]' : 'text-right'} ${err ? 'text-rose-300' : big ? 'text-[#b9bde6]' : 'text-amber-100/60'}`} data-testid="holdmic-note">{note}</p>
        )}
        {r.take ? (
          <div className="flex items-center gap-2 rounded-full border border-amber-200/30 bg-[rgba(16,11,26,0.72)] p-1.5 pl-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <TakePlayer blob={r.take.blob} seconds={r.take.seconds} />
            <button type="button" onClick={r.discard} disabled={busy} className="shrink-0 rounded-full border border-white/15 px-3 py-2 text-[13px] text-white/70 disabled:opacity-40">
              けす
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              aria-label={sendLabel}
              className="flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] text-[#2b1b06] transition active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #fbe9b7, #d79d45)' }}
            >
              {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2b1b06]/30 border-t-[#2b1b06]" /> : <SendGlyph />}
              {sendLabel}
            </button>
          </div>
        ) : big ? (
          <div className="relative flex items-center justify-center pb-1 pt-1">
            <div className="absolute left-1 top-1/2 -translate-y-1/2">{left}</div>
            {right && <div className="absolute right-1 top-1/2 -translate-y-1/2">{right}</div>}
            {r.recording && <span aria-hidden data-testid="mic-ring" className="pointer-events-none absolute left-1/2 top-1/2 h-[74px] w-[74px] rounded-full border-2 border-[#ffd0dc]/70 bg-[rgba(255,170,190,.14)]" style={{ transform: `translate(-50%,-50%) scale(${(1.15 + loud * 0.8).toFixed(3)})`, transition: 'transform 90ms linear' }} />}
            <button
              data-testid="hold-mic"
              type="button"
              disabled={disabled}
              aria-label="押している間、録音"
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                setErr(null);
                // R14: the member takes the turn — a voice still speaking stops (its words show whole)
                bargeIn({ mic: true });
                r.press();
              }}
              onPointerUp={r.release}
              onPointerCancel={r.release}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative grid h-[74px] w-[74px] touch-none select-none place-items-center rounded-full text-[#070b24] transition disabled:opacity-35 ${r.recording ? 'scale-105' : ''}`}
              style={{ background: 'radial-gradient(circle at 35% 30%,#ffffff,#cdd8ff 55%,#9fb2ff)', boxShadow: r.recording ? '0 0 0 14px rgba(255,170,190,.14),0 0 48px rgba(255,150,180,.8)' : '0 0 0 6px rgba(223,230,255,.16),0 0 32px rgba(160,180,255,.55)' }}
            >
              <MicGlyph className="h-[30px] w-[30px]" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-amber-200/30 bg-[rgba(16,11,26,0.72)] p-1.5 pl-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
            <button
              type="button"
              disabled={disabled}
              aria-label="押している間、録音"
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                setErr(null);
                // R14: the member takes the turn — a voice still speaking stops (its words show whole)
                bargeIn({ mic: true });
                r.press();
              }}
              onPointerUp={r.release}
              onPointerCancel={r.release}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative flex h-12 w-12 shrink-0 touch-none select-none items-center justify-center rounded-full border text-amber-100 transition disabled:opacity-35 ${r.recording ? 'scale-110 border-rose-300 bg-rose-400/30' : 'border-amber-200/40 bg-white/5'}`}
            >
              {r.recording && <span data-testid="mic-ring" className="absolute inset-0 rounded-full border border-rose-200/70 bg-rose-400/25" style={{ transform: `scale(${(1.1 + loud * 0.7).toFixed(3)})`, transition: 'transform 90ms linear' }} />}
              <MicGlyph className="relative h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** listen back to a take before sending it */
function TakePlayer({ blob, seconds }: { blob: Blob; seconds: number }) {
  const [on, setOn] = useState(false);
  const url = useRef<string | null>(null);
  const clip = useRef<Clip | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    url.current = u;
    return () => {
      clip.current?.stop();
      URL.revokeObjectURL(u);
    };
  }, [blob]);
  return (
    <button
      type="button"
      onClick={async () => {
        // M-R239: through Web Audio (quiet with the silent switch on)
        if (on) {
          clip.current?.stop();
          return setOn(false);
        }
        const c = url.current ? await playClip(url.current) : null;
        if (!c) return;
        clip.current = c;
        setOn(true);
        void c.done.then(() => setOn(false));
      }}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-2 py-1.5 text-left text-amber-50"
      aria-label={on ? '止める' : '聞き直す'}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm">{on ? '❚❚' : '▶'}</span>
      <Wave active={on} />
      <span className="shrink-0 text-xs text-amber-100/70">{Math.max(1, Math.round(seconds))}秒</span>
    </button>
  );
}

/** a few bars standing for the voice (no real waveform) */
export function Wave({ active, light }: { active?: boolean; light?: boolean }) {
  const bars = [5, 9, 13, 8, 15, 10, 6, 12, 9, 5, 11, 7];
  return (
    <span className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
      {bars.map((h, k) => (
        <span
          key={k}
          className={`w-[3px] shrink-0 rounded-full ${light ? 'bg-[#2b1b06]/60' : 'bg-amber-100/70'}`}
          style={{ height: h, animation: active ? `typingDot 0.9s ${k * 0.07}s ease-in-out infinite` : undefined }}
        />
      ))}
    </span>
  );
}
