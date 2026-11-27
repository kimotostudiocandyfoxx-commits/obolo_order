import sharp from 'sharp';

/**
 * The cut-out's shared parts (client decision M-R325, 2026-11-27) — the production twin of the story prototype's
 * `unwhite` / `key` (design/home/build.py on the story branch). On real phones two mistakes showed on the planet
 * figures, the kororin balls and the shore vehicles:
 *  a. only the outside was removed: the background stayed in the gaps (between an arm and the body, inside a sail);
 *  b. a whitish kororin or white clothes were eaten together with the background.
 * So, for a picture painted on a plain background (plainMatte):
 *  - the background's colour is MEASURED (the median of the border pixels), never assumed;
 *  - the outside is flooded from the border only through pixels very close to it (≤ CUT.BG_DIST) that carry no outline
 *    (a small luminance gradient): a white body touching the background behind its outline is not entered;
 *  - a background-coloured region not connected to the border goes only when it is big enough, flat, and the ring
 *    around it is not background-coloured (and is an outline): a gap goes, a shiny highlight stays.
 * For a picture on a key colour (media/keying.ts keyMatte) the same border flood runs once more after the key
 * (keyFringe): what is near the key and touches the outside goes, a green prop that is not the key's green stays.
 * After every cut the result is checked (checkCut): too much removed, too little, or background holes left.
 */
export type Rgb3 = [number, number, number];

export const CUT = {
  /** the picture is worked on at most this big (px, the longer side) */
  WORK_SIDE: 900,
  /** a pixel this close to the measured background (largest channel difference) may be background (prototype: 12) */
  BG_DIST: 12,
  /** … when the Sobel gradient of its luminance is under this: no outline there (prototype: 60) */
  EDGE_GRAD: 60,
  /** an enclosed region is a hole only from this share of the picture (prototype: 0.06 %) */
  HOLE_MIN_AREA: 0.0006,
  /** … when its mean distance to the background is at most this (prototype: 7) */
  HOLE_MEAN_DIST: 7,
  /** … and its luminance is this flat (standard deviation; prototype: 3) */
  HOLE_LUM_STD: 3,
  /** the ring looked at around a region (px; prototype: 3 dilations) */
  RING_PX: 3,
  /** … must be this far from the background on average (prototype: 45) */
  RING_MIN_DIST: 45,
  /** … and at least this share of it this much darker than the background: an outline (ours; a highlight on a light body has none) */
  RING_DARK_SHARE: 0.2,
  RING_DARK_DROP: 100,
  /** a "hole" bigger than this share of the figure is its body, never removed (ours; the Neptune bubble opts out) */
  HOLE_MAX_SHARE: 0.3,
  /** a floor shadow: the lowest share of the picture, this close to the background, this smooth, this colourless (ours) */
  SHADOW_ZONE: 0.45,
  SHADOW_DIST: 70,
  SHADOW_GRAD: 30,
  SHADOW_TINT: 10,
  /** … and at most this share of it may have the figure below it */
  SHADOW_OVER: 0.03,
  /** a pixel at the edge fades by how background-coloured it is, opaque from this distance (the cut of before) */
  EDGE_SOLID: 90,
  /** on a key colour: what is this close to the measured key and connected to the outside goes too (prototype: 60) */
  KEY_FRINGE: 60,
  // --- the check after the cut (ours: the prototype was checked by eye) ---
  /** eaten: less than this share of the picture is left */
  MIN_KEPT: 0.04,
  /** eaten: this share of the figure is outside-coloured but enclosed by the figure on all eight sides (a leak into the body) */
  MAX_LEAK: 0.08,
  /** eaten: the removed holes together are more than this share of the figure */
  MAX_HOLES: 0.35,
  /** leftover: more than this share of the picture is left */
  MAX_KEPT: 0.9,
  /** leftover: more than this share of the border is left */
  MAX_BORDER_KEPT: 0.25,
  /** holes on a key colour: a kept region this close to the key (mean) and this flat */
  KEY_HOLE_MEAN: 40,
  KEY_HOLE_STD: 6,
} as const;

export type CutProblem = 'eaten' | 'leftover' | 'holes';
export interface CutReport {
  /** share of the picture that is left */
  kept: number;
  /** share of the border that is left */
  borderKept: number;
  /** share of the figure that is removed but enclosed by it on all eight sides */
  leak: number;
  /** removed holes, as a share of the figure */
  holes: number;
  holesRemoved: number;
  /** background-coloured holes still in the figure */
  holesLeft: number;
  problems: CutProblem[];
}
export const cutOk = (r: CutReport) => r.problems.length === 0;

