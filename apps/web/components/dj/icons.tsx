import type { SampleId } from '@/lib/dj/sampler';
import type { VisualId } from '@/lib/dj/visuals';

/**
 * Line icons for the sampler pads (client 2026-10-12: the emoji did not look cool). Drawn in the
 * pad's neon colour (currentColor) on a 24-unit grid, round caps, one weight.
 */
const PATHS: Record<SampleId | VisualId, string> = {
  // sounds
  horn: 'M3 10v4h3l7 5V5L6 10H3z M16 9.5a4 4 0 0 1 0 5 M18.5 7a7.5 7.5 0 0 1 0 10',
  siren: 'M7 18v-6a5 5 0 0 1 10 0v6 M5 18h14 M12 3v2 M4.5 6.5 6 8 M19.5 6.5 18 8 M12 11v4',
  laser: 'M3 12h4 M17 12h4 M7 12l2.5-5 2.5 10 2.5-10 2.5 5',
  riser: 'M5 20l7-7 7 7 M5 13l7-7 7 7 M12 3v1',
  impact: 'M12 2v5 M12 17v5 M2 12h5 M17 12h5 M5 5l3.5 3.5 M15.5 15.5 19 19 M19 5l-3.5 3.5 M8.5 15.5 5 19 M12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5',
  down: 'M5 4l7 7 7-7 M5 11l7 7 7-7 M12 21v-1',
  scratch: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0 M15 5.5c2 1 3.3 3 3.5 5.5',
  clap: 'M4 14l4-4 M7 17l5-5 M10 20l5-5 M14 4l1 3 M19 6l-3 1.5 M20 11h-3',
  // pictures
  flash: 'M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9 7 7 M17 17l2.1 2.1 M19.1 4.9 17 7 M7 17l-2.1 2.1',
  glitch: 'M3 6h10 M7 10h14 M3 14h8 M10 18h11',
  invert: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18 M12 3v18 M12 7a5 5 0 0 1 0 10',
  mirror: 'M12 3v18 M9 7l-5 5 5 5z M15 7l5 5-5 5z',
  stars: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  rainbow: 'M3 18a9 9 0 0 1 18 0 M6.5 18a5.5 5.5 0 0 1 11 0 M10 18a2 2 0 0 1 4 0',
};

export function PadIcon({ id, size }: { id: SampleId | VisualId; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 2px currentColor)' }} aria-hidden>
      <path d={PATHS[id]} />
    </svg>
  );
}
