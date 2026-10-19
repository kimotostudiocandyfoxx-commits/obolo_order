'use client';

import { useEffect, useState } from 'react';

/**
 * Day 1's invitation (D01-S001, client art 2026-10-19): the seal on the envelope glows and turns, the
 * envelope bursts into light and the card rises out of it. Every word on the card is set here in code
 * (never painted into the picture): the inviter's name and their own words ({inviter_message}, only when
 * written) are this visitor's. Calls onOpened once the card has settled; the card stays until the scene
 * changes.
 */
const ENVELOPE = '/onboarding/s/d1-envelope-still.jpg';
/** the client's card with its words taken out (they are set below, in the same places) */
const CARD = '/onboarding/s/d1-invitation-card.jpg';
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

export function Invitation({ inviter, message, onOpened, settled }: { inviter: string; message?: string; onOpened: () => void; settled?: boolean }) {
  const [phase, setPhase] = useState<'seal' | 'burst' | 'card'>(settled ? 'card' : 'seal');
  const [cardOk, setCardOk] = useState(true);
  useEffect(() => {
    if (settled) return;
    const t1 = setTimeout(() => setPhase('burst'), 1700);
    const t2 = setTimeout(() => setPhase('card'), 2150);
    const t3 = setTimeout(onOpened, 3600);
    return () => [t1, t2, t3].forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden bg-black">
      {/* the envelope: the camera leans in to the seal, which wakes up */}
      {phase !== 'card' && (
        <div className="absolute inset-0 animate-[sealLean_2.4s_cubic-bezier(.4,0,.2,1)_both]">
          {/* shown like the motion it continues (whole picture, blurred copy behind) so nothing jumps */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ENVELOPE} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ENVELOPE} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute left-[51.5%] top-1/2 h-0 w-0">
            <span className="absolute -left-[70px] -top-[70px] h-[140px] w-[140px] animate-[sealSpin_1.7s_ease-in_both] rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent, rgba(255,226,150,0.85), transparent 30%, rgba(255,226,150,0.6), transparent 60%, rgba(255,240,200,0.9), transparent 85%)', mixBlendMode: 'screen', filter: 'blur(2px)' }} />
            {[0, 1, 2].map((k) => (
              <span key={k} className="absolute -left-[50px] -top-[50px] h-[100px] w-[100px] rounded-full border border-amber-100/80" style={{ animation: `sealRing 1.5s ${0.25 + k * 0.38}s ease-out both`, boxShadow: '0 0 18px rgba(255,214,140,0.8)' }} />
            ))}
            <span className="absolute -left-[60px] -top-[60px] h-[120px] w-[120px] animate-[sealGlow_1.7s_ease-in_both] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,246,214,0.95), rgba(255,206,110,0.45) 40%, transparent 70%)', mixBlendMode: 'screen' }} />
          </div>
        </div>
      )}
      {/* the burst of light */}
      <div
        className={`absolute inset-0 transition-opacity ${phase === 'burst' ? 'opacity-100 duration-300' : 'opacity-0 duration-[900ms]'}`}
        style={{ background: 'radial-gradient(circle at 50% 55%, #fffaf0 0%, #ffe7b0 30%, rgba(255,190,90,0.55) 60%, rgba(0,0,0,0) 100%)' }}
      />
      {/* the card */}
      {phase === 'card' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardOk ? CARD : ENVELOPE} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" aria-hidden />
          <div className={`relative aspect-[9/16] h-full max-h-full max-w-full ${settled ? '' : 'animate-[cardRise_1.3s_cubic-bezier(.16,1,.3,1)_both]'}`} style={{ width: 'min(100%, calc(100dvh * 9 / 16))', height: 'auto' }}>
            {cardOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={CARD} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setCardOk(false)} />
            ) : (
              <div className="absolute inset-x-[11%] inset-y-[8%] rounded-md bg-[#efe3c8] shadow-[0_0_60px_rgba(255,214,140,0.45)]" />
            )}
            <CardWords inviter={inviter} message={message} settled={settled} />
            {!settled && <span className="absolute inset-0 animate-[cardShine_1.8s_0.5s_ease-out_both]" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,250,230,0.55) 48%, transparent 62%)', mixBlendMode: 'soft-light' }} />}
          </div>
        </div>
      )}
    </div>
  );
}

/** The card's words, set over the blank card exactly where the client's design has them (% of the card). */
function CardWords({ inviter, message, settled }: { inviter: string; message?: string; settled?: boolean }) {
  const at = (top: number, k: number, x = 50) => ({
    top: `${top}%`,
    left: `${x}%`,
    transform: 'translateX(-50%)',
    ...(settled ? {} : { animation: `inkIn 0.9s ${0.55 + k * 0.16}s ease-out both` }),
  });
  const ink = 'absolute whitespace-nowrap text-center text-[#3a2914]';
  return (
    <div className="absolute inset-0" style={{ fontFamily: SERIF, containerType: 'inline-size' }}>
      <p className={`${ink} text-[2.3cqw] tracking-[0.32em] text-[#6e5328]`} style={at(27.6, 0)}>
        ― INVITATION ―
      </p>
      <p className={`${ink} text-[8.2cqw] font-semibold leading-none tracking-[0.16em]`} style={at(31.6, 1)}>
        本部招待状
      </p>
      <p className={`${ink} text-[3.4cqw] leading-[1.95] tracking-[0.05em]`} style={at(39.4, 2)}>
        あなたは、この扉を開くための
        <br />
        招待を受けています。
      </p>
      <p className={`${ink} text-[3.4cqw] leading-[1.95] tracking-[0.05em]`} style={at(49.2, 3)}>
        この先にあるのは、
        <br />
        Obolo Order 本部。
      </p>
      <div className={`${ink} flex items-baseline gap-[3cqw]`} style={at(61.2, 4, 47)}>
        <span className="text-[2.9cqw] tracking-[0.2em] text-[#6e5328]">招待者</span>
        <span className="text-[6.4cqw] font-semibold tracking-[0.1em]">{inviter}</span>
      </div>
      {message && (
        <p className={`${ink} max-w-[66cqw] whitespace-normal text-[3.5cqw] italic leading-[1.6] text-[#5a3d17] [word-break:keep-all]`} style={{ ...at(66.6, 5), width: 'max-content' }}>
          「{message}」
        </p>
      )}
      <p className={`${ink} text-[6.2cqw] font-semibold leading-[1.45] tracking-[0.14em]`} style={at(77.2, 6, 44.5)}>
        本部への来訪を
        <br />
        歓迎します。
      </p>
    </div>
  );
}
