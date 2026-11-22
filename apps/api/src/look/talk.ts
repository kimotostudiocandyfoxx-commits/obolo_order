import { BATI_FACE_TO_TALK, type PartBox, type TalkExpression, type TalkFace, type TalkLook } from '@obolo/shared';
import sharp from 'sharp';

/**
 * 隣に並ぶトーク (M-R232〜M-R235): what the talk needs of a look, made in the background when a look is decided —
 * the six expressions (your own: four), an eyes-closed and an open-mouth edit of the faces that talk most, cut down to
 * small patches with where they sit (found by differencing, like scripts/kimorin/build.py) (M-R241: no コロリン mini any more).
 * Kept in onboardingJson `talk.me` / `talk.bati` (JSON TalkLook, `of` = the picture it was made from).
 */
export type TalkWho = 'me' | 'bati';

/** PLACEHOLDER (P-TALK-2): the faces that get blink / mouth parts (cost: two edits each); the others bob instead */
export const TALK_PART_FACES: TalkFace[] = ['normal', 'smile'];

const FACE_WORDS: Record<TalkFace, string> = {
  normal: 'a calm, friendly neutral face, mouth gently closed',
  smile: 'a warm happy smile, eyes curved with joy, mouth closed or a little open',
  surprised: 'a surprised face, eyes wide and round, eyebrows up, mouth a small open "o"',
  thinking: 'a thinking face, eyes looking up to one side, mouth a small flat line, a hand near the chin if there is a hand',
  sad: 'a gently sad, droopy face, eyebrows tilted, mouth a small frown (soft, not crying)',
  shy: 'a shy, bashful face, cheeks blushing pink, a small embarrassed smile, eyes looking a little away',
};
const KEEP =
  'Keep the same character exactly — the same face, hair, ears, clothes, colours, materials, size, framing, pose, light and the flat plain mid-grey background (#808080).';

/** an expression edit of the decided look (the look itself is the reference, so the face does not drift) */
export const talkFacePrompt = (f: TalkFace) => `Edit the first picture. ${KEEP} Change only the facial expression to ${FACE_WORDS[f]}. Cute, kids-friendly. No text, no letters.`;
/** M-R235: the same picture with only the eyes closed (the blink) */
export const TALK_BLINK_PROMPT = `Edit the first picture. ${KEEP} Change only the eyes: both eyes gently closed, as soft curved lines, as in the middle of a blink. Nothing else changes, not even a pixel of the pose. No text, no letters.`;
/** M-R235: the same picture with only the mouth open (the lip flap) */
export const TALK_MOUTH_PROMPT = `Edit the first picture. ${KEEP} Change only the mouth: open it a little, as in the middle of saying "a", a small rounded open mouth. Nothing else changes, not even a pixel of the pose. No text, no letters.`;
/** the parts of a picture that changed between two edits: diff → the region → its box (fractions) */
export interface FoundPart {
  box: PartBox;
  /** the patch cut from the changed picture at `box` (PNG with its alpha) */
  png: Buffer;
}

const W = 160;

/** RGBA at a small width, the same size for both */
async function small(buf: Buffer, w: number, h: number) {
  return sharp(buf).ensureAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer();
}

/**
 * Where `changed` (an eyes-closed or open-mouth edit) differs from `base`, inside the band `band` (top, bottom as
 * fractions: the face): the painter may shift the edit by a pixel or two, so the best small shift is found first.
 * Null when nothing (or too much) changed — the client falls back to a bob.
 */
