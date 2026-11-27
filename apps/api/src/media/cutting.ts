import type { BackgroundRemover, LlmProvider } from '@obolo/ai';
import sharp from 'sharp';
import { borderColour, checkCut, CUT, distTo, frame, plainMatte, rawOf, regions, type CutReport, type PlainOptions, type Rgb3 } from './cut';
import { keyMatte, KEYS, type KeyName } from './keying';

/**
 * The one cut-out every production path goes through (client decisions M-R325 / M-R326): the planet figures and the
 * Saturn ball (look/figures.service.ts), the kororin designs and butterflies, the standee, the talk faces, the back
 * view and the {bati} pictures (look/look.service.ts). The web app cuts nothing itself: it only shows these PNGs.
 *
 *  cutPicture   one painting cut by colour — on a plain light background (media/cut.ts plainMatte) or on a key colour
 *               (media/keying.ts keyMatte, then the border flood through near-key pixels)
 *  inspectCut   M-R326, the five automatic checks of a cut: 'area' (what is left is in the kind's normal range, nothing
 *               eaten, no background left), 'blob' (no flat background-coloured blob inside), 'fringe' (no background
 *               coloured rim around the outline), 'shape' (the same shape as the background-removal model's cut, IoU),
 *               'vision' (a cheap vision model looks at it on dark and on light)
 *  cutLadder    M-R326, check and retry by another method: the colour cut → the model's cut of the same painting →
 *               painted again on a key colour away from the clothes → painted once more; the first that passes every
 *               check is kept, and after three failed retries NOTHING is (the caller keeps what it had and records it)
 *  recutStored  a figure stored before M-R325, of which only the cut PNG is left: the inner holes can still go
 */
export type CutBackground = 'plain' | KeyName;
export type CutCheck = 'area' | 'blob' | 'fringe' | 'shape' | 'vision';
export const CUT_CHECKS: CutCheck[] = ['area', 'blob', 'fringe', 'shape', 'vision'];

/**
 * check a: the share of the painting that is left, per kind of picture. Measured on the lab's paintings
 * (art/lab/runware-planet-avatar, apps/api/scripts/cutout-samples.ts): ball 33–53 %, butterfly 37–50 %, Saturn chibi
 * 21–38 %, boat 23–28 %, UFO 26–36 %, DJ booth 29–34 %, balloons 22–31 %, book 30–41 %, bubble 31–49 %; each range
 * is that with a wide margin. 'figure': any other character (standee, faces, back view, {bati}, kororin designs).
 */
export const CUT_AREA: Record<string, [number, number]> = {
  saturnBall: [0.2, 0.75],
  jupiter: [0.2, 0.72],
  saturnChibi: [0.1, 0.62],
  mercury: [0.12, 0.55],
  mars: [0.12, 0.6],
  venus: [0.14, 0.6],
  uranus: [0.1, 0.55],
  pluto: [0.14, 0.65],
  neptune: [0.16, 0.75],
  figure: [CUT.MIN_KEPT, CUT.MAX_KEPT],
};
/** check c: the rim looked at (px) and the share of it that may be background-coloured */
export const FRINGE_PX = 2;
export const FRINGE_MAX = 0.15;
/** check d: the colour cut and the model's cut must overlap at least this much (intersection over union) */
export const SHAPE_MIN_IOU = 0.9;

export interface CutWork {
  /** the cut at work size: RGBA, the alpha set */
  px: Uint8Array;
  /** the painting's own colours at the same size */
  before: Uint8Array;
  W: number;
  H: number;
  bg: Rgb3;
}
export interface CutResult {
  png: Buffer;
  report: CutReport;
  how: 'plain' | 'key' | 'model';
  work: CutWork;
}
export type CutOptions = PlainOptions;

