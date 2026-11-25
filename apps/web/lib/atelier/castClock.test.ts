import { describe, expect, it } from 'vitest';
import { clockFace, clockOrder, mmss, OVERDUE_WORDS, ringDash } from './castClock';

const T0 = Date.parse('2026-11-25T10:00:00Z');
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
const job = (startS: number, etaS: number, extra: object = {}) => ({ status: 'running' as const, createdAt: at(startS - 2), startedAt: at(startS), etaAt: at(etaS), ...extra });

describe('clockFace', () => {
  it('fills as elapsed / the time given', () => {
    const j = job(0, 200);
    expect(clockFace(j, T0).fill).toBe(0);
    expect(clockFace(j, T0 + 60_000).fill).toBeCloseTo(0.3);
    expect(clockFace(j, T0 + 180_000).fill).toBeCloseTo(0.9);
  });
  it('counts down in mm:ss (seconds rounded up), words when long', () => {
    expect(clockFace(job(0, 200), T0 + 60_000).numerals).toBe('02:20');
    expect(clockFace(job(0, 200), T0 + 199_500).numerals).toBe('00:01');
    const long = clockFace(job(0, 1500), T0 + 60_000);
    expect(long.numerals).toBe('あと24分');
    expect(long.words).toBe(true);
  });
  it('overdue: full ring, gentle words, never negative', () => {
    const f = clockFace(job(0, 100), T0 + 130_000);
    expect(f).toMatchObject({ fill: 1, left: 0, overdue: true, numerals: OVERDUE_WORDS });
    expect(clockFace(job(0, 100), T0 + 100_000).overdue).toBe(true);
  });
  it('a job the server moved on (late) stays 「もうすこし…」 instead of counting again', () => {
    const f = clockFace(job(0, 160, { late: true }), T0 + 101_000);
    expect(f.overdue).toBe(true);
    expect(f.numerals).toBe(OVERDUE_WORDS);
  });
  it('no time yet: an empty clock without numerals; a quick one: no numerals', () => {
    expect(clockFace(undefined, T0)).toMatchObject({ fill: 0, numerals: null });
    expect(clockFace({ ...job(0, 20), etaAt: null }, T0).numerals).toBeNull();
    const q = clockFace(job(0, 20), T0 + 10_000, false);
    expect(q.numerals).toBeNull();
    expect(q.fill).toBeCloseTo(0.5);
  });
  it('falls back to createdAt when not started', () => {
    expect(clockFace({ status: 'queued', createdAt: at(0), etaAt: at(100) }, T0 + 25_000).fill).toBeCloseTo(0.25);
  });
});

describe('clockOrder', () => {
  it('the soonest to finish first, overdue / late before it, no time last', () => {
    const xs = [
      { id: 'later', job: job(0, 300) },
      { id: 'none', job: undefined },
      { id: 'soon', job: job(0, 120) },
      { id: 'late', job: job(0, 400, { late: true }) },
      { id: 'over', job: job(0, 50) },
    ];
    expect(clockOrder(xs, T0 + 60_000).map((x) => x.id)).toEqual(['late', 'over', 'soon', 'later', 'none']);
  });
  it('keeps the order of equal ones', () => {
    const xs = [{ id: 'a', job: job(0, 100) }, { id: 'b', job: job(0, 100) }];
    expect(clockOrder(xs, T0).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('ringDash / mmss', () => {
  it('dash offset shrinks as the ring fills', () => {
    const c = 2 * Math.PI * 10;
    expect(ringDash(0, 10).dashoffset).toBeCloseTo(c, 1);
    expect(ringDash(0.3, 10).dashoffset).toBeCloseTo(c * 0.7, 1);
    expect(ringDash(2, 10).dashoffset).toBe(0);
  });
  it('mmss', () => {
    expect(mmss(0)).toBe('00:00');
    expect(mmss(-5)).toBe('00:00');
    expect(mmss(61_001)).toBe('01:02');
  });
});
