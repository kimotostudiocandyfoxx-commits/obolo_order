import sharp from 'sharp';

/**
 * Chroma keying for the live looks and {bati} (cut-out review 2026-11-23) — the server twin of scripts/lib/keying.py
 * (same steps, same numbers; the scripts' unit checks and these tests use the same synthetic pictures).
 *
 * The painting is asked for on a flat key colour chosen far from the character's own colours (chooseKey, OKLab), and
 * cut by its distance to the background measured on the border: a soft band unmixed against the character's nearby
 * colour, the key taken out of the edge (un-premultiply + despill toward the key's hue only), the specks of background
 * removed, holes inside the figure filled unless they are clearly the key seen through a gap, a half-pixel erosion and
 * a light feather. The old cut (a flood fill within an RGB distance of #808080) left a grey fringe and ate grey parts.
 */
export type Rgb = [number, number, number];

export const KEYS = {
  green: [0, 255, 0] as Rgb,
  magenta: [255, 0, 255] as Rgb,
  blue: [0, 0, 255] as Rgb,
};
export type KeyName = keyof typeof KEYS;
/** what the prompts call them */
export const KEY_WORDS: Record<KeyName, string> = {
  green: 'pure chroma-key green (#00FF00)',
  magenta: 'pure magenta (#FF00FF)',
  blue: 'pure chroma-key blue (#0000FF)',
};
/** a character whose nearest colour is closer than this (OKLab) to the key keys badly (the matte is fully opaque from ~0.13): it is painted again on another */
export const MIN_CLEARANCE = 0.15;

/** the background words of a prompt on `key` (a key's name, or the words for any colour) */
export const keyBackground = (key: KeyName | string) =>
  `a perfectly flat, solid ${(KEY_WORDS as Record<string, string>)[key] ?? key} background — one single even colour everywhere around it, also in the gaps — with no floor, no shadow, no light spill and no other objects; nothing on the character is that colour`;
/** an edit that changes only the background to `key` */
export const rekeyPrompt = (key: KeyName) =>
  `Edit the picture: replace only the background with ${keyBackground(key)}. Keep the character exactly the same, pixel for pixel: the same pose, size, position, outline, colours, light and details. Nothing else changes. No text, no letters.`;

// --- colour ----------------------------------------------------------------------------------------------------------

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const lin = (v: number) => {
  const c = Math.min(1, Math.max(0, v / 255));
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** sRGB 0..255 → OKLab (into out[o..o+2]) */
export function oklab(r: number, g: number, b: number, out: Float32Array | number[] = [0, 0, 0], o = 0) {
  const R = Number.isInteger(r) && r >= 0 && r < 256 ? LIN[r] : lin(r);
  const G = Number.isInteger(g) && g >= 0 && g < 256 ? LIN[g] : lin(g);
  const B = Number.isInteger(b) && b >= 0 && b < 256 ? LIN[b] : lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return out;
}

/** OKLab → sRGB 0..255 */
export function fromOklab(L: number, A: number, B: number): Rgb {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return Math.min(255, Math.max(0, (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255));
  };
  return [enc(r), enc(g), enc(b)];
}

const dist3 = (a: ArrayLike<number>, i: number, b: ArrayLike<number>) => Math.hypot(a[i] - b[0], a[i + 1] - b[1], a[i + 2] - b[2]);

function percentile(xs: Float32Array | number[], q: number) {
  if (!xs.length) return 0;
  const s = Float32Array.from(xs).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor((q / 100) * (s.length - 1))))];
}

// --- the key colour ---------------------------------------------------------------------------------------------------

/** OKLab of the solid pixels (alpha > 230, not on the edge) of an RGBA buffer, at most ~40k of them */
function subjectLab(px: Uint8Array, W: number, H: number): Float32Array {
  const solid = (i: number) => px[i * 4 + 3] > 230;
  const step = Math.max(1, Math.round(Math.sqrt((W * H) / 40_000)));
  const out: number[] = [];
  const t = [0, 0, 0];
  for (let y = 2; y < H - 2; y += step) {
    for (let x = 2; x < W - 2; x += step) {
      const i = y * W + x;
      if (!solid(i) || !solid(i - 2) || !solid(i + 2) || !solid(i - 2 * W) || !solid(i + 2 * W)) continue;
      oklab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], t);
      out.push(t[0], t[1], t[2]);
    }
  }
  return Float32Array.from(out);
}

