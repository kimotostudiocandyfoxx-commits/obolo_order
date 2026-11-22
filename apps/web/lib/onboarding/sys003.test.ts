import { describe, expect, it } from 'vitest';
import { labelIndex } from './script';
import { SYS003 } from './sys003';

describe('SYS-S003 たまごが、育った (M-R224)', () => {
  it('labels resolve; seed → birth → card → name → role; the 2nd gets a small egg again, the 3rd the last line', () => {
    for (const s of SYS003) {
      if (s.t === 'goto') expect(() => labelIndex(SYS003, s.id)).not.toThrow();
      if (s.t === 'branch') for (const to of [...Object.values(s.cases), s.otherwise]) expect(() => labelIndex(SYS003, to)).not.toThrow();
    }
    const t = SYS003.map((s) => s.t);
    expect(t.indexOf('newbati')).toBeLessThan(t.indexOf('baticard'));
    expect(t.indexOf('baticard')).toBeLessThan(t.indexOf('batiname'));
    expect(t.indexOf('batiname')).toBeLessThan(t.indexOf('batirole'));
    expect(SYS003.slice(labelIndex(SYS003, 'sys3-egg')).some((s) => s.t === 'fx' && s.fx === 'shell-egg')).toBe(true);
    expect(SYS003.slice(labelIndex(SYS003, 'sys3-last')).some((s) => s.t === 'say' && s.text === '、、、これで、三つ。たまごは、もう、生まれない。')).toBe(true);
    expect(SYS003[SYS003.length - 1].t).toBe('end');
  });
});
