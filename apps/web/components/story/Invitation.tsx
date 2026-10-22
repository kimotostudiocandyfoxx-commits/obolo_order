'use client';

import { useEffect, useState } from 'react';

/**
 * Day 1's invitation (D01-S001, client art 2026-10-19). The envelope opens in the client's motion (3-z);
 * from its burst of light the card comes up out of the envelope, and its words ink in. Every word is set
 * here in code (never painted into the picture): the inviter's name and their own words ({inviter_message},
 * only when written) are this visitor's. Calls onOpened once the card has settled. When the visitor heads
 * off (`leaving`), the words glow and lift away (the title stays) and the card hands over to the motion in
 * which the paper folds into a crane.
 */
/** the client's card with its words taken out (they are set below, in the same places) */
const CARD = '/onboarding/s/d1-invitation-card.jpg';
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

export function Invitation({ inviter, message, onOpened, settled, leaving, fromMotion }: { inviter: string; message?: string; onOpened: () => void; settled?: boolean; leaving?: boolean; /** the motion before ended on this very card: no burst, the words just seep in */ fromMotion?: boolean }) {
  // shown already when we arrive (a resume): no opening; otherwise the words keep inking in after onOpened
  const [instant] = useState(!!settled);
  const [burst, setBurst] = useState(!settled && !fromMotion);
  const [cardOk, setCardOk] = useState(true);
  useEffect(() => {
    if (settled) return;
    const t1 = setTimeout(() => setBurst(false), 120);
    const t2 = setTimeout(onOpened, 3400);
    return () => [t1, t2].forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`pointer-events-none absolute inset-0 z-[3] overflow-hidden transition-opacity duration-[900ms] ease-in ${leaving ? 'opacity-0 delay-500' : 'opacity-100'}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CARD} alt="" className={`absolute inset-0 h-full w-full scale-110 object-cover blur-2xl transition-opacity duration-1000 ${instant ? 'opacity-40' : 'animate-[fadeUp_1.2s_ease-out_both] opacity-40'}`} aria-hidden />
        <div className={`relative aspect-[9/16] ${instant || fromMotion ? '' : 'animate-[cardOut_1.5s_cubic-bezier(.16,1,.3,1)_both]'}`} style={{ width: 'min(100%, calc(100dvh * 9 / 16))' }}>
          {cardOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={CARD} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setCardOk(false)} />
          ) : (
            <div className="absolute inset-x-[11%] inset-y-[8%] rounded-md bg-[#efe3c8] shadow-[0_0_60px_rgba(255,214,140,0.45)]" />
          )}
          <CardWords inviter={inviter} message={message} settled={instant} leaving={leaving} />
          {!instant && <span className="absolute inset-0 animate-[cardShine_1.8s_0.7s_ease-out_both]" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,250,230,0.55) 48%, transparent 62%)', mixBlendMode: 'soft-light' }} />}
        </div>
      </div>
      {/* the burst of light the card comes out of (continuing the motion's own) */}
      <div
        className={`absolute inset-0 transition-opacity ease-out ${burst ? 'opacity-100 duration-0' : 'opacity-0 duration-[1100ms]'}`}
        style={{ background: 'radial-gradient(circle at 50% 52%, #fffaf0 0%, #ffe7b0 28%, rgba(255,190,90,0.5) 58%, rgba(0,0,0,0) 100%)' }}
      />
    </div>
  );
}

/** The card's words, set over the blank card exactly where the client's design has them (% of the card). */
function CardWords({ inviter, message, settled, leaving }: { inviter: string; message?: string; settled?: boolean; leaving?: boolean }) {
  const at = (top: number, k: number, x = 50) => ({
    top: `${top}%`,
    left: `${x}%`,
    transform: 'translateX(-50%)',
    ...(settled || leaving
      ? {}
      : {
          WebkitMaskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)',
          maskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }),
    ...(leaving && k >= 2
      ? { animation: `wordsOff 0.9s ${(k - 2) * 0.07}s ease-in forwards` }
      : settled
        ? {}
        : { animation: `inkBleed 2.4s ${0.9 + k * 0.38}s cubic-bezier(.3,.1,.2,1) both` }),
  });
  const ink = 'absolute whitespace-nowrap text-center text-[#3a2914]';
  return (
    <div className="absolute inset-0" style={{ fontFamily: SERIF, containerType: 'inline-size' }}>
      <p className={`${ink} text-[2.3cqw] tracking-[0.32em] text-[#6e5328]`} style={at(29.2, 0)}>
        ― INVITATION ―
      </p>
      <p className={`${ink} text-[8.2cqw] font-semibold leading-none tracking-[0.16em]`} style={at(32.6, 1)}>
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
      <p className={`${ink} text-[5.8cqw] font-semibold leading-[1.45] tracking-[0.14em]`} style={at(76.2, 6, 41.5)}>
        本部への来訪を
        <br />
        歓迎します。
      </p>
    </div>
  );
}
