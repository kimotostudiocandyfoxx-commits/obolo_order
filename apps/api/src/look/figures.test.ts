import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { PLANET_FIGURES, type PlanetFigure } from '@obolo/shared';
import { costScope, type CostCtx } from '../wallet/cost-scope';
import { featureOfJob } from '../wallet/cost-scope';
import { FIGURE_RUN_TRIES, FIGURE_TRIES, PlanetFiguresService, figuresOf, figuresToMake, triesKey, type FigureStore } from './figures.service';
import { wingsOf, WINGS_KEY } from './figures';

vi.mock('../media/keying', async (orig) => ({
  ...(await orig<typeof import('../media/keying')>()),
  chooseKey: async () => 'green',
  cutoutChecked: async () => ({ png: Buffer.from('cut-key'), key: 'green', clearance: 1 }),
}));
vi.mock('../media/cutout', () => ({ cutoutWhite: async () => Buffer.from('cut-white') }));

const LOOK = 'https://x/look.png';
/** which figure a prompt paints (the words each style is known by) */
const figureOfPrompt = (p: string): PlanetFigure =>
  /jumping out joyfully/i.test(p)
    ? 'saturnChibi'
    : /ball-shaped mascot/.test(p)
      ? 'saturnBall'
      : /butterfly/.test(p)
        ? 'jupiter'
        : /sailboat/.test(p)
          ? 'mercury'
          : /UFO/.test(p)
            ? 'mars'
            : /radio DJ/.test(p)
              ? 'venus'
              : /balloons/.test(p)
                ? 'uranus'
                : /flying book/.test(p)
                  ? 'pluto'
                  : 'neptune';

/** a member row kept in memory, painters that note what they painted; `fail(f, n)`: the n-th painting of f fails */
function make(row: { avatarUrl: string | null; chibiPicUrl: string | null; planetFigures: FigureStore | null }, fail: (f: PlanetFigure, n: number) => boolean = () => false) {
  const s = Object.create(PlanetFiguresService.prototype) as PlanetFiguresService & Record<string, unknown>;
  const painted: { f: PlanetFigure; model: string; refs: number; prompt: string }[] = [];
  const count: Partial<Record<PlanetFigure, number>> = {};
  const painter = (model: string) => ({
    name: model,
    generate: async (prompt: string, _seed?: number, refs: unknown[] = []) => {
      const f = figureOfPrompt(prompt);
      count[f] = (count[f] ?? 0) + 1;
      painted.push({ f, model, refs: refs.length, prompt });
      if (fail(f, count[f]!)) throw new Error(`${f} painter down`);
      return { data: Buffer.from(`${f}`), mime: 'image/jpeg' };
    },
  });
  let n = 0;
  const removed: string[] = [];
  Object.assign(s, {
    log: { warn: () => undefined },
    looks: painter('look'),
    chibiPainter: painter('runware:400@4'),
    ballPainter: painter('alibaba:qwen-image@2.1-turbo'),
    planetPainter: painter('alibaba:qwen-image@2.1-turbo'),
    media: {
      storeImage: async () => ({ url: `https://x/fig-${++n}.png` }),
      bytesByUrl: async () => Buffer.from([0x89, 0x50]),
      removeByUrl: async (_u: string, url: string) => void removed.push(url),
    },
    row: async () => ({ ...row, planetFigures: row.planetFigures ? structuredClone(row.planetFigures) : null }),
    patch: async (_u: string, look: string, p: Record<string, string>) => {
      row.planetFigures = { ...(row.planetFigures ?? {}), [look]: { ...(row.planetFigures?.[look] ?? {}), ...p } };
    },
    db: { write: { update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => void Object.assign(row, v) }) }) } },
  });
  return { s, painted, removed };
}

