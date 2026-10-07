'use client';

import type { PuniLook } from '@obolo/shared';
import { BallAvatar } from '@/components/saturn/BallAvatar';
import { PuniFigure } from './PuniFigure';

/**
 * Someone's round avatar: their ぷにぷに character when they dressed one on their profile,
 * otherwise the plain ころりん ball. `bounce` replays the squish (a tap), `speaking` wobbles.
 */
export function PuniAvatar({
  seed,
  neo,
  look,
  size,
  speaking = false,
  bounce,
  poked = false,
}: {
  seed: string;
  neo?: string | null;
  look?: PuniLook | null;
  size: number;
  speaking?: boolean;
  bounce?: number | string;
  poked?: boolean;
}) {
  if (!look)
    return (
      <span key={bounce} className={`inline-block ${bounce !== undefined ? 'animate-[puniSquish_0.55s_cubic-bezier(.3,1.6,.5,1)]' : ''}`} style={{ transformOrigin: '50% 85%' }}>
        <BallAvatar seed={seed} neo={neo} size={size} speaking={speaking} />
      </span>
    );
  // the figure leaves room for hats / arms around the body: draw it larger, centred on the slot
  const big = size * 1.55;
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <span className="absolute" style={{ left: (size - big) / 2, top: (size - big) / 2 - size * 0.04 }}>
        <PuniFigure look={look} size={big} speaking={speaking} bounce={bounce} poked={poked} />
      </span>
    </span>
  );
}
