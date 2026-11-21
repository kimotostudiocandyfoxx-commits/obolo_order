import type { PlanetId } from '@obolo/shared';
import { PlanetSphere } from '@/components/PlanetSphere';

/** A planet's little sphere — Pluto has no picture of its own yet, so it is a pale icy ball. */
export function PlanetMark({ id, size }: { id: PlanetId | 'pluto'; size: number }) {
  if (id === 'pluto')
    return <span style={{ width: size, height: size }} className="inline-block shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#e8eef5,#8a99ab_55%,#3d4756)]" aria-hidden />;
  return <PlanetSphere id={id} size={size} />;
}