/** how far the character's colours (OKLab triplets) are from `key`: the nearest 0.1 % of them */
export function clearanceOf(lab: Float32Array, key: Rgb): number {
  if (!lab.length) return 1;
  const k = oklab(key[0], key[1], key[2]);
  const d = new Float32Array(lab.length / 3);
  for (let i = 0; i < d.length; i++) d[i] = dist3(lab, i * 3, k);
  return percentile(d, 0.1);
}

/**
 * The key colour farthest from every colour of the picture's subject: a cut-out (its solid pixels) or, without alpha,
 * the middle of the picture (a portrait on a soft background). Best first.
 */
export async function rankKeys(input: Buffer, names: KeyName[] = ['green', 'magenta', 'blue']): Promise<{ key: KeyName; clearance: number }[]> {
  const { data, info } = await sharp(input).ensureAlpha().resize(256, 256, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  let opaque = true;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) opaque = false;
  if (opaque) {
    // no alpha: the middle 60 % of the picture stands for the character
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (x < info.width * 0.2 || x > info.width * 0.8 || y < info.height * 0.15 || y > info.height * 0.95) px[(y * info.width + x) * 4 + 3] = 0;
  }
  const lab = subjectLab(px, info.width, info.height);
  return names.map((key) => ({ key, clearance: clearanceOf(lab, KEYS[key]) })).sort((a, b) => b.clearance - a.clearance);
}

/** the best key for a subject (see rankKeys) */
export async function chooseKey(input: Buffer, names?: KeyName[]): Promise<KeyName> {
  return (await rankKeys(input, names).catch(() => [{ key: 'green' as KeyName, clearance: 1 }]))[0].key;
}

/** a cut-out put back on its key colour, as the reference for an edit (JPEG) */
export async function onKey(png: Buffer, key: KeyName): Promise<{ data: Buffer; mime: string }> {
  const [r, g, b] = KEYS[key];
  return { data: await sharp(png).flatten({ background: { r, g, b } }).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' };
}

// --- the matte ---------------------------------------------------------------------------------------------------------

/** a saturated key's own channels and the others (green: hi [1], lo [0, 2]); null for grey, white or a muddy colour */
function channels(K: Rgb): { hi: number[]; lo: number[] } | null {
  const m = Math.max(...K);
  const hi = [0, 1, 2].filter((c) => K[c] >= 0.6 * m);
  const lo = [0, 1, 2].filter((c) => !hi.includes(c));
  if (!lo.length || Math.min(...hi.map((c) => K[c])) - Math.max(...lo.map((c) => K[c])) < 60) return null;
  return { hi, lo };
}
/** how much of the key's own channels a colour has over the others (green: g − max(r, b)) */
const keyness = (v: ArrayLike<number>, o: number, ch: { hi: number[]; lo: number[] }) => Math.min(...ch.hi.map((c) => v[o + c])) - Math.max(...ch.lo.map((c) => v[o + c]));

/** each pixel's standard deviation of `v` over a (2r+1)² window (summed-area tables) */
function localStd(v: Float32Array, W: number, H: number, r: number): Float32Array {
  const S1 = new Float64Array((W + 1) * (H + 1));
  const S2 = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = v[y * W + x];
      const j = (y + 1) * (W + 1) + x + 1;
      S1[j] = a + S1[j - 1] + S1[j - W - 1] - S1[j - W - 2];
      S2[j] = a * a + S2[j - 1] + S2[j - W - 1] - S2[j - W - 2];
    }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(W, x + r + 1);
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(H, y + r + 1);
      const n = (x1 - x0) * (y1 - y0);
      const box = (S: Float64Array) => S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
      const m = box(S1) / n;
      out[y * W + x] = Math.sqrt(Math.max(0, box(S2) / n - m * m));
    }
  return out;
}

/** 8- or 4-connected components of a mask: labels (0 = not in the mask) and each one's size */
function components(mask: Uint8Array, W: number, H: number, eight: boolean) {
  const lab = new Int32Array(W * H);
  const sizes: number[] = [0];
  const stack: number[] = [];
  let n = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s]) continue;
    n++;
    let size = 0;
    lab[s] = n;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % W;
      const y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!eight && dx && dy) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const j = yy * W + xx;
          if (mask[j] && !lab[j]) {
            lab[j] = n;
            stack.push(j);
          }
        }
      }
    }
    sizes.push(size);
  }
  return { lab, sizes };
}

