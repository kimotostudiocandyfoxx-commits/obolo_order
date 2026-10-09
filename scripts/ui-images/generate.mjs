#!/usr/bin/env node
/**
 * UI image workshop (client request 2026-10-09): the design chat writes design/ui-queue.json, this
 * script (run by .github/workflows/ui-images.yml) paints every new item with Novita AI and saves
 * the pictures in design/ui/out/ — the chat pulls them, looks, changes the queue, and so on.
 *
 * Models:
 *  - "qwen"      Qwen-Image (strong at text and layouts: app screens, buttons, Japanese words). ~$0.02 / image
 *  - "animagine" anime characters / scenes (the MV style). Novita retired its checkpoint routes
 *                (txt2img 404 since 2026-10), so for now these are painted by Qwen-Image too, with an
 *                anime-still style added to the prompt.
 * An item is painted once; change its id (e.g. -v2) or set "redo": true to paint it again.
 * At most MAX_IMAGES pictures per run (cost guard).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.NOVITA_API_KEY;
const QUEUE = process.env.QUEUE ?? 'design/ui-queue.json';
const OUT = process.env.OUT ?? 'design/ui/out';
const MAX_IMAGES = Number(process.env.MAX_IMAGES ?? 24);
if (!KEY) throw new Error('NOVITA_API_KEY is not set');
mkdirSync(OUT, { recursive: true });

const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const items = (queue.items ?? []).filter((it) => it && it.id && it.prompt);
const done = new Set(readdirSync(OUT).map((f) => f.replace(/-\d+\.(jpg|jpeg|png|webp)$/, '')));
const todo = items.filter((it) => it.redo || !done.has(it.id));
const headers = { 'content-type': 'application/json', authorization: `Bearer ${KEY}` };

function sizeOf(it) {
  // "W*H" (each 256–1536 for qwen), default: a phone screen
  const m = /^(\d+)\*(\d+)$/.exec(it.size ?? '');
  const [w, h] = m ? [Number(m[1]), Number(m[2])] : it.model === 'animagine' ? [832, 1216] : [864, 1536];
  return { w: Math.min(1536, Math.max(256, w)), h: Math.min(1536, Math.max(256, h)) };
}

async function submit(it) {
  const { w, h } = sizeOf(it);
  const res = await fetch('https://api.novita.ai/v3/async/qwen-image-txt2img', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt:
        it.model === 'animagine'
          ? `Anime illustration, a still from a Japanese TV anime: cel shading, clean line art, vibrant colours. ${it.prompt}. No text, no watermark.${it.negative ? ` Avoid: ${it.negative}.` : ''}`
          : it.prompt,
      size: `${w}*${h}`,
    }),
  });
  if (!res.ok) throw new Error(`submit ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).task_id;
}

async function result(taskId) {
  const until = Date.now() + 5 * 60_000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 2500));
    const r = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${encodeURIComponent(taskId)}`, { headers });
    if (!r.ok) continue;
    const j = await r.json();
    const status = j.task?.status ?? '';
    if (status === 'TASK_STATUS_FAILED') throw new Error(`failed: ${j.task?.reason ?? ''}`);
    if (status === 'TASK_STATUS_SUCCEED') return (j.images ?? []).filter((im) => !(im.nsfw_detection_result && im.nsfw_detection_result.valid === false)).map((im) => im.image_url);
  }
  throw new Error('timed out');
}

const log = [];
let painted = 0;
let skipped = 0;
// a few at a time
const work = [...todo];
async function worker() {
  while (work.length) {
    const it = work.shift();
    const n = 1;
    if (painted + n > MAX_IMAGES) {
      skipped++;
      log.push(`- ⏭ ${it.id}: 今回の上限（${MAX_IMAGES}枚）を超えるので次回`);
      continue;
    }
    painted += n;
    try {
      const urls = await result(await submit(it));
      let k = 0;
      for (const url of urls) {
        const img = await fetch(url);
        if (!img.ok) continue;
        const file = join(OUT, `${it.id}-${++k}.jpg`);
        writeFileSync(file, Buffer.from(await img.arrayBuffer()));
      }
      log.push(`- ✅ ${it.id}（${it.model ?? 'qwen'}）: ${k}枚`);
    } catch (e) {
      log.push(`- ❌ ${it.id}: ${String(e).slice(0, 200)}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const report = [`# UI images — ${new Date().toISOString()}`, '', `新しく描いた: ${painted}枚 / 次回に回した: ${skipped}件 / キューの項目: ${items.length}件`, '', ...log, ''].join('\n');
writeFileSync(join(OUT, '_last-run.md'), report);
console.log(report);
if (!existsSync(join(OUT, '.keep'))) writeFileSync(join(OUT, '.keep'), '');
