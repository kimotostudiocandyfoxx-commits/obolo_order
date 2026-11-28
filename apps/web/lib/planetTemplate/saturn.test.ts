import { describe, expect, it } from 'vitest';
import { templateConfig } from './config';
import type { FloorState } from './motion';
import {
  BUBBLE,
  bubbleX,
  depthScale,
  firstVoiceMs,
  floorMotion,
  floorOf,
  floorStart,
  floorStep,
  GROOVE,
  grooveAt,
  grooveEndMs,
  grooveRides,
  hopOf,
  HOP_ALONG,
  HOP_UP,
  keepInside,
  pileStart,
  pileStep,
  pushApart,
  rideAngle,
  ridePopMs,
  samplePileCount,
  shadesOf,
  shadowOf,
  stageBox,
  throwOf,
  toGround,
  toScreen,
  zOf,
} from './saturn';

const W = 390;
const H = 844;
const f = floorOf(W, H);
const st = (o: Partial<FloorState> = {}): FloorState => ({ gx: 0, gz: 0, h: 0, vh: 0, vgx: 0, vgz: 0, hopT: 0, ws: 0, wv: 0, R: 29, ...o });

describe('04 §1 the record floor (startSim3D, M-R308)', () => {
  it('the floor is the record on the picture covering the screen (390×844: the 9:16 picture is height-fitted, centred)', () => {
    const bw = (844 / 16) * 9;
    expect(f.cx).toBeCloseTo((390 - bw) / 2 + 0.481 * bw, 5);
    expect(f.cy).toBeCloseTo(0.702 * 844, 5);
    expect(f.rx).toBeCloseTo(0.574 * bw, 5);
    expect(f.ry).toBeCloseTo(0.1885 * 844, 5);
  });
  it('the size: 0.58× at the back (gz −1) → 1.18× at the front (gz +1), never outside', () => {
    expect(depthScale(-1)).toBeCloseTo(0.58);
    expect(depthScale(1)).toBeCloseTo(1.18);
    expect(depthScale(0)).toBeCloseTo(0.88);
    expect(depthScale(-5)).toBeCloseTo(0.58);
    expect(depthScale(5)).toBeCloseTo(1.18);
  });
  it('projection: x = cx + gx·rx, y = cy + gz·ry·0.86 − h·size; the back is higher on the screen; the ground point maps back', () => {
    const p = toScreen(f, 0.5, -0.4, 0);
    expect(p.x).toBeCloseTo(f.cx + 0.5 * f.rx);
    expect(p.y).toBeCloseTo(f.cy - 0.4 * f.ry * 0.86);
    expect(toScreen(f, 0, -1, 0).y).toBeLessThan(toScreen(f, 0, 1, 0).y);
    expect(toScreen(f, 0, 0, 100).y).toBeCloseTo(f.cy - 100 * 0.88);
    const g = toGround(f, p.x, p.y);
    expect(g.gx).toBeCloseTo(0.5);
    expect(g.gz).toBeCloseTo(-0.4);
    // off the record: kept on it
    expect(toGround(f, -1000, -1000)).toEqual({ gx: -0.95, gz: -0.92 });
  });
  it('the far ones are behind the near ones (stacking by depth)', () => {
    expect(zOf(-0.9)).toBeLessThan(zOf(0));
    expect(zOf(0)).toBeLessThan(zOf(0.9));
  });
  it('a hop: up 330–530, along 0.28–0.49, the next in 1–2.32 s; far out it goes back toward the middle', () => {
    for (let i = 0; i < 40; i++)
      for (let t = 0; t < 20; t += 0.37) {
        const h = hopOf(i, t, 0, 0);
        expect(h.up).toBeGreaterThanOrEqual(HOP_UP[0]);
        expect(h.up).toBeLessThanOrEqual(HOP_UP[1]);
        expect(h.along).toBeGreaterThanOrEqual(HOP_ALONG[0]);
        expect(h.along).toBeLessThanOrEqual(HOP_ALONG[1] + 1e-9);
        expect(h.next).toBeGreaterThanOrEqual(1);
        expect(h.next).toBeLessThanOrEqual(2.33);
      }
    const out = hopOf(3, 5, 0.8, 0.1);
    expect(Math.cos(out.dir)).toBeLessThan(0); // from the right edge, back to the left
  });
  it('bounce: falls in, lands (squashes), waits, hops up and comes down again — never under the floor', () => {
    const s = floorStart(2, H);
    expect(s.h).toBeGreaterThan(0);
    let t = 0;
    let landed = -1;
    let hopped = false;
    let squash = false;
    for (let k = 0; k < 600; k++) {
      t += 1 / 60;
      floorStep(s, 2, t, 1 / 60, f);
      expect(s.h).toBeGreaterThanOrEqual(0);
      if (s.wv > 0) squash = true;
      if (landed < 0 && s.h === 0) landed = t;
      if (landed >= 0 && s.vh > 0) hopped = true;
    }
    expect(landed).toBeGreaterThan(0);
    expect(squash).toBe(true);
    expect(hopped).toBe(true);
  });
  it('stays on the record and inside the screen sides', () => {
    const s = st({ gx: 2, gz: 2, vgx: 1, vgz: 1 });
    keepInside(s, f);
    expect(Math.hypot(s.gx, s.gz)).toBeLessThanOrEqual(0.9 + 1e-9);
    const sx = f.cx + s.gx * f.rx;
    expect(sx).toBeLessThanOrEqual(W * 0.95);
    expect(sx).toBeGreaterThanOrEqual(W * 0.05);
  });
  it('pushing: two on one spot move apart; the near pair needs more room (screen size); one in the air passes; a held one stays', () => {
    const a = st({ gx: 0, gz: 0.5 });
    const b = st({ gx: 0.02, gz: 0.5 });
    expect(pushApart(a, b, f)).toBe(true);
    expect(a.gx).toBeLessThan(0);
    expect(b.gx).toBeGreaterThan(0.02);
    // near vs far: the same floor gap is "touching" at the front but not at the back
    const gap = 0.14;
    expect(pushApart(st({ gx: 0, gz: 0.9 }), st({ gx: gap, gz: 0.9 }), f)).toBe(true);
    expect(pushApart(st({ gx: 0, gz: -0.9 }), st({ gx: gap, gz: -0.9 }), f)).toBe(false);
    expect(pushApart(st({ gx: 0 }), st({ gx: 0.01, h: 200 }), f)).toBe(false);
    const held = st({ gx: 0 });
    const other = st({ gx: 0.01 });
    pushApart(held, other, f, true, false);
    expect(held.gx).toBe(0);
    expect(other.gx).toBeGreaterThan(0.01);
  });
  it('the shadow: under it on the floor, smaller and fainter as it goes up', () => {
    const lo = shadowOf(f, st({ gz: 0.2 }));
    const hi = shadowOf(f, st({ gz: 0.2, h: 200 }));
    expect(hi.w).toBeLessThan(lo.w);
    expect(hi.o).toBeLessThan(lo.o);
    expect(lo.o).toBeCloseTo(0.45);
    expect(lo.x + lo.w / 2).toBeCloseTo(hi.x + hi.w / 2);
    expect(hi.w).toBeGreaterThanOrEqual(lo.w * 0.5 - 1e-9);
  });
  it('thrown: along the floor the way it was thrown, capped', () => {
    const t = throwOf(f, 900, -300);
    expect(t.vgx).toBeGreaterThan(0);
    expect(t.vgz).toBeLessThan(0);
    expect(t.vh).toBeLessThanOrEqual(500);
    expect(Math.abs(throwOf(f, 99999, 0).vgx)).toBe(1.6);
  });
  it('the motion: eight, they fall in, then settle on the floor with their size by depth; near drawn in front', () => {
    expect(floorMotion.max).toBe(8);
    const bs = Array.from({ length: 8 }, (_, n) => floorMotion.spawn(n, n, W, H));
    for (let k = 0; k < 240; k++) {
      for (const b of bs) floorMotion.step(b, 1 / 60, W, H);
      floorMotion.settle!(bs, 1 / 60, W, H);
    }
    for (const b of bs) {
      const s = b.floor!;
      expect(b.size / (s.R / 29)).toBeGreaterThanOrEqual(0.58 - 1e-9);
      expect(b.size / (s.R / 29)).toBeLessThanOrEqual(1.18 + 1e-9);
      expect(b.z).toBe(zOf(s.gz));
      expect(b.shadow).not.toBeNull();
    }
    // dragged up the screen: smaller (further); let go: it flies with the throw
    const b = bs[0];
    b.drag = true;
    b.x = W / 2;
    b.y = f.cy - f.ry * 0.7;
    floorMotion.drag!(b, W, H);
    const far = b.size;
    b.y = f.cy + f.ry * 0.7;
    floorMotion.drag!(b, W, H);
    expect(b.size).toBeGreaterThan(far);
    b.vx = 600;
    b.vy = 0;
    floorMotion.drop(b, W, H);
    b.drag = false;
    expect(b.floor!.vgx).toBeGreaterThan(0);
    expect(b.floor!.vh).toBeGreaterThan(0);
  });
  it('sunglasses: round 7 in 10, the others 3', () => {
    const all = Array.from({ length: 100 }, (_, i) => shadesOf(i));
    expect(all.filter((x) => x === 'round').length).toBe(70);
    expect(new Set(all)).toEqual(new Set(['round', 'way', 'star', 'heart']));
  });
});

