#!/usr/bin/env node
/**
 * Studio lab (client request 2026-10-09): make the round's test songs on the real GPU studio
 * (obolo-music POST /song, the same request the app sends), then have each one judged by ear
 * (Gemini, audio in) and measured (loudness, peaks, silence). Writes art/lab/studio/<round>/:
 * the mixes, report.md, results.json. Claude reads the report, changes the recipe, runs again.
 *
 * env: MUSIC_URL, MUSIC_TOKEN (ID token for the private GPU service), GEMINI_API_KEY,
 *      ROUND_FILE (default scripts/studio-lab/round.json), JUDGE_MODEL
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MUSIC_URL = (process.env.MUSIC_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.MUSIC_TOKEN;
const GEMINI = process.env.GEMINI_API_KEY;
const JUDGE = process.env.JUDGE_MODEL ?? 'gemini-flash-latest';
const round = JSON.parse(readFileSync(process.env.ROUND_FILE ?? 'scripts/studio-lab/round.json', 'utf8'));
const OUT = join('art/lab/studio', round.round);
mkdirSync(OUT, { recursive: true });
const voice = existsSync('art/lab/voice/2-reference.m4a') ? readFileSync('art/lab/voice/2-reference.m4a').toString('base64') : null;

/** The same words the API adds (apps/api/src/compose/song.service.ts songPrompt) unless the round overrides it. */
function songPrompt(instrumentalPrompt) {
  const base = instrumentalPrompt
    .replace(/\s*,?\s*(no vocals?|instrumental( only)?|without vocals?)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base}, ${round.vocalWords ?? 'catchy japanese pop vocal, clear lead singer, expressive singing'}`.slice(0, 500);
}

async function makeSong(c) {
  const body = {
    prompt: songPrompt(c.prompt),
    lyrics: c.sections.flatMap((s) => s.lines.map((text) => ({ section: s.name, text }))),
    seconds: c.seconds,
    bpm: c.bpm,
    keyRoot: c.keyRoot ?? 0,
    scale: c.scale ?? 'major',
    language: 'ja',
    ...(c.voice && voice ? { voice, similarity: c.similarity ?? 0.7 } : {}),
    ...(round.tune ?? {}),
    ...(c.tune ?? {}),
  };
  const until = Date.now() + 20 * 60_000;
  for (;;) {
    const t0 = Date.now();
    const res = await fetch(`${MUSIC_URL}/song`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(900_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (res.ok) return { ...(await res.json()), wall: Math.round((Date.now() - t0) / 1000), sent: body };
    const text = (await res.text()).slice(0, 300);
    // waking up (503) or busy with someone else's song (429): wait and try again
    if ((res.status === 503 || res.status === 429 || res.status === 0) && Date.now() < until) {
      console.log(`${c.id}: ${res.status} ${text.slice(0, 80)} — waiting`);
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    throw new Error(`${res.status} ${text}`);
  }
}

function measure(file) {
  const run = (args) => {
    try {
      return execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    } catch (e) {
      return String(e.stderr ?? '');
    }
  };
  const loud = run(['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(loud.split('Summary:').pop() ?? '')?.[1]);
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(loud.split('Summary:').pop() ?? '')?.[1]);
  const sil = run(['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=n=-45dB:d=1.5', '-f', 'null', '-']);
  const silence = [...sil.matchAll(/silence_duration: ([\d.]+)/g)].reduce((a, m) => a + Number(m[1]), 0);
  return { lufs: I, truePeak: peak, silenceSec: Math.round(silence * 10) / 10 };
}

const RUBRIC = `You are a strict music producer judging an AI-made Japanese song for a kids-friendly music app.
The expected lyrics (Japanese) are below. Listen to the whole track.
Score each 1-10 (10 = release quality on a streaming service, 5 = clearly amateur/AI, 1 = broken):
- vocalNaturalness: does the singer sound like a real, pleasant human singer (no robotic/metallic/warbly artifacts)?
- pitch: is the singing in tune and stable?
- diction: can a Japanese listener understand the words? (compare with the expected lyrics)
- melody: is the vocal melody catchy and musical (not monotone, not random)?
- arrangement: instruments, groove, structure, intro/chorus build, ending.
- mix: balance vocal vs band, clarity, no clipping/mud, loud enough.
- genreFit: does it match the requested style?
- artifacts: 10 = no glitches/noise/dropouts/garbled parts at all.
Also: overall (1-10), heard: the Japanese words you actually hear (hiragana, short), problems: concrete list with timestamps (mm:ss), fixIdeas: what to change in the generation recipe.`;

async function judge(c, mixB64) {
  if (!GEMINI) return { error: 'no GEMINI_API_KEY' };
  const lyrics = c.sections.map((s) => `[${s.name}]\n${s.lines.join('\n')}`).join('\n\n');
  const schema = {
    type: 'OBJECT',
    properties: Object.fromEntries(
      ['vocalNaturalness', 'pitch', 'diction', 'melody', 'arrangement', 'mix', 'genreFit', 'artifacts', 'overall'].map((k) => [k, { type: 'NUMBER' }]).concat([
        ['heard', { type: 'STRING' }],
        ['problems', { type: 'ARRAY', items: { type: 'STRING' } }],
        ['fixIdeas', { type: 'ARRAY', items: { type: 'STRING' } }],
      ]),
    ),
    required: ['vocalNaturalness', 'pitch', 'diction', 'melody', 'arrangement', 'mix', 'genreFit', 'artifacts', 'overall', 'problems', 'fixIdeas'],
  };
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'audio/mp4', data: mixB64 } },
              { text: `${RUBRIC}\n\nRequested style: ${c.prompt}\nTempo ${c.bpm} BPM.\n\nExpected lyrics:\n${lyrics}` },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (res.ok) {
      const j = await res.json();
      try {
        return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '{}');
      } catch {
        /* retry */
      }
    } else if (i === 2) return { error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { error: 'no answer' };
}

const results = [];
for (const c of round.cases) {
  console.log(`== ${c.id}`);
  try {
    const made = await makeSong(c);
    const mix = join(OUT, `${c.id}.m4a`);
    writeFileSync(mix, Buffer.from(made.mix, 'base64'));
    if (round.keepStems) writeFileSync(join(OUT, `${c.id}-vocals.m4a`), Buffer.from(made.vocals, 'base64'));
    const m = measure(mix);
    const j = await judge(c, made.mix);
    results.push({ id: c.id, ok: true, voiced: made.voiced, voiceNote: made.voiceNote, timings: made.timings, wall: made.wall, lines: made.lines?.length ?? 0, ...m, judge: j, sent: { ...made.sent, voice: made.sent.voice ? '(sample)' : undefined } });
    console.log(`${c.id}: overall ${j.overall ?? '?'} (${made.wall}s)`);
  } catch (e) {
    results.push({ id: c.id, ok: false, error: String(e).slice(0, 300) });
    console.log(`${c.id}: FAILED ${String(e).slice(0, 200)}`);
  }
}

const keys = ['overall', 'vocalNaturalness', 'pitch', 'diction', 'melody', 'arrangement', 'mix', 'genreFit', 'artifacts'];
const avg = Object.fromEntries(keys.map((k) => [k, Math.round((results.filter((r) => r.ok && typeof r.judge?.[k] === 'number').reduce((a, r) => a + r.judge[k], 0) / Math.max(1, results.filter((r) => r.ok && typeof r.judge?.[k] === 'number').length)) * 10) / 10]));
const lines = [
  `# Studio lab — ${round.round}`,
  '',
  round.note ? `${round.note}\n` : '',
  `recipe: ${JSON.stringify(round.tune ?? {})} / vocal words: ${round.vocalWords ?? '(app default)'}`,
  '',
  `**average**: ${keys.map((k) => `${k} ${avg[k]}`).join(' · ')}`,
  '',
  '| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...results.map((r) =>
    r.ok
      ? `| ${r.id} | ${r.judge.overall ?? '?'} | ${r.judge.vocalNaturalness ?? '?'} | ${r.judge.pitch ?? '?'} | ${r.judge.diction ?? '?'} | ${r.judge.melody ?? '?'} | ${r.judge.arrangement ?? '?'} | ${r.judge.mix ?? '?'} | ${r.judge.genreFit ?? '?'} | ${r.judge.artifacts ?? '?'} | ${r.lufs} | ${r.truePeak} | ${r.silenceSec}s | ${r.voiced ? 'yes' : 'no'} | ${r.wall}s |`
      : `| ${r.id} | FAILED: ${r.error} |`,
  ),
  '',
  ...results
    .filter((r) => r.ok)
    .flatMap((r) => [
      `## ${r.id}`,
      `- heard: ${r.judge.heard ?? ''}`,
      `- voice: ${r.voiceNote} · timings ${JSON.stringify(r.timings)} · ${r.lines} line times`,
      ...(r.judge.problems ?? []).map((p) => `- problem: ${p}`),
      ...(r.judge.fixIdeas ?? []).map((p) => `- idea: ${p}`),
      ...(r.judge.error ? [`- judge error: ${r.judge.error}`] : []),
      '',
    ]),
];
writeFileSync(join(OUT, 'report.md'), lines.join('\n'));
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ round: round.round, avg, results }, null, 2));
console.log(lines.join('\n'));
