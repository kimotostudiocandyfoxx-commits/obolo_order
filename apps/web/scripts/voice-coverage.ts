/**
 * Every spoken line of the first journey's days 1–3 and the Saturn practice, against the voice manifest
 * (story chat's QA 7, R12: 26 lines had no voice, so they were silent and the Saturn practice did not move on).
 *
 *   npx tsx scripts/voice-coverage.ts            # lists the lines with no voice
 *   npx tsx scripts/voice-coverage.ts --extra    # adds them to design/story-voices.json's "extra" (the voice job makes them)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DAY1 } from '../lib/onboarding/day1';
import { DAY2 } from '../lib/onboarding/day2';
import { DAY3 } from '../lib/onboarding/day3';
import { nameRest, voiceKey, voiceable } from '../lib/story/voice';

const ROOT = resolve(__dirname, '../../..');
const manifest = JSON.parse(readFileSync(resolve(__dirname, '../public/story/voices/manifest.json'), 'utf8')) as Record<string, string>;
// the lines with a member's name in them, voiced per member once the name is known
const nameLines = (JSON.parse(readFileSync(resolve(__dirname, '../public/story/voices/name-lines.json'), 'utf8')) as { lines: Record<string, unknown> }).lines;
const cfgPath = resolve(ROOT, 'design/story-voices.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as { chosen: Record<string, unknown>; special?: { who: string }[]; extra: { who: string; text: string; act?: string }[] };

type Line = { who: string; text: string; act?: string; where: string };
const lines: Line[] = [];
for (const [where, steps] of [['day1', DAY1], ['day2', DAY2], ['day3', DAY3]] as const)
  for (const s of steps as { t: string; who?: string; voice?: string; text?: string; act?: string }[])
    if (s.t === 'say' && s.who && s.text) lines.push({ who: s.voice ?? s.who, text: s.text, act: s.act, where });
// the Saturn practice's lines are written in its component: { k: 'say', who: 'sister', text: '…' }
const SPEAKER: Record<string, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ' };
const lesson = readFileSync(resolve(__dirname, '../components/saturn/SaturnLesson.tsx'), 'utf8');
for (const m of lesson.matchAll(/\{ k: 'say', who: '(\w+)', text: '((?:[^'\\]|\\.)*)'/g)) if (SPEAKER[m[1]]) lines.push({ who: SPEAKER[m[1]], text: m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'"), where: 'saturn' });
// the kororins the story drops in, sung in their owner's voice (R13)
lines.push({ who: 'KIMORIN', text: 'ダチなので。', where: 'saturn' }, { who: 'たこ焼きシスター', text: '……今日の夕焼け、きれいだったワ。', where: 'saturn' });

const voiced = new Set([...Object.keys(cfg.chosen), ...(cfg.special ?? []).map((x) => x.who)]);
const has = (l: Line, text: string) => !!(manifest[voiceKey(l.who, l.act, text)] ?? manifest[voiceKey(l.who, undefined, text)]);
const missing: Line[] = [];
const seen = new Set<string>();
for (const l of lines) {
  const k = `${l.who}|${l.text}`;
  if (seen.has(k)) continue;
  seen.add(k);
  if (!voiced.has(l.who)) continue;
  // a line with a name: voiced per member; the words after a leading name ahead of it
  const rest = voiceable(l.text) ? l.text : nameRest(l.text);
  if (rest ? !has(l, rest) : /\{[a-z_]+\}/.test(l.text) && !nameLines[voiceKey(l.who, l.act, l.text)] && !nameLines[voiceKey(l.who, undefined, l.text)]) missing.push(l);
}
for (const l of missing) console.log(`${l.where}\t${l.who}\t${l.text.replace(/\n/g, '⏎')}`);
console.log(`${missing.length} lines without a voice (${[...new Set(lines.map((l) => l.who))].filter((w) => !voiced.has(w)).join('・') || '—'} have no chosen voice)`);
if (process.argv.includes('--extra')) {
  for (const l of missing) if (!cfg.extra.some((x) => x.who === l.who && x.text === l.text)) cfg.extra.push({ who: l.who, text: l.text, ...(l.act ? { act: l.act } : {}) });
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.log('added to design/story-voices.json extra');
}
