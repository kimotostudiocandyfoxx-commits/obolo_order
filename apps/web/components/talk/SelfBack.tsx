'use client';

import type { TalkLook } from '@obolo/shared';
import { viewsOf } from '@/lib/story/views';
import type { Rect } from '@/lib/talk/labels';
import { Figure } from './Figure';

/**
 * R9 (client): your own back in the over-the-shoulder framing — a soft presence in the lower right, bigger than the one
 * you look at, blurred (depth of field) and spilling off the right edge. TalkScene's {bati} talk places it with these
 * numbers (its stage); the ダチ hall and plain (MoonTabs, R10) draw the same picture the same way with SelfBack.
 */
export const OTS_BACK = {
  /** its centre, as a fraction of the width */
  x: 0.9,
  /** its feet, below the stage's bottom, and its height: in stage heights */
  drop: 1.15,
  h: 2.05,
  /** its box's width, as a fraction of the screen's */
  w: 0.8,
  filter: 'blur(3.5px) brightness(.9)',
} as const;

/** the talk stage's height and its bottom (the dock under it) for a screen h tall (TalkScene's, without the keyboard) */
export const otsStage = (h: number) => ({ stageH: Math.min(h * 0.46, 420), dock: 110 });

type Back = { src?: string; pw: number; ph: number; head: number[]; box: number[] };
/** the back view (talk-user's, as in the {bati} talk) and where its figure is in its picture (views.json's box and head) */
const CAST_BACK: Back = (() => {
  const v = viewsOf('talk-user');
  return { src: v?.back, pw: 355, ph: 900, head: [95, 173, 164, 215], box: [68, 173, 217, 718] };
})();
/**
 * client 2026-11-25: your own look's back view (Me.lookBack) — a square cut-out (1024, the figure about 94% of its height
 * with a 3% margin, centred like every cut-out of the talk); where its head and body are is an estimate of that framing
 */
const ownBack = (src: string): Back => ({ src, pw: 1024, ph: 1024, head: [392, 31, 240, 200], box: [312, 31, 400, 962] });
/** the back to draw: your own when it is made, else the talk cast's */
const backOf = (own?: string | null): Back => (own ? ownBack(own) : CAST_BACK);

/** where the back stands on a screen w × h: its picture's box (left, top, width, height), from the screen's top left */
function backBox(w: number, h: number, lift = 0, BACK: Back = CAST_BACK) {
  const { stageH, dock } = otsStage(h);
  const fh = stageH * OTS_BACK.h;
  const fw = (fh * BACK.pw) / BACK.ph;
  const bottom = dock - stageH * OTS_BACK.drop - lift;
  return { left: w * OTS_BACK.x - fw / 2, top: h - bottom - fh, fw, fh, bottom };
}

/**
 * The back's visible parts on a screen w × h (head, then shoulders and body), from the screen's top left — for what
 * must not hide under it (the ダチ's names). `lift` (px, negative = lower) as given to SelfBack.
 */
export function selfBackRects(w: number, h: number, lift = 0, own?: string | null): Rect[] {
  const BACK = backOf(own);
  if (!BACK.src || !w || !h) return [];
  const b = backBox(w, h, lift, BACK);
  const k = b.fh / BACK.ph;
  const [hx, hy, hw, hh] = BACK.head;
  const [bx, , bw, bh] = BACK.box;
  const head = { x: b.left + hx * k, y: b.top + hy * k, w: hw * k, h: hh * k };
  const body = { x: b.left + bx * k, y: head.y + head.h, w: bw * k, h: (BACK.box[1] + bh - hy - hh) * k };
  return [head, body];
}

/** your back, big and blurred at the lower right, over the place and its people but never in the way of a tap */
export function SelfBack({ w, h, lift = 0, reduced = false, className = '', style, own }: { w: number; h: number; /** px up (negative: lower) from the talk's placement */ lift?: number; reduced?: boolean; className?: string; style?: React.CSSProperties; /** client 2026-11-25: your look's own back view (Me.lookBack); the talk cast's without it */ own?: string | null }) {
  const BACK = backOf(own);
  if (!BACK.src || !w || !h) return null;
  const { stageH } = otsStage(h);
  const b = backBox(w, h, lift, BACK);
  const look: TalkLook = { of: 'me-view', stand: BACK.src, faces: { normal: { kind: 'image', url: BACK.src } } };
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute flex -translate-x-1/2 items-end justify-center ${className}`}
      style={{ left: `${OTS_BACK.x * 100}%`, bottom: b.bottom, width: `${OTS_BACK.w * 100}%`, height: stageH * OTS_BACK.h, filter: OTS_BACK.filter, ...style }}
      data-testid="self-back"
    >
      <Figure look={look} named={null} state="idle" toward="left" height={stageH * OTS_BACK.h} breath={4.1} reduced={reduced} />
    </div>
  );
}
