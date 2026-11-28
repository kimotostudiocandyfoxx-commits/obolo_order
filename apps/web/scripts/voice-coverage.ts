/**
 * Every spoken line of the first journey's days 1–3 and the Saturn practice, against the voice manifest
 * (story chat's QA 7, R12: 26 lines had no voice, so they were silent and the Saturn practice did not move on).
 *
 *   npx tsx scripts/voice-coverage.ts            # lists the lines with no voice
 *   npx tsx scripts/voice-coverage.ts --extra    # adds them to design/story-voices.json's "extra" (the voice job makes them)
 *   npx tsx scripts/voice-coverage.ts --days 1,2 --only design/story-voices-days12.json
 *       only those days (as played: lib/onboarding/stories.ts), and write what is missing as the list for a voice run
 *       limited to it (Actions → Story voices, only = that file; design/story-voices.json is not touched). Missing here
 *       is what the player cannot play (lib/story/lineVoice.ts): a line with no file, {bati}'s line with no file in
 *       its fixed egg voice (M-R342 — the old voice no longer counts), and the fixed words of a line with names
 *       (nameParts: what plays while the member's own voice of the line is being made).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DAY1 } from '../lib/onboarding/day1';
import { DAY2 } from '../lib/onboarding/day2';
import { DAY3 } from '../lib/onboarding/day3';
import { STORIES } from '../lib/onboarding/stories';
import { nameParts, nameRest, voiceKey, voiceable } from '../lib/story/voice';
import { batiStoryVoice } from '../../../packages/shared/src/batiFixedVoice';

const ROOT = resolve(__dirname, '../../..');
const manifest = JSON.parse(readFileSync(resolve(__dirname, '../public/story/voices/manifest.json'), 'utf8')) as Record<string, string>;
// the lines with a member's name in them, voiced per member once the name is known
const nameLines = (JSON.parse(readFileSync(resolve(__dirname, '../public/story/voices/name-lines.json'), 'utf8')) as { lines: Record<string, unknown> }).lines;
const cfgPath = resolve(ROOT, 'design/story-voices.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as { chosen: Record<string, unknown>; special?: { who: string }[]; extra: { who: string; text: string; act?: string }[] };

type Line = { who: string; text: string; act?: string; where: string };
const lines: Line[] = [];
const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const DAYS = arg('--days')?.split(',').map(Number);
const ONLY = arg('--only');
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
const under = (who: string, l: Line, text: string) => !!(manifest[voiceKey(who, l.act, text)] ?? manifest[voiceKey(who, undefined, text)]);
// M-R342: a {bati} line has a voice when its old one is there (the stand-in) or its egg voices are (one set while both eggs share a voice)
const has = (l: Line, text: string) => under(l.who, l, text) || (l.who === 'バティ' && under(batiStoryVoice('moon'), l, text) && under(batiStoryVoice('sun'), l, text));
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
if (DAYS) days(DAYS);
else for (const l of missing) console.log(`${l.where}\t${l.who}\t${l.text.replace(/\n/g, '⏎')}`);
if (!DAYS) console.log(`${missing.length} lines without a voice (${[...new Set(lines.map((l) => l.who))].filter((w) => !voiced.has(w)).join('・') || '—'} have no chosen voice)`);
if (process.argv.includes('--extra')) {
  for (const l of missing) if (!cfg.extra.some((x) => x.who === l.who && x.text === l.text)) cfg.extra.push({ who: l.who, text: l.text, ...(l.act ? { act: l.act } : {}) });
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.log('added to design/story-voices.json extra');
}

/** --days: the days as played, against what the player can play now */
function days(list: number[]) {
  const egg = batiStoryVoice('moon');
  const file = (who: string, text: string) => manifest[voiceKey(who, undefined, text)];
  const want: { who: string; text: string; why: string; day: number }[] = [];
  const add = (who: string, text: string, why: string, day: number) => {
    if (!want.some((w) => w.who === who && w.text === text)) want.push({ who, text, why, day });
  };
  for (const day of list)
    for (const st of STORIES[day]?.steps ?? []) {
      const s = st as { t: string; who?: string; voice?: string; text?: string };
      if (s.t !== 'say' || !s.who || !s.text) continue;
      const who = s.voice ?? s.who;
      if (!voiced.has(who)) continue;
      const bati = who === 'バティ';
      if (/\{[a-z_]+\}/.test(s.text)) {
        if (!nameLines[voiceKey(who, undefined, s.text)]) add(who, s.text, 'name-lines.json にない（会員ごとの声が作られない）', day);
        for (const p of nameParts(s.text)) if (!file(bati ? egg : who, p)) add(who, p, `名前の入る行の決まった言葉（${s.text.replace(/\n/g, '⏎')}）`, day);
        continue;
      }
      if (!voiceable(s.text)) continue;
      if (!file(bati ? egg : who, s.text)) add(who, s.text, bati && file(who, s.text) ? 'バティの決まった声（M-R342）がない（古い声だけ）' : '声がない', day);
    }
  // --with "WHO|text" (repeatable): a line about to come into the script (the story session's change not imported yet)
  process.argv.forEach((a, i) => {
    if (process.argv[i - 1] !== '--with') return;
    const [who, ...t] = a.split('|');
    const text = t.join('|').replace(/\\n/g, '\n');
    if (who && voiceable(text) && !file(who === 'バティ' ? egg : who, text)) add(who, text, '台本に入る予定の行（--with）', 0);
  });
  const bytes = (who: string) => want.filter((w) => w.who === who).reduce((a, w) => a + Buffer.byteLength(w.text, 'utf8'), 0);
  for (const w of want) console.log(`day${w.day}\t${w.who}\t${w.text.replace(/\n/g, '⏎')}\t${w.why}`);
  const fish = ['KIMORIN', 'バティ'].reduce((a, w) => a + bytes(w), 0);
  const gem = want.filter((w) => !['KIMORIN', 'バティ'].includes(w.who));
  console.log(`${want.length} voices to make — Fish (KIMORIN, バティ): ${fish} bytes ≈ $${((fish * 15) / 1e6).toFixed(4)} a take (up to 3 takes when one comes back cut short); Gemini (OBOLON, MONBAN …): ${gem.length} lines, ${gem.reduce((a, w) => a + w.text.length, 0)} characters`);
  if (ONLY) {
    if (!/^design\/[\w.-]+\.json$/.test(ONLY)) throw new Error('--only must be design/<name>.json');
    writeFileSync(resolve(ROOT, ONLY), JSON.stringify({ note: `声のない ${list.join('・')}日目の台詞（scripts/voice-coverage.ts --days ${list.join(',')} --only ${ONLY}）。Actions の「Story voices」を only=${ONLY} で回すと、これだけを作る。`, lines: want.map(({ who, text }) => ({ who, text })) }, null, 1) + '\n');
    console.log(`wrote ${ONLY}`);
  }
}