/** chamfer distance (px, 3-4 metric / 3) of every pixel to the nearest pixel where `to` is set */
function distanceTo(to: Uint8Array, W: number, H: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = to[i] ? 0 : INF;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 3);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - W] + 3);
        if (x > 0) d[i] = Math.min(d[i], d[i - W - 1] + 4);
        if (x < W - 1) d[i] = Math.min(d[i], d[i - W + 1] + 4);
      }
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + 3);
      if (y < H - 1) {
        d[i] = Math.min(d[i], d[i + W] + 3);
        if (x < W - 1) d[i] = Math.min(d[i], d[i + W + 1] + 4);
        if (x > 0) d[i] = Math.min(d[i], d[i + W - 1] + 4);
      }
    }
  for (let i = 0; i < W * H; i++) d[i] /= 3;
  return d;
}

export interface KeyInfo {
  key: Rgb;
  tBg: number;
  islandsRemoved: number;
  holesFilled: number;
  gapsKept: number;
  /** how far the character's colours are from the background (OKLab, nearest 0.1 %) */
  clearance: number;
}

/**
 * The matte on raw RGBA pixels (changed in place: the alpha and the edge colours). `key`: the background asked for;
 * the border's own colour is used when the border is flat (the painter drifts a little from the asked hex).
 */
