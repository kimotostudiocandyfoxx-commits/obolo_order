/**
 * MV lab (client request 2026-10-09): the story MV made exactly as the app makes it (storyboard →
 * scenes painted → edited on the beat), from a studio-lab song and a hero picture, then watched and
 * judged by Gemini (the finished video with its sound, next to the hero picture). Writes
 * art/lab/mv/<round>/: the MVs, a contact sheet of the scenes, report.md, results.json.
 *
 * Run (repo root): cd apps/api && npx tsx scripts/mv-lab.ts
 * env: GEMINI_API_KEY, NOVITA_API_KEY (Qwen fallback), MUSIC_URL + MUSIC_TOKEN (GPU painter), ROUND_FILE
 */
import { mkdtemp, readFile, rm, writeFile, copyFile, stat } from 'node:fs/promises';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { KeyArtist } from '../src/mv/keyart';
import { DepthModel } from '../src/mv/depth';
import { addParallax } from '../src/mv/parallax';
import { burnLyrics, renderMv } from '../src/mv/render';
import { describeHero, isHuman, planStory, storyToPlan } from '../src/mv/storyboard';
import { photoAnime, StyledPainter, twoLooks, type TwoLookPlan } from '../src/mv/styled';
import type { StoryPlan } from '../src/mv/storyboard';
import { Stylizer } from '../src/mv/stylize';

/** song: an id in the songs file, or "best:<case>" = its best-judged take; photos: a photos.json (photo MV) */
type Case = {
  id: string;
  song: string;
  mood?: string;
  photos?: string;
  /** photo MV: seedream = every photo by Seedream (~7 yen each), cheap = all Animagine img2img (~0.3 yen), mix = Seedream on `keys` chorus photos only, grid = four photos in one Seedream picture (~2 yen a scene) */
  photoMode?: 'seedream' | 'cheap' | 'mix' | 'grid';
  keys?: number;
  /** img2img strength for the cheap photos (0..1, higher = further from the photo) */
  strength?: number;
  /** override the round's parallax / lyrics for this case */
  parallax?: boolean;
  lyrics?: boolean;
  /** reuse the stills an earlier round saved (art/lab/mv/<round>/<id>-stills) instead of painting */
  stills?: string;
};
type Round = {
  round: string;
  note?: string;
  hero: string;
  /** studio-lab results.json the songs come from */
  songs: string;
  /** styled = the two-look MV (chibi verses on Runware Animagine, Seedream key visuals on the chorus) */
  painter: 'gpu' | 'qwen' | 'styled';
  maxScenes: number;
  side?: number;
  /** IP-Adapter strength for hero scenes (0 = tags only) */
  heroRef?: number;
  steps?: number;
  planModel?: string;
  /** stills move in 2.5D (depth + Gemini's camera moves); the lyrics are burnt on (the app's lyric effects) */
  parallax?: boolean;
  lyrics?: boolean;
  /** recipes to compare on every case (each overrides heroRef / steps) */
  variants?: { name: string; heroRef?: number; steps?: number }[];
  cases: Case[];
};

const ROOT = resolve(__dirname, '../../..');
const round = JSON.parse(readFileSync(resolve(ROOT, process.env.ROUND_FILE ?? 'scripts/mv-lab/round.json'), 'utf8')) as Round;
const OUT = join(ROOT, 'art/lab/mv', round.round);
mkdirSync(OUT, { recursive: true });
const GEMINI = process.env.GEMINI_API_KEY;
const depthModel = new DepthModel();
const PLAN_MODEL = round.planModel ?? 'gemini-flash-lite-latest';
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'gemini-flash-latest';
const gpu = round.painter === 'gpu' && process.env.MUSIC_URL ? process.env.MUSIC_URL : undefined;
const artist = new KeyArtist({
  paintUrl: gpu,
  paintToken: gpu ? async () => process.env.MUSIC_TOKEN : undefined,
  novitaKey: process.env.NOVITA_API_KEY || undefined,
  novitaModel: 'animagineXL40_v4Opt',
  novitaStrength: 0.5,
  novitaSide: round.side ?? 768,
  geminiModel: 'none',
  stylizer: new Stylizer(undefined),
});