describe('client 2026-11-25: the planet figures of a look (one job, all nine)', () => {
  it('paints all nine from the look: the Saturn chibi on klein 4B, the ball and the 7 planets on Qwen; the Saturn chibi becomes the mini figure', async () => {
    const row = { avatarUrl: LOOK, chibiPicUrl: 'https://x/old-3d.png', planetFigures: null as FigureStore | null };
    const { s, painted, removed } = make(row);
    await s.make({ userId: 'u1', origin: 'https://api' });
    expect(new Set(painted.map((p) => p.f))).toEqual(new Set(PLANET_FIGURES));
    expect(painted).toHaveLength(9);
    for (const p of painted) expect(p.model).toBe(p.f === 'saturnChibi' ? 'runware:400@4' : 'alibaba:qwen-image@2.1-turbo');
    // the look first, then the style references (the lab's): none for the chibi, the dot ball, three butterfly cells
    const refs = Object.fromEntries(painted.map((p) => [p.f, p.refs]));
    expect(refs).toMatchObject({ saturnChibi: 1, saturnBall: 2, jupiter: 4, mars: 4, neptune: 4 });
    const figs = figuresOf(row.planetFigures, LOOK);
    expect(Object.keys(figs).sort()).toEqual([...PLANET_FIGURES].sort());
    expect(row.chibiPicUrl).toBe(figs.saturnChibi);
    expect(removed).toEqual(['https://x/old-3d.png']);
    // the 2D anime chibi2 (M-R275), not the 3D vinyl figure of before
    const chibi = painted.find((p) => p.f === 'saturnChibi')!.prompt;
    expect(chibi).toContain('flat 2D Japanese anime illustration');
    expect(chibi).not.toMatch(/vinyl/);
    // made: a second job paints nothing
    await s.make({ userId: 'u1', origin: 'https://api' });
    expect(painted).toHaveLength(9);
  });

  it('a partial failure keeps what was made; a figure that failed is retried once in the job, once more by the backfill, then never', async () => {
    const row = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: null as FigureStore | null };
    const { s, painted } = make(row, (f) => f === 'mars');
    await s.make({ userId: 'u1', origin: 'https://api', look: LOOK });
    const figs = figuresOf(row.planetFigures, LOOK);
    expect(Object.keys(figs)).toHaveLength(8);
    expect(figs.mars).toBeUndefined();
    expect(painted.filter((p) => p.f === 'mars')).toHaveLength(FIGURE_RUN_TRIES);
    expect(row.planetFigures![LOOK][triesKey('mars')]).toBe(String(FIGURE_RUN_TRIES));
    expect(figuresToMake(row.planetFigures, LOOK)).toEqual(['mars']);
    // the backfill's job
    await s.make({ userId: 'u1', origin: 'https://api', look: LOOK });
    expect(painted.filter((p) => p.f === 'mars')).toHaveLength(FIGURE_TRIES);
    expect(figuresToMake(row.planetFigures, LOOK)).toEqual([]);
    await s.make({ userId: 'u1', origin: 'https://api', look: LOOK });
    expect(painted.filter((p) => p.f === 'mars')).toHaveLength(FIGURE_TRIES);
    expect(painted.filter((p) => p.f !== 'mars')).toHaveLength(8);
  });

  it('a painting that fails once is painted again in the same job', async () => {
    const row = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: null as FigureStore | null };
    const { s, painted } = make(row, (f, n) => f === 'venus' && n === 1);
    await s.make({ userId: 'u1', origin: 'https://api' });
    expect(figuresOf(row.planetFigures, LOOK).venus).toBeTruthy();
    expect(painted.filter((p) => p.f === 'venus')).toHaveLength(2);
    expect(row.planetFigures![LOOK][triesKey('venus')]).toBe('2');
  });

  it('the look changed meanwhile, or no look: nothing painted', async () => {
    const row = { avatarUrl: 'https://x/other.png', chibiPicUrl: null, planetFigures: null as FigureStore | null };
    const { s, painted } = make(row);
    await s.make({ userId: 'u1', origin: 'https://api', look: LOOK });
    const none = make({ avatarUrl: null, chibiPicUrl: null, planetFigures: null });
    await none.s.make({ userId: 'u1', origin: 'https://api' });
    expect(painted).toHaveLength(0);
    expect(none.painted).toHaveLength(0);
  });

  it("a paid profile look change's figures are that making's costs; the free ones are absorbed ('figures')", async () => {
    const row = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: null as FigureStore | null };
    const { s } = make(row);
    expect(featureOfJob('look.figures')).toBe('figures');
    expect(featureOfJob('look.chibi')).toBe('figures');
    const ctx: CostCtx = { feature: 'figures', userId: 'u1' };
    await costScope.run(ctx, async () => {
      await s.make({ userId: 'u1', origin: 'https://api', paid: { kind: 'profileLook', job: 'make:profileLook:u1:ok:1' } });
      expect(costScope.get()).toMatchObject({ kind: 'profileLook', job: 'make:profileLook:u1:ok:1', paid: true });
    });
  });

  it("03 §1: the butterfly's wing cut is kept with it ('none' when the picture cannot be measured); the backfill measures the stored one", async () => {
    const row = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: null as FigureStore | null };
    const { s } = make(row);
    await s.make({ userId: 'u1', origin: 'https://api' });
    // the mocked cut-out is no picture: measured as nothing, the default cut
    expect(row.planetFigures![LOOK][WINGS_KEY]).toBe('none');
    expect(Object.keys(row.planetFigures![LOOK]).filter((k) => k.endsWith('#wings'))).toEqual([WINGS_KEY]);
    expect(wingsOf(row.planetFigures, LOOK)).toBeNull();
    // a figure of before (no cut yet): the backfill reads its picture and measures it — nothing is painted
    const W = 200;
    const px = Buffer.alloc(W * W * 4);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const wing = ((x - 40) / 38) ** 2 + ((y - 90) / 60) ** 2 <= 1 || ((x - 160) / 38) ** 2 + ((y - 90) / 60) ** 2 <= 1;
        const face = ((x - 100) / 28) ** 2 + ((y - 60) / 26) ** 2 <= 1;
        const body = ((x - 100) / 24) ** 2 + ((y - 130) / 50) ** 2 <= 1;
        const c = face ? [255, 222, 196, 255] : body ? [240, 120, 160, 255] : wing ? [120, 170, 255, 255] : [0, 0, 0, 0];
        px.set(c, (y * W + x) * 4);
      }
    const png = await sharp(px, { raw: { width: W, height: W, channels: 4 } }).png().toBuffer();
    const old = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: { [LOOK]: { jupiter: 'https://x/j.png' }, 'https://x/old-look.png': { jupiter: 'https://x/j0.png', [WINGS_KEY]: '20,72' } } as FigureStore };
    const b = make(old);
    (b.s as unknown as { media: { bytesByUrl: unknown } }).media.bytesByUrl = async () => png;
    expect(await b.s.measureMissingWings('u1')).toEqual({ measured: 1, fallback: 0 });
    const w = wingsOf(old.planetFigures, LOOK)!;
    expect(w.l).toBeLessThanOrEqual(36);
    expect(w.r).toBeGreaterThanOrEqual(64);
    expect(old.planetFigures['https://x/old-look.png'][WINGS_KEY]).toBe('20,72');
    expect(b.painted).toHaveLength(0);
    // measured once: never again
    expect(await b.s.measureMissingWings('u1')).toEqual({ measured: 0, fallback: 0 });
  });
});