export function keyMatte(px: Uint8Array, W: number, H: number, key?: Rgb): KeyInfo {
  const N = W * H;
  // the border's colour and noise
  const border: number[] = [];
  const B = Math.max(2, Math.min(6, Math.floor(Math.min(W, H) / 20)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < B || y < B || x >= W - B || y >= H - B) border.push(y * W + x);
  const med = (c: number) => percentile(border.map((i) => px[i * 4 + c]), 50);
  let K: Rgb = [med(0), med(1), med(2)];
  const lab = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) oklab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], lab, i * 3);
  let kl = oklab(K[0], K[1], K[2]);
  const bd = Float32Array.from(border.map((i) => dist3(lab, i * 3, kl)));
  if (key && percentile(bd, 75) > 0.06) {
    K = key;
    kl = oklab(K[0], K[1], K[2]);
    for (let j = 0; j < border.length; j++) bd[j] = dist3(lab, border[j] * 3, kl);
  }
  const noise = percentile(bd, 98);
  const tBg = Math.min(0.12, Math.max(0.03, noise * 1.4 + 0.012));
  const tFg = tBg + 0.1;
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = dist3(lab, i * 3, kl);
  // texture: the painted background is flat; shading on the character near the key's colour is not — only flat pixels
  // near the key are background (5×5 standard deviation of the distance, against the border's own)
  const tex = localStd(d, W, H, 2);
  const borderTex = Float32Array.from(border.map((i) => tex[i]));
  const tTex = Math.max(percentile(borderTex, 98) * 1.6, 0.006);
  const bg = new Uint8Array(N);
  for (let i = 0; i < N; i++) bg[i] = d[i] < tBg && tex[i] < tTex ? 1 : 0;
  // a saturated key drifts across a painting (lit unevenly): what is clearly of the key's own channels is background too
  const ch0 = channels(K);
  if (ch0) {
    const kk0 = keyness(K, 0, ch0) * 0.75;
    for (let i = 0; i < N; i++) if (keyness(px, i * 4, ch0) >= kk0) bg[i] = 1;
  }
  // a floor shadow: the key's own hue, only darker, touching the background (never for a colourless key)
  const kc = Math.hypot(kl[1], kl[2]);
  if (kc > 0.08) {
    const kh = Math.atan2(kl[2], kl[1]);
    const shade = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (bg[i]) continue;
      const L = lab[i * 3];
      const c = Math.hypot(lab[i * 3 + 1], lab[i * 3 + 2]);
      let dh = Math.abs(Math.atan2(lab[i * 3 + 2], lab[i * 3 + 1]) - kh);
      if (dh > Math.PI) dh = 2 * Math.PI - dh;
      if (dh < 0.12 && L < kl[0] + 0.02 && c > 0.04 && Math.abs(c / kc - L / kl[0]) < 0.18) shade[i] = 1;
    }
    const stack: number[] = [];
    for (let i = 0; i < N; i++) if (bg[i]) stack.push(i);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || !shade[j] || bg[j]) continue;
        bg[j] = 1;
        stack.push(j);
      }
    }
  }
  // islands: the figure and anything sizeable stays
  const core = new Uint8Array(N);
  for (let i = 0; i < N; i++) core[i] = bg[i] ? 0 : 1;
  const fig = components(core, W, H, true);
  const big = Math.max(0, ...fig.sizes);
  let islandsRemoved = 0;
  const keepIt = fig.sizes.map((s, j) => j > 0 && s >= Math.max(60 * (N / (1536 * 1152)) + 4, big * 0.0015));
  islandsRemoved = fig.sizes.filter((_, j) => j > 0 && !keepIt[j]).length;
  for (let i = 0; i < N; i++) core[i] = fig.lab[i] && keepIt[fig.lab[i]] ? 1 : 0;
  // holes: filled unless clearly the key seen through a gap
  const out0 = new Uint8Array(N);
  for (let i = 0; i < N; i++) out0[i] = core[i] ? 0 : 1;
  const holes = components(out0, W, H, false);
  const onEdge = new Set<number>();
  for (let x = 0; x < W; x++) onEdge.add(holes.lab[x]).add(holes.lab[(H - 1) * W + x]);
  for (let y = 0; y < H; y++) onEdge.add(holes.lab[y * W]).add(holes.lab[y * W + W - 1]);
  const clearT = Math.max(noise * 1.15, 0.7 * tBg);
  const clearCount = new Float64Array(holes.sizes.length);
  // clearly the key: flat and as close to it as the border's noise (or a shade of it)
  for (let i = 0; i < N; i++) if (holes.lab[i] && bg[i] && (d[i] < clearT || d[i] >= tBg)) clearCount[holes.lab[i]]++;
  // on a colourless key (grey) a small flat patch may as well be the character's own grey: only a sizeable one is a gap
  const minGap = kc > 0.08 ? 6 : 80 * (N / (864 * 1152));
  let holesFilled = 0;
  let gapsKept = 0;
  const fill = new Uint8Array(holes.sizes.length);
  for (let j = 1; j < holes.sizes.length; j++) {
    if (onEdge.has(j)) continue;
    if (holes.sizes[j] >= minGap && clearCount[j] >= Math.max(3, 0.25 * holes.sizes[j])) gapsKept++;
    else {
      fill[j] = 1;
      holesFilled++;
    }
  }
  for (let i = 0; i < N; i++) if (holes.lab[i] && fill[holes.lab[i]]) core[i] = 1;
  // the character's own colour near each edge pixel (sure pixels within 3 px, else 7 px)
  const notCore = new Uint8Array(N);
  for (let i = 0; i < N; i++) notCore[i] = core[i] ? 0 : 1;
  const toBg = distanceTo(notCore, W, H);
  const toFg = distanceTo(core, W, H);
  const ch = channels(K);
  const kke = ch ? keyness(K, 0, ch) * 0.92 : 0;
  const sure = new Uint8Array(N);
  for (let i = 0; i < N; i++) sure[i] = core[i] && d[i] >= tFg ? 1 : 0;
  const alpha = new Float32Array(N);
  const ref = new Float32Array(N * 3);
  const near = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    near[i] = (core[i] && toBg[i] <= 3) || (!core[i] && toFg[i] <= 2) ? 1 : 0;
    alpha[i] = core[i] ? 1 : 0;
  }
  for (let i = 0; i < N; i++) {
    if (!near[i] && !(core[i] && toBg[i] <= 3.5)) continue;
    const x = i % W;
    const y = (i / W) | 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sw = 0;
    for (const R of [3, 7]) {
      for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++)
        for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) {
          const j = yy * W + xx;
          if (!sure[j]) continue;
          const wgt = 1 / (1 + (xx - x) ** 2 + (yy - y) ** 2);
          sr += px[j * 4] * wgt;
          sg += px[j * 4 + 1] * wgt;
          sb += px[j * 4 + 2] * wgt;
          sw += wgt;
        }
      if (sw > 0) break;
    }
    if (sw > 0) {
      ref[i * 3] = sr / sw;
      ref[i * 3 + 1] = sg / sw;
      ref[i * 3 + 2] = sb / sw;
    } else {
      ref[i * 3] = px[i * 4];
      ref[i * 3 + 1] = px[i * 4 + 1];
      ref[i * 3 + 2] = px[i * 4 + 2];
    }
    if (!near[i]) continue;
    const vr = ref[i * 3] - K[0];
    const vg = ref[i * 3 + 1] - K[1];
    const vb = ref[i * 3 + 2] - K[2];
    const vv = vr * vr + vg * vg + vb * vb;
    // unmixed against the nearby colour, never below the least coverage that keeps the un-mixed colour inside the RGB
    // cube (a dark outline between a light colour and the key is under-rated by the unmixing alone)
    let lo = 0;
    for (let c = 0; c < 3; c++) {
      const v = px[i * 4 + c];
      lo = Math.max(lo, v < K[c] ? (K[c] - v) / Math.max(K[c], 1) : (v - K[c]) / Math.max(255 - K[c], 1));
    }
    let a = Math.max(lo, vv > 3600 ? ((px[i * 4] - K[0]) * vr + (px[i * 4 + 1] - K[1]) * vg + (px[i * 4 + 2] - K[2]) * vb) / vv : (d[i] - tBg) / (tFg - tBg));
    // a saturated key: the classic channel difference (green: g − max(r, b)) mixes linearly between the key's and the
    // nearby character colour's, robust on white, grey and dark outlines alike (where the character has none of it)
    if (ch) {
      const kF = keyness(ref, i * 3, ch);
      if (kF < 10) a = (kke - keyness(px, i * 4, ch)) / Math.max(kke - Math.min(kF, 0), 1);
    }
    alpha[i] = Math.min(1, Math.max(0, a));
  }
  // colours: the key un-mixed from half-covered pixels (toward the character's own colour at the very edge), then the
  // key's hue taken out of the outer 3 px
  const khA = kc > 0.03 ? kl[1] / kc : 0;
  const khB = kc > 0.03 ? kl[2] / kc : 0;
  const t3 = [0, 0, 0];
  const r3 = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    if (!(core[i] || near[i])) continue;
    const a = alpha[i];
    let r = px[i * 4];
    let g = px[i * 4 + 1];
    let b = px[i * 4 + 2];
    if (a < 0.999) {
      const k = Math.max(a, 0.05);
      // (by the distance only: the character's own nearby colour at the very edge, where the unmixing is unsure)
      const t = ch ? 1 : Math.min(1, a / 0.35);
      const un = (c: number, kk: number, rf: number) => Math.min(255, Math.max(0, (c - (1 - k) * kk) / k)) * t + rf * (1 - t);
      r = un(r, K[0], ref[i * 3]);
      g = un(g, K[1], ref[i * 3 + 1]);
      b = un(b, K[2], ref[i * 3 + 2]);
    }
    if (ch && toBg[i] <= 4 && keyness(ref, i * 3, ch) < 10) {
      // the classic clamp: the key's channels not above the others, nor pushed below them (a lilac rim on green)
      const c3 = [r, g, b];
      const top = Math.max(...ch.lo.map((c) => c3[c]));
      const bot = Math.min(...ch.lo.map((c) => c3[c]));
      for (const c of ch.hi) c3[c] = Math.max(Math.min(c3[c], top + 4), bot * 0.94);
      [r, g, b] = c3;
    } else if (!ch && kc > 0.03 && toBg[i] <= 3) {
      oklab(r, g, b, t3);
      oklab(ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2], r3);
      const p = t3[1] * khA + t3[2] * khB;
      const pr = Math.max(0, r3[1] * khA + r3[2] * khB);
      const ex = Math.max(0, p - pr);
      if (ex > 0) {
        const L = ex > 0.02 ? t3[0] * 0.6 + r3[0] * 0.4 : t3[0];
        [r, g, b] = fromOklab(L, t3[1] - ex * khA, t3[2] - ex * khB);
      }
    }
    px[i * 4] = Math.round(r);
    px[i * 4 + 1] = Math.round(g);
    px[i * 4 + 2] = Math.round(b);
  }
  // a half-pixel erosion (2×2 minimum), then a light feather (σ 0.6), never beyond the figure and its edge band
  const er = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      er[i] = Math.min(alpha[i], x > 0 ? alpha[i - 1] : alpha[i], y > 0 ? alpha[i - W] : alpha[i], x > 0 && y > 0 ? alpha[i - W - 1] : alpha[i]);
    }
  const k3 = [0.166, 0.668, 0.166];
  const tmp = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      tmp[i] = er[i] * k3[1] + (x > 0 ? er[i - 1] : er[i]) * k3[0] + (x < W - 1 ? er[i + 1] : er[i]) * k3[2];
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let a = tmp[i] * k3[1] + (y > 0 ? tmp[i - W] : tmp[i]) * k3[0] + (y < H - 1 ? tmp[i + W] : tmp[i]) * k3[2];
      if (!(core[i] || near[i])) a = 0;
      if (a < 0.03) a = 0;
      if (a > 0.97) a = 1;
      px[i * 4 + 3] = Math.round(a * 255);
    }
  return { key: K, tBg, islandsRemoved, holesFilled, gapsKept, clearance: clearanceOf(subjectLab(px, W, H), K) };
}

