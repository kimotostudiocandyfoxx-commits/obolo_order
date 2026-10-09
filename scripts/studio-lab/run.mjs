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
import { spawnSync } from 'node:child_process';
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

/** The same as apps/api/src/compose/song.service.ts vocalWords (keep in step). */
function vocalWords(genre, instrumentalPrompt = '') {
  const g = `${genre} ${instrumentalPrompt}`.toLowerCase();
  if (/hip ?hop|rap|trap/.test(g)) return 'japanese rap vocal, rhythmic flow, clear diction, every word pronounced';
  if (/kids|children|nursery/.test(g)) return 'bright cheerful japanese vocal, simple sing-along melody, clear diction';
  if (/ballad/.test(g)) return 'emotional japanese vocal, smooth legato, clear lead singer';
  if (/rock|punk|metal/.test(g)) return 'powerful japanese rock vocal, clear lead singer';
  return 'catchy japanese pop vocal, clear lead singer, expressive singing';
}

/** The same words the API adds (songPrompt) unless the round overrides them. */
function songPrompt(instrumentalPrompt, genre = '') {
  const base = instrumentalPrompt
    .replace(/\s*,?\s*(no vocals?|instrumental( only)?|without vocals?)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base}, ${round.vocalWords ?? vocalWords(genre, base)}`.slice(0, 500);
}

function songPromptWith(p, words) {
  const base = p.replace(/\s*,?\s*(no vocals?|instrumental( only)?|without vocals?)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
  return `${base}, ${words}`.slice(0, 500);
}

async function makeSong(c, v) {
  const body = {
    prompt: v.vocalWords ? songPromptWith(c.prompt, v.vocalWords) : songPrompt(c.prompt, c.genre ?? ''),
    lyrics: c.sections.flatMap((s) => s.lines.map((text) => ({ section: s.name, text }))),
    seconds: Math.round((c.seconds + ((v.extraBars ?? 0) * 240) / c.bpm) * 10) / 10,
    bpm: c.bpm,
    keyRoot: c.keyRoot ?? 0,
    scale: c.scale ?? 'major',
    language: 'ja',
    ...(c.voice && voice && v.voice !== false ? { voice, similarity: c.similarity ?? 0.7 } : {}),
    ...(round.tune ?? {}),
    ...(v.tune ?? {}),
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
  // ffmpeg writes its measurements to stderr
  const run = (args) => {
    const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return `${r.stdout ?? ''}${r.stderr ?? ''}`;
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

async function judge(c, mixB64, style, before) {
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
              ...(before ? [{ text: 'BEFORE (the original song the member liked):' }, { inlineData: { mimeType: 'audio/mp4', data: before } }, { text: 'AFTER (the longer version, judge THIS one):' }] : []),
              { inlineData: { mimeType: 'audio/mp4', data: mixB64 } },
              { text: `${RUBRIC}\n\nRequested style (a song WITH vocals): ${style}\nTempo ${c.bpm} BPM.\n\nExpected lyrics:\n${lyrics}` },
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

// the round may need what a GPU deploy is still bringing (round.needs: paths in the service's API)
for (const need of round.needs ?? []) {
  const until = Date.now() + 75 * 60_000;
  for (;;) {
    const api = await fetch(`${MUSIC_URL}/openapi.json`, { headers: { authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(600_000) })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '');
    if (api.includes(need)) break;
    if (Date.now() > until) throw new Error(`the GPU studio still has no ${need}`);
    console.log(`waiting for the GPU deploy (${need})`);
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

const results = [];
const variants = round.variants ?? [{ name: '' }];
for (const base of round.cases)
  for (const v of variants) {
  // a variant can be only for the songs with a voice (onlyVoiced), e.g. the same song without the voice change
  if (v.onlyVoiced && !base.voice) continue;
  const c = { ...base, id: v.name ? `${base.id}~${v.name}` : base.id };
  console.log(`== ${c.id}`);
  try {
    const made = await makeSong(c, v);
    const mix = join(OUT, `${c.id}.m4a`);
    writeFileSync(mix, Buffer.from(made.mix, 'base64'));
    if (round.keepStems) writeFileSync(join(OUT, `${c.id}-vocals.m4a`), Buffer.from(made.vocals, 'base64'));
    const m = measure(mix);
    const j = await judge(c, made.mix, made.sent.prompt);
    results.push({ id: c.id, variant: v.name, ok: true, takes: made.takes, file: mix, lineTimes: made.lines ?? [], seconds: made.seconds, voiced: made.voiced, voiceNote: made.voiceNote, timings: made.timings, wall: made.wall, lines: made.lines?.length ?? 0, ...m, judge: j, sent: { ...made.sent, voice: made.sent.voice ? '(sample)' : undefined } });
    console.log(`${c.id}: overall ${j.overall ?? '?'} (${made.wall}s)`);
    // the same take before the voice change: the studio's own vocal on the instrumental
    if (made.voiced && round.judgeStudioVoice) {
      const inst = join(OUT, '_inst.m4a');
      const guide = join(OUT, '_guide.m4a');
      writeFileSync(inst, Buffer.from(made.instrumental, 'base64'));
      writeFileSync(guide, Buffer.from(made.guide, 'base64'));
      const studio = join(OUT, `${c.id}@studio.m4a`);
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inst, '-i', guide, '-filter_complex', '[0:a][1:a]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=false[o]', '-map', '[o]', '-c:a', 'aac', '-b:a', '160k', studio]);
      for (const f of [inst, guide]) spawnSync('rm', ['-f', f]);
      const js = await judge(c, readFileSync(studio).toString('base64'), made.sent.prompt);
      results.push({ id: `${c.id}@studio`, variant: 'studio-voice', ok: true, file: studio, lineTimes: made.lines ?? [], seconds: made.seconds, voiced: false, voiceNote: 'same take, studio voice', timings: made.timings, wall: made.wall, lines: made.lines?.length ?? 0, ...measure(studio), judge: js });
      console.log(`${c.id}@studio: overall ${js.overall ?? '?'}`);
    }
  } catch (e) {
    results.push({ id: c.id, variant: v.name, ok: false, error: String(e).slice(0, 300) });
    console.log(`${c.id}: FAILED ${String(e).slice(0, 200)}`);
  }
  }

// extensions (2番 / 大サビ / longer): the finished song made longer by POST /extend, judged with all its lyrics
for (const x of round.extend ?? []) {
  const from = results.find((r) => r.ok && r.id.split('~')[0] === x.of && (!x.variant || r.variant === x.variant));
  const base = round.cases.find((c) => c.id === x.of);
  const id = `${x.of}+${x.name}${x.mode === 'regen' ? '~regen' : ''}`;
  console.log(`== ${id}`);
  if (!from || !base) {
    results.push({ id, variant: 'extend', ok: false, error: `no finished ${x.of} to extend` });
    continue;
  }
  try {
    const last = from.lineTimes.at(-1);
    // keep up to just after the last sung line (before the original fade-out)
    const keep = Math.min(from.seconds - 1.5, last ? last.end + 1.0 : from.seconds - 3);
    const c = { ...base, id, sections: [...base.sections, ...x.sections] };
    const body = {
      ...from.sent,
      voice: from.sent.voice ? voice : undefined,
      lyrics: c.sections.flatMap((s) => s.lines.map((text) => ({ section: s.name, text }))),
      seconds: x.seconds,
      ...(x.mode === 'regen' ? {} : { src: readFileSync(from.file).toString('base64'), keep }),
    };
    const t0 = Date.now();
    // repaint: the original kept, the rest sung after it; regen: the whole longer song again with the same seed
    const res = await fetch(`${MUSIC_URL}/${x.mode === 'regen' ? 'song' : 'extend'}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(900_000) });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    const made = await res.json();
    const mix = join(OUT, `${id}.m4a`);
    writeFileSync(mix, Buffer.from(made.mix, 'base64'));
    const m = measure(mix);
    const j = await judge(
      c,
      made.mix,
      x.mode === 'regen'
        ? `${body.prompt}. This longer version was made again from scratch with the added lyrics: also judge whether its first part still sounds like the BEFORE song (same melody, singer, arrangement) and whether the added part fits.`
        : `${body.prompt}. The first ${keep.toFixed(0)} s are the BEFORE song, kept as it was; the rest was added (2nd verse / big chorus): also judge whether the join is seamless and the new part sounds like the same song and singer.`,
      readFileSync(from.file).toString('base64'),
    );
    results.push({ id, variant: 'extend', ok: true, file: mix, lineTimes: made.lines ?? [], seconds: made.seconds, voiced: made.voiced, voiceNote: made.voiceNote, timings: made.timings, wall: Math.round((Date.now() - t0) / 1000), lines: made.lines?.length ?? 0, keep, ...m, judge: j });
    console.log(`${id}: overall ${j.overall ?? '?'}`);
  } catch (e) {
    results.push({ id, variant: 'extend', ok: false, error: String(e).slice(0, 300) });
    console.log(`${id}: FAILED ${String(e).slice(0, 200)}`);
  }
}

