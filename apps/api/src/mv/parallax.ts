import { Logger } from '@nestjs/common';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { depthAt, type DepthModel } from './depth';

/**
 * 2.5D camera moves on a still (client idea 2026-10-11): with the picture's depth (depth.ts) the near
 * things (the food, the character) and the far things (the street, the sky) move by different
 * amounts, so a painted still looks like a camera moving through a real place. Gemini Flash-Lite
 * looks at all the pictures at once and picks each one's move and what to keep in focus; ffmpeg does
 * the moving (no cost per MV beyond a few hundred tokens).
 */
export type ParallaxMove = 'orbit-left' | 'orbit-right' | 'crane-up' | 'crane-down' | 'dolly-in' | 'dolly-out';
export type Parallax = { move: ParallaxMove; fx: number; fy: number; strength: number };
export const PARALLAX_MOVES: ParallaxMove[] = ['dolly-in', 'orbit-left', 'crane-up', 'orbit-right', 'dolly-out', 'crane-down'];
const log = new Logger('MvParallax');

/** Without Gemini: the moves in turn, the middle of the picture in focus. */
export function ruleParallax(n: number): Parallax[] {
  return Array.from({ length: n }, (_, k) => ({ move: PARALLAX_MOVES[k % PARALLAX_MOVES.length], fx: 0.5, fy: 0.5, strength: 1 }));
}

/** Gemini picks a move per picture (in order) — e.g. a slow push in on the food, a sideways orbit around the character. */
export async function directParallax(pictures: Buffer[], notes: string[], apiKey: string | undefined, model: string): Promise<Parallax[]> {
  const rule = ruleParallax(pictures.length);
  if (!apiKey || !pictures.length) return rule;
  try {
    const parts: Record<string, unknown>[] = [];
    for (const [k, p] of pictures.entries()) {
      parts.push({ text: `Picture ${k + 1}${notes[k] ? ` (${notes[k].slice(0, 120)})` : ''}:` });
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: (await sharp(p).resize(320, 320, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()).toString('base64') } });
    }
    parts.push({
      text: `You are the camera director of a music video made of these still anime pictures, shown in this order. Each picture gets a slow 2.5D camera move: near things and far things move apart, so it looks 3D.
For every picture choose:
- move: dolly-in (push towards the subject — food close-ups, emotional faces), dolly-out (pull back to reveal — wide places, endings), orbit-left / orbit-right (slide sideways around the subject — tables, characters in a scene), crane-up / crane-down (rise or sink — tall streets, skies, towers).
- fx, fy: where the main subject is (0..1 from the left / top); it stays steady while the rest moves.
- strength: 0.6 (calm) .. 1.4 (bold).
Neighbouring pictures should not repeat the same move; vary it like a real film.`,
    });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                move: { type: 'STRING', enum: PARALLAX_MOVES },
                fx: { type: 'NUMBER' },
                fy: { type: 'NUMBER' },
                strength: { type: 'NUMBER' },
              },
              required: ['move', 'fx', 'fy', 'strength'],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const got = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]') as Partial<Parallax>[];
    const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
    return rule.map((r, k) => {
      const g = got[k];
      if (!g) return r;
      return {
        move: PARALLAX_MOVES.includes(g.move as ParallaxMove) ? (g.move as ParallaxMove) : r.move,
        fx: clamp(g.fx, 0.1, 0.9, 0.5),
        fy: clamp(g.fy, 0.1, 0.9, 0.5),
        strength: clamp(g.strength, 0.5, 1.5, 1),
      };
    });
  } catch (e) {
    log.warn(`parallax direction: ${String(e).slice(0, 200)}`);
    return rule;
  }
}

/**
 * The ffmpeg filter graph for one clip: input 0 = the picture, input 1 = its depth picture (both
 * looped), output [v] = side×side for `dur` seconds. `focus` = the depth value (0..255) that stays
 * still; `beat` adds a small punch on every beat (the chorus).
 */
