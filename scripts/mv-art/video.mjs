#!/usr/bin/env node
/**
 * MV moving paintings (2026-11-12): each queue item { id, image, prompt, duration?, model? } turns the painting
 * `image` (a repo path) into a short clip that starts on that exact frame (Runware videoInference, image-to-video),
 * saved as <queue.out>/<id>.mp4 (H.264, no sound). An id is made once; "redo": [ids] makes it again.
 *   node scripts/mv-art/video.mjs design/mv-video-queue.json
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SEEDREAM_API_KEY;
if (!KEY) throw new Error('SEEDREAM_API_KEY is not set');
const QUEUE = process.argv[2] ?? 'design/mv-video-queue.json';
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const OUT = queue.out ?? 'design/mv-art/video';
mkdirSync(OUT, { recursive: true });
const redo = new Set(queue.redo ?? []);
const todo = (queue.items ?? []).filter((x) => redo.has(x.id) || !existsSync(join(OUT, `${x.id}.mp4`)));

const api = async (body) => {
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const j = await res.json().catch(() => ({}));
  if (j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors).slice(0, 500)}`);
  return j;
};

// a 960px square jpeg of the painting (the clip takes its shape from the frame)
const frame = (p) => {
  const tmp = `/tmp/frame-${randomUUID()}.jpg`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', p, '-vf', 'scale=960:960:flags=lanczos', '-q:v', '2', tmp]);
  const b = readFileSync(tmp);
  unlinkSync(tmp);
  return `data:image/jpeg;base64,${b.toString('base64')}`;
};

async function make(x) {
  const taskUUID = randomUUID();
  const frames = [{ image: frame(x.image), frame: 'first' }];
  if (x.last) frames.push({ image: frame(x.last), frame: 'last' });
  await api([
    {
      taskType: 'videoInference',
      taskUUID,
      model: x.model ?? queue.model ?? 'bytedance:seedance@2.0-fast',
      positivePrompt: `${x.prompt} ${queue.always ?? ''}`.trim(),
      duration: x.duration ?? 5,
      resolution: '720p',
      deliveryMethod: 'async',
      outputFormat: 'MP4',
      includeCost: true,
      inputs: { frameImages: frames },
    },
  ]);
  // a clip takes minutes: ask for it by its task (up to ~20 minutes)
  for (let k = 0; k < 160; k++) {
    await new Promise((r) => setTimeout(r, 7500));
    let j;
    try {
      j = await api([{ taskType: 'getResponse', taskUUID }]);
    } catch (e) {
      if (/timeout|50[234]|abort/i.test(String(e))) continue;
      throw e;
    }
    const d = (j.data ?? []).find((r) => r.taskUUID === taskUUID);
    if (d?.status === 'error') throw new Error(JSON.stringify(d).slice(0, 500));
    if (d?.videoURL) {
      const raw = join(OUT, `${x.id}.raw.mp4`);
      const buf = Buffer.from(await (await fetch(d.videoURL, { signal: AbortSignal.timeout(180_000) })).arrayBuffer());
      writeFileSync(raw, buf);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-an', '-c:v', 'libx264', '-crf', '19', '-preset', 'slow',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(OUT, `${x.id}.mp4`)]);
      unlinkSync(raw);
      return d.cost ?? 0;
    }
  }
  throw new Error('the clip did not come back in time');
}

const log = [];
const failed = new Set();
let usd = 0;
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < todo.length) {
      const x = todo[next++];
      try {
        usd += await make(x);
        log.push(`- ✅ ${x.id}`);
      } catch (e) {
        failed.add(x.id);
        log.push(`- ❌ ${x.id}: ${String(e).slice(0, 500)}`);
      }
    }
  }),
);
if ((queue.redo ?? []).length) writeFileSync(QUEUE, JSON.stringify({ ...queue, redo: queue.redo.filter((id) => failed.has(id)) }, null, 1) + '\n');
const report = [`# MV video — ${new Date().toISOString()}`, '', `${todo.length} clips / about $${usd.toFixed(2)}`, '', ...log.sort(), ''].join('\n');
writeFileSync(join(OUT, 'last-run.md'), report);
console.log(report);
