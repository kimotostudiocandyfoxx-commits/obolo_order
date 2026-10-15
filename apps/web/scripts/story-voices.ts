/**
 * Story voices (client plan 2026-10-13), run by .github/workflows/story-voices.yml when
 * design/story-voices.json changes.
 *
 *  - auditions: for each person, the same line read by several voices, to compare and choose
 *    (public/story/voices/audition/<id>/<k>-<label>.mp3 + auditions.json — /preview/story-assets「声」)
 *  - lines: every spoken line of a person whose voice is chosen, one file per line named by
 *    lib/story/voice.ts voiceKey (public/story/voices/lines/<key>.mp3 + manifest.json). Lines with
 *    per-member names are skipped. MAX_LINES per run (default 400).
 *
 * A voice is a spec (or just a Gemini voice name):
 *   { "voice": "Gacrux", "pitch": 0.7, "echo": 0.3, "growl": 0, "brief": "…" }      Gemini TTS voice
 *   { "fish": "design/story/voices/kimorin-sample.m4a", "model": "<id>" }          cloned from a recording
 * pitch in semitones (rubberband), echo 0–1 (a short delay), growl 0–1 (a monster's grit: lower
 * formants, saturation, low end). A Fish model is made once from the recording (Gemini writes the
 * transcript) and its id is written back to the config.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { walk, type Scene } from '../lib/story/parse';
import { idOf } from '../lib/story/sheets';
import { voiceKey, voiceable } from '../lib/story/voice';

const ROOT = resolve(__dirname, '../../..');
const PUB = join(ROOT, 'apps/web/public');
const STORY = join(PUB, 'story');
const CONFIG = join(ROOT, 'design/story-voices.json');
const KEY = process.env.GEMINI_API_KEY;
const FISH = process.env.FISH_API_KEY;
if (!KEY) throw new Error('GEMINI_API_KEY is not set');
const json = <T>(p: string, d: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : d);
const MAX = Number(process.env.MAX_LINES ?? (json<{ batch?: number }>(join(ROOT, 'design/story-voices.json'), {}).batch ?? 400));

interface Spec {
  voice?: string;
  fish?: string;
  model?: string;
  pitch?: number;
  echo?: number;
  growl?: number;
  /** keep the voice's size when shifting (default) or let it grow / shrink with the pitch */
  formant?: 'preserved' | 'shifted';
  brief?: string;
  /** shown on the audition page */
  label?: string;
}
type VoiceRef = string | Spec;
interface Audition {
  name: string;
  brief: string;
  line?: string;
  voices: VoiceRef[];
}
interface Config {
  auditions: Audition[];
  chosen: Record<string, VoiceRef>;
  redo?: string[];
  [k: string]: unknown;
}
const cfg = json<Config>(CONFIG, { auditions: [], chosen: {} });
const spec = (v: VoiceRef): Spec => (typeof v === 'string' ? { voice: v } : v);
const labelOf = (s: Spec) =>
  s.label ?? [s.fish ? 'clone' : s.voice, s.pitch ? `${s.pitch > 0 ? '+' : ''}${s.pitch}st` : '', s.formant === 'shifted' ? 'big' : '', s.echo ? 'echo' : '', s.growl ? 'growl' : '', 'hq'].filter(Boolean).join('-');

const idx = json<{ parts: string[] }>(join(STORY, 'index.json'), { parts: [] });
const scenes: Scene[] = idx.parts.flatMap((p) => json<Scene[]>(join(STORY, `${p}.json`), []));
const said = new Map<string, { act?: string; text: string }[]>();
for (const s of scenes) walk(s.lines, (l) => l.k === 'say' && said.set(l.who, [...(said.get(l.who) ?? []), { act: l.act, text: l.text }]));

