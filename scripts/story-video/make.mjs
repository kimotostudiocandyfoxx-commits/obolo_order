#!/usr/bin/env node
/**
 * Story motions made by Claude Code (client decision 2026-10-20): Seedance 2.5 on Runware
 * (model bytedance:seedance@2.5, the same key as the Seedream pictures). Run by
 * .github/workflows/story-video.yml when design/story-video-queue.json changes.
 *
 * Each queue item: { id, prompt, first?, last?, refs?, duration?, resolution?, audio? }
 *  - first / last: the picture the motion starts / ends on (a path in the repo) — so it joins the scenes
 *    around it exactly (e.g. the last frame of the motion before)
 *  - refs: character / place reference pictures (the client's art)
 *  - duration: seconds (default 5) · resolution: "720p" (default) or "480p" · audio: let Seedance add sound
 * Saved as apps/web/public/onboarding/m<id>.mp4 (720×1280, squeezed to ≤ 1 MB, docs/media.md) + m<id>.jpg.
 * An id is made once; "redo": [ids] makes it again. The report (cost included) goes to
 * docs/story-import/video-last-run.md.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.RUNWARE_API_KEY ?? process.env.SEEDREAM_API_KEY;
if (!KEY) throw new Error('RUNWARE_API_KEY is not set');
const QUEUE = process.argv[2] ?? 'design/story-video-queue.json';
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const OUT = 'apps/web/public/onboarding';
const MODEL = queue.model ?? 'bytedance:seedance@2.5';
const API = 'https://api.runware.ai/v1';
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
const dataUri = (p) => `data:${mime(p)};base64,${readFileSync(p).toString('base64')}`;
const redo = new Set(queue.redo ?? []);
const log = [];
const todo = (queue.items ?? []).filter((x) => redo.has(x.id) || !existsSync(join(OUT, `m${x.id}.mp4`)));

async function call(tasks) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(120_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 400)}`);
  return j.data ?? [];
}

async function make(x) {
  try {
    return await makeOnce(x, !!x.audio);
  } catch (e) {
    // the sound option is the least certain part of the request: without it, try once more
    if (x.audio && /audio|providerSettings|unsupported|invalid/i.test(String(e))) {
      log.push(`- ⚠️ m${x.id}: 音つきが通らず、音なしで作り直し（${String(e).slice(0, 160)}）`);
      return makeOnce(x, false);
    }
    throw e;
  }
}

async function makeOnce(x, audio) {
  const taskUUID = randomUUID();
  const [w, h] = x.resolution === '480p' ? [480, 864] : [720, 1280];
  const frameImages = [
    ...(x.first ? [{ inputImage: dataUri(x.first), frame: 'first' }] : []),
    ...(x.last ? [{ inputImage: dataUri(x.last), frame: 'last' }] : []),
  ];
  const refs = (x.refs ?? []).filter(existsSync);
  await call([
    {
      taskType: 'videoInference',
      taskUUID,
      model: MODEL,
      positivePrompt: `${x.prompt} ${queue.always ?? ''}`.trim().slice(0, 3000),
      duration: x.duration ?? 5,
      width: w,
      height: h,
      outputFormat: 'MP4',
      deliveryMethod: 'async',
      includeCost: true,
      ...(frameImages.length ? { frameImages } : {}),
      ...(refs.length ? { referenceImages: refs.map(dataUri) } : {}),
      ...(audio ? { providerSettings: { bytedance: { audio: true } } } : {}),
    },
  ]);
  // the motion is made in the background: ask for it until it is there (up to ~12 minutes)
  for (let k = 0; k < 144; k++) {
    await new Promise((r) => setTimeout(r, 5000));
    const d = (await call([{ taskType: 'getResponse', taskUUID }])).find((r) => r.taskUUID === taskUUID);
    if (d?.status === 'error') throw new Error(JSON.stringify(d).slice(0, 300));
    if (d?.videoURL) {
      const raw = join(OUT, `_m${x.id}.mp4`);
      writeFileSync(raw, Buffer.from(await (await fetch(d.videoURL)).arrayBuffer()));
      squeeze(raw, join(OUT, `m${x.id}.mp4`), w !== 720);
      rmSync(raw);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(OUT, `m${x.id}.mp4`), '-frames:v', '1', '-q:v', '3', join(OUT, `m${x.id}.jpg`)]);
      return d.cost ?? 0;
    }
  }
  throw new Error('the motion did not come back in time');
}

/** 720×1280, H.264 + AAC, as light as it takes to stay under 1 MB */
function squeeze(src, out, upscale) {
  for (const crf of [23, 26, 29, 32, 35]) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale=720:1280${upscale ? ':flags=lanczos' : ''}`, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-preset', 'slow', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
    if (statSync(out).size <= 1_000_000) return;
  }
}

let usd = 0;
for (const x of todo) {
  try {
    usd += await make(x);
    log.push(`- ✅ m${x.id}（${x.duration ?? 5}秒・${x.resolution ?? '720p'}）`);
  } catch (e) {
    log.push(`- ❌ m${x.id}: ${String(e).slice(0, 400)}`);
  }
}
if ((queue.redo ?? []).length) writeFileSync(QUEUE, JSON.stringify({ ...queue, redo: [] }, null, 2) + '\n');
mkdirSync('docs/story-import', { recursive: true });
const report = [`# 物語の動画 — ${new Date().toISOString()}`, '', `${MODEL} / ${todo.length}本 / 約${Math.round(usd * 150)}円`, '', ...log, ''].join('\n');
writeFileSync('docs/story-import/video-last-run.md', report);
console.log(report);
