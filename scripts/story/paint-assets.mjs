#!/usr/bin/env node
/**
 * Story people and places that have no picture yet (client plan 2026-10-13): candidates painted with
 * Seedream 5.0 Pro from the story chat's sheets, for the client to pick (then promote-assets.py puts the
 * pick in place). Run by .github/workflows/story-assets.yml when design/story-assets-queue.json changes.
 *
 *  queue: { "n": 3, "paint": ["エビ", "mercury-beach", { "name": "カニ", "desc": "仮の説明" }], "redo": ["エビ"] }
 *  - a name is looked up in public/story/assets.json (people first, then places) for its id and sheet
 *  - people: full body on a plain grey ground (cut out later), in the house style of the existing cast
 *  - places: vertical 9:16 backgrounds without people, in the house style of the story's pictures
 *  - saved at 720×1280 (nothing above 720p, docs/media.md) to public/story/candidates/{cast,places}/<id>/<k>.jpg
 * A name with candidates already is skipped unless it is in "redo".
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SEEDREAM_API_KEY;
if (!KEY) throw new Error('SEEDREAM_API_KEY is not set');
const PUB = 'apps/web/public';
const queue = JSON.parse(readFileSync('design/story-assets-queue.json', 'utf8'));
const assets = JSON.parse(readFileSync(join(PUB, 'story/assets.json'), 'utf8'));
const N = Math.min(4, queue.n ?? 3);
const redo = new Set(queue.redo ?? []);

// the house style: the existing cast (people) and the story's own pictures (places)
const CAST_STYLE = ['kimorin-1.webp', 'freezy.webp', 'hipokin.webp', 'hatg.webp', 'takoyaki-sister.webp'].map((f) => join(PUB, 'onboarding', f)).filter(existsSync);
const PLACE_STYLE = ['saturn-temple.jpg', 'mercury-island.jpg', 'm12.jpg'].map((f) => join(PUB, 'onboarding', f)).filter(existsSync);
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
const dataUri = (p) => `data:${mime(p)};base64,${readFileSync(p).toString('base64')}`;
const NO_TEXT = 'No text, no letters, no numbers, no signs with writing, no watermark anywhere.';

function order(item) {
  const name = typeof item === 'string' ? item : item.name;
  const person = assets.cast.find((c) => c.name === name || c.aliases?.includes(name));
  const place = person ? null : assets.places.find((p) => p.name === name);
  if (!person && !place) return { name, error: 'assets.json にない名前（台本・人物表・場所表のどれにも出てこない）' };
  const sheet = (person ?? place).sheet ?? {};
  const desc = (typeof item === 'object' && item.desc) || sheet.look;
  // style references for this one (e.g. the client's sheets of the same family), else the house style
  const own = typeof item === 'object' && Array.isArray(item.refs) ? item.refs.filter(existsSync) : [];
  if (!desc) return { name, error: '見た目の説明がない（人物表・場所表の「見た目」か、queue の desc で渡す）' };
  if (person)
    return {
      name,
      kind: 'cast',
      id: person.id,
      refs: own.length ? own : CAST_STYLE,
      prompt: [
        // the house style is the existing cast: detailed, painterly dark fantasy — not cute 3D, not flat anime
        own.length
          ? `A character of the same family as the ${own.length} reference characters, drawn in exactly their illustration style (the same line work, shading, face and proportions). Not a 3D render.`
          : `A character for the same world as the ${CAST_STYLE.length} reference characters, drawn in exactly their illustration style: highly detailed hand-painted rendering, rich tactile materials (fur, cloth, carved wood, metal, embroidery), intricate ornamental patterns, a slightly eerie yet charming dark-fantasy mood, muted deep colours with a few glowing accents. Not a 3D render, not chibi, not flat cartoon.`,
        `The character: ${desc}.`,
        sheet.personality ? `Personality to show in the pose and the face: ${sheet.personality}.` : '',
        'Full body, standing, facing the viewer slightly turned, centered; the figure fills about 85% of the picture height, with a little clear space all around it.',
        'Plain flat light grey background (#c8c8c8), soft even light, no ground shadow, no other characters, no props unless described.',
        'Copy the references for style only — do not copy their designs.',
        NO_TEXT,
      ]
        .filter(Boolean)
        .join(' '),
    };
  return {
    name,
    kind: 'places',
    id: place.id,
    refs: PLACE_STYLE,
    prompt: [
      'A vertical 9:16 background painting for a Japanese anime adventure, cinematic, the finest anime film quality, rich detail.',
      `The place: ${desc}.`,
      sheet.light ? `Time and light: ${sheet.light}.` : '',
      'No people and no characters. Keep the lower third of the picture calm and simple (a dialogue box sits there).',
      `Match the art style, colour and light of the ${PLACE_STYLE.length} reference pictures (style only — not their content).`,
      NO_TEXT,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

async function paint(o, k) {
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        model: 'bytedance:seedream@5.0-pro',
        positivePrompt: o.prompt.slice(0, 3000),
        width: 1152,
        height: 2048,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        referenceImages: o.refs.map(dataUri),
      },
    ]),
    signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  const d = j.data?.[0];
  const dir = join(PUB, 'story/candidates', o.kind, o.id);
  mkdirSync(dir, { recursive: true });
  const raw = join(dir, `_${k}.jpg`);
  writeFileSync(raw, Buffer.from(await (await fetch(d.imageURL)).arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=720:1280:flags=lanczos', '-q:v', '2', join(dir, `${k}.jpg`)]);
  rmSync(raw);
  return d.cost ?? 0;
}

const log = [];
let yen = 0;
for (const item of queue.paint ?? []) {
  const o = order(item);
  if (o.error) {
    log.push(`- ❌ ${o.name}: ${o.error}`);
    continue;
  }
  const dir = join(PUB, 'story/candidates', o.kind, o.id);
  const have = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f)) : [];
  if (have.length && !redo.has(o.name)) continue;
  if (redo.has(o.name)) for (const f of have) rmSync(join(dir, f));
  const results = await Promise.allSettled(Array.from({ length: N }, (_, k) => paint(o, k + 1).catch((e) => (/504|Timeout/i.test(String(e)) ? paint(o, k + 1) : Promise.reject(e)))));
  const ok = results.filter((x) => x.status === 'fulfilled');
  yen += ok.reduce((a, x) => a + x.value * 150, 0);
  const bad = results.find((x) => x.status === 'rejected');
  log.push(`- ${ok.length ? '✅' : '❌'} ${o.name}（${o.kind === 'cast' ? '人物' : '場所'}・${o.id}）候補 ${ok.length}/${N}${bad ? ` — ${String(bad.reason).slice(0, 200)}` : ''}\n  - 注文: ${o.prompt.slice(0, 300)}…`);
}
// redo is done once: clear it so the next run does not paint the same again
if ((queue.redo ?? []).length) writeFileSync('design/story-assets-queue.json', JSON.stringify({ ...queue, redo: [] }, null, 2) + '\n');
const report = [`# 物語の素材・候補 — ${new Date().toISOString()}`, '', `Seedream 5.0 Pro / 約${Math.round(yen)}円`, '', ...(log.length ? log : ['（新しく描くものなし）']), ''].join('\n');
writeFileSync('docs/story-import/assets-paint-last-run.md', report);
console.log(report);
