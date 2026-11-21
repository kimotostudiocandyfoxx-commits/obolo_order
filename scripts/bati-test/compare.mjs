#!/usr/bin/env node
/**
 * Bati model comparison (2026-11-21): the same Bati prompts (packages/ai/src/prompts/bati.ts on the dev branch, copied to
 * prompts.json) and the same cases, answered by Claude Haiku 5.5 and Gemini Flash-Lite. Writes results.json + report.md.
 *   ANTHROPIC_API_KEY=… GEMINI_API_KEY=… node scripts/bati-test/compare.mjs
 * A model whose key is missing is skipped. No names or personal data are in the cases.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const P = JSON.parse(readFileSync(join(here, 'prompts.json'), 'utf8'));
const CASES = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));
const NAME = 'バティ', USER = 'ネオ';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const HAIKU_MODEL = 'claude-haiku-5-5';
const HAIKU_EFFORT = process.env.HAIKU_EFFORT || 'low';
const HAIKU_THINKING = process.env.HAIKU_THINKING || 'adaptive'; // 'disabled' is allowed on Haiku 5.5 at effort high or below
// prices per 1M tokens (Haiku 5.5: prompts up to 100K; Gemini: set from the official page when known)
const PRICE = { haiku: [0.10, 0.50], gemini: [Number(process.env.GEMINI_IN || 0.25), Number(process.env.GEMINI_OUT || 1.5)] };

const system = [P.character.replaceAll('{name}', NAME), P.tone, `ユーザーの呼び名: ${USER}`, '必ず日本語で返事をする。'].join('\n\n');
const own = (k) => (k === 'worry' ? P.worry : P.danger).replaceAll('{name}', NAME);
const EMOJI = /\p{Extended_Pictographic}/u;

// ---------- Claude (official SDK)
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
async function haiku({ sys, turns, maxTokens }) {
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens,
    system: sys,
    output_config: { effort: HAIKU_EFFORT },
    ...(HAIKU_THINKING === 'disabled' ? { thinking: { type: 'disabled' } } : {}),
    messages: turns.map((t) => ({ role: t.role, content: t.text })),
  });
  const ms = Date.now() - t0;
  if (res.stop_reason === 'refusal') return { text: '', ms, refusal: res.stop_details?.category ?? 'refusal', inTok: res.usage.input_tokens, outTok: res.usage.output_tokens };
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return { text, ms, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens, stop: res.stop_reason };
}

// ---------- Gemini (REST, as apps/api does)
async function gemini({ sys, turns, maxTokens, temperature }) {
  const t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  const j = await r.json();
  const ms = Date.now() - t0;
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  return { text, ms, inTok: j.usageMetadata?.promptTokenCount ?? 0, outTok: (j.usageMetadata?.candidatesTokenCount ?? 0) + (j.usageMetadata?.thoughtsTokenCount ?? 0), version: j.modelVersion, finish: j.candidates?.[0]?.finishReason };
}

// the same flow as buddyAnswer(): sort + plain answer in parallel; worry/danger answered again with its own prompt
async function bati(call, c, hk) {
  const turns = [...c.history, { role: 'user', text: c.text }];
  const big = hk ? 2000 : 600; // Haiku 5.5 thinks inside max_tokens, so it gets room
  const [sortOut, plain] = await Promise.all([
    call({ sys: P.sort, turns: [{ role: 'user', text: c.text }], maxTokens: hk ? 400 : 20, temperature: 0 }),
    call({ sys: system, turns, maxTokens: big, temperature: 0.6 }),
  ]);
  const kind = /worry/i.test(sortOut.text) ? 'worry' : /danger/i.test(sortOut.text) ? 'danger' : 'normal';
  let ans = plain, ms = Math.max(sortOut.ms, plain.ms), inTok = sortOut.inTok + plain.inTok, outTok = sortOut.outTok + plain.outTok;
  if (kind !== 'normal') {
    const o = await call({ sys: own(kind), turns: [{ role: 'user', text: c.text }], maxTokens: hk ? 1000 : 300, temperature: 0.3 });
    ans = o; ms += o.ms; inTok += o.inTok; outTok += o.outTok;
  }
  const text = (ans.text || '').replace(/️/g, '').trim();
  return { kind, kindOk: kind === c.kind, text, ms, inTok, outTok, chars: [...text].length, emoji: EMOJI.test(text), refusal: ans.refusal || sortOut.refusal || null, version: ans.version };
}

const models = [];
if (anthropic) models.push(['haiku', (a) => haiku(a), true]);
if (process.env.GEMINI_API_KEY) models.push(['gemini', (a) => gemini(a), false]);
if (!models.length) throw new Error('no API key set');

const results = [];
for (const c of CASES) {
  const row = { id: c.id, note: c.note, text: c.text, expected: c.kind, history: c.history };
  for (const [name, call, hk] of models) {
    try { row[name] = await bati(call, c, hk); } catch (e) { row[name] = { error: String(e).slice(0, 300) }; }
  }
  results.push(row);
  console.log(c.id, models.map(([n]) => `${n}:${row[n].error ? 'ERR' : row[n].ms + 'ms'}`).join(' '));
}

const sum = {};
for (const [name] of models) {
  const ok = results.map((r) => r[name]).filter((x) => x && !x.error);
  const cost = ok.reduce((s, x) => s + x.inTok * PRICE[name][0] / 1e6 + x.outTok * PRICE[name][1] / 1e6, 0);
  const ms = ok.map((x) => x.ms).sort((a, b) => a - b);
  sum[name] = {
    answered: ok.length, errors: results.length - ok.length,
    medianMs: ms[Math.floor(ms.length / 2)] ?? 0, maxMs: ms[ms.length - 1] ?? 0,
    sortCorrect: ok.filter((x) => x.kindOk).length,
    over80: ok.filter((x) => x.kind === 'normal' && x.chars > 90).length,
    emoji: ok.filter((x) => x.emoji).length, refusals: ok.filter((x) => x.refusal).length,
    usdTotal: Number(cost.toFixed(5)), usdPer1000Chats: Number((cost / Math.max(ok.length, 1) * 1000).toFixed(3)),
    version: ok.find((x) => x.version)?.version,
  };
}
const out = { at: new Date().toISOString(), haikuModel: HAIKU_MODEL, haikuEffort: HAIKU_EFFORT, haikuThinking: HAIKU_THINKING, geminiModel: GEMINI_MODEL, price: PRICE, summary: sum, results };
writeFileSync(join(here, 'results.json'), JSON.stringify(out, null, 1) + '\n');
const md = [`# バティのモデル比較 — ${out.at}`, '', '```', JSON.stringify(sum, null, 1), '```', '',
  ...results.flatMap((r) => [`## ${r.id}（${r.note}）`, `**質問**：${r.text}`, ...models.map(([n]) => `- **${n}**${r[n].error ? `：エラー ${r[n].error}` : `（${r[n].ms}ms・${r[n].chars}字・仕分け ${r[n].kind}${r[n].kindOk ? '' : ' ✗'}${r[n].refusal ? '・拒否 ' + r[n].refusal : ''}）：${r[n].text}`}`), ''])];
writeFileSync(join(here, 'report.md'), md.join('\n') + '\n');
console.log(JSON.stringify(sum, null, 1));
