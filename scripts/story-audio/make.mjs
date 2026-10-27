/**
 * Story sound made by Claude Code (client 2026-10-25: the synthesised beeps and the three themes felt like
 * a demo): sound effects and background music on Runware's audio models, run by
 * .github/workflows/story-audio.yml when design/story-audio-queue.json changes.
 *
 * Each queue item: { id, kind: "se" | "bgm", prompt, duration?, model?, settings? }
 *  - se  → apps/web/public/onboarding/se-<id>.mp3 (mono, peak-normalised, trimmed silence)
 *  - bgm → apps/web/public/onboarding/bgm-<id>.m4a (AAC, loudness −16 LUFS like the client's tracks)
 * An id is made once; "redo": [ids] makes it again. "probe": ["music", …] lists Runware models whose name
 * matches, into the report (to find the music model's id). Report: docs/story-import/audio-last-run.md.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.RUNWARE_API_KEY;
if (!KEY) throw new Error('RUNWARE_API_KEY is not set');
const QUEUE = process.argv[2] ?? 'design/story-audio-queue.json';
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const OUT = 'apps/web/public/onboarding';
const API = 'https://api.runware.ai/v1';
const redo = new Set(queue.redo ?? []);
const fileOf = (x) => join(OUT, x.kind === 'bgm' ? `bgm-${x.id}.m4a` : `se-${x.id}.mp3`);
const todo = (queue.items ?? []).filter((x) => redo.has(x.id) || !existsSync(fileOf(x)));
/** "listen": [ids] — Gemini listens to tracks already made, into the report */
const listenOnly = (queue.items ?? []).filter((x) => (queue.listen ?? []).includes(x.id) && existsSync(fileOf(x)));
const log = [];

