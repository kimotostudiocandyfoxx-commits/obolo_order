import type { FigureWings } from '@obolo/shared';
import sharp from 'sharp';
import { saneWings, WING_BOUNDS, WING_MARGIN } from './figures';

export { WING_BOUNDS, WING_MARGIN };

/**
 * 03 §1 (Jupiter, client 2026-11-25): where a member's butterfly figure is cut into left wing / right wing / body, measured
 * on the stored cut-out PNG so a flapping wing never covers the face. The prototype's WB table (design/home/template.html)
 * was tuned by eye per character with the fold lines "always outside the face"; here the face is found by its skin:
 *  1. the picture at MEASURE_WIDTH, opaque = alpha over half; the figure's box (all opaque pixels)
 *  2. skin-coloured opaque pixels in the face zone — the top FACE_ZONE_H of the box, its middle FACE_ZONE_W
 *  3. the connected skin patch nearest the figure's middle (big enough): the face; its leftmost and rightmost columns
 *  4. the cut WING_MARGIN percent outside those, rounded; sane only when the body keeps the face and some wing is left
 * Anything else (no alpha, no skin — a robot, a mask —, a face off to one side) is null: the default cut (18 / 76).
 */
export const MEASURE_WIDTH = 256;
/** the face zone: the top part of the figure's box, its middle part (fractions of the box) */
export const FACE_ZONE_H = 0.65;
export const FACE_ZONE_W = 0.7;
/** the smallest face patch, as a fraction of the figure's box */
export const FACE_MIN_AREA = 0.004;

/** an anime skin tone: warm, light, not very saturated (wings in orange / pink / red / peach-saturated fail) */
export function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 140) return false;
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.06 || sat > 0.55) return false;
  // red the largest, green between red and blue (hue about 0–50°)
  return r >= g && g >= b - 4 && r - b >= 12;
}

/** the cut for a figure PNG (percent of its width), or null when it cannot be measured */
export async function measureWings(png: Buffer): Promise<FigureWings | null> {
  let raw: { data: Buffer; info: { width: number; height: number; channels: number } };
  try {
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || !meta.hasAlpha) return null;
    const h = Math.max(1, Math.round((MEASURE_WIDTH * meta.height) / meta.width));
    raw = await sharp(png).ensureAlpha().resize(MEASURE_WIDTH, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }
  return wingsOfPixels(raw.data, raw.info.width, raw.info.height, raw.info.channels);
}

/** the measuring on raw RGBA pixels (exported for the tests) */
export function wingsOfPixels(px: Uint8Array, W: number, H: number, ch = 4): FigureWings | null {
  const alpha = (i: number) => px[i * ch + 3];
  // 1. the figure's box
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (alpha(y * W + x) > 127) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  // 2. skin in the face zone
  const zx0 = Math.floor(x0 + (bw * (1 - FACE_ZONE_W)) / 2);
  const zx1 = Math.ceil(x1 - (bw * (1 - FACE_ZONE_W)) / 2);
  const zy1 = Math.ceil(y0 + bh * FACE_ZONE_H);
  const skin = new Uint8Array(W * H);
  for (let y = y0; y <= zy1 && y < H; y++)
    for (let x = zx0; x <= zx1; x++) {
      const i = y * W + x;
      if (alpha(i) > 127 && isSkin(px[i * ch], px[i * ch + 1], px[i * ch + 2])) skin[i] = 1;
    }
  // 3. the connected patches; the face: big enough, nearest the middle (ties: the bigger)
  const mid = (x0 + x1) / 2;
  const seen = new Uint8Array(W * H);
  let best: { l: number; r: number; area: number; dist: number } | null = null;
  const stack: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!skin[s] || seen[s]) continue;
    let l = W, r = -1, area = 0, sx = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      area++;
      sx += x;
      if (x < l) l = x;
      if (x > r) r = x;
      const near = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
      for (const n of near)
        if (n >= 0 && n < W * H && skin[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
    }
    if (area < FACE_MIN_AREA * bw * bh) continue;
    const dist = Math.abs(sx / area - mid);
    if (!best || dist < best.dist - bw * 0.05 || (Math.abs(dist - best.dist) <= bw * 0.05 && area > best.area)) best = { l, r, area, dist };
  }
  if (!best) return null;
  // 4. the cut, outside the face
  const pct = (x: number) => (x / W) * 100;
  const L = Math.round(pct(best.l) - WING_MARGIN);
  const R = Math.round(pct(best.r + 1) + WING_MARGIN);
  return saneWings(L, R);
}
