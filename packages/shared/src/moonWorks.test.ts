import { describe, expect, it } from 'vitest';
import { BATI_ORDINARY_IDS } from './batiPersona';
import { BATI_VARIANTS } from './batiVariants';
import { batiSay, fillLine, MOON_LINE_TEXTS, MOON_LINES, rotateLine } from './moonWorks';

const holes = (t: string) => [...new Set([...t.matchAll(/\{[a-z_]+\}/g)].map((m) => m[0]))].sort();

describe("M-R253 §6: {bati}'s Moon atelier lines", () => {
  it('every fixed line has all the common styles, with the same placeholders', () => {
    expect(MOON_LINE_TEXTS).toHaveLength(26);
    for (const line of MOON_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      for (const p of BATI_ORDINARY_IDS.filter((x) => x !== 'genki')) {
        expect(v[p], `${p} 「${line}」`).toBeTruthy();
        expect(holes(v[p].replace(/\{neo\}(さん|っち|ちゃん)/g, '{neo}')), `${p} 「${line}」`).toEqual(holes(line));
      }
    }
  });
  it('rendered in the manner, then filled', () => {
    expect(fillLine(batiSay(MOON_LINES.push, { personality: 'teinei' }), { bati: 'タコポン', work: '夏ロック' })).toBe('タコポン：夏ロック、できたよ！　見に来てください。');
    expect(fillLine(batiSay(MOON_LINES.propose.radio, { personality: 'gal' }), { neo: 'ハル' })).toContain('DJ、ハルっち。');
    expect(batiSay(MOON_LINES.fresh, null)).toBe('了解！　まっさらから、いこう。');
  });
  it('several lines for a scene are used in turn, never the same twice in a row', () => {
    expect(rotateLine(2, -1)).toBe(0);
    expect(rotateLine(2, 0)).toBe(1);
    expect(rotateLine(2, 1)).toBe(0);
    expect(rotateLine(1, 0)).toBe(0);
    let last = -1;
    for (let i = 0; i < 6; i++) {
      const n = rotateLine(3, last);
      expect(n).not.toBe(last);
      last = n;
    }
  });
});
