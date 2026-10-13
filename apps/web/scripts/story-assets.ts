/**
 * What the story needs, and where each piece stands (client plan 2026-10-13): every person who speaks,
 * every place, sound effect and tune in the imported scenes, checked against
 *  - the story chat's sheets (docs/story-rewrite/cast.md, places.md: designed or not, the look, the voice)
 *  - what we already have (cast.ts sprites, onboarding backgrounds) and what was made later
 *    (public/story/cast/, places/), what the client sent (design/story/cast/<name>/, places/<name>/)
 *  - candidates painted for the client to pick (public/story/candidates/…) and the picks
 *    (design/story-picks.json)
 *
 * Writes public/story/assets.json (the asset preview page and the player read it), public/story/cast/
 * manifest.json (name → standing picture, aliases included) and docs/story-import/assets.md.
 *
 *   npx --yes tsx@4.19.2 apps/web/scripts/story-assets.ts [folder with cast.md / places.md]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, type Scene } from '../lib/story/parse';
import { CAST } from '../lib/story/cast';
import { castSheets, idOf, placeSheets, type CastSheet, type PlaceSheet } from '../lib/story/sheets';
import { PRESETS, presetFor } from '../lib/story/sfx';

const ROOT = resolve(__dirname, '../../..');
const PUB = join(ROOT, 'apps/web/public');
const STORY = join(PUB, 'story');
const sheetsDir = process.argv[2] ? resolve(process.argv[2]) : null;
const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const json = <T>(p: string, d: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : d);
const ls = (p: string) => (existsSync(p) ? readdirSync(p).filter((f) => !f.startsWith('.')) : []);
const IMG = /\.(png|jpe?g|webp)$/i;

// the scenes as imported
const idx = json<{ parts: string[] }>(join(STORY, 'index.json'), { parts: [] });
const scenes: Scene[] = idx.parts.flatMap((p) => json<Scene[]>(join(STORY, `${p}.json`), []));
const r = check(scenes, CAST.map((c) => c.name));
const uses = new Map<string, number>(r.unknownSpeakers);
for (const s of scenes)
  for (const l of JSON.stringify(s.lines).matchAll(/"k":"say","who":"([^"]+)"/g)) if (CAST.some((c) => c.name === l[1])) uses.set(l[1], (uses.get(l[1]) ?? 0) + 1);

const castSheet: CastSheet[] = sheetsDir ? castSheets(read(join(sheetsDir, 'cast.md'))) : [];
const placeSheet: PlaceSheet[] = sheetsDir ? placeSheets(read(join(sheetsDir, 'places.md'))) : [];
const picks = json<{ cast?: Record<string, string>; places?: Record<string, string> }>(join(ROOT, 'design/story-picks.json'), {});

type Status = 'ready' | 'arrived' | 'waiting' | 'candidates' | 'orderable' | 'needs-sheet';
const STATUS_JA: Record<Status, string> = {
  ready: '✅ 絵あり',
  arrived: '📦 届いた（取り込み待ち）',
  waiting: '📥 クライアントの絵待ち',
  candidates: '🎨 候補あり（選んでもらう）',
  orderable: '⬜ 描ける（人物表あり）',
  'needs-sheet': '⬜ 人物表の見た目待ち',
};

// --- people --------------------------------------------------------------------------------------
const aliasOf = new Map<string, string>();
for (const s of castSheet) for (const a of s.aliases) aliasOf.set(a, s.name);
const names = new Set<string>([...castSheet.map((s) => s.name), ...[...uses.keys()].filter((n) => !aliasOf.has(n))]);
const spriteManifest: Record<string, string> = {};
const cast = [...names].map((name) => {
  const sheet = castSheet.find((s) => s.name === name);
  const id = sheet?.id ?? idOf(name, 'c');
  const aliases = sheet?.aliases ?? [];
  const known = CAST.find((c) => c.name === name)?.sprite;
  const made = existsSync(join(STORY, 'cast', `${id}.webp`)) ? `/story/cast/${id}.webp` : null;
  const sprite = known && !known.startsWith('@') ? `/onboarding/${known}.webp` : made;
  const client = ls(join(ROOT, 'design/story/cast', name)).filter((f) => IMG.test(f));
  const candidates = ls(join(STORY, 'candidates/cast', id)).filter((f) => /\.jpg$/.test(f)).sort().map((f) => `/story/candidates/cast/${id}/${f}`);
  const status: Status = sprite || known?.startsWith('@') ? 'ready' : client.length ? 'arrived' : sheet?.designed ? 'waiting' : candidates.length ? 'candidates' : sheet?.look ? 'orderable' : 'needs-sheet';
  if (sprite) for (const n of [name, ...aliases]) spriteManifest[n] = sprite;
  const n = [name, ...aliases].reduce((a, k) => a + (uses.get(k) ?? 0), 0);
  return { name, id, uses: n, aliases, status, sprite, client, candidates, pick: picks.cast?.[name] ?? null, sheet: sheet ?? null };
});
cast.sort((a, b) => (a.status === 'ready' ? 1 : 0) - (b.status === 'ready' ? 1 : 0) || b.uses - a.uses);

// --- places --------------------------------------------------------------------------------------
const placeNames = new Set<string>([...placeSheet.map((p) => p.name), ...r.backgrounds.keys()]);
const places = [...placeNames].map((name) => {
  const sheet = placeSheet.find((p) => p.name === name);
  const id = sheet?.id ?? idOf(name, 'p');
  const image = existsSync(join(STORY, 'places', `${id}.jpg`)) ? `/story/places/${id}.jpg` : existsSync(join(PUB, 'onboarding', `${name}.jpg`)) ? `/onboarding/${name}.jpg` : null;
  const client = ls(join(ROOT, 'design/story/places', name)).filter((f) => IMG.test(f));
  const candidates = ls(join(STORY, 'candidates/places', id)).filter((f) => /\.jpg$/.test(f)).sort().map((f) => `/story/candidates/places/${id}/${f}`);
  const status: Status = image ? 'ready' : client.length ? 'arrived' : sheet?.drawn ? 'waiting' : candidates.length ? 'candidates' : sheet?.look ? 'orderable' : 'needs-sheet';
  return { name, id, scenes: r.backgrounds.get(name) ?? [], status, image, client, candidates, pick: picks.places?.[name] ?? null, sheet: sheet ?? null };
});

// --- sounds and tunes ----------------------------------------------------------------------------
// design/story-sounds.json: { "se": { "<SE text>": "/story/sound/x.mp3" | "<preset>" | "none" }, "bgm": { "<name>": "/story/sound/y.mp3" } }
// an SE with no entry gets a synthesised preset when its words suggest one (lib/story/sfx.ts)
const soundCfg = json<{ se?: Record<string, string>; bgm?: Record<string, string> }>(join(ROOT, 'design/story-sounds.json'), {});
const seOf = (text: string): { file: string | null; preset: string | null } => {
  const v = soundCfg.se?.[text];
  if (v === 'none') return { file: null, preset: null };
  if (v && (PRESETS as readonly string[]).includes(v)) return { file: null, preset: v };
  if (v) return { file: v, preset: null };
  return { file: null, preset: presetFor(text) };
};
const sounds = [...r.sounds].map(([text, sc]) => ({ text, scenes: sc, ...seOf(text) }));
const music = [...r.music].map(([name, sc]) => ({ name, scenes: sc, file: soundCfg.bgm?.[name] ?? null }));
mkdirSync(join(STORY, 'sound'), { recursive: true });
writeFileSync(
  join(STORY, 'sound/manifest.json'),
  JSON.stringify({
    se: Object.fromEntries(sounds.filter((s) => s.file || s.preset).map((s) => [s.text, s.file ?? `synth:${s.preset}`])),
    bgm: Object.fromEntries(music.filter((m) => m.file).map((m) => [m.name, m.file])),
  }),
);

mkdirSync(join(STORY, 'cast'), { recursive: true });
writeFileSync(join(STORY, 'assets.json'), JSON.stringify({ made: new Date().toISOString(), sheets: { cast: castSheet.length, places: placeSheet.length }, cast, places, sounds, music }, null, 1));
writeFileSync(join(STORY, 'cast/manifest.json'), JSON.stringify(spriteManifest, null, 1));

const count = <T extends { status: Status }>(xs: T[]) => (Object.keys(STATUS_JA) as Status[]).map((s) => [s, xs.filter((x) => x.status === s).length] as const).filter(([, n]) => n);
const md = [
  '# 物語の素材（人物・場所・効果音・BGM）',
  '',
  `人物表: ${castSheet.length ? `${castSheet.length}人分` : '**まだ届いていない**（docs/story-rewrite/cast.md）'} ／ 場所表: ${placeSheet.length ? `${placeSheet.length}か所` : '**まだ届いていない**（places.md）'}`,
  '',
  `- 人物 ${cast.length}人：${count(cast).map(([s, n]) => `${STATUS_JA[s]} ${n}`).join('／')}`,
  `- 場所 ${places.length}か所：${count(places).map(([s, n]) => `${STATUS_JA[s]} ${n}`).join('／')}`,
  `- 効果音 ${sounds.length}種（音のファイル ${sounds.filter((s) => s.file).length}・合成で鳴らす ${sounds.filter((s) => s.preset).length}・本物の音が必要 ${sounds.filter((s) => !s.file && !s.preset).length}）／ BGM ${music.length}曲（音あり ${music.filter((m) => m.file).length}）`,
  '',
  '一覧と候補の見比べ：`/preview/story-assets`',
  '',
  '## 人物',
  '',
  '| 名前 | セリフ数 | 状態 | 別の呼び方 |',
  '|---|---|---|---|',
  ...cast.map((c) => `| ${c.name} | ${c.uses} | ${STATUS_JA[c.status]} | ${c.aliases.join('、')} |`),
  '',
  '## 場所',
  '',
  '| 名前 | 状態 | 出てくる場面 |',
  '|---|---|---|',
  ...places.map((p) => `| ${p.name} | ${STATUS_JA[p.status]} | ${p.scenes.slice(0, 6).join('、')}${p.scenes.length > 6 ? '…' : ''} |`),
  '',
  '## 効果音（〔SE：…〕）',
  '',
  ...(sounds.length ? sounds.map((s) => `- ${s.file ? '🔊' : s.preset ? `🎹 ${s.preset}` : '⬜ 本物の音が必要'} ${s.text}（${s.scenes.join('、')}）`) : ['（台本にまだない）']),
  '',
  '## BGM（〔BGM：…〕）',
  '',
  ...(music.length ? music.map((m) => `- ${m.file ? '🔊' : '⬜'} ${m.name}（${m.scenes.join('、')}）`) : ['（台本にまだない）']),
  '',
].join('\n');
writeFileSync(join(ROOT, 'docs/story-import/assets.md'), md);
console.log(md.split('\n').slice(0, 9).join('\n'));
