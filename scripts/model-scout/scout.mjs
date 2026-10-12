#!/usr/bin/env node
/**
 * Model scout (client request 2026-10-11: stop paying for Seedream, find something cheaper that
 * keeps KIMORIN and the picture quality). Run by .github/workflows/model-scout.yml when
 * scripts/model-scout/round.json changes:
 *  1. `search`: Runware modelSearch for each term → the models' AIR ids in the report (free)
 *  2. `models`: each candidate paints the same two tests with the hero picture as a reference —
 *     "single" (one photo redrawn with KIMORIN in it) and "grid" (four photos as a 2x2 sheet, the
 *     MV's 4コマ way) — and the report shows what each cost (Runware's own figure).
 * Pictures and report: art/lab/scout/<round>/.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.RUNWARE_API_KEY;
if (!KEY) throw new Error('RUNWARE_API_KEY is not set');
const round = JSON.parse(readFileSync(process.env.ROUND_FILE ?? 'scripts/model-scout/round.json', 'utf8'));
const OUT = join('art/lab/scout', round.round);
mkdirSync(OUT, { recursive: true });
const YEN = 150;

const dataUri = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;

async function call(tasks, timeoutMs = 300_000) {
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || (j.errors?.length && !j.data?.length)) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 400)}`);
  return j.data ?? [];
}

const report = [`# Model scout — ${round.round}`, '', round.note ?? '', ''];

// 1. search
if (round.search?.length) {
  report.push('## Search', '');
  for (const term of round.search) {
    try {
      const found = await call([{ taskType: 'modelSearch', taskUUID: randomUUID(), search: term, limit: 12 }], 30_000);
      const list = found.flatMap((f) => f.results ?? []);
      report.push(`### "${term}"`, '');
      if (!list.length) report.push('- (nothing)');
      for (const m of list) report.push(`- \`${m.air}\` — ${m.name ?? ''} ${m.version ?? ''} · ${m.category ?? ''} · ${m.architecture ?? ''}${m.tags?.length ? ` · ${m.tags.slice(0, 5).join(', ')}` : ''}`);
      report.push('');
    } catch (e) {
      report.push(`### "${term}"`, '', `- ❌ ${String(e).slice(0, 300)}`, '');
    }
  }
}

// 2. paint tests
const hero = round.hero ?? 'art/lab/mv/hero.jpg';
const photos = (round.photos ?? []).map((p) => ({ file: p.file, caption: p.caption }));
const HERO_TXT =
  'the character from the reference picture (a small chibi fox spirit: white mask face with blue markings and glowing blue eyes, fox ears, red hooded robe, many white-and-black tails, white paws, blue gem necklace) — exactly the same design, colours and proportions, exactly once';
const singlePrompt = (p) =>
  `A breathtaking still from a high-end Japanese anime film, fully drawn in 2D anime style. The place and food come from the photo in reference picture 2 (${p.caption}). In it is ${HERO_TXT.replace('the reference picture', 'reference picture 1')}, happily doing what the photo shows. Children's picture: drinks are juice or tea. No text, no watermark.`;
const gridPrompt = (ps) =>
  [
    'A 2x2 sheet of four separate square stills from the same high-end Japanese anime film, four equal panels split by thin straight white gutters, all fully drawn in 2D anime style.',
    ...ps.map((p, j) => `Panel ${j + 1}: redraw the photo in reference picture ${j + 2} (${p.caption}).`),
    `In every panel the main character is ${HERO_TXT.replace('the reference picture', 'reference picture 1')} per panel, really doing what the panel shows. Children's pictures: drinks are juice or tea. No text, no watermark.`,
  ].join(' ');

/** one task; `refs` sent the way the model takes them (top-level referenceImages, or inputs.referenceImages) */
function task(m, prompt, refs, w, h) {
  const t = {
    taskType: 'imageInference',
    taskUUID: randomUUID(),
    model: m.model,
    positivePrompt: prompt.slice(0, m.maxPrompt ?? 3000),
    width: w,
    height: h,
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'JPG',
    includeCost: true,
    ...(m.extra ?? {}),
  };
  const r = refs.slice(0, m.maxRefs ?? 10);
  if (m.refs === 'inputs') t.inputs = { referenceImages: r };
  else if (m.refs === 'seed') t.seedImage = r[1] ?? r[0];
  else if (m.refs !== 'none') t.referenceImages = r;
  return t;
}

