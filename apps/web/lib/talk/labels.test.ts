import { describe, expect, it } from 'vitest';
import { labelCandidates, placeLabels, type LabelFig, type Rect } from './labels';

const W = 390;
const H = 660;
/** a figure standing with its feet at (cx, feet), its body w × h above them, its label lw × 18 */
const fig = (cx: number, feet: number, bw: number, bh: number, lw = 50): LabelFig => ({ cx, feet, body: { x: cx - bw / 2, y: feet - bh, w: bw, h: bh }, w: lw, h: 18 });
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rectOf = (f: LabelFig, s: { x: number; y: number }): Rect => ({ x: s.x, y: s.y, w: f.w, h: f.h });

describe('placeLabels', () => {
  it('leaves every label under its feet when nothing collides', () => {
    const figs = [fig(80, 600, 60, 140), fig(300, 600, 60, 140), fig(190, 400, 40, 80)];
    const out = placeLabels(figs, { width: W, height: H });
    out.forEach((s, i) => {
      expect(s.c).toBe(0);
      expect(s.y).toBe(figs[i].feet + 3);
      expect(s.x).toBeCloseTo(figs[i].cx - figs[i].w / 2);
    });
  });

  it("moves a middle-row name off the front figure's head that stands over it", () => {
    // the middle-row figure's feet at 420; a big front figure whose head reaches up to 400, right under that name
    const mid = fig(200, 420, 40, 80);
    const front = fig(210, 640, 120, 240);
    const out = placeLabels([front, mid], { width: W, height: H });
    const r = rectOf(mid, out[1]);
    expect(overlap(r, front.body)).toBe(false);
    expect(out[1].c).not.toBe(0);
    // nor on its own figure
    expect(overlap(r, mid.body)).toBe(false);
  });

  it('keeps two neighbouring names apart', () => {
    const a = fig(150, 500, 30, 70, 80);
    const b = fig(190, 500, 30, 70, 80);
    const out = placeLabels([a, b], { width: W, height: H });
    expect(overlap(rectOf(a, out[0]), rectOf(b, out[1]))).toBe(false);
    expect(out[0].c).toBe(0);
    for (const [f, s] of [
      [a, out[0]],
      [b, out[1]],
    ] as const) {
      expect(overlap(rectOf(f, s), a === f ? b.body : a.body)).toBe(false);
    }
  });

  it('goes above the head when the sides are blocked, and avoids a soft place when it can', () => {
    const me = fig(200, 500, 40, 80);
    const left = fig(130, 560, 90, 130);
    const right = fig(270, 560, 90, 130);
    const out = placeLabels([me, left, right], { width: W, height: H, order: [1, 2, 0] });
    expect(out[0].y + me.h).toBeLessThanOrEqual(me.body.y);
    // a soft obstacle over the home: it steps aside rather than sit on it
    const solo = fig(200, 300, 40, 80);
    const soft = [{ x: 170, y: 300, w: 60, h: 30 }];
    const s = placeLabels([solo], { width: W, height: H, soft })[0];
    expect(overlap(rectOf(solo, s), soft[0])).toBe(false);
  });

  it('is stable: keeps its place while free and comes back home only with room to spare', () => {
    const mid = fig(200, 420, 40, 80);
    const front = fig(210, 640, 120, 240);
    const first = placeLabels([front, mid], { width: W, height: H });
    expect(first[1].c).not.toBe(0);
    // the front figure steps away just enough that home is barely free: the label stays where it is
    const edge = fig(200 + 25 + 60 + 3, 640, 120, 240);
    const second = placeLabels([edge, mid], { width: W, height: H, prev: first });
    expect(second[1].c).not.toBe(0);
    // far away: home again
    const away = fig(360, 640, 40, 240);
    expect(placeLabels([away, mid], { width: W, height: H, prev: second })[1].c).toBe(0);
  });

  it('keeps candidates inside the screen', () => {
    for (const r of labelCandidates(fig(5, 650, 30, 60, 80), W, H)) {
      expect(r.x).toBeGreaterThanOrEqual(2);
      expect(r.x + r.w).toBeLessThanOrEqual(W - 2);
      expect(r.y + r.h).toBeLessThanOrEqual(H);
    }
  });
});

describe('placeLabels in a crowd', () => {
  it('never puts one name on another even when no place is free of figures', () => {
    // a wall of figures: every candidate lies on some body, so each name takes the least-covering place
    const figs: LabelFig[] = [];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) figs.push(fig(30 + k * 55, 640 - r * 60, 60, 120, 54));
    const out = placeLabels(figs, { width: W, height: H });
    for (let i = 0; i < figs.length; i++)
      for (let j = i + 1; j < figs.length; j++) expect(overlap(rectOf(figs[i], out[i]), rectOf(figs[j], out[j])), `${i}~${j}`).toBe(false);
  });
});
