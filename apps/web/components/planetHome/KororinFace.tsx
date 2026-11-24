'use client';

import { kororinPicOf } from '@obolo/shared';
import type { ReactNode } from 'react';
import s from './PlanetHome.module.css';

/**
 * M-R275: the kororin is a painted anime ball (one of 24, public/planet-home/kor-01…24.webp, cut from the story team's
 * kor3 art) — its face is in the picture. Over it only the club's sunglasses (M-R268 / M-R272), 1.42× around the
 * eyes, shown while the scene is `partying`.
 */
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

export const kororinBall = (pic: number) => `/planet-home/kor-${String(pic).padStart(2, '0')}.webp`;

/** the sunglasses over a painted ball (viewBox 0–100; scaled 1.42 about 50% 51% in CSS) */
export function KororinShades({ shades = 'round' }: { shades?: Shades }) {
  return (
    <svg className={s.ballFace} viewBox="0 0 100 100" aria-hidden data-testid="ball-face">
      {SHADES[shades]}
    </svg>
  );
}

/** a ball's small tilt of its own (the painted face looks a little its own way) */
export const ballTilt = (n: number) => (((n * 29) % 15) - 7) * 1.4 * 0.6;

/** a kororin, still (the picker, the chat card, reduced motion): its picture */
export function KororinPic({ pic, size = 58, turn }: { pic: number; size?: number; turn?: number }) {
  return (
    <span className={s.kororinPic} style={{ width: size, height: size }} data-pic={pic}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={kororinBall(pic)} draggable={false} style={turn === undefined ? undefined : { transform: `rotate(${ballTilt(turn).toFixed(1)}deg)` }} />
    </span>
  );
}

/** the picture a ball shows (its maker's choice, else from the ball's number and the name) */
export const ballPic = (w: { id?: string; author: { name: string; kororin?: { pic?: number | null } | null } }, i: number) => kororinPicOf(w.author.kororin, i, w.author.name);
