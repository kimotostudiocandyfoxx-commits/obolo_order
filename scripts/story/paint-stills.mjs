#!/usr/bin/env node
/**
 * The story's still pictures (client decision 2026-10-12: Seedream 5.0 Pro, production quality).
 * Run by .github/workflows/story-stills.yml when design/story-stills-queue.json changes.
 *
 *  - the list of stills comes from the story import (docs/story-import/stills.json: id + the
 *    〔一枚絵：…〕 text); the queue says which to paint: { "paint": ["D01-S002-1", …] } or "all"
 *  - each Japanese description becomes an English picture order (Gemini Flash-Lite), wrapped in the
 *    house style; the onboarding's own stills go along as style references, and a character named in
 *    the text gets its picture as a reference too
 *  - pictures are saved at 720x1280 (nothing above 720p, docs/media.md) to
 *    apps/web/public/story/stills/<id>.jpg, with manifest.json for the preview
 * An id is painted once; "redo": ["id", …] paints it again (e.g. after the text changed).
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SEEDREAM_API_KEY;
const GEMINI = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error('SEEDREAM_API_KEY is not set');
const OUT = 'apps/web/public/story/stills';
const MAX = Number(process.env.MAX_IMAGES ?? 16);
mkdirSync(OUT, { recursive: true });

const stills = JSON.parse(readFileSync('docs/story-import/stills.json', 'utf8'));
const queue = JSON.parse(readFileSync('design/story-stills-queue.json', 'utf8'));
const want = queue.paint === 'all' ? stills.map((s) => s.id) : (queue.paint ?? []);
const redo = new Set(queue.redo ?? []);
const todo = stills.filter((s) => want.includes(s.id) && (redo.has(s.id) || !existsSync(join(OUT, `${s.id}.jpg`)))).slice(0, MAX);

// the house style: the onboarding's own stills (dark, gold light, cinematic, vertical)
const STYLE = ['apps/web/public/onboarding/saturn-temple.jpg', 'apps/web/public/onboarding/m12.jpg'].filter(existsSync);
// who has a picture to copy (the name as the script writes it → file)
const CAST = {
  KIMORIN: 'design/story/refs/kimorin.jpg',
  OBOLON: 'apps/web/public/onboarding/obolon.webp',
  フリージー: 'apps/web/public/onboarding/freezy.webp',
  ヒポキン: 'apps/web/public/onboarding/hipokin.webp',
  ハットG: 'apps/web/public/onboarding/hatg.webp',
  ボスG: 'apps/web/public/onboarding/bossg.webp',
  ロングG: 'apps/web/public/onboarding/longg.webp',
  たこ焼きブラザー: 'apps/web/public/onboarding/takoyaki-brother.webp',
  たこ焼きシスター: 'apps/web/public/onboarding/takoyaki-sister.webp',
};
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
const dataUri = (p) => `data:${mime(p)};base64,${readFileSync(p).toString('base64')}`;

/** The Japanese description → an English order for the picture (keeps names; drops sounds and text). */
async function english(desc) {
  const text = desc.replace(/\{neo\}/g, 'the traveller').replace(/\{bati\}/g, 'the small companion').replace(/\{[a-z]+\}/g, '');
  if (!GEMINI) return text;
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Rewrite this Japanese scene description from a story as one English paragraph that orders a single painted picture: only what can be seen (place, light, objects, who is where, composition). Keep character names as written (KIMORIN, フリージー… keep them in their original spelling). Leave out sounds, feelings and story explanation. Any sign, paper or banner is blank (no letters). Output the paragraph only.\n\n${text}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await res.json().catch(() => ({}));
  return j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
}

async function paint(s) {
  const scene = await english(s.desc);
  const who = Object.keys(CAST).filter((n) => s.desc.includes(n) && existsSync(CAST[n]));
  const refs = [...who.map((n) => CAST[n]), ...STYLE].slice(0, 6);
  const prompt = [
    'A vertical key-art still for a Japanese anime adventure, the finest cinematic anime film quality: painterly, deep space-fantasy mood, warm gold light against dark blues, rich detail, strong composition with a clear focal point.',
    `Scene: ${scene}`,
    who.length ? `${who.join(', ')} appear exactly as in their reference pictures (same design and colours), each shown once.` : '',
    `Match the art style, colour and light of the last ${STYLE.length} reference pictures (style only, not their content).`,
    'No text, no letters, no captions, no watermark anywhere in the picture.',
  ]
    .filter(Boolean)
    .join(' ');
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        model: 'bytedance:seedream@5.0-pro',
        positivePrompt: prompt.slice(0, 3000),
        width: 1152,
        height: 2048,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        referenceImages: refs.map(dataUri),
      },
    ]),
    signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  const d = j.data?.[0];
  const raw = join(OUT, `_${s.id}.jpg`);
  writeFileSync(raw, Buffer.from(await (await fetch(d.imageURL)).arrayBuffer()));
  // 720x1280: the screen's own size
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=720:1280:flags=lanczos', '-q:v', '3', join(OUT, `${s.id}.jpg`)]);
  execFileSync('rm', ['-f', raw]);
  return { cost: d.cost ?? 0, prompt, who };
}

const log = [];
let yen = 0;
for (const s of todo) {
  try {
    const r = await paint(s);
    yen += r.cost * 150;
    log.push(`- ✅ ${s.id}${r.who.length ? `（${r.who.join('・')}）` : ''}: ${s.desc.slice(0, 60)}…\n  - order: ${r.prompt.replace(/^.*?Scene: /, '').slice(0, 400)}`);
  } catch (e) {
    log.push(`- ❌ ${s.id}: ${String(e).slice(0, 300)}`);
  }
}
const done = readdirSync(OUT).filter((f) => /\.jpg$/.test(f) && !f.startsWith('_')).map((f) => f.replace(/\.jpg$/, ''));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(done.sort()));
const report = [`# Story stills — ${new Date().toISOString()}`, '', `Seedream 5.0 Pro / 今回 ${todo.length}枚 / 約${Math.round(yen)}円 / 描き済み ${done.length}枚（全${stills.length}枚）`, '', ...log, ''].join('\n');
writeFileSync('docs/story-import/stills-last-run.md', report);
console.log(report);
