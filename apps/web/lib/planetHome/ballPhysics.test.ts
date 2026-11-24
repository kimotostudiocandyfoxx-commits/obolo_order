import { describe, expect, it } from 'vitest';
import { newBall, press, release, spring, stepBalls, type BallWorld } from './ballPhysics';

const world: BallWorld = { floor: 500, left: 0, right: 300 };

describe('M-R265: the balls’ engine', () => {
  it('falls, comes to rest on the floor, and pile-ups push apart', () => {
    const balls = [newBall('a', 100, 0, 25, 0), newBall('b', 105, -80, 25, 1)];
    for (let i = 0; i < 240; i++) stepBalls(balls, 1 / 60, i / 60, world);
    for (const b of balls) expect(b.y + b.R).toBeLessThanOrEqual(world.floor + 0.5);
    expect(Math.hypot(balls[0].x - balls[1].x, balls[0].y - balls[1].y)).toBeGreaterThan(40);
  });
  it('the spring (70 / 4.2, 4 sub-steps) springs back after a press and settles', () => {
    const b = newBall('a', 0, 0, 25, 0);
    press(b);
    let min = 0;
    for (let i = 0; i < 20; i++) {
      spring(b, 1 / 60);
      min = Math.min(min, b.ws);
    }
    expect(min).toBeLessThan(-0.05);
    release(b);
    for (let i = 0; i < 400; i++) spring(b, 1 / 60);
    expect(Math.abs(b.ws)).toBeLessThan(0.01);
  });
  it('the drawn squash eases (never jumps); reduced motion: no breathing, no stretch', () => {
    const b = newBall('a', 100, 474, 25, 0);
    b.wv = 6;
    const before = b.sx;
    stepBalls([b], 1 / 60, 0, world);
    // at most 45% of the way in one frame
    expect(Math.abs(b.sx - before)).toBeLessThan(0.3 * 0.45 + 0.06);
    const r = newBall('r', 100, 474, 25, 0);
    r.vx = 1200;
    for (let i = 0; i < 30; i++) stepBalls([r], 1 / 60, i, { ...world, reduced: true });
    expect(r.tilt).toBe(0);
  });
});