export async function findPart(base: Buffer, changed: Buffer, band: [number, number] = [0, 0.6]): Promise<FoundPart | null> {
  const meta = await sharp(base).metadata();
  const fw = meta.width ?? 0;
  const fh = meta.height ?? 0;
  if (!fw || !fh) return null;
  const h = Math.max(8, Math.round((W * fh) / fw));
  const [a, b] = await Promise.all([small(base, W, h), small(changed, W, h)]);
  const y0 = Math.floor(band[0] * h);
  const y1 = Math.ceil(band[1] * h);
  const at = (buf: Buffer, x: number, y: number) => (y * W + x) * 4;
  const diff = (dx: number, dy: number, x: number, y: number) => {
    const xx = x + dx;
    const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= h) return 0;
    const i = at(a, x, y);
    const j = at(b, xx, yy);
    if (a[i + 3] < 128 && b[j + 3] < 128) return 0;
    return Math.max(Math.abs(a[i] - b[j]), Math.abs(a[i + 1] - b[j + 1]), Math.abs(a[i + 2] - b[j + 2]), Math.abs(a[i + 3] - b[j + 3]));
  };
  // the shift that makes the two agree most (±3 px at this size)
  let best = { dx: 0, dy: 0, sum: Infinity };
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      let sum = 0;
      for (let y = y0; y < y1; y += 2) for (let x = 0; x < W; x += 2) sum += diff(dx, dy, x, y);
      if (sum < best.sum) best = { dx, dy, sum };
    }
  const on = new Uint8Array(W * h);
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) on[y * W + x] = diff(best.dx, best.dy, x, y) > 48 ? 1 : 0;
  // a changed pixel counts when enough of its neighbours changed too (specks of noise go)
  let minX = W;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let n = 0;
  for (let y = y0 + 1; y < y1 - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!on[y * W + x]) continue;
      let k = 0;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) k += on[(y + v) * W + x + u];
      if (k < 5) continue;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  if (maxX < 0 || n < 4) return null;
  // too much changed: the painter redrew the figure, not just the part
  if ((maxX - minX + 1) * (maxY - minY + 1) > W * h * 0.12) return null;
  const pad = 2;
  const box = {
    x: Math.max(0, minX - pad + best.dx) / W,
    y: Math.max(0, minY - pad + best.dy) / h,
    w: Math.min(W, maxX - minX + 1 + pad * 2) / W,
    h: Math.min(h, maxY - minY + 1 + pad * 2) / h,
  };
  const cm = await sharp(changed).metadata();
  const cw = cm.width ?? fw;
  const ch = cm.height ?? fh;
  const left = Math.max(0, Math.round(box.x * cw));
  const top = Math.max(0, Math.round(box.y * ch));
  const width = Math.max(1, Math.min(cw - left, Math.round(box.w * cw)));
  const height = Math.max(1, Math.min(ch - top, Math.round(box.h * ch)));
  const png = await sharp(changed).ensureAlpha().extract({ left, top, width, height }).png().toBuffer();
  const r = (v: number) => Math.round(v * 10000) / 10000;
  // the box on the base picture (the patch is laid where the base's part is)
  return { box: { x: r(Math.max(0, minX - pad) / W), y: r(Math.max(0, minY - pad) / h), w: r(box.w), h: r(box.h) }, png };
}

/** the stored talk look, if it was made from the picture worn now */
export function storedTalk(j: Record<string, string>, who: TalkWho, of: string | null | undefined): TalkLook | null {
  if (!of) return null;
  try {
    const t = j[`talk.${who}`] ? (JSON.parse(j[`talk.${who}`]) as TalkLook) : null;
    return t && t.of === of ? t : null;
  } catch {
    return null;
  }
}

/**
 * The look the talk shows (Me.talk / BatiView.talk / a dachi's thread): the one made for the picture worn now, else —
 * while it is being made, or if it failed — the standing picture with what there is (your standee, {bati}'s faces).
 */
export function talkLookOf(j: Record<string, string>, who: TalkWho, of: string | null | undefined): TalkLook | null {
  if (!of) return null;
  const made = storedTalk(j, who, of);
  if (made) return made;
  if (who === 'me') {
    const stand = j['look.standee'] && j['look.standee.of'] === of ? j['look.standee'] : of;
    return { of, stand, making: true };
  }
  let faces: Record<string, string> = {};
  try {
    faces = j['bati.faces'] ? (JSON.parse(j['bati.faces']) as Record<string, string>) : {};
  } catch {
    faces = {};
  }
  const out: Partial<Record<TalkFace, TalkExpression>> = {};
  for (const [k, url] of Object.entries(faces)) {
    const f = BATI_FACE_TO_TALK[k];
    if (f && url) out[f] = { kind: 'image', url };
  }
  return { of, stand: of, faces: out, making: true };
}
