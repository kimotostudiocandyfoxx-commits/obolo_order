#!/usr/bin/env node
/**
 * UI art (client request 2026-10-12: "イケてる UI", Seedream 5.0 Pro): the pictures a screen is built
 * from — the Venus DJ's jog wheel, knob caps, metal, backdrop… Run by .github/workflows/ui-art.yml when
 * design/ui-art-queue.json changes.
 *
 * Each queue item: { id, prompt, w, h, size: [w, h] } — painted at w×h, saved at `size` (nothing above
 * 720p, docs/media.md) as apps/web/public/<dir>/<id>.jpg. An id is painted once; "redo": [ids] repaints.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SEEDREAM_API_KEY;
if (!KEY) throw new Error('SEEDREAM_API_KEY is not set');
const queue = JSON.parse(readFileSync('design/ui-art-queue.json', 'utf8'));
const OUT = join('apps/web/public', queue.dir ?? 'ui-art');
mkdirSync(OUT, { recursive: true });
const redo = new Set(queue.redo ?? []);
const todo = queue.items.filter((x) => redo.has(x.id) || !existsSync(join(OUT, `${x.id}.jpg`)));

async function paint(x) {
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        model: 'bytedance:seedream@5.0-pro',
        positivePrompt: `${x.prompt} ${queue.always ?? ''}`.slice(0, 3000),
        width: x.w,
        height: x.h,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
      },
    ]),
    signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
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
await Promise.all(
  todo.map(async (x) => {
    try {
      // Runware sometimes times out a Seedream task (504): one more try
      yen += (await paint(x).catch((e) => (/504|Timeout/i.test(String(e)) ? paint(x) : Promise.reject(e)))) * 150;
      log.push(`- ✅ ${x.id}`);
    } catch (e) {
      log.push(`- ❌ ${x.id}: ${String(e).slice(0, 300)}`);
    }
  }),
);
const report = [`# UI art — ${new Date().toISOString()}`, '', `Seedream 5.0 Pro / ${todo.length}枚 / 約${Math.round(yen)}円`, '', ...log.sort(), ''].join('\n');
writeFileSync(join(OUT, 'last-run.md'), report);
console.log(report);
