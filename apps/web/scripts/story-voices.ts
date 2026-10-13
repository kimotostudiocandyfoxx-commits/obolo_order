/**
 * Story voices (client plan 2026-10-13), run by .github/workflows/story-voices.yml when
 * design/story-voices.json changes.
 *
 *  - auditions: for each person, the same line read by several voices, to compare and choose
 *    (public/story/voices/audition/<id>/<k>.mp3 + auditions.json — /preview/story-assets「声」)
 *  - lines: every spoken line of a person whose voice is chosen ("chosen": { "KIMORIN": "Puck" }),
 *    one file per line named by lib/story/voice.ts voiceKey (public/story/voices/lines/<key>.mp3 +
 *    manifest.json). Lines with per-member names are skipped. MAX_LINES per run (default 400).
 *
 * Voices: Gemini text-to-speech (the newest TTS model the key can use; prebuilt voices, acted from a
 * short direction). Output mp3 64 kbps mono.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { walk, type Scene } from '../lib/story/parse';
import { idOf } from '../lib/story/sheets';
import { voiceKey, voiceable } from '../lib/story/voice';

const ROOT = resolve(__dirname, '../../..');
const STORY = join(ROOT, 'apps/web/public/story');
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error('GEMINI_API_KEY is not set');
const MAX = Number(process.env.MAX_LINES ?? 400);
const json = <T>(p: string, d: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : d);

interface Audition {
  name: string;
  /** how they sound, in English (the voice direction) */
  brief: string;
  line?: string;
  voices: string[];
}
interface Config {
  auditions: Audition[];
  /** name → voice, once the client chose */
  chosen: Record<string, string>;
  /** name → direction for the real lines (defaults to the audition brief) */
  direction?: Record<string, string>;
  redo?: string[];
}
const cfg = json<Config>(join(ROOT, 'design/story-voices.json'), { auditions: [], chosen: {} });
const idx = json<{ parts: string[] }>(join(STORY, 'index.json'), { parts: [] });
const scenes: Scene[] = idx.parts.flatMap((p) => json<Scene[]>(join(STORY, `${p}.json`), []));
const said = new Map<string, { act?: string; text: string }[]>();
for (const s of scenes) walk(s.lines, (l) => l.k === 'say' && said.set(l.who, [...(said.get(l.who) ?? []), { act: l.act, text: l.text }]));

