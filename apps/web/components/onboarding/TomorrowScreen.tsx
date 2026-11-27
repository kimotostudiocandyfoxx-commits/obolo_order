'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { unlockAudio } from '@/lib/onboarding/audio';
import { JOURNEY_WAIT_MS } from '@obolo/shared';
import { playTimeSkip, startDrone, tick } from '@/lib/onboarding/sfx';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const SKIP_SECONDS = 4.8;

/**
 * End of every journey day: "〇〇、また明日。" + a 24-hour countdown with ticking sound.
 * No skipping in the members' app (M-R199, simple version): the countdown only. The review pages pass `canSkip`, and
 * their button skips the wait with the spinning mystical clock.
 */
export function TomorrowScreen({
  name,
  completedAt,
  onUnlocked,
  skipLabel,
  skippedText,
  canSkip = false,
  bati,
  note,
  doneText,
}: {
  /** the day's 〔完了画面〕 words, over the countdown (D08-S011, after the Eclipse day) */
  doneText?: string;
  /** a line under the countdown (D03-S009: the 24 hours are for talking with {bati}) */
  note?: string;
  /** the hatched Bati: a calm way into Bati's room (the Moon) to talk while the day waits (P-BATI-ROOM) */
  bati?: { name: string; image?: string };
  /** the review pages only: the skip button (never in the members' app, M-R199) */
  canSkip?: boolean;
  /** The caption after a skip (default: the door opened). */
  skippedText?: string;
  /** Per-day wording of the skip button (default: m.gate.cantWait = 明日まで待てへん). */
  skipLabel?: string;
  name: string;
  /** When the day was finished (ISO). The wait is 24 h from here. */
  completedAt: string | null;
  /** skipped = the visitor pressed 明日まで待てへん (false = the 24 h passed). */
  onUnlocked: (skipped: boolean) => void;
}) {
  const { m, t } = useI18n();
  const target = useRef((completedAt ? Date.parse(completedAt) : Date.now()) + JOURNEY_WAIT_MS);
  const [left, setLeft] = useState(() => target.current - Date.now());
  const [showButton, setShowButton] = useState(false);
  const [phase, setPhase] = useState<'wait' | 'skip' | 'flash' | 'open'>('wait');
  const [needsTap, setNeedsTap] = useState(false);
  const stopDrone = useRef<(() => void) | null>(null);
  const skipped = useRef(false);
  const tickAlt = useRef(false);

  // countdown + tick every second
  useEffect(() => {
    if (phase !== 'wait') return;
    const id = setInterval(() => {
      const l = target.current - Date.now();
      setLeft(l);
      tick((tickAlt.current = !tickAlt.current));
      if (l <= 0) {
        clearInterval(id);
        setPhase('open');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // sound: works immediately after the story (audio already unlocked); otherwise wait for a tap
  useEffect(() => {
    const ctx = unlockAudio();
    if (ctx?.state === 'running') stopDrone.current = startDrone();
    else setNeedsTap(true);
    const b = setTimeout(() => setShowButton(true), 2600);
    return () => {
      clearTimeout(b);
      stopDrone.current?.();
    };
  }, []);

  const enableSound = () => {
    if (!needsTap) return;
    unlockAudio();
    setNeedsTap(false);
    setTimeout(() => {
      stopDrone.current ??= startDrone();
    }, 50);
  };

  const skip = useCallback(() => {
    skipped.current = true;
    unlockAudio();
    setPhase('skip');
    playTimeSkip(SKIP_SECONDS);
    // roll the digits down to zero with an ease-in curve
    const from = Math.max(0, target.current - Date.now());
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / (SKIP_SECONDS * 1000));
      const eased = k * k * (3 - 2 * k);
      setLeft(from * (1 - eased));
      if (k < 1) requestAnimationFrame(step);
      else {
        setPhase('flash');
        stopDrone.current?.();
        setTimeout(() => setPhase('open'), 900);
      }
    };
    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (phase !== 'open') return;
    const id = setTimeout(() => onUnlocked(skipped.current), 2200);
    return () => clearTimeout(id);
  }, [phase, onUnlocked]);

  // how much of the day has passed: the golden ring fills towards the next day
  const passed = Math.min(1, Math.max(0, 1 - left / JOURNEY_WAIT_MS));
  const sec = Math.max(0, Math.ceil(left / 1000));
  const parts: [string, string][] = [
    [String(Math.floor(sec / 3600)).padStart(2, '0'), '時間'],
    [String(Math.floor((sec % 3600) / 60)).padStart(2, '0'), '分'],
    [String(sec % 60).padStart(2, '0'), '秒'],
  ];
  const R = 118;
  const C = 2 * Math.PI * R;
  return (
    <div
      className="fixed inset-0 z-[100] flex select-none flex-col items-center justify-center overflow-hidden bg-[radial-gradient(120%_80%_at_50%_40%,#141026_0%,#07060d_60%,#000_100%)] px-6 text-center text-white"
      style={{ fontFamily: SERIF }}
      onPointerDown={enableSound}
    >
      <Stars warp={phase === 'skip'} />
      {phase === 'open' ? (
        <div className="relative animate-[fadeUp_1.2s_ease-out]">
          {/* the script's telop only after a skip; the 24 hours waited out open quietly (story chat 2026-10-29) */}
          {skipped.current && <p className="text-2xl tracking-[0.3em] text-amber-50">{skippedText ?? t(m.gate.doorOpened, { name })}</p>}
        </div>
      ) : (
        <>
          <div className={`relative flex flex-col items-center transition-all duration-700 ${phase === 'wait' ? '' : 'scale-[0.97]'}`}>
            {doneText && (
              <p data-testid="day-done-text" className="mb-5 max-w-xs animate-[fadeUp_1.2s_ease-out] text-[15px] leading-relaxed tracking-[0.2em] text-amber-100">
                {doneText}
              </p>
            )}
            <p className="animate-[fadeUp_1.6s_ease-out] text-[19px] tracking-[0.35em] text-amber-50/90">{t(m.gate.seeYouName, { name })}</p>
            <div className="relative mt-8 flex h-[280px] w-[280px] items-center justify-center">
              {/* the eclipse ring: a thin gold circle filling as the day goes by; it spins up on a skip */}
              <svg viewBox="0 0 280 280" className={`absolute inset-0 h-full w-full ${phase === 'skip' ? 'animate-[ringSpin_1.2s_cubic-bezier(.5,0,.2,1)_infinite]' : ''}`} aria-hidden>
                <defs>
                  <linearGradient id="goldArc" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff2c8" />
                    <stop offset="0.5" stopColor="#e2b867" />
                    <stop offset="1" stopColor="#9a6a24" />
                  </linearGradient>
                  <radialGradient id="eclipseGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0.72" stopColor="rgba(255,214,140,0)" />
                    <stop offset="0.84" stopColor="rgba(255,214,140,0.16)" />
                    <stop offset="1" stopColor="rgba(255,214,140,0)" />
                  </radialGradient>
                </defs>
                <circle cx="140" cy="140" r="138" fill="url(#eclipseGlow)" className="animate-[breathe_6s_ease-in-out_infinite]" />
                <circle cx="140" cy="140" r={R} fill="none" stroke="rgba(255,226,170,0.12)" strokeWidth="1" />
                <circle
                  cx="140"
                  cy="140"
                  r={R}
                  fill="none"
                  stroke="url(#goldArc)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeDasharray={`${C * passed} ${C}`}
                  transform="rotate(-90 140 140)"
                  style={{ transition: phase === 'wait' ? 'stroke-dasharray 1s linear' : 'none', filter: 'drop-shadow(0 0 6px rgba(255,210,130,0.7))' }}
                />
                {Array.from({ length: 24 }, (_, i) => {
                  const a = (i / 24) * 2 * Math.PI;
                  return <circle key={i} cx={140 + (R + 9) * Math.sin(a)} cy={140 - (R + 9) * Math.cos(a)} r={i % 6 === 0 ? 1.4 : 0.7} fill="rgba(255,226,170,0.45)" />;
                })}
              </svg>
              <div className="relative flex items-end gap-2.5" style={{ fontFamily: '"Cormorant Garamond", "Shippori Mincho", serif' }}>
                {parts.map(([n, unit]) => (
                  <span key={unit} className="flex items-end gap-0.5">
                    <span className="bg-gradient-to-b from-[#fff6dc] via-[#f0d08c] to-[#b98a3e] bg-clip-text text-[52px] font-light leading-none tabular-nums lining-nums text-transparent drop-shadow-[0_0_14px_rgba(255,214,140,0.35)]">{n}</span>
                    <span className="mb-1.5 text-[11px] tracking-[0.15em] text-amber-100/60" style={{ fontFamily: SERIF }}>
                      {unit}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-6 text-[11px] tracking-[0.4em] text-amber-100/45">つぎの扉が ひらくまで</p>
          </div>

          <div className="pb-safe absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 pb-14">
            {phase === 'wait' && showButton && bati && (
              <Link
                href="/moon"
                className="flex animate-[fadeUp_0.8s_ease-out] items-center gap-3 rounded-full border border-amber-100/25 bg-white/[0.04] py-2 pl-2 pr-7 text-[14px] tracking-[0.2em] text-amber-50/90 backdrop-blur active:scale-95"
              >
                {bati.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bati.image} alt="" className="h-9 w-9 rounded-full bg-amber-50/10 object-contain" />
                ) : (
                  <span className="h-9 w-9 rounded-full border border-amber-100/30" aria-hidden />
                )}
                {bati.name}と話す
              </Link>
            )}
            {phase === 'wait' && showButton && bati && note && <p className="max-w-xs animate-[fadeUp_0.8s_ease-out] text-[11px] leading-relaxed tracking-wider text-amber-100/55">{note}</p>}
            {phase === 'wait' && showButton && canSkip && (
              <button
                onClick={skip}
                className="relative animate-[fadeUp_0.8s_ease-out] overflow-hidden rounded-full border border-amber-200/50 bg-black/40 px-9 py-3.5 text-[15px] tracking-[0.3em] text-amber-50 backdrop-blur active:scale-95"
              >
                <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 animate-[shimmer_3.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-100/25 to-transparent" />
                {skipLabel ?? m.gate.cantWait}
              </button>
            )}
          </div>
          {needsTap && phase === 'wait' && <span className="pt-safe absolute right-4 top-4 text-[11px] tracking-[0.2em] text-white/35">TAP で音</span>}
        </>
      )}
      {/* no sudden light (QA 14 R51): a soft rise to less than half, over half a second */}
      {phase === 'flash' && <div className="pointer-events-none absolute inset-0 animate-[softFlash_1.4s_ease-out_both] bg-amber-50" />}
    </div>
  );
}

/** A quiet field of stars; on a skip, streaks rush outwards from the middle (time rushing past). */
function Stars({ warp }: { warp: boolean }) {
  const stars = useRef(
    Array.from({ length: 70 }, (_, i) => {
      const a = (i * 137.5 * Math.PI) / 180;
      const d = 8 + ((i * 53) % 46);
      return { x: 50 + d * Math.cos(a), y: 50 + d * Math.sin(a) * 1.4, s: 0.6 + ((i * 7) % 10) / 10, deg: (i * 137.5) % 360, delay: (i % 14) * 0.07 };
    }),
  ).current;
  if (warp)
    return (
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {stars.map((st, i) => (
          // a spoke from the centre, turned to its angle; the streak runs out along it
          <span key={i} className="absolute left-1/2 top-[45%] h-0 w-0" style={{ transform: `rotate(${st.deg}deg)` }}>
            <span className="absolute -left-px block h-10 w-[1.5px] rounded-full bg-gradient-to-b from-transparent via-amber-50 to-transparent" style={{ animation: `warpOut 0.85s ${st.delay}s cubic-bezier(.5,0,1,1) infinite` }} />
          </span>
        ))}
      </div>
    );
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {stars.map((st, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-amber-50"
          style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s * 1.6, height: st.s * 1.6, opacity: 0.25 + st.s * 0.35, animation: `twinkle ${3 + (i % 5)}s ${i * 0.13}s ease-in-out infinite` }}
        />
      ))}
    </div>
  );
}