/**
 * Cut a character off its flat key background → a square transparent PNG of `out` px around it (3 % margin), like
 * cutoutWhite. Throws when nothing is left.
 */
export async function cutoutKey(input: Buffer, out = 768, key?: Rgb): Promise<{ png: Buffer; info: KeyInfo }> {
  const { data, info: meta } = await sharp(input).removeAlpha().ensureAlpha().resize(900, 900, { fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  const W = meta.width;
  const H = meta.height;
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const info = keyMatte(px, W, H, key);
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (px[(y * W + x) * 4 + 3] > 10) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  if (maxX <= minX || maxY <= minY) throw new Error('nothing left after removing the background');
  const side = Math.round(Math.max(maxX - minX, maxY - minY) * 1.06);
  const left = Math.round((minX + maxX) / 2 - side / 2);
  const top = Math.round((minY + maxY) / 2 - side / 2);
  const ext = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: W, height: H, channels: 4 } })
    .extend({ top: Math.max(0, -top), bottom: Math.max(0, top + side - H), left: Math.max(0, -left), right: Math.max(0, left + side - W), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const png = await sharp(ext)
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: side, height: side })
    .resize(out, out)
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, info };
}

/**
 * A painting on `key` cut out; when the character came out too near the key (a food's green on green), the background
 * is painted again on the next best key by `rekey` (an image edit) and the cleaner of the two kept. Null when nothing
 * could be cut.
 */
