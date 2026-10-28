'use client';

import type { StickerMade } from '@/lib/onboarding/made';
import { Sticker } from './JupiterLesson';

/**
 * The {neo} butterfly (M-R155): a small, chibi {neo} with glowing wings, the art held in both hands. It is
 * born from the stone's hollow (D05-S008), carries the art to the dachi's 〔推し〕 sky and back to the frame.
 * KIMORIN⭐︎'s butterfly wears his round sunglasses too. `face` is the round picture of the look (the chibi
 * picture made with the look replaces it when it exists).
 */
export function NeoButterfly({
  face,
  body,
  art,
  size = 110,
  shades = false,
  hue = 48,
  flap = true,
}: {
  face?: string;
  body?: string;
  art?: StickerMade | null;
  size?: number;
  shades?: boolean;
  hue?: number;
  flap?: boolean;
}) {
  const head = size * 0.42;
  return (
    <div className="relative" style={{ width: size, height: size * 1.15 }}>
      {/* glowing wings: each flaps round the body's edge; the left one is the right one mirrored in its own box */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          className="absolute top-0"
          style={{
            width: size * 0.56,
            height: size * 0.72,
            left: side < 0 ? 0 : undefined,
            right: side > 0 ? 0 : undefined,
            transformOrigin: side < 0 ? '100% 50%' : '0% 50%',
            animation: flap ? 'nbFlap 0.5s ease-in-out infinite alternate' : undefined,
            filter: `drop-shadow(0 0 ${size * 0.08}px hsla(${hue},100%,75%,.9))`,
          }}
        >
          <svg viewBox="0 0 60 70" className="h-full w-full" style={{ transform: side < 0 ? 'scaleX(-1)' : undefined }}>
            <path d="M2 34 C 10 2, 52 -4, 56 18 C 60 34, 34 38, 2 36 Z" fill={`hsla(${hue},100%,82%,.75)`} stroke={`hsl(${hue},90%,70%)`} strokeWidth="1.5" />
            <path d="M2 38 C 22 40, 46 46, 44 60 C 40 72, 16 62, 2 40 Z" fill={`hsla(${(hue + 30) % 360},100%,84%,.7)`} stroke={`hsl(${(hue + 30) % 360},90%,72%)`} strokeWidth="1.5" />
          </svg>
        </div>
      ))}
      {/* the chibi {neo}: its own picture when made (POST /me/look/chibi), else the round face */}
      {body ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={body} alt="" className="absolute left-1/2 top-0 -translate-x-1/2 object-contain drop-shadow" style={{ width: size * 0.62, height: size * 0.78 }} />
      ) : (
        <div className="absolute left-1/2 top-[6%] -translate-x-1/2 overflow-hidden rounded-full border-2 border-white bg-amber-100 shadow-md" style={{ width: head, height: head }}>
          {face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={face} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <span className="flex h-full w-full items-center justify-center" style={{ fontSize: head * 0.5 }}>
              ✦
            </span>
          )}
          {shades && (
            <svg viewBox="0 0 100 40" className="absolute left-[12%] top-[34%] w-[76%]">
              <circle cx="27" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="4" />
              <circle cx="73" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="4" />
              <path d="M43 18 Q50 13 57 18" fill="none" stroke="#ffd36f" strokeWidth="4" />
            </svg>
          )}
        </div>
      )}
      {/* the art, held in both hands */}
      {art && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: size * 0.5 }}>
          <span className="absolute -left-1.5 top-1 z-10 h-2.5 w-2.5 rounded-full bg-amber-100 ring-1 ring-white" />
          <span className="absolute -right-1.5 top-1 z-10 h-2.5 w-2.5 rounded-full bg-amber-100 ring-1 ring-white" />
          <Sticker s={{ ...art, text: '' }} size={size * 0.5} />
        </div>
      )}
      <style>{'@keyframes nbFlap{from{transform:rotateY(0deg)}to{transform:rotateY(55deg)}}'}</style>
    </div>
  );
}
