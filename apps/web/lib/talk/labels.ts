/**
 * R10 (client): the ダチ's name labels in the hall and on the plain never lie over another figure or another name. Each
 * label prefers its place under its own figure's feet; when that collides it tries a small step sideways, then above
 * its own head (over the unread dot), then further up, and takes the first free place. Pure (no DOM): MoonTabs'
 * strollers call it every frame with the figures' boxes as they walk.
 *
 * Stability: a label keeps the place it has while that place stays free, and goes back to a better one (nearer the
 * feet) only once that one is free with a margin — so it does not flicker between two places at a boundary.
 *
 * Coordinates: px, origin top left, y down.
 */
export type Rect = { x: number; y: number; w: number; h: number };

export type LabelFig = {
  /** the figure's centre (x) and its feet (y): the label's home is centred under them */
  cx: number;
  feet: number;
  /** the figure's visible body (with its unread dot): no other label may lie on it */
  body: Rect;
  /** the label's own size */
  w: number;
  h: number;
};

/** where a label goes: its top-left corner, and which of its candidate places that is (0 = under the feet) */
export type LabelSpot = { x: number; y: number; c: number };

export type PlaceOpts = {
  width: number;
  height: number;
  /** more places no label may cover */
  hard?: Rect[];
  /** places a label avoids when it can, but may sit over (drawn above them) when nothing else is free: the user's own blurred back */
  soft?: Rect[];
  /** the last frame's places, by index (stability) */
  prev?: (LabelSpot | undefined)[];
  /** the order labels choose in (the first choose first); default: as given */
  order?: number[];
  /** the gap kept between a label and anything else */
  pad?: number;
  /** how much more room a better place needs before a label moves back to it */
  margin?: number;
};

/** a label's places, best first: under the feet, a step either side, above the head, then higher and higher */
export function labelCandidates(f: LabelFig, width: number, height: number): Rect[] {
  const gap = 2;
  const under = f.feet + 3;
  const above = f.body.y - f.h - gap;
  const raw: [number, number][] = [
    [0, under],
    [0.6, under],
    [-0.6, under],
    [1.1, under],
    [-1.1, under],
    [0, above],
    [0.6, above],
    [-0.6, above],
  ];
  for (let k = 1; k <= 4; k++) raw.push([0, above - k * (f.h + 3)]);
  return raw.map(([dx, y]) => ({
    x: Math.max(2, Math.min(width - f.w - 2, f.cx - f.w / 2 + dx * f.w)),
    y: Math.max(0, Math.min(height - f.h, y)),
    w: f.w,
    h: f.h,
  }));
}

const hits = (a: Rect, b: Rect, pad: number) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function placeLabels(figs: LabelFig[], o: PlaceOpts): LabelSpot[] {
  const pad = o.pad ?? 2;
  const margin = o.margin ?? 6;
  const order = o.order ?? figs.map((_, i) => i);
  const out: LabelSpot[] = new Array(figs.length);
  const placed: Rect[] = [];
  for (const i of order) {
    const f = figs[i];
    if (!f) continue;
    const cands = labelCandidates(f, o.width, o.height);
    const hard = [...figs.filter((g, j) => j !== i && g).map((g) => g.body), ...placed, ...(o.hard ?? [])];
    const soft = o.soft ?? [];
    // 0: free of everything; 1: only over a soft place; 2: over a hard one
    const level = (r: Rect, p = pad) => (hard.some((b) => hits(r, b, p)) ? 2 : soft.some((b) => hits(r, b, p)) ? 1 : 0);
    const levels = cands.map((r) => level(r));
    const best = levels.indexOf(0) >= 0 ? 0 : levels.indexOf(1) >= 0 ? 1 : 2;
    const prev = o.prev?.[i];
    let c = -1;
    if (prev && prev.c < cands.length && levels[prev.c] === best) {
      // keep it, unless a better place is free with room to spare
      c = prev.c;
      for (let k = 0; k < prev.c; k++)
        if (level(cands[k], pad + margin) <= best) {
          c = k;
          break;
        }
    } else if (best < 2) c = levels.indexOf(best);
    else {
      // nowhere free: the place that covers the least
      let least = Infinity;
      cands.forEach((r, k) => {
        const a = hard.reduce((s, b) => s + area(r, b), 0);
        if (a < least) (least = a), (c = k);
      });
    }
    const r = cands[c];
    out[i] = { x: r.x, y: r.y, c };
    placed.push(r);
  }
  return out;
}