export function parallaxGraph(p: Parallax, focus: number, dur: number, side: number, beat?: number): string {
  const S = Math.round(side * 1.1); // room for the edges to move into
  const Q = Math.round(S / 4); // the displacement maps are made small (fast) and scaled up smoothly
  const D = Math.max(0.5, dur).toFixed(3);
  const k = p.strength;
  // how far a near-or-far point moves, in pixels at full size, per unit of depth difference
  const depthDiff = `(lum(X,Y)-${Math.round(focus)})/255`;
  const ease = `sin((T/${D}-0.5)*PI)`; // -1 → 1, slow at both ends
  const grow = `(T/${D})`;
  let dx = '0';
  let dy = '0';
  let zoom = `(1+0.04*${grow.replace('T', 't')})`;
  switch (p.move) {
    case 'orbit-left':
    case 'orbit-right': {
      const sgn = p.move === 'orbit-left' ? 1 : -1;
      dx = `${depthDiff}*${(44 * k * sgn).toFixed(1)}*${ease}`;
      break;
    }
    case 'crane-up':
    case 'crane-down': {
      const sgn = p.move === 'crane-up' ? 1 : -1;
      dy = `${depthDiff}*${(36 * k * sgn).toFixed(1)}*${ease}`;
      break;
    }
    case 'dolly-in':
    case 'dolly-out': {
      // near things grow away from the focus point faster than far ones
      const amt = p.move === 'dolly-in' ? `${grow}` : `(1-${grow})`;
      dx = `(${p.fx.toFixed(3)}-X/W)*${depthDiff}*${(110 * k).toFixed(1)}*${amt}`;
      dy = `(${p.fy.toFixed(3)}-Y/H)*${depthDiff}*${(110 * k).toFixed(1)}*${amt}`;
      zoom = p.move === 'dolly-in' ? `(1+${(0.08 * k).toFixed(3)}*t/${D})` : `(1+${(0.08 * k).toFixed(3)}*(1-t/${D}))`;
      break;
    }
  }
  if (beat) zoom = `(${zoom}+0.035*pow(1-mod(t,${beat.toFixed(3)})/${beat.toFixed(3)},3))`;
  const map = (e: string) => `geq=lum='clip(128+${e},0,255)',scale=${S}:${S}:flags=bilinear`;
  // the crop follows the focus point a little so the subject stays in frame while zooming
  const cx = `(iw-${side})*${p.fx.toFixed(3)}`;
  const cy = `(ih-${side})*${p.fy.toFixed(3)}`;
  return [
    `[0:v]scale=${S}:${S}:force_original_aspect_ratio=increase,crop=${S}:${S},format=yuv444p,setsar=1[p]`,
    `[1:v]scale=${Q}:${Q},format=gray,split=2[d1][d2]`,
    `[d1]${map(dx)}[xm]`,
    `[d2]${map(dy)}[ym]`,
    `[p][xm][ym]displace=edge=smear,scale=w='${S}*${zoom}':h='${S}*${zoom}':eval=frame,crop=${side}:${side}:'${cx}':'${cy}',format=yuv420p,setsar=1[v]`,
  ].join(';');
}

/**
 * Depth + camera move for every still (null where the picture is missing or its depth could not be
 * made — that one keeps the plain zoom / pan). The depth pictures are written next to the stills.
 */
export async function addParallax(
  files: (string | null)[],
  notes: string[],
  depthModel: DepthModel,
  gemini: { key?: string; model: string },
): Promise<((Parallax & { focus: number; depth: string }) | null)[]> {
  const pics: (Buffer | null)[] = await Promise.all(files.map((f) => (f ? readFile(f).catch(() => null) : null)));
  const shown: { p: Buffer; k: number }[] = [];
  pics.forEach((p, k) => p && shown.push({ p, k }));
  const [moves, depths] = await Promise.all([
    directParallax(
      shown.map((x) => x.p),
      shown.map((x) => notes[x.k] ?? ''),
      gemini.key,
      gemini.model,
    ),
    // one at a time: the model is CPU-bound and the API has two CPUs
    (async () => {
      const out: (Buffer | null)[] = [];
      for (const x of shown) out.push(await depthModel.depth(x.p));
      return out;
    })(),
  ]);
  const result: ((Parallax & { focus: number; depth: string }) | null)[] = files.map(() => null);
  await Promise.all(
    shown.map(async (x, j) => {
      const d = depths[j];
      if (!d) return;
      const file = `${files[x.k]}.depth.png`;
      await writeFile(file, d);
      result[x.k] = { ...moves[j], focus: await depthAt(d, moves[j].fx, moves[j].fy), depth: file };
    }),
  );
  return result;
}
