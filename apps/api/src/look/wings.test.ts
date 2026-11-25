import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { decodeWings, encodeWings, saneWings, wingsOf, wingsToMeasure, WINGS_KEY, type FigureStore } from './figures';
import { isSkin, measureWings, WING_MARGIN } from './wings';

type Rgba = [number, number, number, number];
const SKIN: Rgba = [255, 222, 196, 255];
const HAIR: Rgba = [92, 58, 40, 255];
const WING: Rgba = [120, 170, 255, 255];
const DRESS: Rgba = [240, 120, 160, 255];

/** a synthetic butterfly figure: transparent, wings on both sides, a body, a head (hair + a skin face) in the middle */
async function figure(o: { W?: number; face?: { cx: number; cy: number; r: number }; skin?: Rgba; wings?: Rgba; alpha?: boolean } = {}): Promise<Buffer> {
  const W = o.W ?? 400;
  const px = Buffer.alloc(W * W * 4);
  const set = (x: number, y: number, c: Rgba) => {
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    px.set(c, (y * W + x) * 4);
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: Rgba) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, c);
  };
  const f = o.face ?? { cx: W * 0.5, cy: W * 0.3, r: W * 0.13 };
  // the wings (behind), reaching up beside the head
  ellipse(W * 0.2, W * 0.4, W * 0.19, W * 0.25, o.wings ?? WING);
  ellipse(W * 0.8, W * 0.4, W * 0.19, W * 0.25, o.wings ?? WING);
  // the body and the legs
  ellipse(W * 0.5, W * 0.66, W * 0.12, W * 0.2, DRESS);
  // the head: hair around, the face in front
  ellipse(f.cx, f.cy - f.r * 0.15, f.r * 1.3, f.r * 1.25, HAIR);
  ellipse(f.cx, f.cy, f.r, f.r * 0.9, o.skin ?? SKIN);
  const png = sharp(px, { raw: { width: W, height: W, channels: 4 } });
  return o.alpha === false ? png.removeAlpha().jpeg().toBuffer() : png.png().toBuffer();
}

describe('03 §1: the wing cut measured on the painted figure', () => {
  it('a face in the middle: the cut just outside its edges, wings left on both sides', async () => {
    const W = 400;
    const r = W * 0.13;
    const w = await measureWings(await figure({ W }));
    expect(w).not.toBeNull();
    const faceL = ((W * 0.5 - r) / W) * 100;
    const faceR = ((W * 0.5 + r) / W) * 100;
    // never inside the face (the wing never covers it), at most a few percent further out
    expect(w!.l).toBeLessThanOrEqual(faceL);
    expect(w!.r).toBeGreaterThanOrEqual(faceR);
    expect(w!.l).toBeGreaterThanOrEqual(faceL - WING_MARGIN - 2);
    expect(w!.r).toBeLessThanOrEqual(faceR + WING_MARGIN + 2);
  });
  it('a wider face moves the cut out; a face a little to one side moves it with the face', async () => {
    const wide = (await measureWings(await figure({ face: { cx: 200, cy: 120, r: 72 } })))!;
    const narrow = (await measureWings(await figure({ face: { cx: 200, cy: 120, r: 40 } })))!;
    expect(wide.l).toBeLessThan(narrow.l);
    expect(wide.r).toBeGreaterThan(narrow.r);
    const right = (await measureWings(await figure({ face: { cx: 230, cy: 120, r: 48 } })))!;
    expect(right.l).toBeGreaterThan(narrow.l);
    expect(right.r).toBeGreaterThan(narrow.r);
  });
  it('the wings in a warm, saturated colour are not taken for the face', async () => {
    expect(isSkin(...SKIN.slice(0, 3) as [number, number, number])).toBe(true);
    expect(isSkin(255, 140, 0)).toBe(false); // orange
    expect(isSkin(255, 150, 200)).toBe(false); // pink
    expect(isSkin(120, 170, 255)).toBe(false); // blue
    expect(isSkin(90, 60, 40)).toBe(false); // dark hair
    const w = await measureWings(await figure({ wings: [255, 140, 0, 255] }));
    expect(w).not.toBeNull();
    expect(w!.r - w!.l).toBeLessThan(45);
  });
  it('no face to find (no skin), no transparency, or a face at the edge: null — the default cut', async () => {
    expect(await measureWings(await figure({ skin: [80, 200, 120, 255] }))).toBeNull();
    expect(await measureWings(await figure({ alpha: false }))).toBeNull();
    expect(await measureWings(await figure({ face: { cx: 30, cy: 120, r: 30 } }))).toBeNull();
    expect(await measureWings(Buffer.from('not a picture'))).toBeNull();
  });
  it('kept with the figure as "l,r" (or "none"), read back only when sane; the backfill finds the unmeasured', () => {
    expect(encodeWings({ l: 22, r: 74 })).toBe('22,74');
    expect(encodeWings(null)).toBe('none');
    expect(decodeWings('22,74')).toEqual({ l: 22, r: 74 });
    expect(decodeWings('none')).toBeNull();
    expect(decodeWings('60,62')).toBeNull();
    expect(saneWings(1, 90)).toBeNull();
    expect(saneWings(3, 90)).toEqual({ l: 5, r: 90 });
    const store: FigureStore = { a: { jupiter: 'https://x/a.png', [WINGS_KEY]: '20,72' }, b: { jupiter: 'https://x/b.png' }, c: { mercury: 'https://x/c.png' }, d: { jupiter: 'https://x/d.png', [WINGS_KEY]: 'none' } };
    expect(wingsOf(store, 'a')).toEqual({ l: 20, r: 72 });
    expect(wingsOf(store, 'b')).toBeNull();
    expect(wingsOf(store, 'd')).toBeNull();
    expect(wingsToMeasure(store)).toEqual(['b']);
  });
});