const styled = round.painter === 'styled' && process.env.RUNWARE_API_KEY ? new StyledPainter({ key: process.env.RUNWARE_API_KEY, chibiModel: process.env.MV_CHIBI_MODEL || undefined }) : null;

type SongResult = { id: string; ok: boolean; file: string; seconds: number; lineTimes: { text: string; start: number; end: number }[]; sent: { bpm: number; prompt: string; lyrics?: { section: string; text: string }[] } };

async function judge(video: string, hero: Buffer, storyText: string, lyrics: string) {
  if (!GEMINI) return { error: 'no GEMINI_API_KEY' };
  const size = (await stat(video)).size;
  if (size > 18 * 1024 * 1024) return { error: `video too big to send (${size})` };
  const keys = ['heroLikeness', 'heroConsistency', 'pictureQuality', 'storyTelling', 'lyricFit', 'beatSync', 'variety', 'watchability', 'kidsSafe', 'overall'];
  const schema = {
    type: 'OBJECT',
    properties: Object.fromEntries(
      keys.map((k) => [k, { type: 'NUMBER' }] as [string, unknown]).concat([
        ['bestMoments', { type: 'ARRAY', items: { type: 'STRING' } }],
        ['problems', { type: 'ARRAY', items: { type: 'STRING' } }],
        ['fixIdeas', { type: 'ARRAY', items: { type: 'STRING' } }],
      ]),
    ),
    required: [...keys, 'problems', 'fixIdeas'],
  };
  const text = `You are a demanding anime music-video director reviewing an AI-made MV for a kids-friendly app.
The first picture is the creator's own character (the hero). Then comes the MV (with its song).
Score each 1-10 (10 = a fan-made MV people would rewatch and share, 5 = obviously generated slideshow, 1 = broken):
- heroLikeness: the hero in the MV looks like the reference character (silhouette, colours, mask/face, outfit).
- heroConsistency: the hero looks the same from scene to scene.
- pictureQuality: clean anime drawing, no deformed bodies/hands/faces, no garbage text.
- storyTelling: the scenes tell a story with a beginning, build-up and ending.
- lyricFit: the pictures match what is being sung.
- beatSync: cuts and motion land on the music; energy follows the song (calm verse, big chorus).
- variety: shot sizes, angles, places and colours vary in a good way.
- watchability: would a viewer keep watching to the end?
- kidsSafe: 10 = nothing scary/sexual/violent.
- overall.
Also bestMoments, problems (with mm:ss) and fixIdeas (what to change in the storyboard prompt, the painting prompt, the cut pacing or the effects).

${round.painter === 'styled' && !round.cases.some((c) => c.photos) ? 'Direction: the verses are DELIBERATELY drawn as cute chibi / crayon cuts and the chorus as full cinematic key visuals of the same character — judge whether this switch of look works as direction (like an anime opening going all-out on the chorus), not as an inconsistency.\n\n' : ''}Storyboard used:
${storyText}

Lyrics:
${lyrics}`;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: (await sharp(hero).resize(768, 768, { fit: 'inside' }).jpeg().toBuffer()).toString('base64') } },
              { inlineData: { mimeType: 'video/mp4', data: (await readFile(video)).toString('base64') } },
              { text },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (res.ok) {
      const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      try {
        return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '{}') as Record<string, unknown>;
      } catch {
        /* retry */
      }
    } else if (i === 2) return { error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { error: 'no answer' };
}

/** Which photos Seedream redraws: all, none, or `keys` of the chorus ones spread evenly. */
function seedreamPhotos(c: Case, story: StoryPlan, lyrics: { t: number; chorus: boolean }[]): number[] | undefined {
  const mode = c.photoMode ?? 'seedream';
  if (mode === 'seedream' || mode === 'grid') return undefined;
  if (mode === 'cheap') return [];
  const chorusAt = (t: number) => {
    let ch = false;
    for (const l of lyrics) if (l.t <= t + 0.01) ch = l.chorus;
    return ch;
  };
  let t = 0;
  const inChorus: number[] = [];
  story.scenes.forEach((sc, k) => {
    if (chorusAt(t + sc.dur / 2)) inChorus.push(k);
    t += sc.dur;
  });
  const n = Math.min(c.keys ?? 3, inChorus.length);
  return Array.from({ length: n }, (_, j) => inChorus[Math.floor(((j + 0.5) * inChorus.length) / n)]);
}

