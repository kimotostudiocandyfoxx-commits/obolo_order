import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { checkCut, CUT } from './cut';
import { CUT_AREA, CUT_JUDGE_PROMPT, cutByModel, cutLadder, cutPicture, FRINGE_MAX, fringeShare, inspectCut, ladderRecord, llmCutJudge, recutStored, SHAPE_MIN_IOU, shapeIou, type Painting } from './cutting';
import { cutoutKey } from './keying';

// synthetic pictures, one per rule of the cut (M-R325)
const S = 400;
const pic = (body: string, bg = '#ffffff', defs = '') =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${defs}<rect width="${S}" height="${S}" fill="${bg}"/>${body}</svg>`))
    .png()
    .toBuffer();
const INK = '#3a2a2a';
/** a pink body with a dark outline, and an arm drawn as a closed loop on its right: the loop's inside is background */
const BODY = `<circle cx="170" cy="210" r="90" fill="#f4a3c4" stroke="${INK}" stroke-width="6"/>`;
const ARM = `<circle cx="290" cy="210" r="42" fill="none" stroke="#f4a3c4" stroke-width="22"/><circle cx="290" cy="210" r="53" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="290" cy="210" r="31" fill="none" stroke="${INK}" stroke-width="5"/>`;

/** alpha of a PNG at a point */
async function look(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { a: (x: number, y: number) => data[(Math.round(y) * info.width + Math.round(x)) * 4 + 3], W: info.width };
}
describe('the cut on a plain background (M-R325)', () => {
  it('measures the background on the border: an off-white backdrop goes as well as a pure white one', async () => {
    const r = await cutPicture(await pic(BODY, '#f3efe6'), 256, 'plain');
    const { a } = await look(r.png);
    expect(a(3, 3)).toBe(0);
    expect(a(128, 128)).toBe(255);
    expect(r.report.problems).toEqual([]);
  });

  it('removes the gap between an arm and the body', async () => {
    const r = await cutPicture(await pic(BODY + ARM), 400, 'plain');
    expect(r.report.holesRemoved).toBe(1);
    expect(r.report.problems).toEqual([]);
    // the figure spans x 77…346 (270 wide) → the frame is 286 px wide, scaled to 400: the loop's middle (290, 210)
    const k = 400 / (270 * 1.06);
    const { a } = await look(r.png);
    const at = (x: number, y: number) => a(200 + (x - 211.5) * k, 200 + (y - 210) * k);
    expect(at(290, 210)).toBe(0); // the gap is gone
    expect(at(290, 168)).toBe(255); // the arm stays
    expect(at(170, 210)).toBe(255); // the body stays
  });

  it('keeps a white body that touches the background behind its outline', async () => {
    // a white kororin with a little shading, pink ears: the outside is white too
    const defs = '<defs><radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e4e6f2"/></radialGradient></defs>';
    const body = `<circle cx="120" cy="100" r="34" fill="#f4a3c4" stroke="${INK}" stroke-width="5"/><circle cx="280" cy="100" r="34" fill="#f4a3c4" stroke="${INK}" stroke-width="5"/><circle cx="200" cy="210" r="130" fill="url(#g)" stroke="${INK}" stroke-width="6"/>`;
    const r = await cutPicture(await pic(body, '#ffffff', defs), 400, 'plain');
    const { a } = await look(r.png);
    expect(a(4, 4)).toBe(0);
    for (const [x, y] of [[200, 220], [160, 170], [260, 280], [200, 120]]) expect(a(x, y)).toBe(255);
    expect(r.report.problems).toEqual([]);
    expect(r.report.holesRemoved).toBe(0);
  });

  it('keeps a flat white body too: a "hole" that is most of the figure is the figure', async () => {
    const body = `<circle cx="200" cy="210" r="130" fill="#ffffff" stroke="${INK}" stroke-width="6"/><circle cx="160" cy="200" r="8" fill="${INK}"/><circle cx="240" cy="200" r="8" fill="${INK}"/>`;
    const r = await cutPicture(await pic(body), 400, 'plain');
    const { a } = await look(r.png);
    expect(a(200, 260)).toBe(255);
    expect(r.report.holesRemoved).toBe(0);
  });

  it('keeps white clothes whose outline meets the background', async () => {
    // a white shirt (off the paper's white by a little shading) under a pink head, outlined; the shirt's outline is on the outside
    const body = `<rect x="110" y="200" width="180" height="150" rx="30" fill="#f6f4ee" stroke="${INK}" stroke-width="5"/><circle cx="200" cy="140" r="80" fill="#f7c9a8" stroke="${INK}" stroke-width="5"/>`;
    const r = await cutPicture(await pic(body), 400, 'plain');
    const { a } = await look(r.png);
    expect(a(200, 330)).toBe(255);
    expect(a(140, 300)).toBe(255);
    expect(r.report.problems).toEqual([]);
  });

  it('keeps a shiny highlight (white inside a light body, no outline around it)', async () => {
    const body = `<circle cx="200" cy="200" r="150" fill="#f4a3c4"/><ellipse cx="150" cy="140" rx="34" ry="22" fill="#ffffff"/>`;
    const r = await cutPicture(await pic(body), 400, 'plain');
    const { a } = await look(r.png);
    expect(a(150, 140)).toBe(255);
    expect(r.report.holesRemoved).toBe(0);
    expect(r.report.problems).toEqual([]);
  });

  it('leaves a small speck of white alone (under 0.06 % of the picture)', async () => {
    const body = `${BODY}<circle cx="150" cy="190" r="4" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`;
    const r = await cutPicture(await pic(body), 400, 'plain');
    expect(r.report.holesRemoved).toBe(0);
  });
});

describe('the cut on a key colour (M-R325)', () => {
  const GREEN = '#00ff00';
  const disc = '<circle cx="200" cy="200" r="110" fill="#c8283c"/>';

  it('removes the green fringe the key left around the figure', async () => {
    // a band of duller green around the figure: not the key for the matte, but near it and touching the outside
    const fringe = '<circle cx="200" cy="200" r="122" fill="#32d232"/>';
    const { px, W } = await (async () => {
      const r = await cutoutKey(await pic(fringe + disc, GREEN), 400, [0, 255, 0]);
      const { data, info } = await sharp(r.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { px: data, W: info.width, r };
    })();
    // no pixel of the cut is green any more
    let green = 0;
    let solid = 0;
    for (let i = 0; i < px.length / 4; i++) {
      if (px[i * 4 + 3] < 128) continue;
      solid++;
      if (px[i * 4 + 1] - Math.max(px[i * 4], px[i * 4 + 2]) > 40) green++;
    }
    expect(solid).toBeGreaterThan(1000);
    expect(green).toBe(0);
    expect(px[(200 * W + 200) * 4 + 3]).toBe(255);
  });

  it('keeps a green prop that is not the key\'s green, and a near-key green one that does not touch the outside', async () => {
    const leaf = '<ellipse cx="330" cy="200" rx="50" ry="26" fill="#6b8e23"/>';
    const button = '<circle cx="200" cy="200" r="26" fill="#32d232"/>';
    const r = await cutoutKey(await pic(disc + leaf + button, GREEN), 400, [0, 255, 0]);
    // the figure spans x 90…380 (290 wide) → scale 400 / (290 × 1.06), centred on (235, 200)
    const k = 400 / (290 * 1.06);
    const { a } = await look(r.png);
    const at = (x: number, y: number) => a(200 + (x - 235) * k, 200 + (y - 200) * k);
    expect(at(350, 200)).toBe(255); // the leaf
    expect(at(200, 200)).toBe(255); // the button
    expect(at(120, 200)).toBe(255); // the figure
    expect(a(3, 3)).toBe(0);
    expect(r.report.problems).toEqual([]);
  });
});

describe('the automatic check after cutting (M-R325)', () => {
  it("'eaten': the outline is broken and the outside ran into the white body", async () => {
    // a white body whose outline has a gap at the top; a pink bow keeps something clearly kept
    const body = `<circle cx="200" cy="210" r="130" fill="#ffffff" stroke="${INK}" stroke-width="6" stroke-dasharray="790 27" transform="rotate(-80 200 210)"/><circle cx="200" cy="330" r="16" fill="#f4a3c4" stroke="${INK}" stroke-width="4"/>`;
    const r = await cutPicture(await pic(body), 400, 'plain');
    expect(r.report.leak).toBeGreaterThan(CUT.MAX_LEAK);
    expect(r.report.problems).toContain('eaten');
  });

  it("'eaten': almost nothing is left", async () => {
    const r = await cutPicture(await pic('<circle cx="200" cy="200" r="30" fill="#f4a3c4"/>'), 400, 'plain');
    expect(r.report.kept).toBeLessThan(CUT.MIN_KEPT);
    expect(r.report.problems).toContain('eaten');
  });

  it("'leftover': the background was not flat and stayed", async () => {
    const defs = '<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8a8f9c"/></linearGradient></defs>';
    const src = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${defs}<rect width="${S}" height="${S}" fill="url(#b)"/>${BODY}</svg>`))
      .png()
      .toBuffer();
    const r = await cutPicture(src, 400, 'plain');
    expect(r.report.problems).toContain('leftover');
  });

  it("'holes': a gap of the background is still inside the figure", async () => {
    // a cut that only removed the outside (the mistake of before): the loop's inside is still opaque
    const src = await pic(BODY + ARM);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = new Uint8Array(data);
    const alpha = px.slice();
    // outside = white reachable from the corner, by a plain flood
    const W = info.width;
    const seen = new Uint8Array(W * info.height);
    const stack = [0];
    seen[0] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      alpha[i * 4 + 3] = 0;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= seen.length || seen[j] || Math.abs((j % W) - (i % W)) > 1) continue;
        if (px[j * 4] > 243 && px[j * 4 + 1] > 243 && px[j * 4 + 2] > 243) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const report = checkCut(px, alpha, W, info.height, { bg: [255, 255, 255], kind: 'plain' });
    expect(report.holesLeft).toBe(1);
    expect(report.problems).toEqual(['holes']);
  });

  it('a good cut has no problem', async () => {
    const r = await cutPicture(await pic(BODY), 400, 'plain');
    expect(r.report.problems).toEqual([]);
    expect(r.report.kept).toBeGreaterThan(0.1);
  });
});

