import { PLANETS, type PlanetId } from '@obolo/shared';
import type { CSSProperties } from 'react';

/** CSS-rendered planet (no image assets → nothing to load, crisp at any size). */
export function PlanetSphere({ id, size, className = '' }: { id: PlanetId; size: number | string; className?: string }) {
  const p = PLANETS[id];
  const style = {
    width: size,
    height: size,
    fontSize: typeof size === 'number' ? size / 6 : undefined,
    '--c1': p.colors[0],
    '--c2': p.colors[1],
  } as CSSProperties;
  return (
    <span className={`planet planet-${id} inline-block shrink-0 ${className}`} style={style} aria-hidden>
      {p.ring && <span className="planet-ring" />}
    </span>
  );
}
