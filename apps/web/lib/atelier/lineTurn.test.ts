import { describe, expect, it } from 'vitest';
import { MOON_LINES } from '@obolo/shared';
import { nextLine } from './lineTurn';

describe('M-R253 §6: lines used in turn', () => {
  it('never the same twice in a row for a scene (kept even without storage)', () => {
    const said = Array.from({ length: 5 }, () => nextLine('welcome-test', MOON_LINES.welcome));
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    expect(nextLine('one', [MOON_LINES.stop])).toBe(MOON_LINES.stop);
  });
});
