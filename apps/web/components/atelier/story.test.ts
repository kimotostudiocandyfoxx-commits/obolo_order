import { describe, expect, it } from 'vitest';
import { DAY3 } from '../../lib/onboarding/day3';
import { DAY4 } from '../../lib/onboarding/day4';
import { DAY7 } from '../../lib/onboarding/day7';
import type { Step } from '../../lib/onboarding/script';
import { cues, withWords } from './story';

const atelier = (steps: Step[]) => steps.filter((s): s is Extract<Step, { t: 'atelier' }> => s.t === 'atelier');

describe('atelier story lines', () => {
  it('day 3: {bati} reacts, the kororin sings the words', () => {
    const c = cues(atelier(DAY3)[0].lines);
    expect(c.react?.[0].text).toBe('じゃあ、コロリンにするね！');
    expect(withWords(c.sing![0].text, 'たこ焼き')).toBe('♪たこ焼き♪');
  });
  it('day 4: asks, casts, saves, fails', () => {
    const c = cues(atelier(DAY4)[0].lines);
    expect(c.open?.[0].text).toBe('じゃあ、話してみて！');
    expect(c.spell?.[0].text).toContain('——ここに、かたちを。');
    expect(c.saved?.[0].text).toBe('Bluenaに、しまったよ！');
    expect(c.fail?.length).toBe(1);
  });
  it('day 7: the song question, the mic, again', () => {
    const c = cues(atelier(DAY7)[0].lines);
    expect(c.open?.[0].text).toContain('どの曲、かける？');
    expect(c.react?.[0].text).toContain('マイクで話して');
    expect(c.again?.[0].text).toBe('何回でも、いいよ！');
  });
});
