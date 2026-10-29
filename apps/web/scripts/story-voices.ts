/**
 * Story voices (client plan 2026-10-13), run by .github/workflows/story-voices.yml when
 * design/story-voices.json changes.
 *
 *  - auditions: for each person, the same line read by several voices, to compare and choose
 *    (public/story/voices/audition/<id>/<k>-<label>.mp3 + auditions.json — /kakunin-5798f28713/story-assets「声」)
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
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { walk, type Scene } from '../lib/story/parse';
import { idOf } from '../lib/story/sheets';
import { nameRest, voiceKey, voiceable } from '../lib/story/voice';
// by path: this runs without an install (the workflow), and the file has no imports of its own
import { speakText, spokenChars, storyVoiceFilter, storyVoicePrompt, type NameLines } from '../../../packages/shared/src/storyVoice';

const ROOT = resolve(__dirname, '../../..');
const PUB = join(ROOT, 'apps/web/public');
const STORY = join(PUB, 'story');
const CONFIG = join(ROOT, 'design/story-voices.json');
const KEY = process.env.GEMINI_API_KEY;
const FISH = process.env.FISH_API_KEY;
/** --names-only: just write name-lines.json (no voices made, no key needed) */
const NAMES_ONLY = process.argv.includes('--names-only');
if (!KEY && !NAMES_ONLY) throw new Error('GEMINI_API_KEY is not set');
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
  /** this speaker's own speed on top of "tempo" (KIMORIN 0.85: calmer and slower, client 2026-10-26) */
  tempo?: number;
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

/**
 * Speed and the silence before the first word (client 2026-10-15: every voice 1.3× faster, same key, no
 * silence at the head): "tempo" in the config (default 1.3), applied to every new file; files made before
 * are brought to the current tempo once (voices/tempo.json remembers what each file has).
 */
const TEMPO = Number((cfg as { tempo?: number }).tempo ?? 1.3);
const HEAD = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-42dB:start_silence=0.04';
const atempo = (r: number) => (Math.abs(r - 1) < 0.001 ? [] : [`atempo=${r.toFixed(4)}`]);

/** raw audio → mp3, with the spec's pitch / echo / growl, the tempo and a level (the same sound as members' lines) */
function finish(input: string, inputArgs: string[], s: Spec, out: string) {
  mkdirSync(join(out, '..'), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputArgs, '-i', input, '-af', storyVoiceFilter(s, TEMPO), '-ac', '1', '-b:a', '64k', out]);
  level(out);
}
/**
 * Every line at the same loudness (−18 LUFS). The one-pass loudnorm in the filter left some voices ~17 dB
 * quieter (フリージー, ヒポキン — client 2026-10-26: 「フリージーの声が小さい」): measure, then a fixed gain
 * and a limiter. Returns true when the file was changed.
 */
