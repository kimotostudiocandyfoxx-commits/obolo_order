'use client';

import { useEffect, useRef, useState } from 'react';
import { useHoldRecorder } from '@/lib/dachi/useHoldRecorder';

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
 */
export function HoldMic({
  onSend,
  sendLabel = '送る',
  disabled,
  hint = '押している間だけ、録音されます',
  left,
}: {
  onSend: (blob: Blob, seconds: number) => Promise<void>;
  sendLabel?: string;
  disabled?: boolean;
  hint?: string;
  /** something at the bar's left (the work-card button in a thread) */
  left?: React.ReactNode;
}) {
  const r = useHoldRecorder();
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
    : r.error === 'denied'
      ? 'マイクを許可してね（設定 → Safari → マイク）'
      : r.error === 'unsupported'
        ? 'この端末では録音できません'
        : r.recording
          ? `録音中… ${r.elapsed}秒（最長${r.maxSec}秒）`
          : r.tooShort
            ? 'もう少し長く、押したまま話してね'
            : r.take
              ? '聞き直してから、送れます'
              : hint;

  return (
    <div className="pb-safe px-3" style={{ fontFamily: SERIF }}>
      <div className="mx-auto mb-3 max-w-md">
        <p className={`mb-1.5 min-h-[18px] px-2 text-right text-xs ${err || r.error ? 'text-rose-300' : 'text-amber-100/60'}`}>{note}</p>
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
                r.press();
              }}
              onPointerUp={r.release}
              onPointerCancel={r.release}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative flex h-12 w-12 shrink-0 touch-none select-none items-center justify-center rounded-full border text-amber-100 transition disabled:opacity-35 ${r.recording ? 'scale-110 border-rose-300 bg-rose-400/30' : 'border-amber-200/40 bg-white/5'}`}
            >
              {r.recording && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/30" />}
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
  const el = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = () => setOn(false);
    a.onpause = () => setOn(false);
    el.current = a;
    return () => {
      a.pause();
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  return (
    <button
      type="button"
      onClick={() => {
        const a = el.current;
        if (!a) return;
        if (on) return a.pause();
        a.currentTime = 0;
        void a.play().then(() => setOn(true)).catch(() => setOn(false));
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