/** one painting cut out by colour to a square transparent PNG of `out` px, with the basic report */
export async function cutPicture(input: Buffer, out: number, background: CutBackground, opt: CutOptions = {}): Promise<CutResult> {
  const { px, W, H } = await rawOf(input);
  const before = px.slice();
  if (background === 'plain') {
    const m = plainMatte(px, W, H, opt);
    const report = checkCut(before, px, W, H, { bg: m.bg, kind: 'plain', holesRemoved: m.holesRemoved, holeArea: m.holeArea, bigHoles: opt.bigHoles });
    return { png: await frame(px, W, H, out), report, how: 'plain', work: { px, before, W, H, bg: m.bg } };
  }
  const info = keyMatte(px, W, H, KEYS[background]);
  const report = checkCut(before, px, W, H, { bg: info.key, kind: 'key', bigHoles: opt.bigHoles });
  return { png: await frame(px, W, H, out), report, how: 'key', work: { px, before, W, H, bg: info.key } };
}

/** a painting cut by the background-removal model, with the same report (its holes are the model's business: not removed here) */
export async function cutByModel(input: Buffer, mime: string, model: BackgroundRemover, out: number, background: CutBackground, opt: CutOptions = {}): Promise<CutResult> {
  const cut = await model.remove({ data: input, mime });
  const meta = await sharp(cut.data).metadata();
  if (!meta.hasAlpha) throw new Error('the model returned no alpha');
  const o = await rawOf(input);
  // the model's alpha on the painting's own grid and colours (some models resize, premultiply or blank what they remove)
  const a = await sharp(cut.data).ensureAlpha().extractChannel(3).resize(o.W, o.H, { fit: 'fill' }).raw().toBuffer();
  const px = o.px.slice();
  for (let i = 0; i < o.W * o.H; i++) px[i * 4 + 3] = a[i];
  const bg = borderColour(o.px, o.W, o.H);
  const report = checkCut(o.px, px, o.W, o.H, { bg, kind: background === 'plain' ? 'plain' : 'key', bigHoles: opt.bigHoles });
  return { png: await frame(px, o.W, o.H, out), report, how: 'model', work: { px, before: o.px, W: o.W, H: o.H, bg } };
}

// --- M-R326: the five checks -------------------------------------------------------------------------------------------

/** check c: the share of the figure's outer rim (FRINGE_PX, solid pixels) that is still background-coloured */
export function fringeShare(w: CutWork, background: CutBackground): number {
  const { px, before, W, H, bg } = w;
  const N = W * H;
  const near = background === 'plain' ? CUT.BG_DIST * 2 : CUT.KEY_FRINGE;
  const dist = distTo(before, N, bg);
  // how far each kept pixel is from the removed part (4-connected steps, up to FRINGE_PX)
  const d = new Uint8Array(N).fill(255);
  let cur: number[] = [];
  for (let i = 0; i < N; i++) if (px[i * 4 + 3] <= 10) (d[i] = 0), cur.push(i);
  // only the outside counts: a removed hole's rim is an outline by construction
  for (let step = 1; step <= FRINGE_PX; step++) {
    const next: number[] = [];
    for (const i of cur) {
      const x = i % W;
      const y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1])
        if (j >= 0 && d[j] === 255) {
          d[j] = step;
          next.push(j);
        }
    }
    cur = next;
  }
  let rim = 0;
  let bad = 0;
  for (let i = 0; i < N; i++) {
    if (d[i] === 0 || d[i] === 255 || px[i * 4 + 3] < 128) continue;
    rim++;
    if (dist[i] <= near) bad++;
  }
  return rim ? bad / rim : 0;
}

/** check d: intersection over union of two cuts' shapes (alpha over half), on the same grid */
export function shapeIou(a: CutWork, b: CutWork): number {
  if (a.W !== b.W || a.H !== b.H) return 0;
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.W * a.H; i++) {
    const x = a.px[i * 4 + 3] > 127;
    const y = b.px[i * 4 + 3] > 127;
    if (x && y) inter++;
    if (x || y) union++;
  }
  return union ? inter / union : 0;
}

