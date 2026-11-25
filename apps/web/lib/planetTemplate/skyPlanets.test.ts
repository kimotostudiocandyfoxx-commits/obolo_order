import { HOME_PLANETS } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { floorOf } from './saturn';
import { SKY_SLOTS } from './sky';
import { flutterMotion, GLADE, hitSlot, LAND_MAX, landingLayout, landMotionOf, landNameSize, PLAZA_REC, plazaMotion, SKY_PLANETS, slotRect } from './skyPlanets';

const W = 390;
const H = 844;

describe('landing: each planet’s figures (06 §5)', () => {
  it('seven at most', () => {
    for (const p of HOME_PLANETS) expect(landingLayout(p, 12, W, H)).toHaveLength(LAND_MAX);
    expect(landingLayout('mercury', 3, W, H)).toHaveLength(3);
  });

  it('Mercury: ships on the sea lanes only (from .42 down), sailing left or right', () => {
    const bs = landingLayout('mercury', 7, W, H);
    expect(landMotionOf('mercury').kind).toBe('sail');
    for (const b of bs) {
      expect(b.y / H).toBeGreaterThanOrEqual(0.42);
      expect(b.y / H).toBeLessThanOrEqual(0.9);
      expect(b.v).not.toBe(0);
    }
    // they go both ways
    expect(new Set(bs.map((b) => Math.sign(b.v))).size).toBe(2);
    const m = landMotionOf('mercury');
    const b = bs[0];
    const y0 = b.lane;
    for (let k = 0; k < 120; k++) m.step(b, 1 / 60, W, H);
    expect(b.lane).toBe(y0);
    // dropped in the sky, it goes down to the water
    b.x = 100;
    b.y = 50;
    m.drop(b, W, H);
    expect(b.y / H).toBeCloseTo(0.42, 6);
  });

  it('Jupiter (and the five): butterflies flutter around the glade’s seven places, flying in from either side', () => {
    for (const p of ['jupiter', 'mars', 'venus', 'uranus', 'pluto', 'neptune'] as const) expect(landMotionOf(p)).toBe(flutterMotion);
    const bs = landingLayout('jupiter', 7, W, H);
    bs.forEach((b, i) => {
      expect([b.cx, b.cy, b.size]).toEqual([...GLADE[i]]);
      expect(b.x < 0 || b.x > W).toBe(true);
    });
    // after a while each is near its place, never far
    const b = bs[3];
    for (let k = 0; k < 600; k++) flutterMotion.step(b, 1 / 60, W, H);
    expect(Math.abs(b.x / W - GLADE[3][0])).toBeLessThan(0.08);
    expect(Math.abs(b.y / H - GLADE[3][1])).toBeLessThan(0.04);
    expect(Math.abs(b.rot)).toBeLessThanOrEqual(14);
    // dropped: it stays there (inside the glade), bigger lower down
    b.x = W * 0.5;
    b.y = H * 0.85;
    flutterMotion.drop(b, W, H);
    const big = b.size;
    expect(b.y / H).toBeCloseTo(0.85, 5);
    b.x = W * 1.5;
    b.y = H * 0.1;
    flutterMotion.drop(b, W, H);
    expect(b.x / W).toBeLessThanOrEqual(0.94);
    expect(b.y / H).toBeGreaterThanOrEqual(0.34);
    expect(b.size).toBeLessThan(big);
  });

  it('Saturn: kororins hop on the plaza’s record (inside its ellipse), nearer ones bigger and in front', () => {
    expect(landMotionOf('saturn')).toBe(plazaMotion);
    expect(plazaMotion.kind).toBe('floor');
    const bs = landingLayout('saturn', 7, W, H);
    const f = floorOf(W, H, PLAZA_REC);
    let t = 0;
    for (let k = 0; k < 400; k++) {
      for (const b of bs) plazaMotion.step(b, 1 / 60, W, H);
      plazaMotion.settle!(bs, 1 / 60, W, H);
      t += 1 / 60;
    }
    expect(t).toBeGreaterThan(6);
    for (const b of bs) {
      const st = b.floor!;
      expect(Math.hypot(st.gx, st.gz)).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(b.shadow).not.toBeNull();
      // on the plaza's record, not the home's
      expect(Math.abs(b.shadow!.y + b.shadow!.w * 0.12 - (f.cy + st.gz * f.ry * 0.86))).toBeLessThan(1);
    }
    const near = [...bs].sort((a, b) => b.floor!.gz - a.floor!.gz)[0];
    const far = [...bs].sort((a, b) => a.floor!.gz - b.floor!.gz)[0];
    expect(near.z!).toBeGreaterThan(far.z!);
  });

  it('every planet has its shore path, hold and words', () => {
    for (const p of HOME_PLANETS) {
      const s = SKY_PLANETS[p];
      expect(s.shore.to.y).toBeGreaterThan(0);
      expect(s.whoTop).toBeGreaterThan(0.5);
      expect(s.home).toMatch(/^きみの/);
    }
    // a song / an MV stays until it has finished; the others a set time
    expect(SKY_PLANETS.mercury.holdMs).toBeNull();
    expect(SKY_PLANETS.mars.holdMs).toBeNull();
    expect(SKY_PLANETS.jupiter.holdMs).toBe(7000);
    expect(SKY_PLANETS.saturn.holdMs).toBe(5000);
    // Mercury's ships come from the left, Jupiter's butterflies and Saturn's kororins from above
    expect(SKY_PLANETS.mercury.shore.from.x).toBeLessThan(0);
    expect(SKY_PLANETS.jupiter.shore.from.y).toBeLessThan(0.1);
    expect(SKY_PLANETS.saturn.shore.from.y).toBeLessThan(0);
  });
});

describe('swap by dragging the new island onto one of yours (06 §3)', () => {
  const rects = SKY_SLOTS.map((S, i) => slotRect(i, S, W, H));
  it('the island under the finger', () => {
    SKY_SLOTS.forEach((S, i) => expect(hitSlot(S[0] * W, S[1] * H, rects)).toBe(i));
  });
  it('nowhere near an island: none (the drop does nothing)', () => {
    expect(hitSlot(W * 0.5, H * 0.95, rects)).toBeNull();
    expect(hitSlot(-50, -50, rects)).toBeNull();
  });
  it('a little outside the picture still counts; overlapping boxes go to the nearest centre', () => {
    const r = rects[2];
    expect(hitSlot(r.right + 10, (r.top + r.bottom) / 2, rects)).toBe(2);
    expect(hitSlot(r.right + 30, (r.top + r.bottom) / 2, rects, 14)).not.toBe(2);
    const a = { i: 0, left: 0, top: 0, right: 100, bottom: 100 };
    const b = { i: 1, left: 80, top: 0, right: 180, bottom: 100 };
    expect(hitSlot(95, 50, [a, b])).toBe(1);
    expect(hitSlot(75, 50, [a, b])).toBe(0);
  });
});

describe('the landed name fits in 46% of the width (06 §5)', () => {
  it('44 px at most, smaller for a long name', () => {
    expect(landNameSize('EDM大陸', W)).toBe(35);
    expect(landNameSize('雨', W)).toBe(44);
    expect(landNameSize('レトロポップ広場', W) * 8).toBeLessThanOrEqual(W * 0.46);
  });
});