describe('the five checks (M-R326)', () => {
  const cut = async (body: string, bg = '#ffffff') => cutPicture(await pic(body, bg), 256, 'plain');
  /** a "model" whose cut keeps `shape` (an SVG body, white = kept) */
  const modelOf = (shape: string) => ({
    name: 'fake',
    calls: 0,
    async remove(img: { data: Buffer; mime: string }) {
      this.calls++;
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${shape}</svg>`);
      return { data: await sharp(img.data).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(), mime: 'image/png' };
    },
  });
  const SAME = '<circle cx="170" cy="210" r="92" fill="#fff"/>';

  it('a clean cut passes; without a model and a judge those two checks are skipped, not failed', async () => {
    const i = await inspectCut(await cut(BODY), { background: 'plain', kind: 'figure' });
    expect(i.failed).toEqual([]);
    expect(i.skipped).toEqual(['shape', 'vision']);
  });

  it("a: 'area' — outside the kind's normal range (a ball that is a third of what a ball is), or eaten, or background left", async () => {
    const small = await cut('<circle cx="200" cy="200" r="60" fill="#f4a3c4"/>');
    expect(small.report.kept).toBeGreaterThan(CUT_AREA.figure[0]);
    expect((await inspectCut(small, { background: 'plain', kind: 'figure' })).failed).toEqual([]);
    expect((await inspectCut(small, { background: 'plain', kind: 'saturnBall' })).failed).toEqual(['area']);
    const eaten = await cut('<circle cx="200" cy="200" r="30" fill="#f4a3c4"/>');
    expect((await inspectCut(eaten, { background: 'plain', kind: 'figure' })).failed).toContain('area');
  });

  it("b: 'blob' — a flat background-coloured blob is still inside (the model left the gap in)", async () => {
    const src = await pic(BODY + ARM);
    const m = await cutByModel(src, 'image/png', modelOf('<circle cx="170" cy="210" r="92" fill="#fff"/><circle cx="290" cy="210" r="55" fill="#fff"/>'), 256, 'plain');
    const i = await inspectCut(m, { background: 'plain', kind: 'figure' });
    expect(i.failed).toContain('blob');
  });

  it("c: 'fringe' — a rim of the background is left around the outline", async () => {
    // the model cut 6 px too wide all around: a white rim
    const m = await cutByModel(await pic(BODY), 'image/png', modelOf('<circle cx="170" cy="210" r="99" fill="#fff"/>'), 256, 'plain');
    expect(fringeShare(m.work, 'plain')).toBeGreaterThan(FRINGE_MAX);
    expect((await inspectCut(m, { background: 'plain', kind: 'figure' })).failed).toContain('fringe');
    expect(fringeShare((await cut(BODY)).work, 'plain')).toBeLessThan(FRINGE_MAX);
  });

  it("d: 'shape' — the model's cut of the same painting has another shape (IoU under 0.9)", async () => {
    const src = await pic(BODY);
    const mine = await cutPicture(src, 256, 'plain');
    const same = await cutByModel(src, 'image/png', modelOf(SAME), 256, 'plain');
    const half = await cutByModel(src, 'image/png', modelOf('<rect x="0" y="0" width="170" height="400" fill="#fff"/>'), 256, 'plain');
    expect(shapeIou(mine.work, same.work)).toBeGreaterThan(SHAPE_MIN_IOU);
    expect((await inspectCut(mine, { background: 'plain', kind: 'figure', other: same })).failed).toEqual([]);
    const i = await inspectCut(mine, { background: 'plain', kind: 'figure', other: half });
    expect(i.failed).toEqual(['shape']);
    expect(i.iou).toBeLessThan(0.6);
  });

  it("e: 'vision' — the vision model sees the cut on dark and on light and says no", async () => {
    const sheets: Buffer[] = [];
    const no = { judge: async (sheet: Buffer) => (sheets.push(sheet), { ok: false, reason: 'the left hand is missing' }) };
    const i = await inspectCut(await cut(BODY), { background: 'plain', kind: 'figure', judge: no });
    expect(i.failed).toEqual(['vision']);
    expect(i.reason).toBe('the left hand is missing');
    const meta = await sharp(sheets[0]).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([768, 384, 'jpeg']);
    // a judge that could not look skips the check
    expect((await inspectCut(await cut(BODY), { background: 'plain', kind: 'figure', judge: { judge: async () => null } })).skipped).toContain('vision');
  });

  it('the vision judge reads OK / NG from the cheap vision model, and asks nothing when it cannot look', async () => {
    const asked: string[] = [];
    const llm = (answer: string) => ({ perceive: async (_i: unknown, prompt: string) => (asked.push(prompt), answer) });
    expect(await llmCutJudge(llm('OK'))!.judge(Buffer.alloc(1))).toEqual({ ok: true, reason: '' });
    expect(await llmCutJudge(llm('NG: white patch under the arm'))!.judge(Buffer.alloc(1))).toEqual({ ok: false, reason: 'white patch under the arm' });
    expect(await llmCutJudge(llm('(mock)'))!.judge(Buffer.alloc(1))).toBeNull();
    expect(asked[0]).toBe(CUT_JUDGE_PROMPT);
    expect(llmCutJudge({})).toBeNull();
  });
});

describe('cutLadder: check, then retry by another method (M-R326)', () => {
  const good = async (): Promise<Painting> => ({ data: await pic(BODY), mime: 'image/png', background: 'plain' });
  const bad = async (): Promise<Painting> => ({ data: await pic('<circle cx="200" cy="200" r="30" fill="#f4a3c4"/>'), mime: 'image/png', background: 'plain' });
  /** a model that keeps the body's disc whatever the painting */
  const model = () => ({
    name: 'fake',
    calls: 0,
    async remove(img: { data: Buffer; mime: string }) {
      this.calls++;
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><circle cx="170" cy="210" r="92" fill="#fff"/></svg>`);
      return { data: await sharp(img.data).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(), mime: 'image/png' };
    },
  });
  const yes = { judge: async () => ({ ok: true, reason: '' }) };

  it('stops at the first pass: a good colour cut is kept, nothing painted again', async () => {
    const m = model();
    let repaints = 0;
    const r = await cutLadder({ first: await good(), out: 256, kind: 'figure', model: m, judge: yes, repaint: async () => (repaints++, good()) });
    expect(r.ok && [r.step, r.how, r.painted]).toEqual(['colour', 'plain', 1]);
    expect([repaints, m.calls, r.tries]).toEqual([0, 1, []]);
  });

  it('1st retry: the model\'s cut of the same painting', async () => {
    // the colour cut fails the vision check; the model's cut passes
    const m = model();
    let n = 0;
    const judge = { judge: async () => (n++ === 0 ? { ok: false, reason: 'halo' } : { ok: true, reason: '' }) };
    let repaints = 0;
    const first = await good();
    const r = await cutLadder({ first, out: 256, kind: 'figure', model: m, judge, repaint: async () => (repaints++, good()) });
    expect(r.ok && [r.step, r.how, r.painted, r.source === first]).toEqual(['model', 'model', 1, true]);
    expect(r.tries).toEqual([{ step: 'colour', failed: ['vision'], reason: 'halo' }]);
    expect(repaints).toBe(0);
  });

  it('2nd retry: painted again (the caller paints it on a key colour); 3rd: once more — in that order', async () => {
    const asked: number[] = [];
    const steps: string[] = [];
    // no model: the colour cut of the bad painting fails 'area', then two repaints: the first bad again, the second good
    const r = await cutLadder({ first: await bad(), out: 256, kind: 'figure', repaint: async (k) => (asked.push(k), k === 1 ? bad() : good()), onTry: (t) => steps.push(t.step) });
    expect(r.ok && [r.step, r.painted]).toEqual(['repaint2', 3]);
    expect(asked).toEqual([1, 2]);
    expect(steps).toEqual(['colour', 'repaint']);
    const second = await cutLadder({ first: await bad(), out: 256, kind: 'figure', repaint: async (k) => (asked.push(k), good()) });
    expect(second.ok && [second.step, second.painted]).toEqual(['repaint', 2]);
  });

  it('three failed retries: nothing to show, every step and its failed checks recorded', async () => {
    const m = { name: 'fake', remove: async (img: { data: Buffer }) => ({ data: await sharp(img.data).ensureAlpha().png().toBuffer(), mime: 'image/png' }) };
    const r = await cutLadder({ first: await bad(), out: 256, kind: 'figure', model: m, judge: yes, repaint: bad });
    expect(r.ok).toBe(false);
    expect(r.tries.map((t) => t.step)).toEqual(['colour', 'model', 'repaint', 'repaint2']);
    expect(r.painted).toBe(3);
    expect(r.tries[0].failed).toEqual(['area', 'shape']);
    expect(r.tries[1].failed).toContain('area');
    expect(ladderRecord(r.tries)).toMatch(/^colour:area\+shape\|model:area[^|]*\|repaint:area\+shape\|repaint2:area\+shape$/);
  });

  it('a painter with no tries left ends the ladder', async () => {
    const r = await cutLadder({ first: await bad(), out: 256, kind: 'figure', repaint: async () => null });
    expect(r.ok).toBe(false);
    expect(r.tries.map((t) => t.step)).toEqual(['colour', 'repaint']);
    expect(r.painted).toBe(1);
  });
});

