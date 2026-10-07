'use client';

import type { PuniLook } from '@obolo/shared';
import { useId, useMemo } from 'react';
import { anchors, BackParts, FaceParts, FrontParts, SkinDefs, SkinGloss, SkinRim, skinStroke, TextureDefs, WearPart } from '@/lib/puni/parts';
import { createBlob, localPoints, smoothPath } from '@/lib/puni/physics';

/**
 * A member's ぷにぷに character at rest (Saturn world, replies, profile). Same parts as the
 * physics stage; the squish on a tap is a CSS animation on the wrapper (`bounce` changes →
 * replays), the wobble while their voice plays is `speaking`.
 */
export function PuniFigure({ look, size, speaking = false, poked = false, bounce }: { look: PuniLook; size: number; speaking?: boolean; poked?: boolean; bounce?: number | string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const R = 70;
  const a = anchors(look.shape);
  const d = useMemo(() => smoothPath(localPoints(createBlob('x', 0, 0, R, look.shape))), [look.shape]);
  const tex = `pt${uid}`;
  const clip = `pc${uid}`;
  // room around the body for hats, arms and tails
  const pad = R * 1.75;
  return (
    <span className={`relative inline-block ${speaking ? 'animate-[wobble_0.6s_ease-in-out_infinite]' : ''}`} style={{ width: size, height: size }}>
      <span key={bounce} className={`block h-full w-full ${bounce !== undefined ? 'animate-[puniSquish_0.55s_cubic-bezier(.3,1.6,.5,1)]' : ''}`} style={{ transformOrigin: '50% 85%' }}>
        <svg viewBox={`${-pad} ${-pad} ${pad * 2} ${pad * 2}`} width={size} height={size} aria-hidden overflow="visible">
          <defs>
            <filter id="puni-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <SkinDefs uid={uid} color={look.color} R={R} />
            <TextureDefs id={tex} tex={look.tex} color={look.color} R={R} />
            <clipPath id={clip}>
              <path d={d} />
            </clipPath>
          </defs>
          <ellipse cx={0} cy={R * (a.bottom / 100) + 2} rx={R * 0.78} ry={R * 0.11} fill="#3a1d5c" opacity={0.18} />
          <g transform={`scale(${R / 100})`}>
            <BackParts look={look} a={a} />
          </g>
          <path d={d} fill={`url(#pg${uid})`} />
          {look.tex !== 'none' && <path d={d} fill={`url(#${tex})`} opacity={look.tex === 'rice' ? 0.95 : 0.85} />}
          <g clipPath={`url(#${clip})`}>
            <g transform={`scale(${R / 100})`}>
              <WearPart look={look} a={a} />
            </g>
          </g>
          <SkinRim uid={uid} clip={clip} color={look.color} R={R} />
          <SkinGloss uid={uid} R={R} />
          <path d={d} fill="none" stroke={skinStroke(look.color)} strokeOpacity={0.35} strokeWidth={1.5} />
          <g transform={`scale(${R / 100})`} className={poked ? 'puni-poked' : ''}>
            <FaceParts look={look} a={a} />
            <FrontParts look={look} a={a} />
          </g>
        </svg>
      </span>
    </span>
  );
}
