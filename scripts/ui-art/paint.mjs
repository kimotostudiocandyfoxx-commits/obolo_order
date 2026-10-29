#!/usr/bin/env node
/**
 * UI art (client request 2026-10-12: "イケてる UI", Seedream 5.0 Pro): the pictures a screen is built
 * from — the Venus DJ's jog wheel, knob caps, metal, backdrop… Run by .github/workflows/ui-art.yml when
 * design/ui-art-queue.json changes.
 *
 * Each queue item: { id, prompt, w, h, size: [w, h], refs?: [paths], always?: false } — painted at w×h, saved at `size`
 * (nothing above 720p, docs/media.md) as apps/web/public/<dir>/<id>.jpg. An id is painted once; "redo": [ids]
 * repaints. `refs` (or the queue's own `refs`) are style / character reference images.
 *
 *   node scripts/ui-art/paint.mjs [queue file]   (default design/ui-art-queue.json; the story uses
 *   design/story-art-queue.json)
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const KEY = process.env.SEEDREAM_API_KEY;
if (!KEY) throw new Error('SEEDREAM_API_KEY is not set');
const QUEUE = process.argv[2] ?? 'design/ui-art-queue.json';
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
const dataUri = (p) => `data:${mime(p)};base64,${readFileSync(p).toString('base64')}`;
const OUT = join('apps/web/public', queue.dir ?? 'ui-art');
mkdirSync(OUT, { recursive: true });
const redo = new Set(queue.redo ?? []);
// at most MAX_PICTURES a run (default 20): a big batch while Runware's balance is low gets refused for the reserved
// credit (concurrentRequestLimitExceeded, 2026-10-28); the rest stays for the next run
const todo = queue.items.filter((x) => redo.has(x.id) || !existsSync(join(OUT, `${x.id}.jpg`))).slice(0, Number(process.env.MAX_PICTURES ?? 40));

const refsOf = (x) => (x.refs ?? queue.refs ?? []).filter(existsSync);

// a picture still being made: ask for it by its task until it is there (the answer came with no picture and
// "processing" — 2026-10-29: about half a run failed as "Failed to parse URL from undefined")
async function waitFor(taskUUID) {
  for (let k = 0; k < 36; k++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify([{ taskType: 'getResponse', taskUUID }]),
      signal: AbortSignal.timeout(60_000),
    });
    const j = await res.json().catch(() => ({}));
    if (j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors).slice(0, 300)}`);
    const d = (j.data ?? []).find((r) => r.taskUUID === taskUUID);
    if (d?.status === 'error') throw new Error(JSON.stringify(d).slice(0, 300));
    if (d?.imageURL) return d;
  }
  throw new Error('the picture did not come back in time (Timeout)');
}

async function paint(x) {
  const taskUUID = randomUUID();
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID,
        model: 'bytedance:seedream@5.0-pro',
        // always: false — a picture that edits its first ref (the place kept exactly) skips the queue's style line
        positivePrompt: `${x.prompt} ${x.always === false ? '' : (queue.always ?? '')}`.slice(0, 3000),
        width: x.w,
        height: x.h,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        ...(refsOf(x).length ? { referenceImages: refsOf(x).map(dataUri) } : {}),
      },
    ]),
    signal: AbortSignal.timeout(180_000),
  });
  const j = await res.json().catch(() => ({}));
  // the service sometimes answers 500 with the finished picture in it (2026-10-26): take the picture
  const got = !j.errors?.length && j.data?.[0]?.imageURL;
  if ((!res.ok && !got) || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  const d = j.data?.[0]?.imageURL ? j.data[0] : await waitFor(taskUUID);
  // an id may hold a folder (art/review: V01/K01-a)
  mkdirSync(dirname(join(OUT, x.id)), { recursive: true });
  const raw = join(OUT, `${x.id}.raw.jpg`);
  writeFileSync(raw, Buffer.from(await (await fetch(d.imageURL, { signal: AbortSignal.timeout(60_000) })).arrayBuffer()));
  const [w, h] = x.size;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', `scale=${w}:${h}:flags=lanczos`, '-q:v', '2', join(OUT, `${x.id}.jpg`)]);
  rmSync(raw);
  return d.cost ?? 0;
}

const log = [];
let yen = 0;
// the job is stopped at 30 minutes and then saves nothing it had not finished: stop starting new pictures at
// 22 minutes; what is left (and what failed) stays in redo for the next run (2026-10-27: a stuck task ate a run)
const START = Date.now();
const late = () => Date.now() - START > 22 * 60_000;
const failed = new Set();
// a few at a time: a burst of tasks is what made Runware time out (504)
const retry = (x, n) => paint(x).catch((e) => (n > 0 && !late() && /504|Timeout|timeout|abort|concurrentRequestLimitExceeded/i.test(String(e)) ? new Promise((r) => setTimeout(r, 8000)).then(() => retry(x, n - 1)) : Promise.reject(e)));
// in passes: a picture that edits one painted in this run (its ref still missing) waits for the next pass
const waits = (x) => (x.refs ?? []).some((r) => !existsSync(r) && todo.some((y) => y !== x && join(OUT, `${y.id}.jpg`) === r));
let left = todo;
while (left.length) {
  const batch = left.filter((x) => !waits(x));
  if (!batch.length) break;
  left = left.filter((x) => !batch.includes(x));
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < batch.length) {
        const x = batch[next++];
        if (late()) {
          failed.add(x.id);
          log.push(`- ⏸ ${x.id}: 時間切れ、次回`);
          continue;
        }
        try {
          yen += (await retry(x, 1)) * 150;
          log.push(`- ✅ ${x.id}`);
        } catch (e) {
          failed.add(x.id);
          log.push(`- ❌ ${x.id}: ${String(e).slice(0, 300)}`);
        }
      }
    }),
  );
}
// what waits on a picture that failed stays for the next run
for (const x of left) {
  failed.add(x.id);
  log.push(`- ⏸ ${x.id}: 元の絵ができなかったので次回`);
}
// redo is done once: keep only what was not painted (failed, waiting, out of time)
if ((queue.redo ?? []).length) writeFileSync(QUEUE, JSON.stringify({ ...queue, redo: (queue.redo ?? []).filter((id) => failed.has(id)) }, null, 2) + '\n');
const report = [`# UI art — ${new Date().toISOString()}`, '', `Seedream 5.0 Pro / ${todo.length}枚 / 約${Math.round(yen)}円`, '', ...log.sort(), ''].join('\n');
writeFileSync(join(OUT, 'last-run.md'), report);
console.log(report);