/** median of each channel over the border pixels */
export function borderColour(px: Uint8Array, W: number, H: number): Rgb3 {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let n = 0;
  const add = (i: number) => {
    for (let c = 0; c < 3; c++) hist[c][px[i * 4 + c]]++;
    n++;
  };
  for (let x = 0; x < W; x++) {
    add(x);
    add((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    add(y * W);
    add(y * W + W - 1);
  }
  return hist.map((h) => {
    let s = 0;
    for (let v = 0; v < 256; v++) {
      s += h[v];
      if (s * 2 >= n) return v;
    }
    return 255;
  }) as Rgb3;
}

/** each pixel's largest channel difference to `bg` */
export function distTo(px: Uint8Array, N: number, bg: Rgb3): Uint8Array {
  const d = new Uint8Array(N);
  for (let i = 0; i < N; i++) d[i] = Math.max(Math.abs(px[i * 4] - bg[0]), Math.abs(px[i * 4 + 1] - bg[1]), Math.abs(px[i * 4 + 2] - bg[2]));
  return d;
}
function luminance(px: Uint8Array, N: number): Float32Array {
  const l = new Float32Array(N);
  for (let i = 0; i < N; i++) l[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
  return l;
}
/** Sobel gradient magnitude (the kernel's own scale, like scipy.ndimage.sobel; the border repeats) */
function sobel(l: Float32Array, W: number, H: number): Float32Array {
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 1) * W;
    const y1 = y * W;
    const y2 = Math.min(H - 1, y + 1) * W;
    for (let x = 0; x < W; x++) {
      const a = Math.max(0, x - 1);
      const b = Math.min(W - 1, x + 1);
      const gx = l[y0 + b] + 2 * l[y1 + b] + l[y2 + b] - l[y0 + a] - 2 * l[y1 + a] - l[y2 + a];
      const gy = l[y2 + a] + 2 * l[y2 + x] + l[y2 + b] - l[y0 + a] - 2 * l[y0 + x] - l[y0 + b];
      g[y1 + x] = Math.hypot(gx, gy);
    }
  }
  return g;
}

/** 4-connected components of a mask: labels (0 = not in it), each one's size, and whether it touches the border */
export function regions(mask: Uint8Array, W: number, H: number) {
  const lab = new Int32Array(W * H);
  const sizes: number[] = [0];
  const edge: boolean[] = [false];
  const stack: number[] = [];
  let n = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s]) continue;
    n++;
    let size = 0;
    let onEdge = false;
    lab[s] = n;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % W;
      const y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) onEdge = true;
      const go = (j: number) => {
        if (mask[j] && !lab[j]) {
          lab[j] = n;
          stack.push(j);
        }
      };
      if (x > 0) go(i - 1);
      if (x < W - 1) go(i + 1);
      if (y > 0) go(i - W);
      if (y < H - 1) go(i + W);
    }
    sizes.push(size);
    edge.push(onEdge);
  }
  return { lab, sizes, edge };
}

interface HoleRules {
  /** which pixels may be a hole (background-like) */
  like: Uint8Array;
  dist: Uint8Array;
  lum: Float32Array;
  bgLum: number;
  meanMax: number;
  stdMax: number;
  /** only regions wholly inside this mask count (the check: the kept figure); all when not given */
  within?: Uint8Array;
  /** regions touching these pixels are not holes (the outside) */
  outside?: Uint8Array;
  /** the ring must also be an outline (clearly darker than the background): a plain light background only */
  outline: boolean;
}
/**
 * The background-coloured regions enclosed by the figure that are gaps, not highlights: big enough, flat, and ringed
 * by something that is not background-coloured and is an outline. Returns a mask of them and each one's size.
 */
