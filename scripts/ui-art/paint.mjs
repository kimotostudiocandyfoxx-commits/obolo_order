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
import { join } from 'node:path';

const KEY = process.env.SEEDREAM_API_KEY;
if (!KEY) throw new Error('SEEDREAM_API_KEY is not set');
const QUEUE = process.argv[2] ?? 'design/ui-art-queue.json';
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
const dataUri = (p) => `data:${mime(p)};base64,${readFileSync(p).toString('base64')}`;
const OUT = join('apps/web/public', queue.dir ?? 'ui-art');
mkdirSync(OUT, { recursive: true });
const redo = new Set(queue.redo ?? []);
const todo = queue.items.filter((x) => redo.has(x.id) || !existsSync(join(OUT, `${x.id}.jpg`)));

const refsOf = (x) => (x.refs ?? queue.refs ?? []).filter(existsSync);

async function paint(x) {
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
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
    signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  // the service sometimes answers 500 with the finished picture in it (2026-10-26): take the picture
  const got = !j.errors?.length && j.data?.[0]?.imageURL;
  if ((!res.ok && !got) || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  const d = j.data?.[0];
  const raw = join(OUT, `_${x.id}.jpg`);
  writeFileSync(raw, Buffer.from(await (await fetch(d.imageURL)).arrayBuffer()));
  const [w, h] = x.size;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', `scale=${w}:${h}:flags=lanczos`, '-q:v', '2', join(OUT, `${x.id}.jpg`)]);
  rmSync(raw);
  return d.cost ?? 0;
}

const log = [];
let yen = 0;
// a few at a time: a burst of tasks is what made Runware time out (504)
const retry = (x, n) => paint(x).catch((e) => (n > 0 && /504|Timeout|timeout/i.test(String(e)) ? new Promise((r) => setTimeout(r, 8000)).then(() => retry(x, n - 1)) : Promise.reject(e)));
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
        try {
          yen += (await retry(x, 2)) * 150;
          log.push(`- ✅ ${x.id}`);
        } catch (e) {
          log.push(`- ❌ ${x.id}: ${String(e).slice(0, 300)}`);
        }
      }
    }),
  );
}
// what waits on a picture that failed stays for the next run
for (const x of left) log.push(`- ⏸ ${x.id}: 元の絵ができなかったので次回`);
// redo is done once: clear it so the next run does not paint the same again
if ((queue.redo ?? []).length) writeFileSync(QUEUE, JSON.stringify({ ...queue, redo: [] }, null, 2) + '\n');
const report = [`# UI art — ${new Date().toISOString()}`, '', `Seedream 5.0 Pro / ${todo.length}枚 / 約${Math.round(yen)}円`, '', ...log.sort(), ''].join('\n');
writeFileSync(join(OUT, 'last-run.md'), report);
console.log(report);
