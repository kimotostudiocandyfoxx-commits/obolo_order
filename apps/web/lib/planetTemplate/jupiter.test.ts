import { describe, expect, it } from 'vitest';
import { templateConfig } from './config';
import {
  ALL_SEEN,
  ART_TOP,
  ART_WIDTH,
  artTitleOf,
  artTitleStyle,
  CAMERAS,
  DEFAULT_WING_CUT,
  flapSeconds,
  frameTilt,
  JTREE,
  KAKEJIKU,
  pick,
  PORCH_HOLD_MS,
  PORCH_INTRO_MS,
  PORCH_PATH,
  SAMPLE_ARTS,
  SCROLL_MS,
  scrollLayout,
  WING_CUTS,
  WING_OVERLAP,
  wingCutOf,
  wingParts,
} from './jupiter';
import { templateSample } from './sample';

const insetOf = (clip: string) => clip.match(/[\d.]+/g)!.map(Number); // top right bottom left

describe('03 §1 the butterflies: only the wings move', () => {
  it('cuts a sample character by its own table, any other figure by the default', () => {
    expect(wingCutOf('/planets/sample/fig-jupiter-monban.webp')).toEqual(WING_CUTS.monban);
    expect(wingCutOf('https://cdn/x/chibi4-sister.webp')).toEqual(WING_CUTS.sister);
    expect(wingCutOf('https://cdn/look/abc.webp')).toEqual(DEFAULT_WING_CUT);
    expect(wingCutOf(null)).toEqual(DEFAULT_WING_CUT);
  });

  it('keeps each wing outside the body (the face) but for the small hinge overlap, hinged at the body edge', () => {
    for (const cut of [...Object.values(WING_CUTS), DEFAULT_WING_CUT]) {
      const [L, R] = cut;
      const p = wingParts(cut);
      const left = insetOf(p.left.clip);
      const right = insetOf(p.right.clip);
      const body = insetOf(p.body.clip);
      // left wing: 0 → L + overlap; right wing: R − overlap → 100; the body L → R
      expect(100 - left[1]).toBe(L + WING_OVERLAP);
      expect(right[3]).toBe(R - WING_OVERLAP);
      expect([body[3], 100 - body[1]]).toEqual([L, R]);
      expect(p.left.origin).toBe(`${L}% 52%`);
      expect(p.right.origin).toBe(`${R}% 52%`);
      // the face is well inside the body: the wings reach at most 2% into it
      expect(L + WING_OVERLAP).toBeLessThan((L + R) / 2 - 20);
      expect(R - WING_OVERLAP).toBeGreaterThan((L + R) / 2 + 20);
    }
  });

  it('beats each butterfly at its own pace, 0.26–0.38 s', () => {
    const all = Array.from({ length: 20 }, (_, i) => flapSeconds(i));
    expect(Math.min(...all)).toBe(0.26);
    expect(Math.max(...all)).toBe(0.38);
    expect(new Set(all.slice(0, 5)).size).toBe(5);
    expect(flapSeconds(-3)).toBeGreaterThanOrEqual(0.26);
  });
});

describe('03 §2 the hanging scroll', () => {
  it('puts the square art at 95% of the screen width, its top at 9% of the height, for every scroll and screen', () => {
    for (const k of KAKEJIKU)
      for (const [W, H] of [
        [390, 844],
        [360, 640],
        [430, 932],
      ]) {
        const L = scrollLayout(k, W, H);
        const artW = (L.art.width / 100) * L.width;
        const artH = (L.art.height / 100) * L.width * k.ar;
        expect(artW).toBeCloseTo(ART_WIDTH * W, 6);
        expect(artH).toBeCloseTo(artW, 6);
        expect(L.top + (L.art.top / 100) * L.width * k.ar).toBeCloseTo(ART_TOP * H, 6);
        // the art fits on the screen whole (not cut)
        expect(ART_TOP * H + artH).toBeLessThan(H);
      }
  });

  it('picks one of four scrolls and five cameras at random', () => {
    expect(KAKEJIKU).toHaveLength(4);
    expect(CAMERAS).toEqual(['push', 'slam', 'shake', 'drift', 'whip']);
    expect(pick(CAMERAS, 0)).toBe('push');
    expect(pick(CAMERAS, 0.999)).toBe('whip');
    expect(pick(CAMERAS, 1)).toBe('whip');
  });

  it('opens fast and closes fast; the tap that opened it does not close it', () => {
    expect(SCROLL_MS.open).toBeLessThanOrEqual(200);
    expect(SCROLL_MS.roll).toBeLessThan(SCROLL_MS.unroll);
    expect(SCROLL_MS.closeAfter).toBeGreaterThan(0);
    expect(SCROLL_MS.name).toBeGreaterThanOrEqual(SCROLL_MS.toCorner);
  });

  it('titles the art with its own title (or its first line of words), never 「〜のアート」', () => {
    expect(artTitleOf({ title: '月と海', text: 'x' })).toBe('月と海');
    expect(artTitleOf({ title: '', text: '夜の森\nきれいだった' })).toBe('夜の森');
    expect(artTitleOf({})).toBe('');
    const view = templateSample('jupiter');
    for (const w of [...view.around, ...view.own]) {
      expect(w.title).not.toMatch(/のアート$/);
      expect(SAMPLE_ARTS).toContain(w.title);
    }
  });

  it("gives each art its own font and entrance: the prototype's five by title, the rest by style, steady per art", () => {
    expect(artTitleStyle('ラーメン')).toMatchObject({ font: 'Dela Gothic One', motion: 'slam' });
    expect(artTitleStyle('夕焼けの町').motion).toBe('brush');
    expect(artTitleStyle('ある日', { main: '水彩', moods: [] }).font).toBe('Zen Kurenaido');
    expect(artTitleStyle('ある日')).toEqual(artTitleStyle('ある日'));
  });
});

describe('03 §3 ▶ from the porch', () => {
  it('is the porch at night with fireflies, you come out of your tree as your butterfly, one at a time, about 3 s each', () => {
    const c = templateConfig('jupiter');
    expect(c.play).toMatchObject({ night: true, fireflies: true, fireworks: false, untilDone: false, dance: JTREE, danceAs: 'figure', doneLine: ALL_SEEN });
    expect(c.play.path).toBe(PORCH_PATH);
    expect(c.introMs).toBe(PORCH_INTRO_MS);
    expect(c.holdMs).toBe(PORCH_HOLD_MS);
    // the butterfly flies down from the top and ends at the bottom left while its art is open (playJ)
    expect(PORCH_PATH.from.y).toBeLessThan(0.3);
    expect(PORCH_PATH.front).toMatchObject({ x: 0.15, y: 0.92 });
    // one visitor ≈ 4.7 s (playJ: 4700 ms), the scroll ≈ 3 s (M-R283)
    const cycle = 40 + PORCH_PATH.arriveMs + PORCH_HOLD_MS + PORCH_PATH.leaveMs;
    expect(cycle).toBeGreaterThan(4300);
    expect(cycle).toBeLessThan(5000);
    expect(templateConfig('mercury').play.danceAs).toBe('dance');
  });
});

describe('03 §4 the atelier', () => {
  it('hangs each frame a little crooked, at most 1.5°', () => {
    const t = Array.from({ length: 10 }, (_, j) => frameTilt(j));
    expect(Math.max(...t.map(Math.abs))).toBeLessThanOrEqual(1.5);
    expect(new Set(t).size).toBeGreaterThan(2);
  });
});
