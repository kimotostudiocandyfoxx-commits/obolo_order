import { describe, expect, it } from 'vitest';
import { BATI_VARIANTS } from './batiVariants';
import { BLUENA_LINES, BLUENA_LINE_TEXTS } from './bluenaVariants';

describe("R16: bati's Bluena viewer lines in every style", () => {
  it('every line has all its styles, with the same placeholders and sentences; ていねい writes デス／マス', () => {
    const holes = (x: string) => [...x.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).filter((h) => h !== '{self}').sort();
    const sentences = (x: string) => (x.match(/[^！？。!?]+[！？。!?]*/g) ?? [x]).length;
    expect(BLUENA_LINE_TEXTS).toContain(BLUENA_LINES.editAsk);
    expect(BLUENA_LINES.editAsk).toContain('どういじる？');
    for (const line of BLUENA_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      for (const [k, s] of Object.entries(v)) {
        expect(holes(s), `${k}: ${line}`).toEqual(holes(line));
        expect(sentences(s), `${k}: ${s}`).toBe(sentences(line));
        if (k === 'teinei') expect(s).not.toMatch(/(です|ます)(?![\p{sc=Han}])/u);
      }
    }
  });
});
