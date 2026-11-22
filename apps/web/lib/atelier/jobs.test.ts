import { describe, expect, it } from 'vitest';
import type { JobView } from '@obolo/shared';
import { countdown, isLong, jobEvents, msLeft } from './jobTime';

const t0 = Date.parse('2026-11-22T10:00:00Z');
const job = (x: Partial<JobView> = {}): JobView => ({ id: 'j', kind: 'song', status: 'running', stage: null, result: null, errorCode: null, error: null, createdAt: new Date(t0).toISOString(), startedAt: new Date(t0).toISOString(), etaAt: new Date(t0 + 240_000).toISOString(), attempts: 1, ...x });

describe('M-R253 §4: the card counts down', () => {
  it('a 4-minute job: said up front, 「あと4分」 → 「あと3分」 → 「もうすぐ」, filling as it goes', () => {
    const j = job();
    expect(isLong(j, t0)).toBe(true);
    expect(countdown(j, t0).left).toBe('あと4分');
    expect(countdown(j, t0 + 61_000).left).toBe('あと3分');
    expect(countdown(j, t0 + 235_000).left).toBe('もうすぐ');
    expect(countdown(j, t0 + 120_000).progress).toBeCloseTo(0.5);
    expect(countdown(j, t0 + 999_000).progress).toBeLessThan(1);
  });
  it('a 20-second one: waited in place, no time said', () => {
    const j = job({ etaAt: new Date(t0 + 20_000).toISOString() });
    expect(isLong(j, t0)).toBe(false);
    expect(countdown(j, t0, false).left).toBeNull();
    expect(msLeft(j, t0)).toBe(20_000);
  });
  it('what {bati} says: late once when the time moves on, made again, done', () => {
    const a = job();
    expect(jobEvents(undefined, a)).toEqual([]);
    expect(jobEvents(a, job({ late: true, etaAt: new Date(t0 + 300_000).toISOString() }))).toEqual(['late']);
    expect(jobEvents(job({ late: true }), job({ late: true }))).toEqual([]);
    expect(jobEvents(a, job({ retrying: true, attempts: 2 }))).toEqual(['retrying']);
    expect(jobEvents(job({ retrying: true, attempts: 2 }), job({ retrying: true, attempts: 2 }))).toEqual([]);
    expect(jobEvents(a, job({ status: 'done' }))).toEqual(['done']);
    expect(jobEvents(job({ status: 'done' }), job({ status: 'done' }))).toEqual([]);
    expect(jobEvents(a, job({ status: 'failed' }))).toEqual(['failed']);
  });
});