function holesOf(W: number, H: number, r: HoleRules): { mask: Uint8Array; sizes: number[] } {
  const N = W * H;
  const { lab, sizes, edge } = regions(r.like, W, H);
  const n = sizes.length - 1;
  const mask = new Uint8Array(N);
  const out: number[] = [];
  if (!n) return { mask, sizes: out };
  const sd = new Float64Array(n + 1);
  const sl = new Float64Array(n + 1);
  const sl2 = new Float64Array(n + 1);
  const bad = new Uint8Array(n + 1);
  const x0 = new Int32Array(n + 1).fill(W);
  const x1 = new Int32Array(n + 1);
  const y0 = new Int32Array(n + 1).fill(H);
  const y1 = new Int32Array(n + 1);
  for (let i = 0; i < N; i++) {
    const k = lab[i];
    if (!k) continue;
    sd[k] += r.dist[i];
    sl[k] += r.lum[i];
    sl2[k] += r.lum[i] * r.lum[i];
    if (r.within && !r.within[i]) bad[k] = 1;
    const x = i % W;
    const y = (i / W) | 0;
    if (x < x0[k]) x0[k] = x;
    if (x > x1[k]) x1[k] = x;
    if (y < y0[k]) y0[k] = y;
    if (y > y1[k]) y1[k] = y;
    if (r.outside) {
      if ((x > 0 && r.outside[i - 1]) || (x < W - 1 && r.outside[i + 1]) || (y > 0 && r.outside[i - W]) || (y < H - 1 && r.outside[i + W])) bad[k] = 1;
    }
  }
  const R = CUT.RING_PX;
  for (let k = 1; k <= n; k++) {
    const a = sizes[k];
    if (edge[k] || bad[k] || a < CUT.HOLE_MIN_AREA * N) continue;
    const m = sl[k] / a;
    if (sd[k] / a > r.meanMax || Math.sqrt(Math.max(0, sl2[k] / a - m * m)) > r.stdMax) continue;
    // the ring: R dilations (4-connected) inside the region's box, without the region and without other background-like pixels
    const bx0 = Math.max(0, x0[k] - R);
    const bx1 = Math.min(W - 1, x1[k] + R);
    const by0 = Math.max(0, y0[k] - R);
    const by1 = Math.min(H - 1, y1[k] + R);
    const bw = bx1 - bx0 + 1;
    const bh = by1 - by0 + 1;
    let cur = new Uint8Array(bw * bh);
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (lab[y * W + x] === k) cur[(y - by0) * bw + (x - bx0)] = 1;
    for (let it = 0; it < R; it++) {
      const nx = new Uint8Array(cur);
      for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
          const j = y * bw + x;
          if (cur[j]) continue;
          if ((x > 0 && cur[j - 1]) || (x < bw - 1 && cur[j + 1]) || (y > 0 && cur[j - bw]) || (y < bh - 1 && cur[j + bw])) nx[j] = 1;
        }
      cur = nx;
    }
    let ringN = 0;
    let ringD = 0;
    let dark = 0;
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        if (!cur[y * bw + x]) continue;
        const i = (y + by0) * W + x + bx0;
        if (lab[i] === k || r.like[i]) continue;
        ringN++;
        ringD += r.dist[i];
        if (r.lum[i] < r.bgLum - CUT.RING_DARK_DROP) dark++;
      }
    if (!ringN || ringD / ringN <= CUT.RING_MIN_DIST || (r.outline && dark / ringN < CUT.RING_DARK_SHARE)) continue;
    out.push(a);
    for (let y = y0[k]; y <= y1[k]; y++) for (let x = x0[k]; x <= x1[k]; x++) if (lab[y * W + x] === k) mask[y * W + x] = 1;
  }
  return { mask, sizes: out };
}

export interface PlainOptions {
  /** the soft grey shadow the painter leaves under the feet goes too (the kororin designs; cutoutWhite's noShadow) */
  noShadow?: boolean;
  /** a hole may be bigger than CUT.HOLE_MAX_SHARE of the figure (the Neptune bubble: the figure floats inside it) */
  bigHoles?: boolean;
}
export interface PlainMatte {
  bg: Rgb3;
  /** 1 = removed (the outside and the holes) */
  clear: Uint8Array;
  holesRemoved: number;
  /** removed holes' pixels */
  holeArea: number;
}

/**
 * The matte of a picture painted on a plain light background, on raw RGBA pixels (changed in place: the alpha only).
 */