/** One scene per photo over the song, on whole beats; the chorus photos pulse (storyToPlan cuts them). */
function photoStory(photos: { caption: string }[], seconds: number, bpm: number, lyrics: { t: number; chorus: boolean }[]): StoryPlan {
  const beat = 60 / bpm;
  const each = Math.max(beat * 4, Math.round(seconds / photos.length / beat) * beat);
  let t = 0;
  const scenes = photos.map((p, k) => {
    const dur = k === photos.length - 1 ? Math.max(beat * 4, seconds - t) : Math.min(each, Math.max(beat, seconds - t - beat * 4 * (photos.length - k - 1)));
    t += dur;
    const chorus = lyrics.some((l) => l.chorus && l.t <= t - dur + 0.01);
    return { dur, tags: p.caption, hero: true, motion: (['zoom-in', 'pan-left', 'zoom-out', 'pan-right'] as const)[k % 4], effect: chorus && k % 3 === 0 ? ('SPEED_LINES' as const) : ('NONE' as const) };
  });
  return { note: '旅の写真をアニメにしたよ', style: 'anime film', scenes, lyrics: lyrics.map((l) => (l.chorus ? 'ZOOM_BURST' : 'MINIMAL_CHILL')) };
}

async function sheet(files: (Buffer | null)[], out: string) {
  const cell = 192;
  const cols = 6;
  const rows = Math.ceil(files.length / cols);
  const tiles = await Promise.all(
    files.map(async (b, k) => ({
      input: b ? await sharp(b).resize(cell, cell, { fit: 'cover' }).jpeg().toBuffer() : await sharp({ create: { width: cell, height: cell, channels: 3, background: '#400' } }).jpeg().toBuffer(),
      left: (k % cols) * cell,
      top: Math.floor(k / cols) * cell,
    })),
  );
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
}

