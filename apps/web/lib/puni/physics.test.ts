import { describe, expect, it } from 'vitest';
import { createBlob, poke, step, type BodyShape } from './physics';

const world = { W: 800, H: 1000, floor: 900 };
const shapes: BodyShape[] = ['round', 'tall', 'chunky', 'round', 'chunky'];

function settle(seconds: number, blobs = shapes.map((s, i) => createBlob(`b${i}`, 100 + i * 150, 100 + i * 40, 70, s))) {
  for (let t = 0; t < seconds; t += 1 / 120) step(blobs, 1 / 120, world);
  return blobs;
}

describe('puni physics', () => {
  it('stays stable and comes to rest on the floor', () => {
    const blobs = settle(6);
    for (const b of blobs) {
      expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
      expect(b.y).toBeLessThan(world.floor);
      expect(b.y).toBeGreaterThan(world.floor - 120);
      expect(Math.abs(b.vy)).toBeLessThan(40);
      for (const o of b.o) expect(Math.abs(o)).toBeLessThan(70);
    }
  });

  it('flattens where it touches the floor (squash wider than tall)', () => {
    const [b] = settle(4, [createBlob('a', 400, 300, 80, 'round')]);
    expect(b.sx).toBeGreaterThan(b.sy);
  });

  it('a poke dents it, then it springs back', () => {
    const [b] = settle(4, [createBlob('a', 400, 300, 80, 'round')]);
    poke(b, b.x + 80, b.y);
    let minO = 0;
    const blobs = [b];
    for (let t = 0; t < 0.1; t += 1 / 120) {
      step(blobs, 1 / 120, world);
      minO = Math.min(minO, b.o[0]);
    }
    expect(minO).toBeLessThan(-5);
    settle(4, blobs);
    expect(Math.abs(b.o[0])).toBeLessThan(6);
  });

  it('a thrown blob rolls and stands back up', () => {
    const [b] = settle(3, [createBlob('a', 200, 300, 70, 'round')]);
    b.vx = 900;
    const blobs = [b];
    let spun = 0;
    for (let t = 0; t < 0.6; t += 1 / 120) {
      step(blobs, 1 / 120, world);
      spun = Math.max(spun, Math.abs(b.angle));
    }
    expect(spun).toBeGreaterThan(1);
    settle(6, blobs);
    expect(Math.abs(Math.atan2(Math.sin(b.angle), Math.cos(b.angle)))).toBeLessThan(0.15);
  });
});