describe('04 §2 ▶ the groove (M-R289 / M-R290 / M-R304)', () => {
  it('the first kororin talks at about 2.3 s, and the template says so (introMs)', () => {
    expect(firstVoiceMs()).toBeGreaterThan(2200);
    expect(firstVoiceMs()).toBeLessThan(2400);
    expect(Math.abs(templateConfig('saturn').introMs - firstVoiceMs())).toBeLessThan(100);
  });
  it('the first three start partway along the groove, then one every 2.6 s from the start of the groove', () => {
    const r = grooveRides(6);
    expect(r.slice(0, 3).map((x) => x.from)).toEqual([GROOVE.pop + 22, GROOVE.pop + 69, GROOVE.pop + 116]);
    expect(r[3].from).toBe(GROOVE.a0);
    expect(r[4].startMs - r[3].startMs).toBe(2600);
    expect(ridePopMs(r[0])).toBeLessThan(ridePopMs(r[1]));
    expect(ridePopMs(r[1])).toBeLessThan(ridePopMs(r[2]));
  });
  it('3–4 on the record at once once it is going; a ride is 10.5 s end to end; then it ends', () => {
    const r = grooveRides(10);
    for (let ms = 3000; ms < 20000; ms += 250) {
      const on = r.filter((x) => rideAngle(x, ms) != null).length;
      expect(on).toBeGreaterThanOrEqual(2);
      expect(on).toBeLessThanOrEqual(5);
    }
    expect(rideAngle(r[9], grooveEndMs(10) + 1)).toBeNull();
    expect(rideAngle({ k: 0, startMs: 0, from: GROOVE.a0 }, 10_499)).not.toBeNull();
    expect(rideAngle({ k: 0, startMs: 0, from: GROOVE.a0 }, 10_501)).toBeNull();
  });
  it('the groove: far at the top small, near at the bottom big; it pops on the left arc', () => {
    const back = grooveAt(GROOVE.a0, W, H);
    const pop = grooveAt(GROOVE.pop, W, H);
    const front = grooveAt(GROOVE.a1, W, H);
    expect(back.y).toBeLessThan(front.y);
    expect(back.s).toBeLessThan(front.s);
    expect(pop.x).toBeLessThan(W * 0.4);
    expect(pop.x).toBeGreaterThan(0);
  });
});