async function paint(m, kind, prompt, refs, w, h) {
  const t0 = Date.now();
  let modes = [m.refs ?? 'top', ...(m.refs ? [] : ['inputs'])];
  let lastErr;
  for (const mode of modes) {
    try {
      const [d] = await call([task({ ...m, refs: mode }, prompt, refs, w, h)]);
      if (!d?.imageURL) throw new Error('no picture');
      const img = Buffer.from(await (await fetch(d.imageURL)).arrayBuffer());
      const file = `${m.name}-${kind}.jpg`;
      writeFileSync(join(OUT, file), img);
      return `- ✅ **${kind}** ${w}x${h} · refs ${mode} · ${d.cost != null ? `${(d.cost * YEN).toFixed(2)}円 ($${d.cost})` : 'cost ?'} · ${Math.round((Date.now() - t0) / 1000)}s → ${file}`;
    } catch (e) {
      lastErr = e;
    }
  }
  return `- ❌ **${kind}**: ${String(lastErr).slice(0, 300)}`;
}

if (round.models?.length) {
  report.push('## Paint tests', '');
  const heroRef = dataUri(hero);
  for (const m of round.models) {
    report.push(`### ${m.name} — \`${m.model}\``, '');
    const [w, h] = m.size ?? [1024, 1024];
    if (photos[0]) report.push(await paint(m, 'single', singlePrompt(photos[0]), [heroRef, dataUri(photos[0].file)], w, h));
    if (photos.length >= 4 && m.grid !== false) {
      const four = photos.slice(0, 4);
      const [gw, gh] = m.gridSize ?? [Math.max(w, 1024), Math.max(h, 1024)];
      report.push(await paint(m, 'grid', gridPrompt(four), [heroRef, ...four.map((p) => dataUri(p.file))], gw, gh));
    }
    report.push('');
  }
}

writeFileSync(join(OUT, 'report.md'), report.join('\n'));
console.log(report.join('\n'));

// 3. character test (client direction 2026-10-12: members show who they are by features — a hat's
//    colour, the shape of sunglasses — not a face): each hero picture × each scene with one model,
//    words for the hero from `look`; a contact sheet per hero is made by the workflow's report step
if (round.heroes?.length && round.scenes?.length) {
  const m = round.heroModel ?? { name: 'klein-4b', model: 'runware:400@4', maxRefs: 4 };
  report.push(`## Characters — ${m.name}`, '');
  let total = 0;
  for (const h of round.heroes) {
    report.push(`### ${h.name}`, '');
    const ref = dataUri(h.file);
    const results = await Promise.all(
      round.scenes.map(async (sc, k) => {
        const prompt = [
          `A still from a high-end Japanese anime film, fully drawn in 2D anime style: ${sc}.`,
          `The main character is the one in the reference picture — exactly the same design, colours, outfit and accessories (${h.look}) — shown exactly once.`,
          'Keep its face, headwear, eyewear and outfit exactly as in the reference; never draw an open mouth or teeth the reference does not have.',
          'Any glass on the table holds orange juice, green tea or milk. Rich detailed background, cinematic lighting. No text, no watermark.',
        ].join(' ');
        try {
          const [d] = await call([task({ ...m, refs: 'top' }, prompt, [ref], 1024, 1024)]);
          const img = Buffer.from(await (await fetch(d.imageURL)).arrayBuffer());
          const file = `${h.name}-${k + 1}.jpg`;
          writeFileSync(join(OUT, file), img);
          total += d.cost ?? 0;
          return `- ✅ ${sc.slice(0, 60)} → ${file}`;
        } catch (e) {
          return `- ❌ ${sc.slice(0, 60)}: ${String(e).slice(0, 200)}`;
        }
      }),
    );
    report.push(...results, '');
  }
  report.push(`費用: ${(total * YEN).toFixed(1)}円`, '');
}

writeFileSync(join(OUT, 'report.md'), report.join('\n'));
