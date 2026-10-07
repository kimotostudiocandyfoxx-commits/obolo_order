'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * Art workshop pieces (client request 2026-10-07): the backgrounds and the empty ship / UFO were
 * designed by Claude Code and painted by Gemini (art/queue.json → art/out → public/art); the
 * motion loops by Veo. Text, buttons and people are always drawn in code on top.
 */
export const ART_BASE = '/art';

/**
 * The stage: the painted background (16:9), moving (Veo loop) when the video is there. 4:3 on a
 * landscape screen, square on a portrait one (the painting is cropped around `focus`, % from the left).
 * `reserve` is the height (px) the screen needs for everything else, so the stage always fits.
 */
export function ArtStage({ name, reserve, focus = 50, children }: { name: string; reserve: number; focus?: number; children?: ReactNode }) {
  return (
    <div
      className="relative aspect-[4/3] w-full max-w-[min(100%,calc((100svh-var(--reserve))*1.333))] overflow-hidden rounded-xl portrait:aspect-square portrait:max-w-[min(100%,calc(100svh-var(--reserve)))]"
      style={{ '--reserve': `${reserve}px` } as CSSProperties}
    >
      {/* the poster is the still painting: it shows until (or if never) the loop plays */}
      <video
        ref={(v) => {
          // iOS Safari plays inline only when muted is set on the element itself
          if (!v) return;
          v.muted = true;
          v.play().catch(() => undefined);
        }}
        src={`${ART_BASE}/${name}.mp4`}
        poster={`${ART_BASE}/${name}.jpg`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        style={{ objectPosition: `${focus}% 50%` }}
      />
      {children}
    </div>
  );
}

/**
 * Where the rider stands in each vessel, in % of the sprite: the round character sits at (x, bottom),
 * and the part of the vessel below `front` is drawn again over it, so the rider is inside.
 */
const RIDE = {
  ship: { src: 'ship', x: 37, bottom: 52, size: 30, front: 50, ratio: 640 / 397 },
  ufo: { src: 'ufo', x: 50, bottom: 33, size: 36, front: 30, ratio: 640 / 460 },
} as const;

/** The painted ship / UFO with someone aboard (their character picture, or their emoji). */
export function Vessel({ kind, img, emoji }: { kind: 'ship' | 'ufo'; img?: string | null; emoji: string }) {
  const r = RIDE[kind];
  const sprite = `${ART_BASE}/${r.src}.webp`;
  return (
    <div className="relative w-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.45)]" style={{ aspectRatio: `${r.ratio}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sprite} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
      <span
        className="absolute flex aspect-square -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-white/85 bg-[#1b1f3a] shadow-[0_0_14px_rgba(255,255,255,0.35)]"
        style={{ left: `${r.x}%`, bottom: `${100 - r.bottom}%`, width: `${r.size}%` }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="text-[clamp(14px,3vw,30px)] leading-none">{emoji}</span>
        )}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sprite} alt="" className="pointer-events-none absolute inset-0 h-full w-full select-none" style={{ clipPath: `inset(${r.front}% 0 0 0)` }} draggable={false} />
    </div>
  );
}
