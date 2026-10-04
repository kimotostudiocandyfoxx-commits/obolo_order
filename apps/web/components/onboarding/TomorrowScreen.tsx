'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { unlockAudio } from '@/lib/onboarding/audio';
import { DAY_WAIT_MS } from '@/lib/onboarding/progress';
import { playTimeSkip, startDrone, tick } from '@/lib/onboarding/sfx';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const SKIP_SECONDS = 4.8;
// U+FE0E forces the monochrome text glyph instead of the colour emoji.
const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map((z) => `${z}\uFE0E`);

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

/**
 * End of Day 1: "〇〇、また明日。" + a 24-hour countdown with ticking sound.
 * "明日まで待てへん" skips the wait with a spinning mystical clock.
 * PLACEHOLDER (P-OB-3): the skip is free and unlimited for now; it may later cost MANA.
 */
export function TomorrowScreen({
  name,
  completedAt,
  onUnlocked,
}: {
  name: string;
  /** When Day 1 was finished (ISO). The wait is 24 h from here. */
  completedAt: string | null;
  onUnlocked: () => void;
}) {
  const { m, t } = useI18n();
  const target = useRef((completedAt ? Date.parse(completedAt) : Date.now()) + DAY_WAIT_MS);
  const [left, setLeft] = useState(() => target.current - Date.now());
  const [showButton, setShowButton] = useState(false);
  const [phase, setPhase] = useState<'wait' | 'skip' | 'flash' | 'open'>('wait');
  const [needsTap, setNeedsTap] = useState(false);
  const stopDrone = useRef<(() => void) | null>(null);
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
    const id = setTimeout(onUnlocked, 2200);
    return () => clearTimeout(id);
  }, [phase, onUnlocked]);

  return (
    <div
      className="fixed inset-0 z-[100] flex select-none flex-col items-center justify-center overflow-hidden bg-black px-6 text-center text-white"
      style={{ fontFamily: SERIF }}
      onPointerDown={enableSound}
    >
      {phase === 'open' ? (
        <div className="animate-[fadeUp_1.2s_ease-out]">
          <p className="text-2xl tracking-[0.25em] text-amber-50">{t(m.gate.doorOpened, { name })}</p>
        </div>
      ) : (
        <>
          <div className={`transition-all duration-700 ${phase === 'wait' ? '' : '-translate-y-6 scale-95 opacity-60'}`}>
            <p className="animate-[fadeUp_1.6s_ease-out] text-[22px] tracking-[0.2em] text-amber-50">{t(m.gate.seeYouName, { name })}</p>
            <p
              className="mt-6 font-mono text-5xl tabular-nums tracking-[0.12em] text-amber-100 drop-shadow-[0_0_18px_rgba(255,214,140,0.45)]"
              style={{ fontFamily: '"SF Mono", ui-monospace, Menlo, monospace' }}
            >
              {fmt(left)}
            </p>
          </div>

          {phase !== 'wait' && <MysticClock seconds={SKIP_SECONDS} />}

          <div className="pb-safe absolute inset-x-0 bottom-0 flex justify-center pb-14">
            {phase === 'wait' && showButton && (
              <button
                onClick={skip}
                className="animate-[fadeUp_0.8s_ease-out] rounded-full border border-amber-200/70 bg-black px-8 py-3.5 text-[17px] tracking-[0.2em] text-amber-50 shadow-[0_0_28px_rgba(255,210,130,0.3)] active:scale-95"
              >
                {m.gate.cantWait}
              </button>
            )}
          </div>
          {needsTap && phase === 'wait' && (
            <span className="pt-safe absolute right-4 top-4 text-xs text-white/35">🔊 TAP</span>
          )}
        </>
      )}
      {phase === 'flash' && <div className="pointer-events-none absolute inset-0 animate-[flash_0.9s_ease-out] bg-amber-50" />}
    </div>
  );
}

/** The time-skip clock: zodiac ring + hands that spin faster and faster. */
function MysticClock({ seconds }: { seconds: number }) {
  return (
    <div className="pointer-events-none mt-8 animate-[clockIn_0.9s_ease-out] drop-shadow-[0_0_30px_rgba(255,200,110,0.55)]">
      <svg viewBox="0 0 200 200" className="h-64 w-64 sm:h-80 sm:w-80" aria-hidden>
        <defs>
          <radialGradient id="face" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#3a2a12" />
            <stop offset="1" stopColor="#0a0704" />
          </radialGradient>
        </defs>
        <g style={{ transformOrigin: '100px 100px', animation: `spinRev ${seconds * 2}s linear infinite` }}>
          <circle cx="100" cy="100" r="96" fill="none" stroke="#d9b46a" strokeWidth="1.2" />
          <circle cx="100" cy="100" r="84" fill="none" stroke="#d9b46a" strokeOpacity=".5" strokeWidth=".6" strokeDasharray="2 3" />
          {ZODIAC.map((z, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            return (
              <text key={z} x={100 + 90 * Math.cos(a)} y={100 + 90 * Math.sin(a) + 3} fontSize="9" fill="#f3d998" textAnchor="middle" fontFamily="'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols', serif">
                {z}
              </text>
            );
          })}
        </g>
        <circle cx="100" cy="100" r="78" fill="url(#face)" stroke="#d9b46a" strokeWidth="1.5" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = ((i * 6) * Math.PI) / 180;
          const r1 = i % 5 === 0 ? 66 : 71;
          return (
            <line
              key={i}
              x1={100 + r1 * Math.sin(a)}
              y1={100 - r1 * Math.cos(a)}
              x2={100 + 75 * Math.sin(a)}
              y2={100 - 75 * Math.cos(a)}
              stroke="#e8c77d"
              strokeWidth={i % 5 === 0 ? 1.6 : 0.6}
            />
          );
        })}
        <g style={{ transformOrigin: '100px 100px', animation: `spinRev ${seconds * 3}s linear infinite` }}>
          <circle cx="100" cy="100" r="40" fill="none" stroke="#d9b46a" strokeOpacity=".35" strokeWidth=".8" />
          <polygon points="100,62 104,100 100,138 96,100" fill="none" stroke="#d9b46a" strokeOpacity=".35" strokeWidth=".6" />
          <polygon points="62,100 100,96 138,100 100,104" fill="none" stroke="#d9b46a" strokeOpacity=".35" strokeWidth=".6" />
        </g>
        {/* hour hand */}
        <g style={{ transformOrigin: '100px 100px', animation: `handHour ${seconds}s cubic-bezier(.55,0,.25,1) forwards` }}>
          <path d="M100 100 L96 96 L100 52 L104 96 Z" fill="#f3d998" />
        </g>
        {/* minute hand */}
        <g style={{ transformOrigin: '100px 100px', animation: `handMinute ${seconds}s cubic-bezier(.6,0,.2,1) forwards` }}>
          <path d="M100 104 L98.5 100 L100 30 L101.5 100 Z" fill="#fff4d6" />
        </g>
        <circle cx="100" cy="100" r="4.5" fill="#f3d998" stroke="#5a4218" strokeWidth="1" />
        <circle cx="100" cy="100" r="1.6" fill="#fff" />
      </svg>
    </div>
  );
}
