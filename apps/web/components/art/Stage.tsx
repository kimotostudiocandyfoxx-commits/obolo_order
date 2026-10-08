'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * Art workshop pieces (client request 2026-10-07): Claude Code designs the art, Gemini paints it
 * (art/queue.json → art/out → public/art). Since 2026-10-08: images only, on the cheap model, in
 * a picture style per planet that hides the cheaper quality (Mercury: gouache picture book; Mars:
 * retro screen-print poster). Text, buttons and people are always drawn in code on top.
 */
export const ART_BASE = '/art';

/**
 * The stage: the painted background (16:9) with a slow drift so it never feels frozen. 4:3 on a
 * landscape screen, square on a portrait one (the painting is cropped around `focus`, % from the left).
 * `reserve` is the height (px) the screen needs for everything else, so the stage always fits.
 */
export function ArtStage({ name, reserve, focus = 50, children }: { name: string; reserve: number; focus?: number; children?: ReactNode }) {
  return (
    <div
      className="relative aspect-[4/3] w-full max-w-[min(100%,calc((100svh-var(--reserve))*1.333))] overflow-hidden rounded-xl portrait:aspect-square portrait:max-w-[min(100%,calc(100svh-var(--reserve)))]"
      style={{ '--reserve': `${reserve}px` } as CSSProperties}
    >
      <ArtBackdrop name={name} focus={focus} />
      {children}
    </div>
  );
}

/** A painted background filling its box, slowly drifting. */
export function ArtBackdrop({ name, focus = 50 }: { name: string; focus?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ART_BASE}/${name}.jpg`}
      alt=""
      aria-hidden
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      style={{ objectPosition: `${focus}% 50%`, animation: 'art-drift 28s ease-in-out infinite alternate' }}
    />
  );
}

/**
 * A vessel sprite and where its rider sits, in % of the sprite: the round character's centre-bottom
 * is at (x, bottom), `size` is its width; the part of the vessel below `front` is drawn again over
 * it, so the rider is inside.
 */
export type Ride = { src: string; x: number; bottom: number; size: number; front: number; ratio: number };

/** Mercury's DJ ships (one look per person). */
export const SHIPS: Ride[] = [
  { src: 'ship-sakura', x: 45, bottom: 72, size: 24, front: 69, ratio: 560 / 554 },
  { src: 'ship-candy', x: 44, bottom: 70, size: 34, front: 69, ratio: 404 / 656 },
  { src: 'ship-pearl', x: 50, bottom: 68, size: 34, front: 67, ratio: 441 / 688 },
  { src: 'ship-pirate', x: 50, bottom: 66, size: 24, front: 64, ratio: 560 / 710 },
  { src: 'ship-neon', x: 46, bottom: 70, size: 22, front: 69, ratio: 560 / 643 },
  { src: 'ship-jungle', x: 43, bottom: 66, size: 24, front: 64, ratio: 560 / 638 },
];
/** Mars's UFOs (one look per person): the rider sits in the dome. */
export const UFOS: Ride[] = [
  { src: 'ufo-classic', x: 51, bottom: 30, size: 22, front: 26, ratio: 560 / 283 },
  { src: 'ufo-retro', x: 47, bottom: 32, size: 22, front: 28, ratio: 560 / 320 },
  { src: 'ufo-cosmo', x: 45, bottom: 36, size: 22, front: 33, ratio: 560 / 715 },
  { src: 'ufo-rust', x: 50, bottom: 27, size: 20, front: 24, ratio: 560 / 352 },
];
const pick = (list: Ride[], key: string) => list[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % list.length];
export const pickShip = (key: string) => pick(SHIPS, key);
export const pickUfo = (key: string) => pick(UFOS, key);

/** The painted ship / UFO with someone aboard (their character picture, or their emoji). */
export function Vessel({ ride, img, emoji }: { ride: Ride; img?: string | null; emoji: string }) {
  const r = ride;
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
