#!/usr/bin/env node
/**
 * Story image workshop (client request 2026-10-10): the story-design chat writes
 * design/story-queue.json, this script (run by .github/workflows/story-images.yml) paints every new
 * item with OpenAI GPT Image 2 and saves the pictures in design/story/out/ — the chat pulls them,
 * looks, changes the queue, and so on. See docs/handoff/story-images.md.
 *
 * Item: { id, prompt, size?, quality?, n?, refs?, redo? }
 *  - size     "portrait" (1024x1536, default) | "landscape" (1536x1024) | "square" (1024x1024) | "WxH"
 *  - quality  "low" | "medium" (default) | "high"
 *  - refs     up to 8 pictures in the repo (e.g. art/lab/mv/hero.jpg, or an earlier design/story/out/…)
 *             the picture follows them (same character, same style) — the edits endpoint
 * An item is painted once; change its id (-v2) or set "redo": true to paint it again.
 * At most MAX_IMAGES pictures per run (cost guard).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
const QUEUE = process.env.QUEUE ?? 'design/story-queue.json';
const OUT = process.env.OUT ?? 'design/story/out';
const MAX_IMAGES = Number(process.env.MAX_IMAGES ?? 16);
if (!KEY) throw new Error('OPENAI_API_KEY is not set');
mkdirSync(OUT, { recursive: true });

// rough yen per 1024-ish picture (third-party figures for gpt-image-2; check the OpenAI bill)
const YEN = { low: 1.5, medium: 9, high: 35 };
const SIZES = { portrait: '1024x1536', landscape: '1536x1024', square: '1024x1024' };

const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const items = (queue.items ?? []).filter((it) => it && it.id && it.prompt);
const done = new Set(readdirSync(OUT).map((f) => f.replace(/-\d+\.(jpg|jpeg|png|webp)$/, '')));
const todo = items.filter((it) => it.redo || !done.has(it.id));

const sizeOf = (it) => SIZES[it.size] ?? (/^\d{3,4}x\d{3,4}$/.test(it.size ?? '') ? it.size : SIZES.portrait);
const qualityOf = (it) => (['low', 'medium', 'high'].includes(it.quality) ? it.quality : 'medium');
const countOf = (it) => Math.min(4, Math.max(1, Number(it.n) || 1));

async function paint(it) {
  const common = { model: MODEL, prompt: it.prompt, size: sizeOf(it), quality: qualityOf(it), n: countOf(it), output_format: 'jpeg', output_compression: 88 };
  const refs = (it.refs ?? []).slice(0, 8).filter((p) => existsSync(p));
  let res;
  if (refs.length) {
    // with reference pictures: the edits endpoint (multipart)
    const form = new FormData();
    for (const [k, v] of Object.entries(common)) form.append(k, String(v));
    for (const p of refs) form.append('image[]', new Blob([readFileSync(p)], { type: /\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg' }), basename(p));
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form, signal: AbortSignal.timeout(300_000) });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify(common),
      signal: AbortSignal.timeout(300_000),
    });
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return (j.data ?? []).map((d) => d.b64_json).filter(Boolean);
}

const log = [];
let painted = 0;
let yen = 0;
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
      const pics = await paint(it);
      pics.forEach((b64, k) => writeFileSync(join(OUT, `${it.id}-${k + 1}.jpg`), Buffer.from(b64, 'base64')));
      yen += pics.length * YEN[qualityOf(it)];
      log.push(`- ✅ ${it.id}（${qualityOf(it)}, ${sizeOf(it)}${it.refs?.length ? `, 参考 ${it.refs.length}枚` : ''}）: ${pics.length}枚`);
    } catch (e) {
      log.push(`- ❌ ${it.id}: ${String(e).slice(0, 300)}`);
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));

const report = [
  `# Story images — ${new Date().toISOString()}`,
  '',
  `新しく描いた: ${painted}枚 / キューの項目: ${items.length}件 / 費用の目安: 約${Math.round(yen)}円`,
  '',
  ...log,
  ...(missingRefs.length ? ['', '見つからなかった参考画像（パスを確認）:', ...missingRefs.map((m) => `- ${m}`)] : []),
  '',
].join('\n');
writeFileSync(join(OUT, '_last-run.md'), report);
console.log(report);
if (!existsSync(join(OUT, '.keep'))) writeFileSync(join(OUT, '.keep'), '');
