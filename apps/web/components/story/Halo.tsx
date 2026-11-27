import { MOTION } from '@/lib/story/motion';

/**
 * where a disc of light sits behind a head: its picture, its centre in the figure's picture (x, y: 0–1 from the left /
 * the top) and its diameter as a share of the picture's height
 */
export type HaloSpec = { src: string; x: number; y: number; size: number };

/**
 * MONBAN's golden halo (client 2026-11-27; painted on black as a layer of its own, design/cast/monban-halo.jpg →
 * onboarding/monban-halo.webp by scripts/cast/build.py): laid BEHIND the figure's picture, inside the picture's own
 * box. The disc's brightness is its transparency, so it lightens what is behind it like a screen layer and adds no
 * glow of its own; it is kept faint (MOTION.poise.still.halo) and only its opacity breathes, very slowly — it never
 * turns or moves, and he never bobs. prefers-reduced-motion: it does not breathe at all (globals.css .still-halo).
 */
export function Halo({ at, lit = true }: { at: HaloSpec; lit?: boolean }) {
  const H = MOTION.poise.still.halo;
  return (
    <span
      className="pointer-events-none absolute block aspect-square -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%`, height: `${at.size * 100}%`, opacity: lit ? 1 : H.dim, mixBlendMode: 'screen' }}
      aria-hidden
      data-halo
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={at.src} alt="" draggable={false} className="still-halo block h-full w-full max-w-none select-none" style={{ ['--hmin' as string]: `${H.opacity[0]}`, ['--hmax' as string]: `${H.opacity[1]}`, animationDuration: `${H.ms}ms` }} />
    </span>
  );
}