export async function cutoutChecked(
  data: Buffer,
  out: number,
  key: KeyName,
  rekey?: (to: KeyName, prompt: string) => Promise<Buffer>,
): Promise<{ png: Buffer; key: KeyName; clearance: number } | null> {
  const first = await cutoutKey(data, out, KEYS[key]).catch(() => null);
  if (first && first.info.clearance >= MIN_CLEARANCE) return { png: first.png, key, clearance: first.info.clearance };
  if (!rekey) return first ? { png: first.png, key, clearance: first.info.clearance } : null;
  // the key its colours are farthest from, measured on the first cut (or the whole picture)
  const ranked = (await rankKeys(first?.png ?? data).catch(() => [])).filter((r) => r.key !== key);
  const to = ranked[0]?.key ?? (key === 'magenta' ? 'green' : 'magenta');
  const again = await rekey(to, rekeyPrompt(to))
    .then((b) => cutoutKey(b, out, KEYS[to]))
    .catch(() => null);
  if (again && (!first || again.info.clearance > first.info.clearance)) return { png: again.png, key: to, clearance: again.info.clearance };
  return first ? { png: first.png, key, clearance: first.info.clearance } : null;
}

/**
 * A picture on one flat colour put on another (its own size and framing kept): the prepared {bati} bodies are painted on
 * grey (assets/bati), the edit that dresses them should see the key colour the result is cut from.
 */
export async function moveToKey(input: Buffer, from: Rgb, to: KeyName): Promise<{ data: Buffer; mime: string; png: Buffer }> {
  const { data, info } = await sharp(input).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  keyMatte(px, info.width, info.height, from);
  const png = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { ...(await onKey(png, to)), png };
}
