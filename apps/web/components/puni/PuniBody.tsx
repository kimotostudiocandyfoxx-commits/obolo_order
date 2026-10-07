'use client';

import type { PuniLook } from '@obolo/shared';
import { useEffect, useRef } from 'react';
import { anchors, BackParts, FaceParts, FrontParts, SkinDefs, SkinGloss, SkinRim, skinStroke, TextureDefs, WearPart } from '@/lib/puni/parts';

/** The DOM nodes the physics loop updates every frame (no React re-render per frame). */
export interface PuniNodes {
  outer: SVGGElement | null;
  rot: SVGGElement | null;
  gloss: SVGGElement | null;
  bodies: SVGPathElement[];
  clip: SVGPathElement | null;
  parts: SVGGElement[];
  open: SVGGElement | null;
  poked: SVGGElement | null;
}

/** One character: the body path (colour, texture, shine, outline) with its parts. */
export function PuniBody({ look: l, R, register }: { look: PuniLook & { id: string }; R: number; register: (n: PuniNodes) => void }) {
  const a = anchors(l.shape);
  const tex = `tex-${l.id}`;
  const clip = `clip-${l.id}`;
  const n = useRef<PuniNodes>({ outer: null, rot: null, gloss: null, bodies: [], clip: null, parts: [], open: null, poked: null });
  const partsRef = (el: SVGGElement | null) => {
    if (el && !n.current.parts.includes(el)) n.current.parts.push(el);
  };
  const bodyRef = (el: SVGPathElement | null) => {
    if (el && !n.current.bodies.includes(el)) n.current.bodies.push(el);
  };
  useEffect(() => {
    // pick up the face's two eye groups (open / poked) after each render
    const rot = n.current.rot;
    n.current.open = rot?.querySelector('[data-eyes="open"]') ?? null;
    n.current.poked = rot?.querySelector('[data-eyes="poked"]') ?? null;
    n.current.parts = n.current.parts.filter((g) => g.isConnected);
    n.current.bodies = n.current.bodies.filter((p) => p.isConnected);
    register(n.current);
  });
  return (
    <g ref={(el) => void (n.current.outer = el)}>
      <g ref={(el) => void (n.current.rot = el)}>
        <defs>
          <TextureDefs id={tex} tex={l.tex} color={l.color} R={R} />
          <SkinDefs uid={l.id} color={l.color} R={R} />
          <clipPath id={clip}>
            <path ref={(el) => void (n.current.clip = el)} />
          </clipPath>
        </defs>
        <g ref={partsRef}>
          <BackParts look={l} a={a} />
        </g>
        <path ref={bodyRef} fill={`url(#pg${l.id})`} />
        {l.tex !== 'none' && <path ref={bodyRef} fill={`url(#${tex})`} opacity={l.tex === 'rice' ? 0.95 : 0.85} />}
        <g clipPath={`url(#${clip})`}>
          <g ref={partsRef}>
            <WearPart look={l} a={a} />
          </g>
        </g>
        <SkinRim uid={l.id} clip={clip} color={l.color} R={R} />
        <g ref={(el) => void (n.current.gloss = el)}>
          <SkinGloss uid={l.id} R={R} />
        </g>
        <path ref={bodyRef} fill="none" stroke={skinStroke(l.color)} strokeOpacity={0.35} strokeWidth={1.5} />
        <g ref={partsRef}>
          <FaceParts look={l} a={a} />
          <FrontParts look={l} a={a} />
        </g>
      </g>
    </g>
  );
}