/** check e: someone who looks at the cut on dark and on light and says whether it is clean */
export interface CutJudge {
  /** `sheet`: the cut on a dark background (left) and on a light one (right). null: could not look (the check is skipped) */
  judge(sheet: Buffer): Promise<{ ok: boolean; reason: string } | null>;
}
export const CUT_JUDGE_PROMPT =
  'This image shows the SAME cut-out character twice: on a dark background (left) and on a light checkerboard (right). It was cut out of a painting automatically. ' +
  'Look for cut-out mistakes only: (1) a part of the character is missing or eaten away (a hole in the body or clothes where the backdrop shows through, a missing hand, half a face); ' +
  '(2) leftover background: a white, grey or green patch, halo or box that is not part of the character (often between an arm and the body, or around the outline). ' +
  'A transparent bubble, a floating character and soft glows are fine. Answer with exactly one line: "OK" if the cut-out is clean, or "NG: <short reason>" if you see a mistake.';
/** the dark | light sheet the judge looks at (also the hand-off pictures) */
export async function judgeSheet(png: Buffer, side = 384): Promise<Buffer> {
  const tile = async (a: string, b: string) => {
    const bgd = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="${a}"/><rect width="16" height="16" fill="${b}"/><rect x="16" y="16" width="16" height="16" fill="${b}"/></pattern></defs><rect width="${side}" height="${side}" fill="url(#c)"/></svg>`,
    );
    const fig = await sharp(png).resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return sharp(bgd).composite([{ input: fig }]).png().toBuffer();
  };
  const [dark, light] = await Promise.all([tile('#1c1630', '#241d3c'), tile('#d3d7e0', '#ffffff')]);
  return sharp({ create: { width: side * 2, height: side, channels: 3, background: '#000000' } })
    .composite([
      { input: dark, left: 0, top: 0 },
      { input: light, left: side, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}
/** the app's cheap vision model as the judge (the LLM chain's `perceive`: Gemini Flash-Lite); an answer that is neither OK nor NG skips the check */
export function llmCutJudge(llm: Pick<LlmProvider, 'perceive'> | null | undefined): CutJudge | null {
  if (!llm?.perceive) return null;
  return {
    async judge(sheet) {
      const text = (await llm.perceive!({ mime: 'image/jpeg', data: sheet }, CUT_JUDGE_PROMPT).catch(() => '')).trim();
      if (/^OK\b/i.test(text)) return { ok: true, reason: '' };
      const ng = /^NG\b[:：\s]*(.*)$/is.exec(text);
      return ng ? { ok: false, reason: ng[1].trim().slice(0, 200) } : null;
    },
  };
}

export interface Inspection {
  /** the checks that failed (empty: the cut may be shown) */
  failed: CutCheck[];
  /** the checks that could not run (no model, no judge) */
  skipped: CutCheck[];
  kept: number;
  fringe: number;
  iou: number | null;
  reason: string;
}
/**
 * M-R326: the five checks of one cut. `kind`: the picture's kind (CUT_AREA), `other`: the model's cut of the same
 * painting for the shape check (not for the model's own cut), `judge`: the vision check.
 */
export async function inspectCut(c: CutResult, a: { background: CutBackground; kind: string; other?: CutResult | null; judge?: CutJudge | null }): Promise<Inspection> {
  const failed: CutCheck[] = [];
  const skipped: CutCheck[] = [];
  const [min, max] = CUT_AREA[a.kind] ?? CUT_AREA.figure;
  const r = c.report;
  // a: in the kind's range, nothing eaten, no background left
  if (r.kept < min || r.kept > max || r.problems.includes('eaten') || r.problems.includes('leftover')) failed.push('area');
  // b: no flat background-coloured blob inside
  if (r.problems.includes('holes')) failed.push('blob');
  // c: no background-coloured rim
  const fringe = fringeShare(c.work, a.background);
  if (fringe > FRINGE_MAX) failed.push('fringe');
  // d: the same shape as the model's cut
  let iou: number | null = null;
  if (c.how === 'model') {
    /* the model's own cut: nothing to compare with */
  } else if (a.other) {
    iou = shapeIou(c.work, a.other.work);
    if (iou < SHAPE_MIN_IOU) failed.push('shape');
  } else skipped.push('shape');
  // e: the vision model, only asked when the cheap checks passed (a failed cut is retried anyway)
  let reason = '';
  if (!a.judge) skipped.push('vision');
  else if (!failed.length) {
    const v = await a.judge.judge(await judgeSheet(c.png)).catch(() => null);
    if (!v) skipped.push('vision');
    else if (!v.ok) {
      failed.push('vision');
      reason = v.reason;
    }
  }
  return { failed, skipped, kept: r.kept, fringe, iou, reason };
}

// --- M-R326: check and retry -------------------------------------------------------------------------------------------

export type LadderStep = 'colour' | 'model' | 'repaint' | 'repaint2';
export interface Painting {
  data: Buffer;
  mime: string;
  background: CutBackground;
}
export interface LadderTry {
  step: LadderStep;
  failed: CutCheck[];
  reason: string;
}
export type LadderResult =
  | { ok: true; png: Buffer; how: CutResult['how']; step: LadderStep; source: Painting; tries: LadderTry[]; painted: number }
  | { ok: false; tries: LadderTry[]; painted: number };
/** the record of a cut nobody may see: each step and the checks it failed ("colour:shape|model:area|repaint:vision") */
export const ladderRecord = (tries: LadderTry[]) => tries.map((t) => `${t.step}:${t.failed.join('+') || 'error'}`).join('|');

/**
 * M-R326: a painting cut, checked, and retried by another method until it passes — never more than three retries:
 *   colour    the colour cut of the first painting
 *   model     the background-removal model's cut of the same painting
 *   repaint   painted again (`repaint`: on a key colour away from the clothes), cut by colour
 *   repaint2  painted once more
 * Every step runs the five checks (inspectCut). The first that passes is the result; when none does, `ok` is false
 * and nothing is to be shown: the caller keeps what it had and records `tries`. `repaint` may return null (no tries
 * left): the ladder ends there.
 */
export async function cutLadder(a: {
  first: Painting;
  out: number;
  kind: string;
  opt?: CutOptions;
  model?: BackgroundRemover | null;
  judge?: CutJudge | null;
  repaint?: (n: 1 | 2) => Promise<Painting | null>;
  onTry?: (t: LadderTry) => void;
}): Promise<LadderResult> {
  const tries: LadderTry[] = [];
  let painted = 1;
  const note = (step: LadderStep, failed: CutCheck[], reason = '') => {
    const t = { step, failed, reason };
    tries.push(t);
    a.onTry?.(t);
  };
  /** the colour cut of one painting checked (with the model's cut of it for the shape); the model's cut is handed back for the next step */
  const colour = async (step: LadderStep, p: Painting): Promise<{ pass: CutResult | null; model: CutResult | null }> => {
    const [cut, model] = await Promise.all([
      cutPicture(p.data, a.out, p.background, a.opt).catch(() => null),
      a.model ? cutByModel(p.data, p.mime, a.model, a.out, p.background, a.opt).catch(() => null) : Promise.resolve(null),
    ]);
    if (!cut) {
      note(step, [], 'nothing could be cut');
      return { pass: null, model };
    }
    const i = await inspectCut(cut, { background: p.background, kind: a.kind, other: a.model ? model : undefined, judge: a.judge });
    if (!i.failed.length) return { pass: cut, model };
    note(step, i.failed, i.reason);
    return { pass: null, model };
  };
  const done = (step: LadderStep, c: CutResult, source: Painting): LadderResult => ({ ok: true, png: c.png, how: c.how, step, source, tries, painted });

  const one = await colour('colour', a.first);
  if (one.pass) return done('colour', one.pass, a.first);
  // 1st retry: the model's cut of the same painting
  if (one.model) {
    const i = await inspectCut(one.model, { background: a.first.background, kind: a.kind, judge: a.judge });
    if (!i.failed.length) return done('model', one.model, a.first);
    note('model', i.failed, i.reason);
  } else if (a.model) note('model', [], 'the model could not cut it');
  // 2nd and 3rd retries: painted again
  for (const n of [1, 2] as const) {
    if (!a.repaint) break;
    const step: LadderStep = n === 1 ? 'repaint' : 'repaint2';
    const p = await a.repaint(n).catch(() => null);
    if (!p) {
      note(step, [], 'not painted');
      break;
    }
    painted++;
    const r = await colour(step, p);
    if (r.pass) return done(step, r.pass, p);
  }
  return { ok: false, tries, painted };
}

// --- figures of before -------------------------------------------------------------------------------------------------

export interface Recut {
  /** the new PNG (the same size and framing), or null when nothing changed */
  png: Buffer | null;
  holesRemoved: number;
  /** the removed part reaches into the figure: its whites were probably eaten by the old cut — only a new painting restores them */
  eaten: boolean;
  report: CutReport;
  /** the stored picture as a cut to inspect (after the holes went) */
  result: CutResult;
}
/**
 * A figure cut before M-R325 of which only the cut PNG is kept (the paintings were not stored): what can still be
 * done on it. The background's colour is known from how it was painted (`background`): inner holes of that colour —
 * flat, big enough, ringed by an outline — are removed (mistake a). Whites the old cut ate (mistake b) are gone from
 * the PNG and cannot be restored: `eaten` only reports that it looks so.
 */
export async function recutStored(png: Buffer, background: CutBackground, opt: CutOptions = {}): Promise<Recut> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const W = info.width;
  const H = info.height;
  const N = W * H;
  const plain = background === 'plain';
  const bg: Rgb3 = plain ? [255, 255, 255] : KEYS[background];
  // the picture as it was painted: the cut part is the background again
  const flat = px.slice();
  for (let i = 0; i < N; i++) {
    const al = flat[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) flat[i * 4 + c] = Math.round(flat[i * 4 + c] * al + bg[c] * (1 - al));
    flat[i * 4 + 3] = 255;
  }
  let holesRemoved = 0;
  let holeArea = 0;
  if (plain) {
    // the same matte on the flattened picture finds the old outside again and the holes; only the holes are taken
    const work = flat.slice();
    const m = plainMatte(work, W, H, opt);
    const gone = new Uint8Array(N);
    for (let i = 0; i < N; i++) gone[i] = px[i * 4 + 3] <= 10 ? 1 : 0;
    const outside = regions(gone, W, H);
    const hole = new Uint8Array(N);
    for (let i = 0; i < N; i++) hole[i] = m.clear[i] && !gone[i] ? 1 : 0;
    const hs = regions(hole, W, H);
    // a cleared region of opaque pixels that does not touch the old outside is a hole (the fringe along the edge is not)
    const touches = new Uint8Array(hs.sizes.length);
    for (let i = 0; i < N; i++) {
      const k = hs.lab[i];
      if (!k) continue;
      const x = i % W;
      const y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && gone[j] && outside.edge[outside.lab[j]]) touches[k] = 1;
    }
    for (let k = 1; k < hs.sizes.length; k++)
      if (!touches[k] && hs.sizes[k] >= CUT.HOLE_MIN_AREA * N) {
        holesRemoved++;
        holeArea += hs.sizes[k];
      } else touches[k] = 1;
    if (holesRemoved)
      for (let i = 0; i < N; i++) {
        const k = hs.lab[i];
        if (k && !touches[k]) px[i * 4 + 3] = 0;
        // the matte's own soft edge around a removed hole
        else if (!gone[i] && work[i * 4 + 3] < px[i * 4 + 3] && nearHole(hs.lab, touches, i, W, H)) px[i * 4 + 3] = work[i * 4 + 3];
      }
  }
  const report = checkCut(flat, px, W, H, { bg, kind: plain ? 'plain' : 'key', holesRemoved, holeArea, bigHoles: opt.bigHoles });
  const outPng = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return {
    png: holesRemoved ? outPng : null,
    holesRemoved,
    eaten: report.problems.includes('eaten'),
    report,
    result: { png: holesRemoved ? outPng : png, report, how: plain ? 'plain' : 'key', work: { px, before: flat, W, H, bg } },
  };
}
function nearHole(lab: Int32Array, skip: Uint8Array, i: number, W: number, H: number): boolean {
  const x = i % W;
  const y = (i / W) | 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const k = lab[yy * W + xx];
      if (k && !skip[k]) return true;
    }
  return false;
}