function level(file: string): boolean {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-18:TP=-1.5:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /"input_i"\s*:\s*"(-?[\d.]+)"/.exec(`${r.stdout}${r.stderr}`);
  const gain = m ? -18 - Number(m[1]) : NaN;
  if (!isFinite(gain) || Math.abs(gain) < 2) return false;
  const tmp = `${file}.l.mp3`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-af', `volume=${gain.toFixed(1)}dB,alimiter=limit=0.84:level=false`, '-ac', '1', '-b:a', '64k', tmp]);
  renameSync(tmp, file);
  return true;
}
const seconds = (file: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

async function gemini(model: string, s: Spec, brief: string, act: string | undefined, text: string, out: string) {
  const prompt = storyVoicePrompt(s.brief ?? brief, act, text);
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
      body: JSON.stringify({ text: speakText(text), reference_id: s.model, format: 'mp3', mp3_bitrate: 128, latency: 'normal', normalize: true }),
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

// "special": a line said in another way — { who, text?, act?, as?, spec } (as = borrow that person's voice,
// spec = changes on top, e.g. KIMORIN's tremendously funny voice: a higher pitch)
type Special = { who: string; text?: string; act?: string; as?: string; spec?: Spec };
const specials = (cfg.special as Special[] | undefined) ?? [];
/** The voice a line is said in (null = that person has no voice yet). */
function voiceFor(name: string, l: { act?: string; text: string }): { s: Spec; brief: string } | null {
  const sp = specials.find((x) => x.who === name && (!x.text || l.text.includes(x.text)) && (!x.act || (l.act ?? '').includes(x.act)));
  const baseRef = sp?.as ? cfg.chosen[sp.as] : cfg.chosen[name];
  if (!baseRef) return null;
  const s = { ...spec(baseRef), ...(sp?.spec ?? {}) };
  return { s, brief: s.brief ?? cfg.auditions.find((a) => a.name === (sp?.as ?? name))?.brief ?? '' };
}

/**
 * public/story/voices/name-lines.json: every line with a member's name in it ({name} {neo} {bati} …), in
 * the whole story, with its voice — the server voices them for each member (@obolo/shared storyVoice).
 */
function writeNameLines(model: string) {
  const out: NameLines = { model, tempo: TEMPO, lines: {} };
  for (const [name, ls] of said)
    for (const l of ls) {
      if (!/\{[a-z_]+\}/.test(l.text)) continue;
      const v = voiceFor(name, l);
      if (!v) continue;
      // the Fish model id is enough for the server; the recording's path is not needed there
      const { fish, ...rest } = v.s;
      const line = { who: name, ...(l.act ? { act: l.act } : {}), text: l.text, spec: fish ? { ...rest, fish: 'clone' } : rest, brief: v.brief };
      out.lines[voiceKey(name, l.act, l.text)] = line;
      out.lines[voiceKey(name, undefined, l.text)] ??= line;
    }
  out.pace = paces(Object.values(out.lines).map((l) => l.who));
  mkdirSync(join(STORY, 'voices'), { recursive: true });
  writeFileSync(join(STORY, 'voices/name-lines.json'), JSON.stringify(out));
  return Object.keys(out.lines).length;
}

/**
 * Each speaker's speed in the pre-made lines (spoken characters a second, the median), so a member's line is
 * picked from takes at the same speed as the lines around it (story chat 2026-10-29: MONBAN's {inviter} line
 * came out at another speed and key).
 */
function paces(who: string[]): Record<string, number> {
  const manifest = json<Record<string, string>>(join(STORY, 'voices/manifest.json'), {});
  const out: Record<string, number> = {};
  for (const name of new Set(who)) {
    const r: number[] = [];
    for (const l of said.get(name) ?? []) {
      const file = !/\{[a-z_]+\}/.test(l.text) && manifest[voiceKey(name, l.act, l.text)];
      if (!file || !existsSync(join(PUB, file))) continue;
      const chars = spokenChars(l.text);
      if (chars < 6) continue;
      r.push(chars / seconds(join(PUB, file)));
      if (r.length >= 25) break;
    }
    if (r.length >= 3) out[name] = +r.sort((a, b) => a - b)[r.length >> 1].toFixed(2);
  }
  return out;
}

/** Run jobs a few at a time. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

(async () => {
  if (NAMES_ONLY) {
    const model = json<{ model?: string }>(join(STORY, 'voices/auditions.json'), {}).model ?? 'gemini-2.5-pro-preview-tts';
    console.log(`name-lines.json: ${writeNameLines(model)} keys`);
    return;
  }
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
  // "extra": lines the client added in the app before the story has them ({ who, text, act? })
  const extra = (cfg.extra as { who: string; text: string; act?: string }[] | undefined) ?? [];
  for (const x of extra) {
    spoken.set(x.who, [...(spoken.get(x.who) ?? []), { act: x.act, text: x.text }]);
    said.set(x.who, [...(said.get(x.who) ?? []), { act: x.act, text: x.text }]);
  }
  const manifestPath = join(STORY, 'voices/manifest.json');
  const manifest = json<Record<string, string>>(manifestPath, {});
  const jobs: { name: string; s: Spec; brief: string; act?: string; text: string; key: string }[] = [];
  let skipped = 0;
  const voiced = new Set([...Object.keys(cfg.chosen), ...specials.map((x) => x.who)]);
  for (const name of voiced) {
    const again = redo.has(name);
    for (const l of spoken.get(name) ?? []) {
      const v = voiceFor(name, l);
      if (!v) continue;
      const { s, brief } = v;
      if (!voiceable(l.text)) {
        skipped++;
        // a line that starts with a name (「{name}、お前は…」): its words after the name are voiced too
        const rest = nameRest(l.text);
        const rk = rest && voiceKey(name, l.act, rest);
        if (rest && rk && (again || redoLines.some((r) => r && l.text.includes(r)) || !manifest[rk] || !existsSync(join(PUB, manifest[rk]))) && !jobs.some((j) => j.key === rk))
          jobs.push({ name, s, brief, act: l.act, text: rest, key: rk });
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
      // a take that is far too short for its words was cut off by the voice service: try again (keep the longest)
      const chars = j.text.replace(/[\s、。，．！？!?…・「」『』（）()〜ー＊*“”"-]/g, '').length;
      let best = 0;
      for (let take = 0; take < 3; take++) {
        const t = join(PUB, `${file}.take.mp3`);
        await speak(j.name, j.s, j.brief, j.act, j.text, t);
        const sec = seconds(t);
        if (sec > best) {
          best = sec;
          renameSync(t, tmp);
        } else rmSync(t);
        if (chars < 6 || chars / best <= 13) break;
      }
      renameSync(tmp, join(PUB, file));
      manifest[j.key] = file;
      made++;
      if (made % 25 === 0) writeFileSync(manifestPath, JSON.stringify(manifest));
    } catch (e) {
      log.push(`- ❌ ${j.name}「${j.text.slice(0, 20)}」: ${String(e).slice(0, 160)}`);
    }
  });
  // the app plays a line by who + words: a line with a stage direction (〔…〕) is also found without it
  for (const name of voiced)
    for (const l of spoken.get(name) ?? []) {
      if (!l.act) continue;
      const file = manifest[voiceKey(name, l.act, l.text)];
      const plain = voiceKey(name, undefined, l.text);
      if (file && !manifest[plain]) manifest[plain] = file;
      const rest = nameRest(l.text);
      const restFile = rest && manifest[voiceKey(name, l.act, rest)];
      if (rest && restFile && !manifest[voiceKey(name, undefined, rest)]) manifest[voiceKey(name, undefined, rest)] = restFile;
    }
  // every line file at the current tempo, without silence at the head (files made this run already are)
  const tempoPath = join(STORY, 'voices/tempo.json');
  const tempoOf = json<Record<string, number>>(tempoPath, {});
  for (const j of todo) tempoOf[`/story/voices/lines/${j.key}.mp3`] = TEMPO;
  let retimed = 0;
  for (const file of new Set(Object.values(manifest))) {
    const had = tempoOf[file] ?? 1;
    const path = join(PUB, file);
    if (Math.abs(had - TEMPO) < 0.001 || !existsSync(path)) continue;
    const tmp = `${path}.t.mp3`;
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path, '-af', [HEAD, ...atempo(TEMPO / had)].join(','), '-ac', '1', '-b:a', '64k', tmp]);
      renameSync(tmp, path);
      tempoOf[file] = TEMPO;
      retimed++;
    } catch (e) {
      log.push(`- ❌ 速さの変更 ${file}: ${String(e).slice(0, 120)}`);
    }
  }
  if (retimed) log.push(`- ⏩ 前に作った声 ${retimed}個を ${TEMPO}倍速・頭の無音なしにした`);
  // cleanup: voices of lines that are no longer in any part of the story
  const alive = new Set<string>();
  for (const [name, ls] of said)
    for (const l of ls) {
      alive.add(voiceKey(name, l.act, l.text)).add(voiceKey(name, undefined, l.text));
      const rest = nameRest(l.text);
      if (rest) alive.add(voiceKey(name, l.act, rest)).add(voiceKey(name, undefined, rest));
    }
  let removed = 0;
  for (const [k, file] of Object.entries(manifest)) {
    if (alive.has(k)) continue;
    delete manifest[k];
    if (!Object.values(manifest).includes(file) && existsSync(join(PUB, file))) {
      rmSync(join(PUB, file));
      removed++;
    }
  }
  if (removed) log.push(`- 🧹 台本から消えたセリフの声 ${removed}個を消した`);
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const live = new Set(Object.values(manifest));
  writeFileSync(tempoPath, JSON.stringify(Object.fromEntries(Object.entries(tempoOf).filter(([f]) => live.has(f)))));

  const nameKeys = writeNameLines(tts);
  log.push(`- 🏷 名前の入るセリフ ${nameKeys}個の一覧（name-lines.json）: 会員ごとに、名前が決まったら裏で声を作る`);
  // Fish model ids made this run go back into the config; redo / redoLines are done once
  writeFileSync(CONFIG, JSON.stringify({ ...cfg, redo: [], redoLines: [] }, null, 2) + '\n');
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
