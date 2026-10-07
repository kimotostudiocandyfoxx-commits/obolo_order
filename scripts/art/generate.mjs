// Art workshop (client request 2026-10-07): Claude Code designs the UI art, Gemini paints it.
// Reads art/queue.json — a list of jobs — and writes the results to art/out/<id>/.
//   image job: { id, kind: 'image', prompt, refs?: [repo paths], aspect?: '16:9'|'1:1'|'9:16'|'4:3'|'3:4', count?: n, model? }
//   video job: { id, kind: 'video', prompt, image?: repo path (first frame), loop?: true (the last frame is the
//              same picture, so the clip loops seamlessly and the camera stays put), aspect?: '16:9'|'9:16', model? }
// Jobs whose output folder already exists are skipped (delete the folder or change the id to redo).
// Needs GEMINI_API_KEY. No dependencies (Node 20+ fetch).
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { extname, join } from 'node:path';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error('GEMINI_API_KEY is not set');
const API = 'https://generativelanguage.googleapis.com/v1beta';
const IMAGE_MODELS = (process.env.ART_IMAGE_MODELS || 'gemini-3-pro-image-preview,gemini-2.5-flash-image').split(',');
const VIDEO_MODELS = (process.env.ART_VIDEO_MODELS || 'veo-3.1-generate-preview,veo-3.0-generate-001').split(',');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const note = (s) => {
  console.log(s);
  log.push(s);
};

async function inline(path) {
  return { inlineData: { mimeType: MIME[extname(path).toLowerCase()] || 'image/png', data: (await readFile(path)).toString('base64') } };
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${text.slice(0, 400)}`), { status: res.status });
  return JSON.parse(text);
}

async function image(job, dir) {
  const parts = [{ text: job.prompt }];
  for (const r of job.refs ?? []) parts.push(await inline(r));
  const models = job.model ? [job.model] : IMAGE_MODELS;
  for (let n = 0; n < (job.count ?? 2); n++) {
    let done = false;
    for (const model of models) {
      try {
        const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], ...(job.aspect ? { imageConfig: { aspectRatio: job.aspect } } : {}) } };
        const out = await post(`${API}/models/${model}:generateContent`, body);
        const img = out.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!img) throw new Error(`no image: ${JSON.stringify(out).slice(0, 300)}`);
        const ext = img.inlineData.mimeType?.includes('jpeg') ? 'jpg' : 'png';
        await writeFile(join(dir, `${n + 1}.${ext}`), Buffer.from(img.inlineData.data, 'base64'));
        note(`✓ ${job.id} #${n + 1} (${model})`);
        done = true;
        break;
      } catch (e) {
        note(`✗ ${job.id} #${n + 1} ${model}: ${e.message}`);
      }
    }
    if (!done) break;
  }
}

async function video(job, dir) {
  const models = job.model ? [job.model] : VIDEO_MODELS;
  for (const model of models) {
    try {
      const instance = { prompt: job.prompt };
      if (job.image) {
        const d = await inline(job.image);
        instance.image = { bytesBase64Encoded: d.inlineData.data, mimeType: d.inlineData.mimeType };
        if (job.loop) instance.lastFrame = instance.image;
      }
      const op = await post(`${API}/models/${model}:predictLongRunning`, { instances: [instance], parameters: { aspectRatio: job.aspect || '16:9' } });
      let cur = op;
      for (let i = 0; i < 90 && !cur.done; i++) {
        await sleep(10_000);
        const res = await fetch(`${API}/${op.name}`, { headers: { 'x-goog-api-key': KEY } });
        cur = await res.json();
      }
      if (!cur.done) throw new Error('timed out');
      if (cur.error) throw new Error(JSON.stringify(cur.error).slice(0, 300));
      const uri = cur.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error(`no video: ${JSON.stringify(cur).slice(0, 300)}`);
      const res = await fetch(uri, { headers: { 'x-goog-api-key': KEY }, redirect: 'follow' });
      if (!res.ok) throw new Error(`download ${res.status}`);
      await writeFile(join(dir, '1.mp4'), Buffer.from(await res.arrayBuffer()));
      note(`✓ ${job.id} video (${model})`);
      return;
    } catch (e) {
      note(`✗ ${job.id} video ${model}: ${e.message}`);
    }
  }
}

const queue = JSON.parse(await readFile('art/queue.json', 'utf8'));
for (const job of queue) {
  const dir = join('art/out', job.id);
  if (await exists(dir)) {
    note(`- ${job.id} (already made)`);
    continue;
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'job.json'), JSON.stringify(job, null, 2));
  if (job.kind === 'video') await video(job, dir);
  else await image(job, dir);
}
await writeFile('art/out/last-run.log', log.join('\n') + '\n');