async function call(tasks) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(180_000),
  });
  const j = await res.json().catch(() => ({}));
  // a task still being made comes back as 500 with its data and no errors (2026-10-26): not a failure
  const stillMaking = !res.ok && !j.errors?.length && Array.isArray(j.data) && j.data.length > 0 && j.data.every((d) => !d.status || d.status === 'processing');
  if (stillMaking) return j.data;
  if (!res.ok || j.errors?.length) throw new Error(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 1500)}`);
  return j.data ?? [];
}

/** the models Runware has for a word (to find the right ids) */
async function probe(word) {
  try {
    const d = await call([{ taskType: 'modelSearch', taskUUID: randomUUID(), search: word, limit: 50 }]);
    const list = (d[0]?.results ?? d).map((m) => `${m.air ?? m.model ?? ''} — ${m.name ?? ''} (${m.category ?? m.type ?? ''})`);
    log.push(`- 🔎 「${word}」: ${list.length ? '' : 'なし'}`, ...list.slice(0, 50).map((l) => `  - ${l}`));
  } catch (e) {
    log.push(`- 🔎 「${word}」: ${String(e).slice(0, 400)}`);
  }
}

async function make(x) {
  const taskUUID = randomUUID();
  const model = x.model ?? (x.kind === 'bgm' ? queue.musicModel : queue.sfxModel);
  if (!model) throw new Error('no model for this kind yet');
  const first = await call([
    {
      taskType: 'audioInference',
      taskUUID,
      model,
      positivePrompt: x.prompt,
      // Seed Audio takes no length (it decides it from the description)
      ...(x.duration && !String(model).startsWith('bytedance:seed-audio') ? { duration: x.duration } : {}),
      outputType: 'URL',
      outputFormat: 'MP3',
      deliveryMethod: 'async',
      includeCost: true,
      ...(x.settings ?? {}),
    },
  ]);
  let d = first.find((r) => r.taskUUID === taskUUID && r.audioURL);
  for (let k = 0; !d && k < 120; k++) {
    await new Promise((r) => setTimeout(r, 5000));
    const got = (await call([{ taskType: 'getResponse', taskUUID }])).find((r) => r.taskUUID === taskUUID);
    if (got?.status === 'error') throw new Error(JSON.stringify(got).slice(0, 600));
    if (got?.audioURL) d = got;
  }
  if (!d) throw new Error('the sound did not come back in time');
  const raw = join(OUT, `_${x.id}.mp3`);
  writeFileSync(raw, Buffer.from(await (await fetch(d.audioURL)).arrayBuffer()));
  // a silent take never replaces a sound (a Seed Audio stamp came back silent, 2026-10-27)
  const vol = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
  const peak = Number(/max_volume: (-?[\d.]+|-inf) dB/.exec(vol)?.[1] ?? '-inf');
  if (!(peak > -40)) {
    rmSync(raw);
    throw new Error(`silent take (peak ${peak} dB)`);
  }
  const out = fileOf(x);
  if (x.kind === 'bgm') {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '2', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k', out]);
  } else {
    // trim silence at both ends, loudness −18 LUFS (a touch under the music and voices), mono, light
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-18:TP=-1.5:LRA=11', '-ac', '1', '-ar', '44100', '-b:a', '96k', out]);
  }
  rmSync(raw);
  return d.cost ?? 0;
}

/** Gemini listens to a made track and says what it hears (no vocals? the mood, does it loop, a score) */
async function listen(file, prompt, kind = 'bgm') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const wav = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-t', '75', '-f', 'mp3', 'pipe:1'], { maxBuffer: 64 << 20 });
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [
          { inlineData: { mimeType: 'audio/mp3', data: wav.toString('base64') } },
          {
            text:
              kind === 'se'
                ? `This is a sound effect made for a Japanese anime fantasy story game. It was asked for as: "${prompt}". Listen and answer in Japanese, in 2 short lines: 1) 何の音に聞こえるか（ひとことで）、声や音楽が混ざっていないか 2) 依頼に合っているか、効果音としての質（安っぽくないか）を10点満点で。`
                : `This is background music made for a Japanese anime fantasy story game. It was asked for as: "${prompt}". Listen and answer in Japanese, in 3 short lines: 1) 歌声・人の声が入っているか（はい/いいえ） 2) 雰囲気と楽器（ひとことで） 3) 依頼に合っているか、BGMとしての質を10点満点で、ループに向くか。`,
          },
        ] }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const j = await res.json();
    return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim() ?? `（聞けなかった：${res.status} ${JSON.stringify(j.error ?? j).slice(0, 200)}）`;
  } catch (e) {
    return `（聞けなかった：${String(e).slice(0, 120)}）`;
  }
}

for (const w of queue.probe ?? []) await probe(w);
let usd = 0;
let next = 0;
/** ids that failed stay in redo for the next run (a silent or timed-out take) */
const failed = [];
await Promise.all(
  Array.from({ length: queue.parallel ?? 3 }, async () => {
    while (next < todo.length) {
      const x = todo[next++];
      try {
        usd += await make(x);
        const heard = await listen(fileOf(x), x.prompt, x.kind);
        log.push(`- ✅ ${x.kind}-${x.id}（${x.duration ?? '-'}秒）${heard ? `\n  - 聞いた感じ：${heard}` : ''}`);
      } catch (e) {
        failed.push(x.id);
        log.push(`- ❌ ${x.kind}-${x.id}: ${String(e).slice(0, 1200)}`);
      }
    }
  }),
);
for (const x of listenOnly) log.push(`- 👂 ${x.kind}-${x.id}：${(await listen(fileOf(x), x.prompt)) ?? '（鍵がない）'}`);
if ((queue.redo ?? []).length || (queue.probe ?? []).length || (queue.listen ?? []).length) writeFileSync(QUEUE, JSON.stringify({ ...queue, redo: failed.filter((id) => redo.has(id)), probe: [], listen: [] }, null, 2) + '\n');
mkdirSync('docs/story-import', { recursive: true });
const report = [`# 物語の音 — ${new Date().toISOString()}`, '', `${todo.length}本 / 約${Math.round(usd * 150)}円`, '', ...log, ''].join('\n');
writeFileSync('docs/story-import/audio-last-run.md', report);
console.log(report);