async function main() {
  const songs = (JSON.parse(readFileSync(resolve(ROOT, round.songs), 'utf8')) as { results: SongResult[] }).results;
  const heroPic = readFileSync(resolve(ROOT, round.hero));
  const hero = await describeHero(heroPic, GEMINI, PLAN_MODEL);
  console.log(`hero tags: ${hero}`);
  const results: Record<string, unknown>[] = [];
  const toJudge: (() => Promise<unknown>)[] = [];
  for (const base of round.cases)
  for (const v of round.variants ?? [{ name: '' }]) {
    const c = { ...base, id: v.name ? `${base.id}~${v.name}` : base.id };
    const heroRef = v.heroRef ?? round.heroRef ?? 0.6;
    const steps = v.steps ?? round.steps;
    const s = c.song.startsWith('best:')
      ? songs
          .filter((x) => x.ok && x.id.split('~')[0] === c.song.slice(5))
          .sort((a, b) => (Number((b as { judge?: { overall?: number } }).judge?.overall) || 0) - (Number((a as { judge?: { overall?: number } }).judge?.overall) || 0))[0]
      : songs.find((x) => x.id === c.song && x.ok);
    if (s) console.log(`${c.id}: song ${s.id}`);
    if (!s) {
      results.push({ id: c.id, ok: false, error: `song ${c.song} not in ${round.songs}` });
      continue;
    }
    const dir = await mkdtemp(join(tmpdir(), 'mvlab-'));
    try {
      const t0 = Date.now();
      const seconds = Math.min(90, s.seconds);
      const bpm = s.sent.bpm;
      const lyrics = s.lineTimes.map((l, k) => ({ t: l.start, text: l.text, chorus: s.sent.lyrics?.[k]?.section === 'chorus' }));
      // photo MV: one scene per photo, in order, on the beats; otherwise Bati's storyboard
      const photoList = c.photos ? (JSON.parse(readFileSync(resolve(ROOT, c.photos), 'utf8')) as { photos: { file: string; caption: string }[] }).photos : null;
      const story = photoList
        ? photoStory(photoList, seconds, bpm, lyrics)
        : await planStory(
            { title: c.song, seconds, bpm, mood: c.mood ?? '', music: s.sent.prompt.slice(0, 300), lyrics, hero, maxScenes: round.maxScenes },
            GEMINI,
            PLAN_MODEL,
          );
      const t1 = Date.now();
      // the two-look MV: chorus scenes merge into the key visuals, the rest are chibi cuts
      const shown = round.painter === 'styled' && !photoList ? twoLooks(story, lyrics, 2) : story;
      const drawn = c.stills
        ? await Promise.all(story.scenes.map((_, k) => readFile(resolve(ROOT, c.stills!, `scene-${k}.jpg`)).catch(() => null)))
        : photoList
        ? await photoAnime(styled!, photoList.map((p) => ({ photo: readFileSync(resolve(ROOT, p.file)), caption: p.caption })), heroPic, {
            seedream: seedreamPhotos(c, story, lyrics),
            heroLook: hero,
            strength: c.strength,
            grid: c.photoMode === 'grid',
            seed: Math.floor(Math.random() * 2 ** 31),
          })
        : round.painter === 'styled'
          ? await styled!.paint((shown as TwoLookPlan).scenes, hero, heroPic, Math.floor(Math.random() * 2 ** 31))
          : await artist.paintAll(story.scenes, Math.floor(Math.random() * 2 ** 31), 6, {
              reference: heroRef === 0 ? null : heroPic,
              heroIsHuman: isHuman(hero),
              refScale: heroRef,
              steps,
            });
      const costYen = styled ? Math.round(styled.lastCostUsd * 150 * 10) / 10 : null;
      const t2 = Date.now();
      await sheet(drawn, join(OUT, `${c.id}-scenes.jpg`));
      // the stills, for a later round to reuse (no second paint bill)
      mkdirSync(join(OUT, `${c.id}-stills`), { recursive: true });
      await Promise.all(drawn.map((img, k) => (img ? sharp(img).jpeg({ quality: 90 }).toFile(join(OUT, `${c.id}-stills`, `scene-${k}.jpg`)) : null)));
      const pics = await Promise.all(
        drawn.map(async (img, k) => {
          if (!img) return null;
          const f = join(dir, `scene-${k}.jpg`);
          await sharp(img).jpeg({ quality: 92 }).toFile(f);
          return f;
        }),
      );
      const first = pics.find(Boolean);
      if (!first) throw new Error('no scene could be painted');
      const moves = (c.parallax ?? round.parallax) ? await addParallax(pics, shown.scenes.map((sc) => sc.tags), depthModel, { key: GEMINI, model: PLAN_MODEL }) : pics.map(() => null);
      if (c.parallax ?? round.parallax) console.log(`${c.id}: parallax ${moves.filter(Boolean).length}/${pics.length}: ${moves.map((m) => m?.move ?? '-').join(' ')}`);
      const materials = pics.map((f, k) => {
        const own = f ? k : pics.slice(0, k).reduce((a, x, j) => (x ? j : a), -1);
        const mv = own >= 0 ? moves[own] : null;
        return { kind: 'photo' as const, file: f ?? pics.slice(0, k).reverse().find(Boolean) ?? first, depth: mv?.depth ?? null, parallax: mv ?? null };
      });
      const audio = join(dir, 'song.m4a');
      await copyFile(join(ROOT, s.file), audio);
      const mvPlan = storyToPlan(shown, bpm, lyrics);
      const out = await renderMv({ dir, materials, plan: mvPlan, audio, seconds, bpm, keyArtist: artist, painted: true });
      if (c.lyrics ?? round.lyrics)
        out.video = await burnLyrics(
          dir,
          out.video,
          s.lineTimes.map((l, k) => ({ t: l.start, end: l.end, text: l.text, effect: mvPlan.lyrics[k] ?? 'MINIMAL_CHILL' })),
        );
      const t3 = Date.now();
      const video = join(OUT, `${c.id}.mp4`);
      await copyFile(out.video, video);
      const storyText = [`style: ${shown.style}`, ...shown.scenes.map((sc, k) => `${k + 1}. ${sc.dur.toFixed(1)}s ${sc.hero ? '[hero] ' : ''}${sc.motion}/${sc.effect}: ${sc.tags}`)].join('\n');
      await writeFile(join(OUT, `${c.id}-storyboard.txt`), storyText);
      // judged after every MV is made: judging takes minutes, and the GPU would end itself meanwhile
      // (each MV then paid a cold start — about 8 minutes of GPU)
      const lyricText = s.lineTimes.map((l) => `${l.start.toFixed(1)}s ${l.text}`).join('\n');
      const j: Record<string, unknown> = {};
      toJudge.push(async () => Object.assign(j, await judge(video, heroPic, storyText, lyricText)));
      const painted = drawn.filter(Boolean).length;
      results.push({
        id: c.id,
        ok: true,
        heroRef,
        song: c.song,
        scenes: shown.scenes.length,
        painted,
        costYen,
        seconds: { plan: Math.round((t1 - t0) / 1000), paint: Math.round((t2 - t1) / 1000), render: Math.round((t3 - t2) / 1000) },
        judge: j,
      });
      console.log(`${c.id}: ${painted}/${shown.scenes.length} painted${costYen !== null ? ` (${costYen} yen)` : ''} in ${Math.round((t2 - t1) / 1000)}s`);
    } catch (e) {
      results.push({ id: c.id, ok: false, error: String(e).slice(0, 300) });
      console.log(`${c.id}: FAILED ${String(e).slice(0, 300)}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  for (const go of toJudge) await go();
  const keys = ['overall', 'heroLikeness', 'heroConsistency', 'pictureQuality', 'storyTelling', 'lyricFit', 'beatSync', 'variety', 'watchability', 'kidsSafe'];
  const ok = results.filter((r) => r.ok) as { id: string; judge: Record<string, unknown>; scenes: number; painted: number; seconds: Record<string, number> }[];
  const avg = Object.fromEntries(keys.map((k) => [k, Math.round((ok.reduce((a, r) => a + (Number(r.judge[k]) || 0), 0) / Math.max(1, ok.length)) * 10) / 10]));
  const lines = [
    `# MV lab — ${round.round}`,
    '',
    round.note ?? '',
    '',
    `painter: ${round.painter} · scenes ≤ ${round.maxScenes} · side ${round.side ?? 768} · heroRef ${round.heroRef ?? 0.6} · steps ${round.steps ?? 28} · hero tags: ${hero}`,
    '',
    `**average**: ${keys.map((k) => `${k} ${avg[k]}`).join(' · ')}`,
    '',
    `| case | ${keys.join(' | ')} | painted | paint s | yen |`,
    `|---|${keys.map(() => '---').join('|')}|---|---|---|`,
    ...results.map((r) =>
      r.ok
        ? `| ${r.id} | ${keys.map((k) => (r as { judge: Record<string, unknown> }).judge[k] ?? '?').join(' | ')} | ${(r as { painted: number }).painted}/${(r as { scenes: number }).scenes} | ${(r as { seconds: Record<string, number> }).seconds.paint} | ${(r as { costYen?: number | null }).costYen ?? '-'} |`
        : `| ${r.id} | FAILED: ${r.error} |`,
    ),
    '',
    ...ok.flatMap((r) => [
      `## ${r.id}`,
      ...((r.judge.bestMoments as string[]) ?? []).map((p) => `- good: ${p}`),
      ...((r.judge.problems as string[]) ?? []).map((p) => `- problem: ${p}`),
      ...((r.judge.fixIdeas as string[]) ?? []).map((p) => `- idea: ${p}`),
      ...(r.judge.error ? [`- judge error: ${r.judge.error}`] : []),
      '',
    ]),
  ];
  await writeFile(join(OUT, 'report.md'), lines.join('\n'));
  await writeFile(join(OUT, 'results.json'), JSON.stringify({ round: round.round, hero, avg, results }, null, 2));
  console.log(lines.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
