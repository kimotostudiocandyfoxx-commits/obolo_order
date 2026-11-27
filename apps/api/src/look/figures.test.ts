import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { PLANET_FIGURES, type PlanetFigure } from '@obolo/shared';
import { costScope, type CostCtx } from '../wallet/cost-scope';
import { featureOfJob } from '../wallet/cost-scope';
import { FIGURE_RUN_TRIES, FIGURE_TRIES, PlanetFiguresService, figuresOf, figuresToMake, triesKey, type FigureStore } from './figures.service';
import { cutFailKey, cutKey, srcKey, versionKey, wingsOf, WINGS_KEY } from './figures';

vi.mock('../media/keying', async (orig) => ({ ...(await orig<typeof import('../media/keying')>()), chooseKey: async () => 'green' }));
/** the cut-out ladder of the tests: passes at once, or does what `ladder.run` says (M-R326) */
const ladder: { run: null | ((a: { first: unknown; kind: string; repaint?: (n: 1 | 2) => Promise<unknown> }) => Promise<unknown>) } = { run: null };
vi.mock('../media/cutting', async (orig) => ({
  ...(await orig<typeof import('../media/cutting')>()),
  cutLadder: async (a: { first: unknown; kind: string; repaint?: (n: 1 | 2) => Promise<unknown> }) =>
    ladder.run ? ladder.run(a) : { ok: true, png: Buffer.from('cut'), how: 'plain', step: 'colour', source: a.first, tries: [], painted: 1 },
}));

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
    log: { warn: () => undefined, error: () => undefined },
    looks: painter('look'),
    chibiPainter: painter('runware:400@4'),
    ballPainter: painter('alibaba:qwen-image@2.1-turbo'),
    planetPainter: painter('alibaba:qwen-image@2.1-turbo'),
    media: {
      storeImage: async (_u: string, _k: string, mime: string) => ({ url: `https://x/fig-${++n}.${mime === 'image/png' ? 'png' : 'jpg'}` }),
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

  it('M-R325 / M-R326: the painting is kept beside its figure; a cut that fails every retry is not shown, the figure of before stays, and it is recorded', async () => {
    const row = { avatarUrl: LOOK, chibiPicUrl: 'https://x/chibi-before.png', planetFigures: null as FigureStore | null };
    const { s, painted } = make(row);
    // the Saturn chibi's cut fails all the way (two repaints asked for on the key colour); the others pass at once
    ladder.run = async (a) => {
      if (a.kind !== 'saturnChibi') return { ok: true, png: Buffer.from('cut'), how: 'plain', step: 'colour', source: a.first, tries: [], painted: 1 };
      await a.repaint!(1);
      await a.repaint!(2);
      return { ok: false, painted: 3, tries: [{ step: 'colour', failed: ['shape'], reason: '' }, { step: 'model', failed: ['area'], reason: '' }, { step: 'repaint', failed: ['vision'], reason: 'a hand is missing' }, { step: 'repaint2', failed: ['fringe'], reason: '' }] };
    };
    try {
      await s.make({ userId: 'u1', origin: 'https://api' });
    } finally {
      ladder.run = null;
    }
    const e = row.planetFigures![LOOK];
    // not shown: no figure, the mini figure of before stays
    expect(e.saturnChibi).toBeUndefined();
    expect(row.chibiPicUrl).toBe('https://x/chibi-before.png');
    expect(e[cutFailKey('saturnChibi')]).toBe('colour:shape|model:area|repaint:vision|repaint2:fringe');
    // three paintings, each counted; the repaints were asked on the key colour
    const chibi = painted.filter((p) => p.f === 'saturnChibi');
    expect(chibi).toHaveLength(FIGURE_TRIES);
    expect(e[triesKey('saturnChibi')]).toBe(String(FIGURE_TRIES));
    // a figure normally on white is asked on the key colour when painted again
    expect(painted.find((p) => p.f === 'mars')!.prompt).toContain('pure white background');
    // the others: shown, their painting kept, marked as cut by the checked cut
    expect(e.mars).toMatch(/\.png$/);
    expect(e[srcKey('mars')]).toMatch(/\.jpg$/);
    expect(e[cutKey('mars')]).toBe('2:colour');
    expect(Object.keys(figuresOf(row.planetFigures, LOOK))).toHaveLength(8);
    // never painted again (its tries are spent)
    await s.make({ userId: 'u1', origin: 'https://api' });
    expect(painted.filter((p) => p.f === 'saturnChibi')).toHaveLength(FIGURE_TRIES);
  });

  it('M-R326: a repaint is asked on the key colour, also for a figure normally painted on white', async () => {
    const row = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: null as FigureStore | null };
    const { s, painted } = make(row);
    ladder.run = async (a) => {
      const again = a.kind === 'mercury' ? await a.repaint!(1) : null;
      return { ok: true, png: Buffer.from('cut'), how: 'key', step: again ? 'repaint' : 'colour', source: again ?? a.first, tries: [], painted: again ? 2 : 1 };
    };
    try {
      await s.make({ userId: 'u1', origin: 'https://api' });
    } finally {
      ladder.run = null;
    }
    const boat = painted.filter((p) => p.f === 'mercury').map((p) => p.prompt);
    expect(boat).toHaveLength(2);
    expect(boat[0]).toContain('Plain solid pure white background');
    expect(boat[1]).not.toContain('pure white background');
    expect(boat[1]).toContain('pure chroma-key green (#00FF00)');
    expect(row.planetFigures![LOOK][cutKey('mercury')]).toBe('2:repaint');
    expect(row.planetFigures![LOOK][triesKey('mercury')]).toBe('2');
  });

  it('M-R325 backfill: a figure of before is cut again without painting — its gap goes; one that fails the checks stays as it is, marked', async () => {
    const S = 300;
    const INK = '#3a2a2a';
    const svg = (body: string) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#fff"/>${body}</svg>`)).png().toBuffer();
    /** the cut of before: only the white connected to the border went */
    const oldCut = async (src: Buffer) => {
      const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width;
      const seen = new Uint8Array(W * info.height);
      const stack = [0];
      seen[0] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        data[i * 4 + 3] = 0;
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          if (j < 0 || j >= seen.length || seen[j] || Math.abs((j % W) - (i % W)) > 1) continue;
          if (data[j * 4] > 227 && data[j * 4 + 1] > 227 && data[j * 4 + 2] > 227) (seen[j] = 1), stack.push(j);
        }
      }
      return sharp(data, { raw: { width: W, height: info.height, channels: 4 } }).png().toBuffer();
    };
    const body = `<circle cx="120" cy="160" r="80" fill="#f4a3c4" stroke="${INK}" stroke-width="6"/>`;
    const arm = `<circle cx="225" cy="160" r="40" fill="none" stroke="#f4a3c4" stroke-width="18"/><circle cx="225" cy="160" r="50" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="225" cy="160" r="30" fill="none" stroke="${INK}" stroke-width="5"/>`;
    const withGap = await oldCut(await svg(body + arm));
    // eaten by the old cut: the outline is open and the white body is gone
    const eaten = await oldCut(await svg(`<circle cx="150" cy="160" r="110" fill="#fff" stroke="${INK}" stroke-width="6" stroke-dasharray="664 27" transform="rotate(-80 150 160)"/><circle cx="150" cy="255" r="12" fill="#f4a3c4" stroke="${INK}" stroke-width="4"/>`));
    const row = {
      avatarUrl: LOOK,
      chibiPicUrl: null,
      planetFigures: { [LOOK]: { mars: 'https://x/mars.png', venus: 'https://x/venus.png', pluto: 'https://x/pluto.png', [cutKey('pluto')]: '2:colour' } } as FigureStore,
    };
    const b = make(row);
    (b.s as unknown as { media: { bytesByUrl: unknown } }).media.bytesByUrl = async (_u: string, url: string) => (url.includes('mars') ? withGap : eaten);
    const got = await b.s.recut('u1', 'https://api');
    expect(got).toEqual({ checked: 2, changed: 1, holes: 1, failed: 1, eaten: 1 });
    const e = row.planetFigures[LOOK];
    // the gap went: a new picture, the old one removed; marked as re-cut
    expect(e.mars).not.toBe('https://x/mars.png');
    expect(e[cutKey('mars')]).toBe('r2');
    expect(b.removed).toEqual(['https://x/mars.png']);
    // the eaten one cannot be restored: the figure of before stays, marked for a new painting
    expect(e.venus).toBe('https://x/venus.png');
    expect(e[cutKey('venus')]).toMatch(/^x2:.*area/);
    // already cut by the checked cut: not touched; nothing is ever painted
    expect(e[cutKey('pluto')]).toBe('2:colour');
    expect(b.painted).toHaveLength(0);
    // done once
    expect((await b.s.recut('u1', 'https://api')).checked).toBe(0);
  });

  it('M-R328: a Mars figure painted with the old prompt (the light beam) is painted again once, through the ladder; a new one carries its prompt version', async () => {
    const fresh = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: null as FigureStore | null };
    const a = make(fresh);
    await a.s.make({ userId: 'u1', origin: 'https://api' });
    expect(fresh.planetFigures![LOOK][versionKey('mars')]).toBe('2');
    expect(fresh.planetFigures![LOOK][versionKey('venus')]).toBeUndefined();
    expect(await a.s.repaintOld('u1', 'https://api')).toEqual({ repainted: 0, failed: 0, painted: 0 });

    const row = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: { [LOOK]: { mars: 'https://x/mars-beam.png', venus: 'https://x/venus.png' }, 'https://x/old-look.png': { mars: 'https://x/mars-old-look.png' } } as FigureStore };
    const b = make(row);
    expect(await b.s.repaintOld('u1', 'https://api')).toEqual({ repainted: 1, failed: 0, painted: 1 });
    expect(b.painted.map((p) => p.f)).toEqual(['mars']);
    expect(b.painted[0].prompt).toContain('No light beam, no glow and no sparkles under the saucer');
    const e = row.planetFigures[LOOK];
    expect(e.mars).not.toBe('https://x/mars-beam.png');
    expect(e[versionKey('mars')]).toBe('2');
    expect(e[srcKey('mars')]).toBeTruthy();
    expect(b.removed).toEqual(['https://x/mars-beam.png']);
    // only the look worn now; the other figures untouched; done once
    expect(row.planetFigures['https://x/old-look.png']).toEqual({ mars: 'https://x/mars-old-look.png' });
    expect(e.venus).toBe('https://x/venus.png');
    expect(await b.s.repaintOld('u1', 'https://api')).toEqual({ repainted: 0, failed: 0, painted: 0 });

    // the cut fails every retry: the figure of before stays, marked, and is not painted again
    const bad = { avatarUrl: LOOK, chibiPicUrl: null, planetFigures: { [LOOK]: { mars: 'https://x/mars-beam.png' } } as FigureStore };
    const c = make(bad);
    ladder.run = async () => ({ ok: false, painted: 3, tries: [{ step: 'colour', failed: ['area'], reason: '' }] });
    try {
      expect(await c.s.repaintOld('u1', 'https://api')).toEqual({ repainted: 0, failed: 1, painted: 3 });
    } finally {
      ladder.run = null;
    }
    expect(bad.planetFigures[LOOK].mars).toBe('https://x/mars-beam.png');
    expect(bad.planetFigures[LOOK][versionKey('mars')]).toBe('2x');
    expect(bad.planetFigures[LOOK][cutFailKey('mars')]).toBe('colour:area');
    expect(await c.s.repaintOld('u1', 'https://api')).toEqual({ repainted: 0, failed: 0, painted: 0 });
  });
});
