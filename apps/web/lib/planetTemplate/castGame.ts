import type { CastGameKind } from './castWorks';
import type { Sfx } from './sound';

/**
 * Neptune's games of the cast (handoff planets-08 §3, the prototype's sapGame / kidGame): quick tap toys, one idea
 * each, played at once where the work opens (no case, no PRESS START).
 *   wobble   サーぽん — where you touch him he wobbles (ぷるぷる; a WebGL ripple over his picture)
 *   puff     ガリみ♡ — petals puff out softly from the touch
 *   jump     えびすけ — he jumps with a back flip
 *   spin     ウニまる — he spins, to the side you tapped
 *   ink      いかチョロ — ink blots where you touch, and he shrinks away from it
 *   scatter  しゃりお — grains of rice scatter and bounce on the floor
 *   snap     かにぶぅ — he walks sideways to where you tapped, bubbles rising
 * The residents and KIMORIN⭐︎ play one of the six kinds with their own chibi (res.json's gameKind).
 * This file is the game itself on a 600 × 600 board — the state, what a tap does and how it moves (castGame.test.ts);
 * components/planetTemplate/cast/TapGame.tsx draws it.
 */
export const BOARD = 600;
/** the counter's word per kind (the prototype's KIDG; サーぽん: ぷるぷる) */
export const GAME_LABEL: Record<CastGameKind, string> = { wobble: 'ぷるぷる', puff: 'ふわふわ', jump: 'ジャンプ', spin: 'くるくる', ink: 'スミ', scatter: 'パラパラ', snap: 'チョキ' };
/** each kind's own sound on a tap */
export const GAME_SFX: Record<CastGameKind, Sfx> = { wobble: 'poyo', puff: 'puff', jump: 'jump', spin: 'spin', ink: 'ink', scatter: 'scatter', snap: 'snap' };
export const GAME_KINDS = Object.keys(GAME_LABEL) as CastGameKind[];

export interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** gravity */
  g: number;
  /** what is left of it (≤ 0: gone) */
  a: number;
  s: number;
  c: string;
  shape: 'dot' | 'petal' | 'grain';
  spin: number;
  rot: number;
  floor: boolean;
  fade: number;
}
export interface Blot {
  x: number;
  y: number;
  r: number;
  R: number;
  a: number;
  s: number;
}
/** a ripple of the wobble (fractions of the board; `t` seconds since the touch) */
export interface Ripple {
  x: number;
  y: number;
  a: number;
  t: number;
}
export interface GameState {
  kind: CastGameKind;
  /** how many taps */
  count: number;
  /** the character: where it is and is heading (x), its height off the floor, its turn and squash */
  x: number;
  y: number;
  tx: number;
  h: number;
  vy: number;
  rot: number;
  vr: number;
  sq: number;
  flip: number;
  /** ink: seconds until it comes back to the middle (0: not away) */
  back: number;
  parts: Part[];
  blots: Blot[];
  ripples: Ripple[];
}