describe('recutStored: a figure of before, only its cut PNG kept (M-R325)', () => {
  /** the cut of before: only the white connected to the border went */
  async function oldCut(src: Buffer) {
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
        if (data[j * 4] > 227 && data[j * 4 + 1] > 227 && data[j * 4 + 2] > 227) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    return sharp(data, { raw: { width: W, height: info.height, channels: 4 } }).png().toBuffer();
  }

  it('removes the gap still inside it, the same size and framing', async () => {
    const r = await recutStored(await oldCut(await pic(BODY + ARM)), 'plain');
    expect(r.holesRemoved).toBe(1);
    expect(r.eaten).toBe(false);
    const { a, W } = await look(r.png!);
    expect(W).toBe(S);
    expect(a(290, 210)).toBe(0);
    expect(a(290, 168)).toBe(255);
    expect(a(170, 210)).toBe(255);
  });

  it('changes nothing when there is no gap, and reports a body that looks eaten', async () => {
    const fine = await recutStored(await oldCut(await pic(BODY)), 'plain');
    expect(fine.png).toBeNull();
    expect(fine.eaten).toBe(false);
    const body = `<circle cx="200" cy="210" r="130" fill="#ffffff" stroke="${INK}" stroke-width="6" stroke-dasharray="790 27" transform="rotate(-80 200 210)"/><circle cx="200" cy="330" r="16" fill="#f4a3c4" stroke="${INK}" stroke-width="4"/>`;
    const eaten = await recutStored(await oldCut(await pic(body)), 'plain');
    expect(eaten.png).toBeNull();
    expect(eaten.eaten).toBe(true);
  });
});
