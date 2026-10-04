import { describe, expect, it } from 'vitest';
import { DAY1 } from './day1';
import { fill, labelIndex, mediaAt } from './script';

describe('day 1 script', () => {
  it('every goto/choice target exists', () => {
    for (const s of DAY1) {
      if (s.t === 'goto') expect(() => labelIndex(DAY1, s.id)).not.toThrow();
      if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(DAY1, o.goto!)).not.toThrow();
    }
  });
  it('starts with motion 1 and ends with end', () => {
    expect(DAY1[0]).toEqual({ t: 'video', motion: 1 });
    expect(DAY1[DAY1.length - 1]).toEqual({ t: 'end' });
  });
  it('asks the name exactly once', () => {
    expect(DAY1.filter((s) => s.t === 'name')).toHaveLength(1);
  });
  it('fills placeholders', () => {
    expect(fill('{name}へ by {inviter}', { name: 'ユウ', inviter: 'KIMORIN' })).toBe('ユウへ by KIMORIN');
  });
  it('restores the right background when resuming', () => {
    const i = DAY1.findIndex((s) => s.t === 'action' && s.label === '本部へ向かう');
    expect(mediaAt(DAY1, i)).toEqual({ motion: 4, loop: true });
  });
});