const API = 'https://generativelanguage.googleapis.com/v1beta';
async function models(): Promise<string[]> {
  const r = (await (await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': KEY! } })).json()) as { models?: { name: string }[] };
  return (r.models ?? []).map((m) => m.name.replace(/^models\//, ''));
}
const pickTts = (names: string[]) => {
  const tts = names.filter((n) => /tts/i.test(n)).sort((a, b) => Number(/pro/.test(b)) - Number(/pro/.test(a)) || b.localeCompare(a));
  if (!tts.length) throw new Error('no text-to-speech model for this key');
  return tts[0];
};

/** raw audio → mp3, with the spec's pitch / echo / growl and a level */
function finish(input: string, inputArgs: string[], s: Spec, out: string) {
  const f: string[] = [];
  // rubberband at its best quality (the default "speed" setting sounded robotic)
  const rb = (st: number, formant: string) => `rubberband=pitch=${Math.pow(2, st / 12).toFixed(4)}:formant=${formant}:pitchq=quality:transients=smooth:window=long:smoothing=on:phase=independent`;
  if (s.growl) {
    // a monster: formants pulled down with the pitch, grit, weight in the low end
    f.push(rb(s.pitch ?? -6, 'shifted'));
    f.push(`bass=g=${(6 * s.growl).toFixed(1)}:f=120`, `asoftclip=type=tanh:threshold=${(1 - 0.5 * s.growl).toFixed(2)}`, 'lowpass=f=7000');
  } else if (s.pitch) f.push(rb(s.pitch, s.formant ?? 'preserved'));
  if (s.echo) {
    const d = (0.25 + 0.35 * s.echo).toFixed(2);
    f.push(`aecho=0.85:0.75:170|340:${d}|${(+d / 2).toFixed(2)}`);
  }
  f.push('loudnorm=I=-18:TP=-1.5');
  mkdirSync(join(out, '..'), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputArgs, '-i', input, '-af', f.join(','), '-ac', '1', '-b:a', '64k', out]);
}
const seconds = (file: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

async function gemini(model: string, s: Spec, brief: string, act: string | undefined, text: string, out: string) {
  const how = act ? ` This time it is said ${act} (stage direction, in Japanese: 「${act}」).` : '';
  const prompt = `You are voicing a character in a Japanese anime adventure for children. ${s.brief ?? brief}.${how} Speak only the Japanese line below, in character, naturally — do not read these instructions.\n\n${text.replace(/\n/g, ' ')}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY! },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } } } } }),
      signal: AbortSignal.timeout(120_000),
    });
    const j = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[]; error?: { message: string } };
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) {
      // busy, or a short line it would not voice this time (finishReason OTHER): try again
      const other = JSON.stringify(j).includes('"OTHER"');
      if (res.status === 429 || res.status >= 500 || (other && attempt < 3)) {
        await new Promise((r) => setTimeout(r, (other ? 1500 : 5000) * (attempt + 1)));
        continue;
      }
      throw new Error(`${res.status} ${j.error?.message ?? JSON.stringify(j).slice(0, 200)}`);
    }
    const rate = part.inlineData!.mimeType?.match(/rate=(\d+)/)?.[1] ?? '24000';
    const raw = `${out}.pcm`;
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(raw, Buffer.from(part.inlineData!.data!, 'base64'));
    finish(raw, ['-f', 's16le', '-ar', rate, '-ac', '1'], s, out);
    rmSync(raw);
    return;
  }
  throw new Error('the voice service kept failing');
}

/** The recording's words (Fish wants a transcript with the sample). */
async function transcribe(file: string, names: string[]): Promise<string> {
  // the newest general flash model (old ones are retired for new keys): the -latest alias if offered
  const flash = names.filter((n) => /flash/.test(n) && !/tts|image|live|lite|audio|embed|exp|preview/.test(n));
  const ver = (n: string) => Number(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const model = flash.includes('gemini-flash-latest') ? 'gemini-flash-latest' : flash.sort((a, b) => ver(b) - ver(a))[0] ?? 'gemini-flash-latest';
  const mime = extname(file) === '.wav' ? 'audio/wav' : extname(file) === '.mp3' ? 'audio/mpeg' : 'audio/mp4';
  const res = await fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY! },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: mime, data: readFileSync(file).toString('base64') } }, { text: 'Transcribe this Japanese speech exactly, as plain text in Japanese. Output only the transcript.' }] }] }),
    signal: AbortSignal.timeout(120_000),
  });
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!t) throw new Error(`transcript failed: ${JSON.stringify(j).slice(0, 200)}`);
  return t;
}

/** A Fish voice model from the recording, made once (its id goes back into the config). */
// one model per recording (the audition and the real lines share it), made once per run
const fishMaking = new Map<string, Promise<string>>();
async function fishModel(s: Spec, name: string, names: string[]): Promise<string> {
  if (s.model) return s.model;
  if (!fishMaking.has(s.fish!)) fishMaking.set(s.fish!, makeFishModel({ ...s }, name, names));
  s.model = await fishMaking.get(s.fish!)!;
  return s.model;
}
async function makeFishModel(s: Spec, name: string, names: string[]): Promise<string> {
  if (!FISH) throw new Error('FISH_API_KEY is not set (Secret Manager: obolo-fish-api-key)');
  const file = join(ROOT, s.fish!);
  const text = await transcribe(file, names);
  const form = new FormData();
  form.append('title', `OBOLO story ${name}`);
  form.append('visibility', 'private');
  form.append('type', 'tts');
  form.append('train_mode', 'fast');
  form.append('texts', text);
  form.append('voices', new Blob([new Uint8Array(readFileSync(file))], { type: 'audio/mp4' }), `sample${extname(file)}`);
  const res = await fetch('https://api.fish.audio/model', { method: 'POST', headers: { authorization: `Bearer ${FISH}` }, body: form, signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`fish model ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { _id?: string; id?: string };
  s.model = j._id ?? j.id;
  if (!s.model) throw new Error('fish returned no model id');
  return s.model;
}

async function fishSpeak(s: Spec, text: string, out: string) {
  if (!FISH) throw new Error('FISH_API_KEY is not set');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { authorization: `Bearer ${FISH}`, 'content-type': 'application/json', model: process.env.FISH_MODEL ?? 's2.1-pro' },
      body: JSON.stringify({ text: text.replace(/\n/g, ' '), reference_id: s.model, format: 'mp3', mp3_bitrate: 128, latency: 'normal', normalize: true }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        continue;
      }
      throw new Error(`fish tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const raw = `${out}.src.mp3`;
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    finish(raw, [], s, out);
    rmSync(raw);
    return;
  }
  throw new Error('fish kept failing');
}

/** Run jobs a few at a time. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

(async () => {
  const names = await models();
  const tts = pickTts(names);
  const log: string[] = [];
  const redo = new Set(cfg.redo ?? []);
  const speak = async (name: string, s: Spec, brief: string, act: string | undefined, text: string, out: string) => {
    if (s.fish) {
      await fishModel(s, name, names);
      await fishSpeak(s, text, out);
    } else await gemini(tts, s, brief, act, text, out);
  };

  // --- auditions ---
  const out = json<{ auditions: { name: string; line: string; takes: { voice: string; file: string; seconds: number }[] }[] }>(join(STORY, 'voices/auditions.json'), { auditions: [] });
  for (const a of cfg.auditions) {
    const id = idOf(a.name, 'c');
    const own = (said.get(a.name) ?? []).filter((l) => voiceable(l.text) && l.text.length >= 8 && l.text.length <= 45).sort((x, y) => y.text.length - x.text.length)[0];
    const line = a.line ?? own?.text ?? '';
    if (!line) {
      log.push(`- ❌ ${a.name}: 試しに読むセリフがない`);
      continue;
    }
    const prev = out.auditions.find((x) => x.name === a.name);
    const takes: { voice: string; file: string; seconds: number }[] = [];
    for (const [k, ref] of a.voices.entries()) {
      const s = spec(ref);
      const label = labelOf(s);
      const file = `/story/voices/audition/${id}/${k + 1}-${label}.mp3`;
      const old = prev?.takes.find((t) => t.file === file);
      if (old && prev?.line === line && !redo.has(a.name) && existsSync(join(PUB, file))) {
        takes.push(old);
        continue;
      }
      try {
        await speak(a.name, s, a.brief, a.line ? undefined : own?.act, line, join(PUB, file));
        const sec = seconds(join(PUB, file));
        takes.push({ voice: label, file, seconds: sec });
        log.push(`- ✅ ${a.name} ${k + 1}（${label}）${sec.toFixed(1)}秒`);
      } catch (e) {
        log.push(`- ❌ ${a.name} ${k + 1}（${label}）: ${String(e).slice(0, 200)}`);
      }
    }
    out.auditions = [...out.auditions.filter((x) => x.name !== a.name), { name: a.name, line, takes }];
  }
  out.auditions.sort((x, y) => cfg.auditions.findIndex((a) => a.name === x.name) - cfg.auditions.findIndex((a) => a.name === y.name));
  mkdirSync(join(STORY, 'voices'), { recursive: true });
  const chosenLabels = Object.fromEntries(Object.entries(cfg.chosen).map(([n, v]) => [n, labelOf(spec(v))]));
  writeFileSync(join(STORY, 'voices/auditions.json'), JSON.stringify({ ...out, chosen: chosenLabels, model: tts }, null, 1));

  // --- the real lines of people whose voice is chosen ---
  // "parts": only these parts are voiced now (the first journey = P01–P04); "redoLines": lines (their words,
  // or a part of them) to say again; lines no longer in the story lose their files (cleanup)
  const parts = (cfg.parts as string[] | undefined) ?? idx.parts;
  const redoLines = (cfg.redoLines as string[] | undefined) ?? [];
  const spoken = new Map<string, { act?: string; text: string }[]>();
  for (const p of parts) for (const sc of json<Scene[]>(join(STORY, `${p}.json`), [])) walk(sc.lines, (l) => l.k === 'say' && spoken.set(l.who, [...(spoken.get(l.who) ?? []), { act: l.act, text: l.text }]));
  const manifestPath = join(STORY, 'voices/manifest.json');
  const manifest = json<Record<string, string>>(manifestPath, {});
  const jobs: { name: string; s: Spec; brief: string; act?: string; text: string; key: string }[] = [];
  let skipped = 0;
  for (const [name, ref] of Object.entries(cfg.chosen)) {
    const s = spec(ref);
    const brief = s.brief ?? cfg.auditions.find((a) => a.name === name)?.brief ?? '';
    const again = redo.has(name);
    for (const l of spoken.get(name) ?? []) {
      if (!voiceable(l.text)) {
        skipped++;
        continue;
      }
      const key = voiceKey(name, l.act, l.text);
      const once = redoLines.some((r) => r && l.text.includes(r));
      if (!again && !once && manifest[key] && existsSync(join(PUB, manifest[key]))) continue;
      if (!jobs.some((j) => j.key === key)) jobs.push({ name, s, brief, act: l.act, text: l.text, key });
    }
  }
  // a batch takes lines from everyone in turn, so each chosen voice can be heard early
  const byName = new Map<string, typeof jobs>();
  for (const j of jobs) byName.set(j.name, [...(byName.get(j.name) ?? []), j]);
  const mixed: typeof jobs = [];
  for (let k = 0; mixed.length < jobs.length; k++) for (const list of byName.values()) if (list[k]) mixed.push(list[k]);
  // without the Fish key, cloned voices wait (one note, not one per line)
  const waiting = FISH ? [] : [...new Set(mixed.filter((j) => j.s.fish).map((j) => j.name))];
  if (waiting.length) log.push(`- ⏸ ${waiting.join('・')}: 録音から作る声は Fish Audio のキー待ち（Secret Manager: obolo-fish-api-key）。${mixed.filter((j) => j.s.fish).length}行は後で作る`);
  const todo = mixed.filter((j) => FISH || !j.s.fish).slice(0, MAX);
  let made = 0;
  // the Fish model (if any) is made before the parallel run
  for (const j of todo) if (j.s.fish && !j.s.model) await fishModel(j.s, j.name, names).catch((e) => log.push(`- ❌ ${j.name}: ${String(e).slice(0, 200)}`));
  await pool(todo, 4, async (j) => {
    const file = `/story/voices/lines/${j.key}.mp3`;
    try {
      const tmp = join(PUB, `${file}.new.mp3`);
      await speak(j.name, j.s, j.brief, j.act, j.text, tmp);
      renameSync(tmp, join(PUB, file));
      manifest[j.key] = file;
      made++;
      if (made % 25 === 0) writeFileSync(manifestPath, JSON.stringify(manifest));
    } catch (e) {
      log.push(`- ❌ ${j.name}「${j.text.slice(0, 20)}」: ${String(e).slice(0, 160)}`);
    }
  });
  writeFileSync(manifestPath, JSON.stringify(manifest));

  // Fish model ids made this run go back into the config; redo is done once
  writeFileSync(CONFIG, JSON.stringify({ ...cfg, redo: [] }, null, 2) + '\n');
  const total = [...spoken.entries()].filter(([n]) => cfg.chosen[n]).reduce((a, [, ls]) => a + ls.filter((l) => voiceable(l.text)).length, 0);
  const report = [
    `# 物語の声 — ${new Date().toISOString()}`,
    '',
    `モデル: ${tts}${FISH ? ' ＋ Fish Audio（録音から）' : ''}`,
    `声の候補: ${cfg.auditions.length}人 ／ 本番の声: ${Object.keys(cfg.chosen).length}人・${Object.keys(manifest).length}行（決まった人のセリフ ${total}行のうち、今回 ${made}行・残り ${Math.max(0, jobs.length - made)}行、名前の入る行 ${skipped}行は対象外）`,
    '',
    ...log,
    '',
  ].join('\n');
  writeFileSync(join(ROOT, 'docs/story-import/voices-last-run.md'), report);
  console.log(report);
})();