const keys = ['overall', 'vocalNaturalness', 'pitch', 'diction', 'melody', 'arrangement', 'mix', 'genreFit', 'artifacts'];
const avg = Object.fromEntries(keys.map((k) => [k, Math.round((results.filter((r) => r.ok && typeof r.judge?.[k] === 'number').reduce((a, r) => a + r.judge[k], 0) / Math.max(1, results.filter((r) => r.ok && typeof r.judge?.[k] === 'number').length)) * 10) / 10]));
const avgOf = (rs) => Object.fromEntries(keys.map((k) => [k, Math.round((rs.filter((r) => r.ok && typeof r.judge?.[k] === 'number').reduce((a, r) => a + r.judge[k], 0) / Math.max(1, rs.filter((r) => r.ok && typeof r.judge?.[k] === 'number').length)) * 10) / 10]));
const byVariant = variants.map((v) => ({ name: v.name || '(one recipe)', v, avg: avgOf(results.filter((r) => r.variant === v.name)) }));
const lines = [
  `# Studio lab — ${round.round}`,
  '',
  ...byVariant.map((b) => `- **${b.name}** ${JSON.stringify({ tune: b.v.tune ?? {}, words: b.v.vocalWords ?? undefined })}: ${keys.map((k) => `${k} ${b.avg[k]}`).join(' · ')}`),
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
      `- voice: ${r.voiceNote} · timings ${JSON.stringify(r.timings)} · ${r.lines} line times${r.takes?.length ? ` · takes heard ${r.takes.map((t) => t.score).join(' / ')}` : ''}`,
      ...(r.judge.problems ?? []).map((p) => `- problem: ${p}`),
      ...(r.judge.fixIdeas ?? []).map((p) => `- idea: ${p}`),
      ...(r.judge.error ? [`- judge error: ${r.judge.error}`] : []),
      '',
    ]),
];
writeFileSync(join(OUT, 'report.md'), lines.join('\n'));
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ round: round.round, avg, byVariant: byVariant.map((b) => ({ name: b.name, avg: b.avg })), results }, null, 2));
console.log(lines.join('\n'));
