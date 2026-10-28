'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

/**
 * M-R153: a kororin is puni-puni every day and a party animal only while it sings. While one sings:
 *  - the sky dims softly and coloured light flows slowly round Saturn's ring
 *  - 青のり confetti drifts down; sauce and mayo penlights sway
 *  - on the singer: round sunglasses drop from the forehead onto the eyes (シャキーン), the takoyaki pick turns
 *    into a mic, the katsuobushi on its head dances to the beat (126 BPM, the songs' own)
 * When it ends the glasses go back up and the flakes lie down. No sudden flashes, no jumps in loudness: light
 * only pulses slowly or shifts colour. `place` is called every frame with the singer's position.
 */
export type KororinPartyHandle = { place: (b: { x: number; y: number; R: number } | undefined) => void };

const BEAT = 60 / 126;

/** behind the characters: the sky, the ring's light, the confetti, the penlights */
export function KororinPartySky({ on }: { on: boolean }) {
  // confetti and penlights: placed once
  const bits = useMemo(
    () =>
      Array.from({ length: 26 }, (_, k) => ({
        left: (k * 37) % 100,
        delay: -((k * 1.7) % 9),
        dur: 7 + ((k * 13) % 5),
        size: 4 + ((k * 7) % 5),
        rot: (k * 53) % 360,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* the sky dims */}
      <div className="absolute inset-0 bg-[#0b0420] transition-opacity duration-[1400ms]" style={{ opacity: on ? 0.55 : 0 }} />
      {/* coloured light flowing slowly round the ring */}
      <div
        className="absolute left-1/2 top-[52%] h-[38vmin] w-[150vmin] -translate-x-1/2 -translate-y-1/2 rounded-[50%] transition-opacity duration-[1400ms]"
        style={{
          opacity: on ? 0.55 : 0,
          background: 'conic-gradient(from 0deg, #ff6fb5, #ffd36f, #6fffd2, #6fb8ff, #c86fff, #ff6fb5)',
          maskImage: 'radial-gradient(ellipse at center, transparent 55%, #000 62%, #000 70%, transparent 76%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 55%, #000 62%, #000 70%, transparent 76%)',
          animation: on ? 'kpHue 9s linear infinite' : undefined,
          filter: 'blur(6px)',
        }}
      />
      {on && (
        <>
          {/* 青のり confetti, drifting slowly */}
          {bits.map((b, k) => (
            <span
              key={k}
              className="absolute top-[-4%] rounded-[2px] bg-[#3d8b3a]"
              style={{ left: `${b.left}%`, width: b.size, height: b.size * 0.6, transform: `rotate(${b.rot}deg)`, animation: `kpFall ${b.dur}s linear ${b.delay}s infinite`, opacity: 0.85 }}
            />
          ))}
          {/* sauce and mayo penlights, swaying on the beat's half-time */}
          {[8, 22, 78, 92].map((left, k) => (
            <span
              key={left}
              className="absolute bottom-[6%] h-[16vh] w-[7px] origin-bottom rounded-full"
              style={{
                left: `${left}%`,
                background: k % 2 ? 'linear-gradient(#fff9d6, #ffe680)' : 'linear-gradient(#a0522d, #5a2a12)',
                boxShadow: k % 2 ? '0 0 14px rgba(255,240,170,.8)' : '0 0 14px rgba(190,100,50,.7)',
                animation: `kpSway ${BEAT * 4}s ease-in-out ${-k * BEAT}s infinite alternate`,
              }}
            />
          ))}
        </>
      )}
      <style>{`
        @keyframes kpHue { from { filter: blur(6px) hue-rotate(0deg); } to { filter: blur(6px) hue-rotate(360deg); } }
        @keyframes kpFall { to { transform: translateY(110vh) rotate(540deg); } }
        @keyframes kpSway { from { transform: rotate(-16deg); } to { transform: rotate(16deg); } }
      `}</style>
    </div>
  );
}

/** in front of the characters: the singer's party kit, following it every frame */
export const KororinParty = forwardRef<KororinPartyHandle, { on: boolean }>(function KororinParty({ on }, ref) {
  const singer = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    place: (b) => {
      const el = singer.current;
      if (!el) return;
      if (!b) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = '1';
      el.style.width = `${b.R * 2}px`;
      el.style.height = `${b.R * 2}px`;
      el.style.transform = `translate(${b.x - b.R}px, ${b.y - b.R}px)`;
    },
  }));
  return (
    <div className="pointer-events-none absolute inset-0 z-[65]" aria-hidden>
      <div ref={singer} className="absolute left-0 top-0 opacity-0 transition-opacity duration-300">
        <div className="relative h-full w-full">
          {/* katsuobushi dancing to the beat */}
          {on &&
            [-0.28, 0, 0.26].map((dx, k) => (
              <span
                key={k}
                className="absolute h-[14%] w-[16%] rounded-[40%_60%_50%_50%] bg-gradient-to-b from-[#f6c79a] to-[#d58d5c]"
                style={{ left: `${42 + dx * 100}%`, top: '-4%', animation: `kpFlake ${BEAT}s ease-in-out ${-k * BEAT * 0.33}s infinite alternate`, transformOrigin: '50% 100%' }}
              />
            ))}
          {/* round sunglasses: forehead → eyes */}
          <svg
            viewBox="0 0 100 40"
            className="absolute left-[18%] w-[64%] transition-[top] duration-200 ease-[cubic-bezier(.5,1.8,.6,1)]"
            style={{ top: on ? '30%' : '6%' }}
          >
            <circle cx="27" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="3" />
            <circle cx="73" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="3" />
            <path d="M43 18 Q50 13 57 18" fill="none" stroke="#ffd36f" strokeWidth="3" />
            <ellipse cx="21" cy="14" rx="5" ry="3" fill="#fff" opacity=".55" />
            <ellipse cx="67" cy="14" rx="5" ry="3" fill="#fff" opacity=".55" />
          </svg>
          {/* the takoyaki pick turned into a mic */}
          <svg viewBox="0 0 30 70" className="absolute right-[-14%] top-[38%] w-[24%] transition-transform duration-500" style={{ transform: on ? 'rotate(-18deg)' : 'rotate(200deg) scale(0)' }}>
            <rect x="12" y="24" width="6" height="44" rx="3" fill="#e8d2a8" />
            <circle cx="15" cy="15" r="12" fill="#3a3a44" stroke="#c9c9d6" strokeWidth="2" />
            <path d="M7 12h16M7 17h16" stroke="#6a6a78" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
      <style>{`
        @keyframes kpFlake { from { transform: rotate(-22deg) scaleY(1); } to { transform: rotate(22deg) scaleY(1.25); } }
      `}</style>
    </div>
  );
});
