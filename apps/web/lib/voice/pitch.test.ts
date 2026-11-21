import { describe, expect, it } from 'vitest';
import { semitoneRatio, wsolaStretch } from './pitch';

/** zero crossings per second ≈ 2 × frequency */
function freq(x: Float32Array, sr: number) {
  let n = 0;
  for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n++;
  return n / 2 / (x.length / sr);
}

describe('pitch without changing speed (WSOLA + playback rate)', () => {
  it('+2 is the same ratio as the server (2^(2/12))', () => {
    expect(semitoneRatio(2)).toBeCloseTo(1.1225, 3);
  });
  it('stretches to r× the length and keeps the pitch', () => {
    const sr = 44100;
    const x = new Float32Array(sr * 2).map((_, i) => Math.sin((2 * Math.PI * 220 * i) / sr));
    const r = semitoneRatio(4);
    const y = wsolaStretch(x, r, sr);
    expect(y.length / x.length).toBeCloseTo(r, 2);
    // played back at rate r it is back to 2 s and 220 × r Hz; before that, the stretch alone keeps 220 Hz
    expect(freq(y.subarray(4096, y.length - 4096), sr)).toBeGreaterThan(210);
    expect(freq(y.subarray(4096, y.length - 4096), sr)).toBeLessThan(230);
  });
});