export function plainMatte(px: Uint8Array, W: number, H: number, opt: PlainOptions = {}): PlainMatte {
  const N = W * H;
  const bg = borderColour(px, W, H);
  const dist = distTo(px, N, bg);
  const lum = luminance(px, N);
  const grad = sobel(lum, W, H);
  const like = new Uint8Array(N);
  for (let i = 0; i < N; i++) like[i] = dist[i] <= CUT.BG_DIST && grad[i] < CUT.EDGE_GRAD ? 1 : 0;
  // the outside: background-like regions that touch the border
  const all = regions(like, W, H);
  const clear = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (all.lab[i] && all.edge[all.lab[i]]) clear[i] = 1;
  // the soft shadow a painter leaves on the floor although asked not to (a white smear on a dark planet): from the
  // outside on, in the lowest part of the picture, through pixels that are the background only darker (no colour of
  // their own), smooth, and not far from it. A shadow lies under the figure: when what the flood took has the figure
  // below it (it ran into a light body or a bubble through a faint outline), nothing of it is taken.
  {
    const from = Math.floor(H * (1 - CUT.SHADOW_ZONE));
    const sh = new Uint8Array(N);
    const stack: number[] = [];
    for (let i = from * W; i < N; i++) if (clear[i]) stack.push(i);
    let taken = 0;
    const shade = (i: number) => {
      if (clear[i] || sh[i] || i < from * W || dist[i] > CUT.SHADOW_DIST || grad[i] >= CUT.SHADOW_GRAD) return;
      const dr = bg[0] - px[i * 4];
      const dg = bg[1] - px[i * 4 + 1];
      const db = bg[2] - px[i * 4 + 2];
      if (Math.min(dr, dg, db) < -2 || Math.max(dr, dg, db) - Math.min(dr, dg, db) > CUT.SHADOW_TINT) return;
      sh[i] = 1;
      taken++;
      stack.push(i);
    };
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 0) shade(i - 1);
      if (x < W - 1) shade(i + 1);
      if (y > 0) shade(i - W);
      if (y < H - 1) shade(i + W);
    }
    let over = 0;
    for (let x = 0; x < W; x++) {
      let below = false;
      for (let y = H - 1; y >= from; y--) {
        const i = y * W + x;
        if (sh[i]) {
          if (below) over++;
        } else if (!clear[i]) below = true;
      }
    }
    if (taken && over <= CUT.SHADOW_OVER * taken) for (let i = from * W; i < N; i++) if (sh[i]) clear[i] = 1;
  }
  if (opt.noShadow) {
    // the shadow under the feet: light, nearly colourless and warm (never bluish: a sky-blue band stays), in the lowest 40 %
    const stack: number[] = [];
    for (let i = Math.floor(H * 0.6) * W; i < N; i++) if (clear[i]) stack.push(i);
    const shade = (i: number) => {
      if (clear[i] || ((i / W) | 0) < H * 0.6) return;
      const r = px[i * 4];
      const g = px[i * 4 + 1];
      const b = px[i * 4 + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) <= 45 && Math.min(r, g, b) >= 140 && r >= b - 4) {
        clear[i] = 1;
        stack.push(i);
      }
    };
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 0) shade(i - 1);
      if (x < W - 1) shade(i + 1);
      if (y > 0) shade(i - W);
      if (y < H - 1) shade(i + W);
    }
  }
  // the holes: enclosed, flat, ringed by an outline — and never the body itself
  const bgLum = (bg[0] + bg[1] + bg[2]) / 3;
  const holes = holesOf(W, H, { like, dist, lum, bgLum, meanMax: CUT.HOLE_MEAN_DIST, stdMax: CUT.HOLE_LUM_STD, outside: clear, outline: true });
  let figure = 0;
  for (let i = 0; i < N; i++) if (!clear[i]) figure++;
  let holesRemoved = 0;
  let holeArea = 0;
  if (holes.sizes.length) {
    const cap = opt.bigHoles ? Infinity : CUT.HOLE_MAX_SHARE * figure;
    const lab = regions(holes.mask, W, H);
    for (let i = 0; i < N; i++) {
      const k = lab.lab[i];
      if (k && lab.sizes[k] <= cap) clear[i] = 1;
    }
    for (let k = 1; k < lab.sizes.length; k++)
      if (lab.sizes[k] <= cap) {
        holesRemoved++;
        holeArea += lab.sizes[k];
      }
  }
  // the alpha: gone where cleared; a pixel touching the cleared part fades by how background-coloured it is; then a light feather
  const a = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (clear[i]) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && clear[yy * W + xx]) {
            touches = true;
            break;
          }
        }
      a[i] = touches && dist[i] < CUT.EDGE_SOLID ? Math.max(0, Math.min(1, (dist[i] - CUT.BG_DIST) / (CUT.EDGE_SOLID - CUT.BG_DIST))) : 1;
    }
  feather(a, W, H, clear);
  for (let i = 0; i < N; i++) px[i * 4 + 3] = Math.round(a[i] * 255);
  return { bg, clear, holesRemoved, holeArea };
}

