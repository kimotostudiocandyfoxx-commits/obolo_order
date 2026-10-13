import type { CSSProperties } from 'react';

/**
 * The Venus DJ's look (client request 2026-10-12: "パッと見てかっこいい、スタイリッシュな画面"):
 * dark brushed metal hardware, neon-lit buttons, a CDJ-style jog wheel and machined knobs.
 * The photo-real parts are painted by Seedream (design/ui-art-queue.json → public/dj/art); every
 * control still draws itself if a picture is missing.
 */
export const ART = {
  jog: '/dj/art/jog-b.jpg',
  knob: '/dj/art/knob-a.jpg',
  metal: '/dj/art/metal.jpg',
  club: '/dj/art/club-a.jpg',
  /** the start screen: the stage floating by Venus */
  stage: '/dj/art/club-b.jpg',
};

/** labels: a squared, technical face; numbers: a wide display face (both SIL OFL, bundled with the app via
 * @fontsource and imported by fonts.ts, so they load offline too and text never falls back to a wider face) */
export const FONT_UI = "'Rajdhani', 'M PLUS Rounded 1c', system-ui, sans-serif";
export const FONT_NUM = "'Orbitron', 'Rajdhani', system-ui, sans-serif";

export const NEON = {
  blue: '#3cc8ff',
  orange: '#ff9a3c',
  green: '#39ff9c',
  pink: '#ff4fa3',
  violet: '#a879ff',
  yellow: '#ffd84a',
  teal: '#3cf0c8',
  cyan: '#6ae0ff',
};

/** CDJ-style hot cue colours, one per pad */
export const HOT_CUE_COLORS = [NEON.pink, NEON.cyan, NEON.yellow, NEON.violet];

/**
 * A neon button face: dark glass with a tinted rim when off; lit from inside, glowing, when on.
 * Size and shape are added by the caller.
 */
export function neon(c: string, on: boolean, k: number): CSSProperties {
  return {
    fontFamily: FONT_UI,
    fontWeight: 700,
    letterSpacing: '0.06em',
    border: `${Math.max(1, 1.4 * k)}px solid ${on ? c : `${c}70`}`,
    color: on ? '#fff' : `${c}`,
    textShadow: on ? `0 0 ${4 * k}px #fff, 0 0 ${8 * k}px ${c}` : `0 0 ${4 * k}px ${c}99`,
    background: on ? `radial-gradient(circle at 50% 35%, ${c}cc 0%, ${c}55 55%, ${c}22 100%)` : 'radial-gradient(circle at 50% 28%, #2a2d36 0%, #121318 60%, #07080b 100%)',
    boxShadow: on
      ? `0 0 ${8 * k}px ${c}, 0 0 ${20 * k}px ${c}88, inset 0 0 ${6 * k}px rgba(255,255,255,0.45)`
      : `0 0 ${6 * k}px ${c}33, inset 0 ${k}px ${k}px rgba(255,255,255,0.14), inset 0 ${-2 * k}px ${4 * k}px rgba(0,0,0,0.7)`,
  };
}
