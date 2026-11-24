'use client';

import { kororinOf, type KororinChoice, type KororinFace as Face } from '@obolo/shared';
import type { CSSProperties, ReactNode } from 'react';
import s from './PlanetHome.module.css';

/**
 * M-R266 (design/home/README.md §11, template.html faceSVG): the 8 faces, drawn over a ball (viewBox 0–100): pink
 * cheeks, the eyes (they blink every 4.6 s and squint while pressed), a mouth. Any face goes with any colour.
 */
const INK = '#2a1a22';
const eye = (x: number) => (
  <g key={x}>
    <ellipse cx={x} cy="52" rx="5.2" ry="6.2" fill={INK} />
    <circle cx={x - 1.6} cy="49.6" r="1.8" fill="#fff" />
  </g>
);
const ln = (d: string) => <path d={d} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
const mo = (d: string) => <path d={d} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />;
const STAR = 'l2.2 5.2 5.6 .5 -4.3 3.6 1.4 5.4 -4.9 -3 -4.9 3 1.4 -5.4 -4.3 -3.6 5.6 -.5z';

const EYES: Record<Face, ReactNode> = {
  omega: [eye(36), eye(64)],
  smile: ln('M30 53 q6 -7 12 0 M58 53 q6 -7 12 0'),
  wink: [eye(36), <g key="w">{ln('M58 52 q6 -5 12 0')}</g>],
  sleepy: ln('M30 53 h12 M58 53 h12'),
  cat: [eye(36), eye(64)],
  oh: (
    <>
      <circle cx="36" cy="51" r="6.5" fill={INK} />
      <circle cx="34" cy="48.5" r="2.2" fill="#fff" />
      <circle cx="64" cy="51" r="6.5" fill={INK} />
      <circle cx="62" cy="48.5" r="2.2" fill="#fff" />
    </>
  ),
  grin: ln('M30 55 q6 -8 12 0 M58 55 q6 -8 12 0'),
  star: (
    <>
      <path d={`M36 44 ${STAR}`} fill="#ffd23f" stroke={INK} strokeWidth="1.2" />
      <path d={`M64 44 ${STAR}`} fill="#ffd23f" stroke={INK} strokeWidth="1.2" />
    </>
  ),
};
const MOUTH: Record<Face, ReactNode> = {
  omega: mo('M43 61 q3.5 5 7 0 q3.5 5 7 0'),
  smile: mo('M42 60 q8 9 16 0'),
  wink: mo('M44 61 q6 6 12 0'),
  sleepy: <ellipse cx="50" cy="63" rx="3" ry="2.4" fill={INK} />,
  cat: mo('M42 60 q4 5 8 0 q4 5 8 0'),
  oh: <ellipse cx="50" cy="63" rx="4" ry="5" fill={INK} />,
  grin: <path d="M40 59 q10 12 20 0 z" fill={INK} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />,
  star: mo('M43 60 q7 7 14 0'),
};

export function KororinFace({ face, delay = 0, style }: { face: Face; delay?: number; style?: CSSProperties }) {
  return (
    <svg className={s.ballFace} viewBox="0 0 100 100" aria-hidden data-testid="ball-face" data-face={face} style={style}>
      <ellipse cx="27" cy="62" rx="9" ry="5" fill="#ff8fa8" opacity=".55" />
      <ellipse cx="73" cy="62" rx="9" ry="5" fill="#ff8fa8" opacity=".55" />
      <g className={s.ballSquint}>
        <g className={s.ballEyes} style={{ animationDelay: `${delay.toFixed(2)}s` }}>
          {EYES[face]}
        </g>
      </g>
      {MOUTH[face]}
    </svg>
  );
}

export const kororinBall = (colour: string) => `/planet-home/ballc-${colour}.webp`;

/**
 * README §11: each ball looks its own way — the face moved a little up / down / left / right, tilted a little, and
 * squashed by as much as it moved (as if turned on the sphere); its blink at its own moment. From a number of its own.
 */
export function faceTurn(n: number) {
  const fx = (((n * 37) % 17) - 8) * 1.1;
  const fy = (((n * 53) % 13) - 6) * 1.1;
  const fr = (((n * 29) % 15) - 7) * 1.4;
  return {
    transform: `translate(${fx.toFixed(1)}%, ${fy.toFixed(1)}%) rotate(${fr.toFixed(1)}deg) scale(${(1 - Math.abs(fx) / 80).toFixed(3)}, ${(1 - Math.abs(fy) / 70).toFixed(3)})`,
    delay: -((n * 1.37) % 4.6),
  };
}

/** a kororin, still (the picker, the chat card): its ball and face */
export function KororinPic({ k, size = 58, turn }: { k?: Partial<KororinChoice> | null; size?: number; turn?: number }) {
  const c = kororinOf(k);
  const t = turn === undefined ? null : faceTurn(turn);
  return (
    <span className={s.kororinPic} style={{ width: size, height: size }} data-colour={c.colour} data-face={c.face}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={kororinBall(c.colour)} draggable={false} />
      <KororinFace face={c.face} style={t ? { transform: t.transform } : undefined} delay={t?.delay} />
    </span>
  );
}