/** a light feather (σ ≈ 0.6) that never spreads into the cleared part */
function feather(a: Float32Array, W: number, H: number, clear: Uint8Array) {
  const k = [0.166, 0.668, 0.166];
  const t = new Float32Array(a.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      t[i] = a[i] * k[1] + (x > 0 ? a[i - 1] : a[i]) * k[0] + (x < W - 1 ? a[i + 1] : a[i]) * k[2];
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = t[i] * k[1] + (y > 0 ? t[i - W] : t[i]) * k[0] + (y < H - 1 ? t[i + W] : t[i]) * k[2];
      if (clear[i] || v < 0.03) v = 0;
      if (v > 0.97) v = 1;
      a[i] = v;
    }
}

/**
 * After a colour key (M-R325): what is still near the measured key and connected to the outside goes too — the
 * leftover fringe and shadow — on raw RGBA pixels whose alpha the key already set. A green prop that is not the
 * key's green (further than CUT.KEY_FRINGE) or does not touch the outside stays. `original`: the colours before the
 * key's despill. Returns how many pixels went.
 */
export function keyFringe(px: Uint8Array, original: Uint8Array, W: number, H: number, key: Rgb3): number {
  const N = W * H;
  const stack: number[] = [];
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++)
    if (px[i * 4 + 3] === 0) {
      seen[i] = 1;
      const x = i % W;
      const y = (i / W) | 0;
      if ((x > 0 && px[(i - 1) * 4 + 3]) || (x < W - 1 && px[(i + 1) * 4 + 3]) || (y > 0 && px[(i - W) * 4 + 3]) || (y < H - 1 && px[(i + W) * 4 + 3])) stack.push(i);
    }
  // only from the outside: the transparent pixels connected to the border
  const outside = regions(seen, W, H);
  let gone = 0;
  const near = (i: number) => Math.max(Math.abs(original[i * 4] - key[0]), Math.abs(original[i * 4 + 1] - key[1]), Math.abs(original[i * 4 + 2] - key[2])) < CUT.KEY_FRINGE;
  const take = (j: number) => {
    if (seen[j] || !near(j)) return;
    seen[j] = 1;
    px[j * 4 + 3] = 0;
    gone++;
    stack.push(j);
  };
  const seeds = stack.splice(0).filter((i) => outside.edge[outside.lab[i]]);
  stack.push(...seeds);
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i / W) | 0;
    if (x > 0) take(i - 1);
    if (x < W - 1) take(i + 1);
    if (y > 0) take(i - W);
    if (y < H - 1) take(i + W);
  }
  return gone;
}

export interface CheckOptions {
  /** the background the picture was painted on (measured) */
  bg: Rgb3;
  /** 'plain': a light plain background; 'key': a key colour (a looser, flatter rule for the holes left) */
  kind: 'plain' | 'key';
  holesRemoved?: number;
  holeArea?: number;
  /** the Neptune bubble: big holes are meant */
  bigHoles?: boolean;
}

/**
 * The automatic check after a cut (M-R325). `original`: the picture's colours before the cut, `alpha`: the cut
 * (RGBA, only the alpha read). Three kinds of failure:
 *  - 'eaten': too much went — almost nothing is left, the removed part reaches into the figure (enclosed by it on all
 *    eight sides while connected to the outside: a leak through a broken outline), or the holes are most of the figure;
 *  - 'leftover': too little went — nearly the whole picture or much of its border is left;
 *  - 'holes': a background-coloured gap is still inside the figure.
 */
