#!/usr/bin/env node
/**
 * Look / Bati lab (client 2026-10-25): the same prompts painted by several engines, side by side, to pick
 * the engine and the prompt before the app changes. design/look-lab-queue.json → design/look-lab/<id>.jpg.
 * Item: { id, engine: 'seedream' | 'gemini' | 'gemini-pro', prompt, refs?: [paths], w?, h? }. Painted once
 * ("redo": [ids] repaints). An item whose ref is painted in the same run waits for it (passes).
 * Run by .github/workflows/look-lab.yml.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const QUEUE = 'design/look-lab-queue.json';
const OUT = 'design/look-lab';
mkdirSync(OUT, { recursive: true });
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const redo = new Set(queue.redo ?? []);
const todo = queue.items.filter((x) => redo.has(x.id) || !existsSync(join(OUT, `${x.id}.jpg`)));
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
const GEMINI = { gemini: 'gemini-2.5-flash-image', 'gemini-pro': 'gemini-3-pro-image-preview' };

async function seedream(x) {
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RUNWARE_API_KEY}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        model: 'bytedance:seedream@5.0-pro',
        positivePrompt: x.prompt.slice(0, 3000),
        width: x.w ?? 1536,
        height: x.h ?? 1536,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        ...(x.refs?.length ? { referenceImages: x.refs.map((p) => `data:${mime(p)};base64,${readFileSync(p).toString('base64')}`) } : {}),
      },
    ]),
    signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  return { data: Buffer.from(await (await fetch(j.data[0].imageURL)).arrayBuffer()), yen: (j.data[0].cost ?? 0) * 150 };
}

async function gemini(x) {
  const model = GEMINI[x.engine];
  const parts = [...(x.refs ?? []).map((p) => ({ inlineData: { mimeType: mime(p), data: readFileSync(p).toString('base64') } })), { text: x.prompt }];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'] } }),
    signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  const d = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!d) throw new Error(`no image: ${JSON.stringify(j).slice(0, 300)}`);
  return { data: Buffer.from(d.inlineData.data, 'base64'), yen: x.engine === 'gemini' ? 6 : 20 };
}

const log = [];
let yen = 0;
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
          const r = await (x.engine === 'seedream' ? seedream(x) : gemini(x));
          writeFileSync(join(OUT, `${x.id}.jpg`), r.data);
          yen += r.yen;
          log.push(`- ✅ ${x.id}`);
        } catch (e) {
          log.push(`- ❌ ${x.id}: ${String(e).slice(0, 300)}`);
        }
      }
    }),
  );
}
for (const x of left) log.push(`- ⏸ ${x.id}: 元の絵ができなかったので次回`);
if (redo.size) writeFileSync(QUEUE, JSON.stringify({ ...queue, redo: [] }, null, 2) + '\n');
const report = [`# Look lab — ${new Date().toISOString()}`, '', `${todo.length}枚 / 約${Math.round(yen)}円`, '', ...log.sort(), ''].join('\n');
writeFileSync(join(OUT, 'last-run.md'), report);
console.log(report);