export function newGame(kind: CastGameKind): GameState {
  return { kind, count: 0, x: 300, y: 330, tx: 300, h: 0, vy: 0, rot: 0, vr: 0, sq: 0, flip: 0, back: 0, parts: [], blots: [], ripples: [] };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const part = (p: Partial<Part> & Pick<Part, 'x' | 'y' | 'vx' | 'vy' | 'a' | 's' | 'c'>): Part => ({ g: 0, shape: 'dot', spin: 0, rot: 0, floor: false, fade: 0.8, ...p });

/** a tap at (x, y) on the board; `rnd`: Math.random */
export function tapGame(st: GameState, x: number, y: number, rnd: () => number = Math.random): void {
  st.count++;
  switch (st.kind) {
    case 'wobble':
      st.ripples.push({ x: x / BOARD, y: y / BOARD, a: 0.09, t: 0.0001 });
      if (st.ripples.length > 6) st.ripples.splice(0, st.ripples.length - 6);
      break;
    case 'puff':
      st.sq = -0.18;
      for (let i = 0; i < 14; i++) {
        const an = rnd() * Math.PI * 2;
        const sp = 120 + rnd() * 220;
        st.parts.push(part({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 60, g: 60, a: 1.2, s: 8 + rnd() * 8, c: ['#ffc2d6', '#ffe7a3', '#ffd1e6'][i % 3], shape: 'petal', spin: rnd() * 6 - 3, fade: 0.7 }));
      }
      break;
    case 'jump':
      // only from the floor: a tap in the air does not jump again
      if (st.h < 5) {
        st.vy = 760;
        st.flip = 1;
        st.sq = -0.2;
      }
      for (let i = 0; i < 6; i++) st.parts.push(part({ x: st.x + (rnd() - 0.5) * 80, y: 540, vx: (rnd() - 0.5) * 120, vy: -80 - rnd() * 80, a: 0.8, s: 6 + rnd() * 6, c: 'rgba(255,255,255,.8)', fade: 1.2 }));
      break;
    case 'spin':
      st.vr += (x < st.x ? -1 : 1) * 9;
      for (let i = 0; i < 8; i++) {
        const an = rnd() * Math.PI * 2;
        st.parts.push(part({ x: st.x + Math.cos(an) * 150, y: st.y + Math.sin(an) * 150, vx: Math.cos(an) * 90, vy: Math.sin(an) * 90, a: 1, s: 5, c: '#ffd84a', fade: 1.4 }));
      }
      break;
    case 'ink':
      st.blots.push({ x, y, r: 6, R: 40 + rnd() * 40, a: 1, s: rnd() * 9 });
      st.sq = 0.2;
      st.tx = clamp(st.x + (st.x - x) * 0.5, 170, 430);
      st.back = 0.7;
      break;
    case 'scatter':
      st.sq = 0.15;
      for (let i = 0; i < 18; i++) {
        const an = -Math.PI * rnd();
        const sp = 200 + rnd() * 320;
        st.parts.push(part({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 1400, a: 2.2, s: 7, c: '#fffaf0', shape: 'grain', spin: rnd() * 10 - 5, floor: true, fade: 0.6 }));
      }
      break;
    case 'snap':
      st.tx = clamp(x, 160, 440);
      st.sq = -0.15;
      for (let i = 0; i < 5; i++) st.parts.push(part({ x: st.x + (rnd() - 0.5) * 100, y: st.y - 120 - rnd() * 60, vx: (rnd() - 0.5) * 40, vy: -120 - rnd() * 80, a: 1, s: 5 + rnd() * 7, c: 'rgba(190,235,255,.85)', fade: 0.9 }));
      break;
  }
}

/** `dt` seconds pass (at most 0.04 at a time, as the prototype) */
export function stepGame(st: GameState, dtIn: number): void {
  const dt = Math.min(0.04, Math.max(0, dtIn));
  st.x += (st.tx - st.x) * Math.min(1, dt * 6);
  if (st.back > 0) {
    st.back -= dt;
    if (st.back <= 0) {
      st.back = 0;
      st.tx = 300;
    }
  }
  if (st.h > 0 || st.vy) {
    st.vy -= 1600 * dt;
    st.h += st.vy * dt;
    if (st.h <= 0) {
      st.h = 0;
      st.vy = 0;
      st.sq = 0.25;
    }
  }
  st.rot += st.vr * dt;
  st.vr *= Math.pow(0.25, dt);
  // it comes upright again (a spinner only once it has slowed down)
  if (st.kind !== 'spin' || Math.abs(st.vr) < 0.2) st.rot += (Math.round(st.rot / (2 * Math.PI)) * 2 * Math.PI - st.rot) * Math.min(1, dt * 3);
  st.sq *= Math.pow(0.02, dt);
  st.flip *= Math.pow(0.05, dt);
  for (const b of st.blots) {
    b.a -= dt * 0.25;
    b.r += (b.R - b.r) * Math.min(1, dt * 10);
  }
  st.blots = st.blots.filter((b) => b.a > 0);
  for (const p of st.parts) {
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.a -= dt * p.fade;
    if (p.floor && p.y > 560) {
      p.y = 560;
      p.vy *= -0.45;
      p.vx *= 0.7;
    }
    p.rot += dt * p.spin;
  }
  st.parts = st.parts.filter((p) => p.a > 0);
  for (const r of st.ripples) r.t += dt;
  st.ripples = st.ripples.filter((r) => r.t < 1.6);
}

/** the wobble's ripples as the shader takes them: six of (x, y, strength, age) */
export function rippleUniform(st: GameState): Float32Array {
  const arr = new Float32Array(24);
  st.ripples.slice(-6).forEach((k, i) => arr.set([k.x, k.y, k.a, k.t], i * 4));
  return arr;
}

/** the wobble's shaders (the prototype's): each touch pushes the picture around it, ringing down */
export const WOBBLE_VS = 'attribute vec2 p;varying vec2 u;void main(){u=p*.5+.5;u.y=1.-u.y;gl_Position=vec4(p,0,1);}';
export const WOBBLE_FS =
  'precision mediump float;varying vec2 u;uniform sampler2D t;uniform vec4 h[6];void main(){vec2 q=u;for(int i=0;i<6;i++){vec4 k=h[i];if(k.w<=0.)continue;vec2 d=q-k.xy;float r=length(d);float a=k.z*exp(-r*r/0.025)*sin(k.w*28.)*exp(-k.w*3.2);q-=d*a*6.;}gl_FragColor=texture2D(t,q);}';