const API = 'https://generativelanguage.googleapis.com/v1beta';
async function ttsModel(): Promise<string> {
  const r = (await (await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': KEY! } })).json()) as { models?: { name: string }[] };
  const names = (r.models ?? []).map((m) => m.name.replace(/^models\//, '')).filter((n) => /tts/i.test(n));
  if (!names.length) throw new Error('no text-to-speech model for this key');
  // the best acting first: pro over flash, newer versions first
  names.sort((a, b) => Number(/pro/.test(b)) - Number(/pro/.test(a)) || b.localeCompare(a));
  return names[0];
}

async function speak(model: string, voice: string, brief: string, act: string | undefined, text: string, out: string): Promise<number> {
  const how = act ? ` This time it is said ${act} (stage direction, in Japanese: 「${act}」).` : '';
  const prompt = `You are voicing a character in a Japanese anime adventure for children. ${brief}.${how} Speak only the Japanese line below, in character, naturally — do not read these instructions.\n\n${text.replace(/\n/g, ' ')}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY! },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
      signal: AbortSignal.timeout(120_000),
    });
    const j = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[]; error?: { message: string } };
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) {
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      throw new Error(`${res.status} ${j.error?.message ?? JSON.stringify(j).slice(0, 200)}`);
    }
    const rate = Number(part.inlineData!.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
    const raw = `${out}.pcm`;
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(raw, Buffer.from(part.inlineData!.data!, 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw, '-af', 'loudnorm=I=-18:TP=-1.5', '-b:a', '64k', out]);
    const seconds = (readFileSync(raw).length / 2 / rate);
    rmSync(raw);
    return seconds;
  }
  throw new Error('the voice service kept failing');
}

(async () => {
  const model = await ttsModel();
  const log: string[] = [];
  const redo = new Set(cfg.redo ?? []);
  // --- auditions ---
  const out = json<{ auditions: { name: string; line: string; takes: { voice: string; file: string; seconds: number }[] }[] }>(join(STORY, 'voices/auditions.json'), { auditions: [] });
  for (const a of cfg.auditions) {
    const id = idOf(a.name, 'c');
    // a line of their own: the longest plain one under 45 characters, else the brief's line
    const own = (said.get(a.name) ?? []).filter((l) => voiceable(l.text) && l.text.length >= 8 && l.text.length <= 45).sort((x, y) => y.text.length - x.text.length)[0];
    const line = a.line ?? own?.text ?? '';
    if (!line) {
      log.push(`- ❌ ${a.name}: 試しに読むセリフがない`);
      continue;
    }
    const prev = out.auditions.find((x) => x.name === a.name);
    const takes: { voice: string; file: string; seconds: number }[] = [];
    for (const [k, voice] of a.voices.entries()) {
      const file = `/story/voices/audition/${id}/${k + 1}-${voice}.mp3`;
      const old = prev?.takes.find((t) => t.file === file);
      if (old && prev?.line === line && !redo.has(a.name) && existsSync(join(ROOT, 'apps/web/public', file))) {
        takes.push(old);
        continue;
      }
      try {
        const seconds = await speak(model, voice, a.brief, a.line ? undefined : own?.act, line, join(ROOT, 'apps/web/public', file));
        takes.push({ voice, file, seconds });
        // far longer than the words: it may have read the direction too
        const suspect = seconds > line.length * 0.38 + 2.5;
        log.push(`- ${suspect ? '⚠️' : '✅'} ${a.name} ${k + 1}（${voice}）${seconds.toFixed(1)}秒${suspect ? ' — 長すぎ（指示まで読んだかも）' : ''}`);
      } catch (e) {
        log.push(`- ❌ ${a.name} ${k + 1}（${voice}）: ${String(e).slice(0, 200)}`);
      }
    }
    out.auditions = [...out.auditions.filter((x) => x.name !== a.name), { name: a.name, line, takes }];
  }
  out.auditions.sort((x, y) => cfg.auditions.findIndex((a) => a.name === x.name) - cfg.auditions.findIndex((a) => a.name === y.name));
  mkdirSync(join(STORY, 'voices'), { recursive: true });
  writeFileSync(join(STORY, 'voices/auditions.json'), JSON.stringify({ ...out, chosen: cfg.chosen, model }, null, 1));

  // --- the real lines of people whose voice is chosen ---
  const manifest = json<Record<string, string>>(join(STORY, 'voices/manifest.json'), {});
  let made = 0;
  let skipped = 0;
  for (const [name, voice] of Object.entries(cfg.chosen)) {
    const brief = cfg.direction?.[name] ?? cfg.auditions.find((a) => a.name === name)?.brief ?? '';
    for (const l of said.get(name) ?? []) {
      if (!voiceable(l.text)) {
        skipped++;
        continue;
      }
      const key = voiceKey(name, l.act, l.text);
      if (manifest[key] && existsSync(join(ROOT, 'apps/web/public', manifest[key]))) continue;
      if (made >= MAX) break;
      const file = `/story/voices/lines/${key}.mp3`;
      try {
        await speak(model, voice, brief, l.act, l.text, join(ROOT, 'apps/web/public', file));
        manifest[key] = file;
        made++;
      } catch (e) {
        log.push(`- ❌ ${name}「${l.text.slice(0, 20)}」: ${String(e).slice(0, 160)}`);
      }
    }
  }
  writeFileSync(join(STORY, 'voices/manifest.json'), JSON.stringify(manifest));
  const total = [...said.entries()].filter(([n]) => cfg.chosen[n]).reduce((a, [, ls]) => a + ls.filter((l) => voiceable(l.text)).length, 0);
  const report = [`# 物語の声 — ${new Date().toISOString()}`, '', `モデル: ${model}`, `声の候補: ${cfg.auditions.length}人 ／ 本番の声: ${Object.keys(cfg.chosen).length}人・${Object.keys(manifest).length}/${total}行（今回 ${made}行、名前の入る行 ${skipped}行は対象外）`, '', ...log, ''].join('\n');
  writeFileSync(join(ROOT, 'docs/story-import/voices-last-run.md'), report);
  console.log(report);
})();
