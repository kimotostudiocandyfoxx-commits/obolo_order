'use client';

import { kororinOf, type KororinFace as Face } from '@obolo/shared';
import type { CSSProperties, ReactNode } from 'react';
import s from './PlanetHome.module.css';

/**
 * M-R266 (design/home/README.md §11, template.html faceSVG): the 8 faces, drawn over a ball (viewBox 0–100): pink
 * cheeks, the eyes (they blink every 4.6 s and squint while pressed), a mouth. Any face goes with any colour.
 * M-R268: sunglasses ride above, shown while the scene is `partying`.
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

export function KororinFace({ face, delay = 0, style, shades = 'round' }: { face: Face; delay?: number; style?: CSSProperties; shades?: Shades }) {
  return (
    <svg className={s.ballFace} viewBox="0 0 100 100" aria-hidden data-testid="ball-face" data-face={face} style={style}>
      {/* M-R268 / M-R272: sunglasses, on in club mode (the eyes hidden under them) — this ball's own shape */}
      {SHADES[shades]}
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

/** M-R272: the club's sunglasses — 7 in 10 round, the rest a square wayfarer, a deep-pink star or a deep-red heart */
export type Shades = 'round' | 'way' | 'star' | 'heart';
export const shadesOf = (n: number): Shades => {
  const h = (n * 7 + 3) % 10;
  return h < 7 ? 'round' : (['way', 'star', 'heart'] as const)[h - 7];
};
const star = (x: number, y: number, r: number) => {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const q = k % 2 ? r * 0.48 : r;
    d += `${k ? 'L' : 'M'}${(x + Math.cos(a) * q).toFixed(1)} ${(y + Math.sin(a) * q).toFixed(1)}`;
  }
  return `${d}z`;
};
const LENS = '#141018';
const bridge = (d: string) => <path d={d} fill="none" stroke={LENS} strokeWidth="3" />;
const glint = (d: string) => <path d={d} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" />;
const SHADES: Record<Shades, ReactNode> = {
  round: (
    <g className={s.shades} data-shades="round">
      <circle cx="35" cy="51" r="10.5" fill={LENS} />
      <circle cx="65" cy="51" r="10.5" fill={LENS} />
      {bridge('M45.5 49 q4.5 -4 9 0')}
      {glint('M29 46 q3 -3 6 -3 M59 46 q3 -3 6 -3')}
    </g>
  ),
  way: (
    <g className={s.shades} data-shades="way">
      <path d="M22 44 h22 a4 4 0 0 1 4 4 v3 a9 9 0 0 1 -9 9 h-6 a11 11 0 0 1 -11 -11 v-1 a4 4 0 0 1 0 -4z M78 44 h-22 a4 4 0 0 0 -4 4 v3 a9 9 0 0 0 9 9 h6 a11 11 0 0 0 11 -11 v-1 a4 4 0 0 0 0 -4z" fill={LENS} />
      {bridge('M46 49 h8')}
      {glint('M27 48 l6 0 M61 48 l6 0')}
    </g>
  ),
  star: (
    <g className={s.shades} data-shades="star">
      <path d={star(34, 51, 13)} fill="#3a1238" />
      <path d={star(66, 51, 13)} fill="#3a1238" />
      {bridge('M45 50 h10')}
      {glint('M30 47 l3 -2 M62 47 l3 -2')}
    </g>
  ),
  heart: (
    <g className={s.shades} data-shades="heart">
      <path d="M35 61 C24 53 23 44 29 42 C32 41 34 43 35 45 C36 43 38 41 41 42 C47 44 46 53 35 61z" fill="#3d0f22" />
      <path d="M65 61 C54 53 53 44 59 42 C62 41 64 43 65 45 C66 43 68 41 71 42 C77 44 76 53 65 61z" fill="#3d0f22" />
      {bridge('M45 48 h10')}
      {glint('M29 46 l3 -2 M59 46 l3 -2')}
    </g>
  ),
};

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
export function KororinPic({ k, size = 58, turn }: { k?: { colour?: string | null; face?: string | null } | null; size?: number; turn?: number }) {
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
