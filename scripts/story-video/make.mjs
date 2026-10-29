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
import { dirname, join } from 'node:path';

const KEY = process.env.RUNWARE_API_KEY ?? process.env.SEEDREAM_API_KEY;
if (!KEY) throw new Error('RUNWARE_API_KEY is not set');
const QUEUE = process.argv[2] ?? 'design/story-video-queue.json';
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
// the review queue (design/review-video-queue.json) puts each cut in art/review for the story chat to judge first
const OUT = queue.out ?? 'apps/web/public/onboarding';
const file = (id) => (queue.out ? `${id}` : `m${id}`);
const MODEL = queue.model ?? 'bytedance:seedance@2.5';
const API = 'https://api.runware.ai/v1';
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
const dataUri = (p) => `data:${mime(p)};base64,${readFileSync(p).toString('base64')}`;
const redo = new Set(queue.redo ?? []);
const log = [];
const todo = (queue.items ?? []).filter((x) => redo.has(x.id) || !existsSync(join(OUT, `${file(x.id)}.mp4`)));

async function call(tasks) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(120_000),
  });
  const j = await res.json().catch(() => ({}));
  // the service now answers a task still being made with 500 + status "processing" (2026-10-26): not a failure
  const stillMaking = !res.ok && !j.errors?.length && Array.isArray(j.data) && j.data.length > 0 && j.data.every((d) => d.status === 'processing');
  if (stillMaking) return j.data;
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 1500)}`);
  return j.data ?? [];
}

async function make(x) {
  // credit still reserved by a request that is finishing: wait and ask again (up to ~5 minutes)
  for (let k = 0; ; k++) {
    try {
      return await makeWithSound(x);
    } catch (e) {
      if (k < 10 && /concurrentRequestLimitExceeded|Insufficient available balance/i.test(String(e))) {
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      throw e;
    }
  }
}

async function makeWithSound(x) {
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
  const w = x.resolution === '480p' ? 480 : 720;
  const frameImages = [
    ...(x.first ? [{ inputImage: dataUri(x.first), frame: 'first' }] : []),
    ...(x.last ? [{ inputImage: dataUri(x.last), frame: 'last' }] : []),
  ];
    await call([
    {
      taskType: 'videoInference',
      taskUUID,
      model: MODEL,
      // always: false — a shot in its own look (the live-action-like openings) skips the queue's anime style line
      positivePrompt: `${x.prompt} ${x.always === false ? '' : (queue.always ?? '')}`.trim().slice(0, 3000),
      duration: x.duration ?? 5,
      outputFormat: 'MP4',
      deliveryMethod: 'async',
      includeCost: true,
      ...(frameImages.length ? { frameImages } : {}),
      // the shape and size come from the first frame (Seedance 2.5 takes no width / height); character
      // references are not taken this way either — the first / last frames carry the look
      ...(audio ? { providerSettings: { bytedance: { audio: true } } } : {}),
    },
  ]);
  // the motion is made in the background: ask for it until it is there (up to ~12 minutes)
  for (let k = 0; k < 144; k++) {
    await new Promise((r) => setTimeout(r, 5000));
    const d = (await call([{ taskType: 'getResponse', taskUUID }])).find((r) => r.taskUUID === taskUUID);
    if (d?.status === 'error') throw new Error(JSON.stringify(d).slice(0, 300));
    if (d?.videoURL) {
      mkdirSync(OUT, { recursive: true });
      const raw = join(OUT, `_${file(x.id)}.mp4`);
      writeFileSync(raw, Buffer.from(await (await fetch(d.videoURL)).arrayBuffer()));
      squeeze(raw, join(OUT, `${file(x.id)}.mp4`), w !== 720);
      rmSync(raw);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(OUT, `${file(x.id)}.mp4`), '-frames:v', '1', '-q:v', '3', join(OUT, `${file(x.id)}.jpg`)]);
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
// what each cut cost, kept in the queue's ledger (the story chat keeps track of what is left)
const spent = [];
const failed = new Set();
// one at a time by default (each request reserves credit up front; parallel requests ran the balance
// out — 2026-10-22); the queue's "parallel" can raise it
let next = 0;
await Promise.all(
  Array.from({ length: queue.parallel ?? 1 }, async () => {
    while (next < todo.length) {
      // a spending cap for this run (the review queue's budgetYen): nothing new starts past it
      if (queue.budgetYen && usd * 150 >= queue.budgetYen) {
        log.push(`- ⏸ ${file(todo[next++].id)}: この回の上限（約${queue.budgetYen}円）に届いたので次回`);
        continue;
      }
      const x = todo[next++];
      try {
        const cost = await make(x);
        usd += cost;
        spent.push(`| ${new Date().toISOString().slice(0, 16)} | ${x.id} | ${x.duration ?? 5}秒 | 約${Math.round(cost * 150)}円（$${cost.toFixed(3)}） |`);
        log.push(`- ✅ ${file(x.id)}（${x.duration ?? 5}秒・${x.resolution ?? '720p'}・約${Math.round(cost * 150)}円）`);
      } catch (e) {
        failed.add(x.id);
        log.push(`- ❌ m${x.id}: ${String(e).slice(0, 1500)}`);
      }
    }
  }),
);
// a redo that failed (the service busy, a refusal) stays queued for the next push
if ((queue.redo ?? []).length) writeFileSync(QUEUE, JSON.stringify({ ...queue, redo: queue.redo.filter((id) => failed.has(id)) }, null, 2) + '\n');
mkdirSync(dirname(queue.report ?? 'docs/story-import/x'), { recursive: true });
const report = [`# 物語の動画 — ${new Date().toISOString()}`, '', `${MODEL} / ${todo.length}本 / 約${Math.round(usd * 150)}円`, '', ...log, ''].join('\n');
writeFileSync(queue.report ?? 'docs/story-import/video-last-run.md', report);
if (queue.ledger && spent.length) {
  const head = existsSync(queue.ledger) ? readFileSync(queue.ledger, 'utf8') : '# 動画の費用（カットごと）\n\n| 日時 (UTC) | カット | 長さ | 費用 |\n|---|---|---|---|\n';
  writeFileSync(queue.ledger, `${head.trimEnd()}\n${spent.join('\n')}\n`);
}
console.log(report);
