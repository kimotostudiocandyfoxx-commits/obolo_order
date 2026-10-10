#!/usr/bin/env node
/**
 * Story image workshop (client request 2026-10-10: Seedream 5.0 Pro): the story-design chat writes
 * design/story-queue.json, this script (run by .github/workflows/story-images.yml) paints every new
 * item with ByteDance Seedream 5.0 Pro and saves the pictures in design/story/out/ — the chat pulls
 * them, looks, changes the queue, and so on. See docs/handoff/story-images.md.
 *
 * Provider (SEEDREAM_PROVIDER, key in SEEDREAM_API_KEY):
 *  - "runware" (default): api.runware.ai, model bytedance:seedream@5.0-pro (the same account can
 *    paint the Mars MV scenes with Animagine)
 *  - "ark": BytePlus ModelArk (ByteDance's own), model dola-seedream-5-0-pro-260628
 *
 * Item: { id, prompt, size?, n?, refs?, redo? }
 *  - size  "portrait" (1152x1536, default) | "landscape" (1536x1152) | "square" (1536x1536) | "WxH"
 *  - refs  up to 10 pictures in the repo (e.g. design/story/refs/kimorin.jpg, or an earlier output):
 *          the picture follows them (same character, same style)
 * An item is painted once; change its id (-v2) or set "redo": true to paint it again.
 * At most MAX_IMAGES pictures per run (cost guard).
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SEEDREAM_API_KEY;
const PROVIDER = process.env.SEEDREAM_PROVIDER || 'runware';
const MODEL = process.env.SEEDREAM_MODEL || (PROVIDER === 'ark' ? 'dola-seedream-5-0-pro-260628' : 'bytedance:seedream@5.0-pro');
const QUEUE = process.env.QUEUE ?? 'design/story-queue.json';
const OUT = process.env.OUT ?? 'design/story/out';
const MAX_IMAGES = Number(process.env.MAX_IMAGES ?? 16);
if (!KEY) throw new Error('SEEDREAM_API_KEY is not set');
mkdirSync(OUT, { recursive: true });

// about $0.045 a picture up to ~2.4 MP (+$0.003 a reference after the first) — third-party figures
const YEN_EACH = 7;
const SIZES = { portrait: [1152, 1536], landscape: [1536, 1152], square: [1536, 1536] };

const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const items = (queue.items ?? []).filter((it) => it && it.id && it.prompt);
const done = new Set(readdirSync(OUT).map((f) => f.replace(/-\d+\.(jpg|jpeg|png|webp)$/, '')));
const todo = items.filter((it) => it.redo || !done.has(it.id));

function sizeOf(it) {
  if (SIZES[it.size]) return SIZES[it.size];
  const m = /^(\d{3,4})[x*](\d{3,4})$/.exec(it.size ?? '');
  return m ? [Number(m[1]), Number(m[2])] : SIZES.portrait;
}
const countOf = (it) => Math.min(4, Math.max(1, Number(it.n) || 1));
const dataUri = (p) => `data:${/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg'};base64,${readFileSync(p).toString('base64')}`;
const refsOf = (it) => (it.refs ?? []).slice(0, 10).filter((p) => existsSync(p));

async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function paintRunware(it) {
  const [width, height] = sizeOf(it);
  const refs = refsOf(it);
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        model: MODEL,
        positivePrompt: it.prompt,
        width,
        height,
        numberResults: countOf(it),
        outputType: 'URL',
        outputFormat: 'JPG',
        ...(refs.length ? { referenceImages: refs.map(dataUri) } : {}),
      },
    ]),
    signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  return Promise.all((j.data ?? []).filter((d) => d.imageURL).map((d) => download(d.imageURL)));
}

async function paintArk(it) {
  const [w, h] = sizeOf(it);
  const refs = refsOf(it);
  const out = [];
  // one picture a call (several pictures at once is a different mode on ModelArk)
  for (let k = 0; k < countOf(it); k++) {
    const res = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        prompt: it.prompt,
        size: `${w}x${h}`,
        response_format: 'b64_json',
        watermark: false,
        sequential_image_generation: 'disabled',
        ...(refs.length ? { image: refs.length === 1 ? dataUri(refs[0]) : refs.map(dataUri) } : {}),
      }),
      signal: AbortSignal.timeout(300_000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(`${res.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
    for (const d of j.data ?? []) out.push(d.b64_json ? Buffer.from(d.b64_json, 'base64') : await download(d.url));
  }
  return out;
}

const log = [];
let painted = 0;
let made = 0;
const missingRefs = [];
const work = [...todo];
async function worker() {
  while (work.length) {
    const it = work.shift();
    const n = countOf(it);
    if (painted + n > MAX_IMAGES) {
      log.push(`- ⏭ ${it.id}: 今回の上限（${MAX_IMAGES}枚）を超えるので次回`);
      continue;
    }
    painted += n;
    for (const p of it.refs ?? []) if (!existsSync(p)) missingRefs.push(`${it.id}: ${p}`);
    try {
      const pics = PROVIDER === 'ark' ? await paintArk(it) : await paintRunware(it);
      pics.forEach((b, k) => writeFileSync(join(OUT, `${it.id}-${k + 1}.jpg`), b));
      made += pics.length;
      const [w, h] = sizeOf(it);
      log.push(`- ✅ ${it.id}（${w}x${h}${it.refs?.length ? `, 参考 ${refsOf(it).length}枚` : ''}）: ${pics.length}枚`);
    } catch (e) {
      log.push(`- ❌ ${it.id}: ${String(e).slice(0, 300)}`);
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));

const report = [
  `# Story images — ${new Date().toISOString()}`,
  '',
  `Seedream 5.0 Pro（${PROVIDER}）/ 新しく描いた: ${made}枚 / キューの項目: ${items.length}件 / 費用の目安: 約${made * YEN_EACH}円`,
  '',
  ...log,
  ...(missingRefs.length ? ['', '見つからなかった参考画像（パスを確認）:', ...missingRefs.map((m) => `- ${m}`)] : []),
  '',
].join('\n');
writeFileSync(join(OUT, '_last-run.md'), report);
console.log(report);
if (!existsSync(join(OUT, '.keep'))) writeFileSync(join(OUT, '.keep'), '');