describe('04 §3 the profile: the 2D stage (M-R304)', () => {
  it('the sample piles 18 of your own, 10–13 of a dachi', () => {
    expect(samplePileCount('ミナト★', true)).toBe(18);
    for (const n of ['a', 'ab', 'abc', 'abcd', 'MONBAN']) {
      expect(samplePileCount(n, false)).toBeGreaterThanOrEqual(10);
      expect(samplePileCount(n, false)).toBeLessThanOrEqual(13);
    }
  });
  it('they fall and pile on the stone ground between the speakers; the newest is NEW and a little bigger', () => {
    const bs = pileStart(13, W, H);
    expect(bs.filter((b) => b.isNew).map((b) => b.j)).toEqual([12]);
    const { L, R, F } = stageBox(W, H);
    for (let k = 0; k < 60 * 8; k++) pileStep(bs, 1 / 60, W, H);
    for (const b of bs) {
      expect(b.y + b.r).toBeLessThanOrEqual(F + 2);
      expect(b.x - b.r).toBeGreaterThanOrEqual(L - 2);
      expect(b.x + b.r).toBeLessThanOrEqual(R + 2);
    }
    // piled: some rest on the ground, little overlap
    expect(bs.filter((b) => Math.abs(b.y + b.r - F) < 1).length).toBeGreaterThan(3);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) expect(Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y)).toBeGreaterThan(bs[i].r + bs[j].r - 12);
  });
});

describe('the pop’s bubble (story 2026-11-28: the prototype’s .bub)', () => {
  it('above the one speaking, its middle within 24%–76% of the screen, a wide one pushed in to stay whole', () => {
    expect(BUBBLE.maxW).toBe(0.62);
    expect(bubbleX(195, 120, 390)).toBe(195);
    expect(bubbleX(250, 100, 390)).toBe(250);
    // a short bubble near an edge: the prototype's 24% / 76%
    expect(bubbleX(10, 80, 390)).toBeCloseTo(390 * 0.24);
    expect(bubbleX(380, 80, 390)).toBeCloseTo(390 * 0.76);
    // the widest (62%): pushed in just enough to stay on the screen
    const w = 390 * 0.62;
    expect(bubbleX(10, w, 390) - w / 2).toBeGreaterThanOrEqual(0);
    expect(bubbleX(380, w, 390) + w / 2).toBeLessThanOrEqual(390);
  });
});
