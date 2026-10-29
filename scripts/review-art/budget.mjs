#!/usr/bin/env node
/**
 * What the luxury cuts have cost since the client topped up Runware, and roughly what is left (story chat
 * 2026-10-29: keep the spending per cut and per picture visible). Reads the two ledgers the makers keep —
 * art/review/saturn/rounds/video-costs.md (make.mjs) and art-costs.md (paint.mjs) — and writes budget.md beside them.
 * The balance is an estimate: the top-ups below minus what the ledgers recorded (Runware's own page is the truth).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = 'art/review/saturn/rounds';
// the client's balance when this ledger began (2026-10-29: about 5,000 yen, then +$50 ≈ 7,500 yen)
const TOPUPS = [
  { at: '2026-10-29T05:40', yen: 5000, note: '制作開始の時の残高（約）' },
  { at: '2026-10-29T06:05', yen: 7500, note: '+50ドル' },
];
const rows = (f) =>
  existsSync(`${DIR}/${f}`)
    ? readFileSync(`${DIR}/${f}`, 'utf8')
        .split('\n')
        .filter((l) => /^\| 20\d\d-/.test(l))
        .map((l) => {
          const c = l.split('|').map((x) => x.trim());
          return { at: c[1], id: c[2], yen: Number((l.match(/約([\d.]+)円/) ?? [])[1] ?? 0) };
        })
    : [];
const video = rows('video-costs.md');
const art = rows('art-costs.md');
const sum = (xs) => xs.reduce((a, x) => a + x.yen, 0);
const by = (xs, key) => Object.entries(xs.reduce((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + x.yen), m), {}));
const start = TOPUPS[0].at;
const since = (xs) => xs.filter((x) => x.at >= start);
const spent = sum(since(video)) + sum(since(art));
const topped = TOPUPS.reduce((a, t) => a + t.yen, 0);
const out = [
  '# 豪華カットの費用と残高のめやす',
  '',
  `更新：${new Date().toISOString().slice(0, 16)} UTC（動画・止め絵を作るたびに自動で書きかわります）`,
  '',
  `- 入れた額：約${topped.toLocaleString()}円（${TOPUPS.map((t) => `${t.note} ${t.yen.toLocaleString()}円`).join('、')}）`,
  `- 使った額：約${Math.round(spent).toLocaleString()}円（動画 約${Math.round(sum(since(video))).toLocaleString()}円 ${since(video).length}本・止め絵 約${Math.round(sum(since(art))).toLocaleString()}円 ${since(art).length}枚）`,
  `- **残高のめやす：約${Math.round(topped - spent).toLocaleString()}円**（正確な残高は Runware の画面で）`,
  '',
  '## 映像ごと（動画）',
  '',
  '| 映像 | 本数 | 費用 |',
  '|---|---|---|',
  ...by(since(video), (x) => x.id.split('-')[0]).map(([k, y]) => `| ${k} | ${since(video).filter((x) => x.id.startsWith(k + '-')).length} | 約${Math.round(y)}円 |`),
  '',
  '## 映像ごと（止め絵）',
  '',
  '| 映像 | 枚数 | 費用 |',
  '|---|---|---|',
  ...by(since(art), (x) => x.id.split('/')[0]).map(([k, y]) => `| ${k} | ${since(art).filter((x) => x.id.startsWith(k + '/')).length} | 約${Math.round(y)}円 |`),
  '',
  'カットごと・1枚ごとの記録：`video-costs.md`・`art-costs.md`。',
  '',
];
writeFileSync(`${DIR}/budget.md`, out.join('\n'));
console.log(out.slice(0, 8).join('\n'));
