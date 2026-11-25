/**
 * Spell lab (R14, client 2026-11-25: 「サイケデリックトランスの曲」 came back as a pop spell): prints the spell the app builds
 * for ~20 tricky requests and corrections, with a real model, so the client and the devs can judge it by ear and eye.
 * Not run in CI (it needs a key and costs a little). Exactly the API's path: SpellService (SPELL_MODEL first, the rules
 * under it) — with the rules-only spell beside it.
 *
 * Run: cd apps/api && GEMINI_API_KEY=… npx tsx scripts/spell-live.ts
 * env: GEMINI_API_KEY and/or ANTHROPIC_API_KEY; SPELL_MODEL (default the API's: gemini:gemini-2.5-flash,…), e.g.
 *      SPELL_MODEL=claude:claude-haiku-4-5 to try Claude; ONLY=<substring> to run some cases
 */
import { createTaskLlm, TASK_MODEL_DEFAULTS } from '@obolo/ai';
import { spellFrom, spellPrompt, type SpellKind, type SpellTag } from '@obolo/shared';
import { SpellService } from '../src/moon/spell.service';

type Case = { kind: SpellKind; said: string; then?: string };
const CASES: Case[] = [
  { kind: 'song', said: 'サイケデリックトランスの曲を作りたい' },
  { kind: 'song', said: 'サイトラの曲を作りたい', then: '全然違うよ、サイケデリックトランスにして' },
  { kind: 'song', said: 'ゴアっぽいやつで宇宙を旅する感じ' },
  { kind: 'song', said: 'ノリのいい曲', then: 'そうじゃなくて、もっとアンダーグラウンドなテクノ' },
  { kind: 'song', said: '勉強のときに流すローファイ' },
  { kind: 'song', said: '夏の夜にドライブしながら聴くシティポップ' },
  { kind: 'song', said: '泣けるバラード、ピアノだけで' },
  { kind: 'song', said: 'ボカロっぽい速い曲で失恋' },
  { kind: 'song', said: 'K-POPみたいなかっこいいダンス曲' },
  { kind: 'song', said: 'ドラムンベースで疾走感' },
  { kind: 'song', said: 'フェスで盛り上がるEDM' },
  { kind: 'song', said: 'ジブリみたいな壮大なやつ' },
  { kind: 'song', said: 'お祭りっぽい和風ロック' },
  { kind: 'song', said: 'ゆったりしたボサノバで海辺の午後' },
  { kind: 'song', said: 'メタルで激しく、でも女の子の声' },
  { kind: 'song', said: '眠れるアンビエント' },
  { kind: 'song', said: 'ファミコンみたいなピコピコの曲' },
  { kind: 'art', said: 'ヤッホー、かわいい猫が宇宙を飛んでる絵を作って欲しいんだけど' },
  { kind: 'art', said: '夕焼けの海でクジラがジャンプしてる、油絵っぽく', then: 'イメージと違う、もっとアニメっぽく' },
  { kind: 'novel', said: 'メガネの少年が魔法学校で謎を解く話' },
  { kind: 'game', said: '宇宙船で隕石をよけるゲーム、だんだん速くなるやつ' },
];

const line = (tags: SpellTag[]) => tags.map((t) => `${t.ja}(${t.group}:${t.en})`).join('  ');

async function main() {
  const spec = process.env.SPELL_MODEL ?? TASK_MODEL_DEFAULTS.spell;
  const llm = createTaskLlm(spec, { geminiApiKey: process.env.GEMINI_API_KEY, anthropicApiKey: process.env.ANTHROPIC_API_KEY, openaiApiKey: process.env.OPENAI_API_KEY }, { timeoutMs: 20_000 });
  if (llm.name === 'mock') console.warn('No model key set: the spells below are the rules alone (set GEMINI_API_KEY or ANTHROPIC_API_KEY).');
  console.log(`SPELL_MODEL = ${spec} → ${llm.name}\n`);
  const svc = new SpellService(llm);
  for (const c of CASES.filter((x) => !process.env.ONLY || x.said.includes(process.env.ONLY))) {
    const t0 = Date.now();
    const v = await svc.spell({ kind: c.kind, said: c.said });
    console.log(`■ [${c.kind}] ${c.said}   (${v.how}, ${Date.now() - t0} ms)`);
    console.log(`  model: ${line(v.tags)}`);
    console.log(`  rules: ${line(spellFrom(c.kind, c.said))}`);
    console.log(`  prompt: ${spellPrompt(c.kind, v.tags)}`);
    if (c.then) {
      const e = await svc.spell({ kind: c.kind, said: c.then, tags: v.tags, history: [{ who: 'me', text: c.said }, { who: 'bati', text: 'じゃあ、こういうスペルになるね。' }] });
      console.log(`  → 「${c.then}」 (${e.how}${e.respelled ? ', remade' : ''})`);
      console.log(`    ${line(e.tags)}`);
      console.log(`    + ${e.added.map((t) => t.ja).join(' ')}   − ${e.removed.map((t) => t.ja).join(' ')}`);
    }
    console.log('');
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