export function checkCut(original: Uint8Array, alpha: Uint8Array, W: number, H: number, opt: CheckOptions): CutReport {
  const N = W * H;
  const keep = new Uint8Array(N);
  let kept = 0;
  for (let i = 0; i < N; i++)
    if (alpha[i * 4 + 3] > 10) {
      keep[i] = 1;
      kept++;
    }
  let border = 0;
  for (let x = 0; x < W; x++) border += keep[x] + keep[(H - 1) * W + x];
  for (let y = 0; y < H; y++) border += keep[y * W] + keep[y * W + W - 1];
  // the removed part connected to the border, and how much of it the figure encloses on all eight sides
  const gone = new Uint8Array(N);
  for (let i = 0; i < N; i++) gone[i] = keep[i] ? 0 : 1;
  const out = regions(gone, W, H);
  const enclosed = new Uint8Array(N).fill(1);
  const sweep = (dx: number, dy: number) => {
    const seen = new Uint8Array(N);
    const xs = dx > 0 ? [0, W, 1] : [W - 1, -1, -1];
    const ys = dy > 0 ? [0, H, 1] : [H - 1, -1, -1];
    for (let y = ys[0]; y !== ys[1]; y += ys[2])
      for (let x = xs[0]; x !== xs[1]; x += xs[2]) {
        const px0 = x - dx;
        const py0 = y - dy;
        const i = y * W + x;
        if (px0 >= 0 && py0 >= 0 && px0 < W && py0 < H) {
          const p = py0 * W + px0;
          seen[i] = keep[p] || seen[p] ? 1 : 0;
        }
        if (!seen[i]) enclosed[i] = 0;
      }
  };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) sweep(dx, dy);
  let leak = 0;
  for (let i = 0; i < N; i++) if (gone[i] && enclosed[i] && out.edge[out.lab[i]]) leak++;
  // background-coloured gaps still in the figure
  const dist = distTo(original, N, opt.bg);
  const lum = luminance(original, N);
  const grad = sobel(lum, W, H);
  const like = new Uint8Array(N);
  const plain = opt.kind === 'plain';
  for (let i = 0; i < N; i++) like[i] = keep[i] && (plain ? dist[i] <= CUT.BG_DIST && grad[i] < CUT.EDGE_GRAD : dist[i] < CUT.KEY_FRINGE) ? 1 : 0;
  const left = holesOf(W, H, {
    like,
    dist,
    lum,
    bgLum: (opt.bg[0] + opt.bg[1] + opt.bg[2]) / 3,
    meanMax: plain ? CUT.HOLE_MEAN_DIST : CUT.KEY_HOLE_MEAN,
    stdMax: plain ? CUT.HOLE_LUM_STD : CUT.KEY_HOLE_STD,
    outside: gone,
    outline: plain,
  });
  const figure = Math.max(1, kept + (opt.holeArea ?? 0));
  const holesLeft = opt.bigHoles ? left.sizes.length : left.sizes.filter((s) => s <= CUT.HOLE_MAX_SHARE * figure).length;
  const report: CutReport = {
    kept: kept / N,
    borderKept: border / (2 * (W + H)),
    leak: leak / figure,
    holes: (opt.holeArea ?? 0) / figure,
    holesRemoved: opt.holesRemoved ?? 0,
    holesLeft,
    problems: [],
  };
  if (report.kept < CUT.MIN_KEPT || report.leak > CUT.MAX_LEAK || (!opt.bigHoles && report.holes > CUT.MAX_HOLES)) report.problems.push('eaten');
  if (report.kept > CUT.MAX_KEPT || report.borderKept > CUT.MAX_BORDER_KEPT) report.problems.push('leftover');
  if (holesLeft > 0) report.problems.push('holes');
  return report;
}

/** raw RGBA pixels of a picture, at most CUT.WORK_SIDE on its longer side (`flat`: any alpha it had is dropped) */
export async function rawOf(input: Buffer, side: number = CUT.WORK_SIDE, flat = true): Promise<{ px: Uint8Array; W: number; H: number }> {
  const s = flat ? sharp(input).removeAlpha().ensureAlpha() : sharp(input).ensureAlpha();
  const { data, info } = await s.resize(side, side, { fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  return { px: new Uint8Array(data.buffer, data.byteOffset, data.length), W: info.width, H: info.height };
}

/** the cut pixels as a square transparent PNG of `out` px around the figure (3 % margin). Throws when nothing is left. */
export async function frame(px: Uint8Array, W: number, H: number, out: number): Promise<Buffer> {
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (px[(y * W + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX <= minX || maxY <= minY) throw new Error('nothing left after removing the background');
  const side = Math.round(Math.max(maxX - minX, maxY - minY) * 1.06);
  const left = Math.round((minX + maxX) / 2 - side / 2);
  const top = Math.round((minY + maxY) / 2 - side / 2);
  const ext = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: W, height: H, channels: 4 } })
    .extend({ top: Math.max(0, -top), bottom: Math.max(0, top + side - H), left: Math.max(0, -left), right: Math.max(0, left + side - W), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp(ext)
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: side, height: side })
    .resize(out, out)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
