/**
 * Story sync check (2026-11-21): every character line the app plays (lib/onboarding/dayN.ts) must be the script's
 * line, word for word (public/story/*.json, imported from the story chat's branch). Lists, per day, the script lines
 * the app does not play and the app lines the script does not have.
 *   npx --yes tsx@4.19.2 apps/web/scripts/story-sync.ts   → docs/story-import/sync.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { walk, type Scene } from '../lib/story/parse';
import { STORIES } from '../lib/onboarding/stories';
import { SCENE_DAY } from '../lib/onboarding/sceneDays';
import { AFTER_DAYS } from '../lib/onboarding/after';

const ROOT = resolve(__dirname, '../../..');
const PUB = join(ROOT, 'apps/web/public/story');
const idx = JSON.parse(readFileSync(join(PUB, 'index.json'), 'utf8')) as { parts: string[] };
const scenes: Scene[] = idx.parts.flatMap((p) => JSON.parse(readFileSync(join(PUB, `${p}.json`), 'utf8')) as Scene[]);

type L = { who: string; text: string; scene?: string };
const norm = (t: string) => t.replace(/\s+/g, '').replace(/[／/]/g, '');

/** the planet practices keep their lines in their own beat lists (who: 'kaiser' …): read those too, for their day */
const LESSONS: Record<number, string> = {
  3: 'components/saturn/SaturnLesson.tsx',
  4: 'components/jupiter/JupiterLesson.tsx',
  5: 'components/mercury/MercuryLesson.tsx',
  6: 'components/mars/MarsLesson.tsx',
  7: 'components/venus/VenusLesson.tsx',
};
const WHO: Record<string, string> = {
  kaiser: '大根カイザー',
  kimorin: 'KIMORIN',
  pinpon: 'うんちピンポンくん',
  bati: 'バティ',
  freezy: 'フリージー',
  hipokin: 'ヒポキン',
  bossg: 'ボスG',
  hatg: 'ハットG',
  longg: 'ロングG',
  brother: 'たこ焼きブラザー',
  sister: 'たこ焼きシスター',
};
function lessonLines(day: number): L[] {
  const f = LESSONS[day];
  if (!f) return [];
  const src = readFileSync(join(ROOT, 'apps/web', f), 'utf8');
  const out: L[] = [];
  for (const m of src.matchAll(/who:\s*'(\w+)',\s*text:\s*'((?:[^'\\]|\\.)*)'/g)) {
    const who = WHO[m[1]];
    if (who) out.push({ who, text: m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'") });
  }
  return out;
}

const out: string[] = ['# 台本と画面の台詞の照合', '', `台本：public/story（${idx.parts.join('・')}）／画面：lib/onboarding/dayN.ts・after.ts と各星の練習（SaturnLesson など）の台詞`, ''];
let total = 0;
// SYS-S002's last line (KIMORIN back from his mother) plays on whichever day he appears next (lib/onboarding/kimorinBack.ts)
const ANY_DAY = new Set(['KIMORIN|' + norm('……母に言いましたが、聞く耳を持ちません。調査は、続けます。')]);

/** the `say` steps anywhere in a step list (branches and labels included) */
function sayLines(steps: unknown): L[] {
  const app: L[] = [];
  const visit = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(visit);
    const o = x as Record<string, unknown>;
    if (o.t === 'say' && typeof o.who === 'string' && typeof o.text === 'string') app.push({ who: o.who, text: o.text });
    Object.values(o).forEach(visit);
  };
  visit(steps);
  return app;
}

/** one section: the script's lines of the scenes `inSection` picks against the app's lines */
function section(title: string, inSection: (id: string) => boolean, app: L[]) {
  const script: L[] = [];
  for (const s of scenes) {
    if (!inSection(s.id)) continue;
    walk(s.lines, (l) => {
      if (l.k === 'say') script.push({ who: l.who, text: l.text, scene: s.id });
    });
  }
  const key = (l: L) => `${l.who}|${norm(l.text)}`;
  const appKeys = new Map<string, number>();
  for (const l of app) appKeys.set(key(l), (appKeys.get(key(l)) ?? 0) + 1);
  const scriptKeys = new Map<string, number>();
  for (const l of script) scriptKeys.set(key(l), (scriptKeys.get(key(l)) ?? 0) + 1);
  const missing = script.filter((l) => !appKeys.has(key(l)) && !ANY_DAY.has(key(l)));
  const extra = app.filter((l) => !scriptKeys.has(key(l)) && !ANY_DAY.has(key(l)));
  total += missing.length + extra.length;
  out.push(`## ${title}：台本 ${script.length}行／画面 ${app.length}行 — 画面にない ${missing.length}・台本にない ${extra.length}`, '');
  if (missing.length) out.push('台本にあって画面にない：', ...missing.map((l) => `- ${l.scene} ${l.who}「${l.text.replace(/\n/g, '／')}」`), '');
  if (extra.length) out.push('画面にあって台本にない：', ...extra.map((l) => `- ${l.who}「${l.text.replace(/\n/g, '／')}」`), '');
}

for (let day = 1; day <= 8; day++) {
  // SYS-S002 (joining early) plays at the end of day 3 (and from the settings)
  section(`${day}日目`, (id) => (id === 'SYS-S002' ? 3 : SCENE_DAY(id)) === day, [...sayLines(STORIES[day]?.steps ?? []), ...lessonLines(day)]);
}
// after joining (P05m: M-URANUS / M-PLUTO / M-NEPTUNE / M-END) — lib/onboarding/after.ts
section('会員後', (id) => id.startsWith('M-'), sayLines(AFTER_DAYS));
writeFileSync(join(ROOT, 'docs/story-import/sync.md'), out.join('\n') + '\n');
console.log(`sync: ${total} differences → docs/story-import/sync.md`);
