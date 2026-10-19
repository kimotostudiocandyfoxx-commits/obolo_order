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
const CARD = '/onboarding/s/d1-invitation.jpg';
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
        <div className="absolute inset-0 animate-[sealLean_2.2s_cubic-bezier(.4,0,.2,1)_both]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ENVELOPE} alt="" className="absolute inset-0 h-full w-full object-cover" />
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

/** The card's words, laid over the blank card in the places the client's design has them. */
function CardWords({ inviter, message, settled }: { inviter: string; message?: string; settled?: boolean }) {
  const line = (k: number) => (settled ? undefined : { animation: `inkIn 0.9s ${0.55 + k * 0.16}s ease-out both` });
  return (
    <div className="absolute inset-x-[17%] top-[19.5%] bottom-[12%] flex flex-col items-center text-center text-[#3a2914]" style={{ fontFamily: SERIF }}>
      <p className="text-[9px] tracking-[0.35em] text-[#8a6a33]" style={line(0)}>
        ― INVITATION ―
      </p>
      <p className="mt-[2.5%] text-[min(7.6vw,30px)] font-semibold tracking-[0.18em]" style={line(1)}>
        本部招待状
      </p>
      <div className="mt-[5%] space-y-[3%] text-[min(3.1vw,12.5px)] leading-[1.9] tracking-[0.06em]" style={line(2)}>
        <p>あなたは、この扉を開くための<br />招待を受けています。</p>
        <p>この先にあるのは、<br />Obolo Order 本部。</p>
      </div>
      <span className="my-[5%] h-px w-3/4 bg-gradient-to-r from-transparent via-[#b48a45] to-transparent" style={line(3)} />
      <div className="flex items-baseline gap-3" style={line(4)}>
        <span className="text-[min(2.7vw,11px)] tracking-[0.2em] text-[#7a5c2c]">招待者</span>
        <span className="text-[min(5.6vw,22px)] font-semibold tracking-[0.12em]">{inviter}</span>
      </div>
      {message && (
        <p className="mt-[3.5%] max-w-full px-1 text-[min(3.6vw,14.5px)] italic leading-[1.7] tracking-[0.04em] text-[#5a3d17] [word-break:keep-all]" style={line(5)}>
          「{message}」
        </p>
      )}
      <span className="my-[5%] h-px w-3/4 bg-gradient-to-r from-transparent via-[#b48a45] to-transparent" style={line(6)} />
      <p className="text-[min(4.8vw,19px)] font-semibold leading-[1.6] tracking-[0.14em]" style={line(7)}>
        本部への来訪を
        <br />
        歓迎します。
      </p>
    </div>
  );
}
