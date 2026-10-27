/**
 * Story import (client decision 2026-10-12): reads the story chat's Markdown (Pxx/cxx.md), writes the
 * scenes for the player (public/story/<part>.json + index.json) and a report of what to fix or make
 * (docs/story-import/report.md, plus the picture list for the story image workshop).
 *
 *   npx --yes tsx@4.19.2 apps/web/scripts/story-import.ts <folder with P01/, P02/, …>
 *
 * The story lives on the story chat's branch; `scripts/story/import.sh` fetches it and runs this.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, parseFile, type Scene } from '../lib/story/parse';
import { STORY_SPEAKERS } from '../lib/story/cast';

const src = resolve(process.argv[2] ?? 'docs/story-rewrite/wip');
const srcLabel = process.argv[3] ?? src;
const ROOT = resolve(__dirname, '../../..');
const OUT = join(ROOT, 'apps/web/public/story');
const REPORT = join(ROOT, 'docs/story-import');
mkdirSync(OUT, { recursive: true });
mkdirSync(REPORT, { recursive: true });

const parts = readdirSync(src).filter((d) => /^P\d+$/.test(d)).sort();
const all: Scene[] = [];
for (const p of parts) {
  const files = readdirSync(join(src, p)).filter((f) => /^c\d+[a-z]?\.md$/.test(f)).sort();
  const scenes = files.flatMap((f) => parseFile(readFileSync(join(src, p, f), 'utf8'), p, `${p}/${f}`));
  all.push(...scenes);
  writeFileSync(join(OUT, `${p}.json`), JSON.stringify(scenes));
}
// the order the scenes are written in is the story order (the player starts at the first)
writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify({ parts, scenes: all.map((s) => ({ id: s.id, part: s.part, title: s.title, next: s.next, resume: s.resume })) }),
);

const r = check(all, STORY_SPEAKERS);
const byPart = new Map<string, number>();
for (const i of r.issues) {
  const part = all.find((s) => s.id === i.scene)?.part ?? '?';
  byPart.set(part, (byPart.get(part) ?? 0) + 1);
}
const errors = r.issues.filter((i) => i.level === 'error');
const md = [
  `# 物語の取り込みレポート`,
  '',
  `読み込んだ場所: \`${srcLabel}\` ／ ${parts.length}パート・${all.length}場面`,
  '',
  `- ❌ 直さないと動かない: **${errors.length}件** ／ ⚠️ 確認してほしい: ${r.issues.length - errors.length}件`,
  `- 新しく描く一枚絵: ${r.stills.length}枚 ／ 機能の画面を呼ぶ場所: ${r.screens.length}か所 ／ 参照している動画: ${r.videos.size}本`,
  `- まだ登録されていない話者: ${r.unknownSpeakers.size}人`,
  '',
  '## 直さないと動かないもの（❌）',
  '',
  ...(errors.length ? errors.map((i) => `- ${i.scene}: ${i.msg}`) : ['（なし）']),
  '',
  '## 確認してほしいもの（⚠️、パートごと）',
  '',
  ...parts.map((p) => {
    const list = r.issues.filter((i) => i.level === 'warn' && all.find((s) => s.id === i.scene)?.part === p);
    return list.length ? [`### ${p}（${list.length}件）`, '', ...list.slice(0, 60).map((i) => `- ${i.scene}: ${i.msg}`), ...(list.length > 60 ? [`- …ほか ${list.length - 60}件`] : []), ''].join('\n') : '';
  }),
  '## まだ登録されていない話者（立ち絵・名前表示が必要）',
  '',
  ...[...r.unknownSpeakers.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `- ${w}（${n}回）`),
  '',
  '## 差し込み文字',
  '',
  ...[...r.vars.entries()].map(([v, n]) => `- \`${v}\` ${n}回${['{name}', '{inviter}', '{neo}', '{bati}', '{food}', '{age}'].includes(v) ? '' : ' ← エンジンにまだない'}`),
  '',
  '## 機能の画面を呼ぶ場所（種類ごとの数）',
  '',
  ...Object.entries(r.screens.reduce<Record<string, number>>((a, s) => ((a[s.kind] = (a[s.kind] ?? 0) + 1), a), {})).map(([k, n]) => `- ${k}: ${n}か所`),
  '',
  '機能の名前（`〔画面：名前｜…〕` の ｜ の前）ごと：',
  '',
  ...Object.entries(r.screens.reduce<Record<string, number>>((a, s) => ((a[s.feature || '（名前なし）'] = (a[s.feature || '（名前なし）'] ?? 0) + 1), a), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `- ${k}: ${n}か所`),
  '',
  '一覧は `screens.md`、一枚絵の一覧は `stills.md` を見てください。',
  '',
].join('\n');
writeFileSync(join(REPORT, 'report.md'), md);
writeFileSync(
  join(REPORT, 'stills.md'),
  ['# 一枚絵の一覧（物語の絵の作業場で描く）', '', ...r.stills.map((s) => `## ${s.id}${s.arrival ? '（到着）' : ''}\n\n${s.desc}\n`)].join('\n'),
);
writeFileSync(
  join(REPORT, 'screens.md'),
  ['# 機能の画面を呼ぶ場所', '', '| 場面 | 種類 | 機能 | 中身 |', '|---|---|---|---|', ...r.screens.map((s) => `| ${s.scene} | ${s.kind} | ${s.feature} | ${s.text.replace(/\|/g, '／').replace(/\n/g, ' ').slice(0, 160)} |`)].join('\n'),
);
writeFileSync(join(REPORT, 'stills.json'), JSON.stringify(r.stills, null, 1));
console.log(md.split('\n').slice(0, 12).join('\n'));
