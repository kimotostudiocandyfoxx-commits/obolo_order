/**
 * {bati}'s birth (M-R217, docs/story-rewrite/バティの性格の決め方.md): the seed the member answered (the first {bati}: the
 * favourite food) decides the personality, its 一人称 / 呼び方 / 口ぐせ and the card's introduction — one call to the Bati
 * chat model (Haiku 5.5). Whatever comes back, one personality is always given (a fixed fallback when the model fails or
 * refuses); an unfit seed comes back as `{ ok: false }` so OBOLON can ask again.
 *
 * A rare personality's fixed story lines are rewritten once at birth (one more call): manner only, checked line by line
 * (the same placeholders, the length within ±40 %); a line that fails is said as written.
 */
import {
  BATI_ORDINARY_IDS,
  BATI_PERSONALITIES,
  BATI_RARE_IDS,
  BatiPersonaPick,
  batiDefaultCall,
  batiPersonaByRules,
  batiSelf,
  isBatiRare,
  type BatiEggKind,
  type BatiPersonality,
  type BatiSeedKind,
} from '@obolo/shared';
import type { LlmProvider } from './types';

export interface BatiPersona {
  personality: BatiPersonality;
  self: string;
  /** a template: {neo} = the member's name */
  call: string;
  catchphrase: string;
  intro: string;
  rare: boolean;
  /** the model gave nothing usable: the fixed fallback */
  fallback?: boolean;
}

const table = (ids: readonly BatiPersonality[]) =>
  ids
    .map((id) => {
      const d = BATI_PERSONALITIES[id];
      return `- ${id}（${d.label}）一人称：${d.self.sun === d.self.moon ? d.self.sun : `${d.self.sun}／${d.self.moon}`}／呼び方：${batiDefaultCall(id)}／${d.manner}／例：「{neo}、すごいね！」→「${d.examples.find(([b]) => b.includes('すごい'))?.[1] ?? d.examples[0][1]}」`;
    })
    .join('\n');

/** the rules, word for word from the decision (M-R217 §2) */
export const BATI_PERSONA_SYSTEM = `あなたは、Obolo Order の月の神殿で、生まれる{bati}（ユーザーの相方）の性格を決める係。ユーザーが答えた「種」（好きな食べ物）から、下の決まりに従って、必ず一つに決める。

【ふつうの性格（よく出る・8つ）】
${table(BATI_ORDINARY_IDS)}

【めずらしい性格（たまに出る・12）】
${table(BATI_RARE_IDS)}

【種から性格を決める決まり（上から順に見る）】
1. 答えが食べ物でない・ふさわしくない時
 - ふさわしくない言葉（下品すぎる、悪口、危ない物）：{"ok":false} だけを返す（性格は決めない。OBOLONがもう一度聞く）。
 - 冗談のような答え（「うんち」「石」「空気」など、笑いで済むもの）：めずらしい性格から選ぶ（例：空気→ninja、石→philosopher）。笑って受け取る。
2. 土地の食べ物（地方の名物）：その土地のことばの子にする。
 - 関西（たこ焼き・お好み焼き・串カツ・551 など）→ kansai
 - 福岡・九州（もつ鍋・明太子・とんこつラーメン・ごまさば など）→ hakata
 - 東北（きりたんぽ・牛たん・ずんだ・芋煮 など）→ tohoku
 - 沖縄（ゴーヤチャンプルー・ソーキそば・サーターアンダギー など）→ okinawa
 - ほかの地方の名物は、食べ物の感じ（4）で決める。海外の料理は、ことばのまねをしない（その国の人をからかう形にしない）。食べ物の感じで決める。
3. 王道の食べ物（からあげ・カレー・ラーメン・寿司・ハンバーグ・焼肉・おにぎり・パスタ・チョコ・アイス など、多くの人が好きと言う物）→ ふつうの性格から選ぶ。
 マイナーな食べ物（あまり聞かない物、組み合わせが変な物、細かすぎる物：ほや、くさや、いなごの佃煮、ポテチにアイスをのせたもの、近所の店の〇〇定食 など）→ めずらしい性格から選ぶ。マイナーなほど、めずらしい性格にする。
4. 食べ物の感じ（2・3で決まらない分）
 - 甘い・やわらかい・小さい（プリン、マシュマロ）→ baby／mellow
 - 辛い・熱い・がっつり（激辛、カツ丼）→ nekketsu／genki
 - 高い・上品（ステーキ、うに、フレンチ）→ king／keigo／butler
 - 冷たい・さっぱり（冷やし中華、そうめん、レモン）→ cool
 - 手間がかかる・こだわり（自家製、手打ち）→ philosopher／bushi
 - 屋台・おやつ・ジャンク（ポテト、駄菓子）→ clumsy／gal
 - 音が鳴る・リズムがいい（せんべい、ポップコーン）→ rapper
 - 名前がきれい・季節もの（桜餅、かき氷）→ poet
5. 同じ種でも、少しだけゆらぐ：合う性格が2つある時は、どちらかを選ぶ（いつも同じにしない）。
6. KIMORINと同じ性格でもよい。

【2体目・3体目の種（M-R218）】種が「好きな音・曲」の時：速い・激しい→nekketsu／rapper、静か→cool／poet、ゆったり→mellow、かわいい・小さい→baby、ご当地の音（祭りばやし・三線・だんじり など）→その土地のことばの子、王道の音→ふつうの性格、めずらしい音→めずらしい性格。
種が「大事にしている言葉」の時：言葉の感じで決める（元気が出る→genki／nekketsu、ていねい→keigo／butler、やさしい→mellow、かっこいい→cool／bushi、深い→philosopher、きれい→poet、方言の言葉→その土地のことばの子）。食べ物の決まりの1（ふさわしくない時）は、音や言葉でも同じ。紹介文は、その音・言葉から生まれた感じにする。

【答え方】JSON だけを返す（前置き・説明・コードの囲みは書かない）。
{"personality":"<上の英語のid>","self":"<一人称>","call":"<呼び方。ユーザーの名前は {neo} と書く（例：{neo}さま、{neo}っち）。名前を使わない呼び方はそのまま（例：君）>","catchphrase":"<口ぐせ。12字まで>","intro":"<カードの紹介文。種（そのままの言葉）から生まれた感じが伝わる、40字くらい。子どもにもやさしい言葉。例：たこ焼きの湯気から生まれた。うれしいと、くるくる回る。>"}
一人称が2つある性格は、月のたまごなら2つ目、太陽のたまごなら1つ目を使う。
ふさわしくない種の時だけ {"ok":false}。`;

/** the fixed fallback (the model failed / refused / answered something unusable): 元気な子 */
export function fallbackBatiPersona(seed: string, egg: BatiEggKind = 'sun'): BatiPersona {
  const d = BATI_PERSONALITIES.genki;
  return { personality: 'genki', self: batiSelf('genki', egg), call: batiDefaultCall('genki'), catchphrase: d.catchphrase, intro: `${seed.slice(0, 16)}の香りの光から生まれた。いつも元気いっぱい。`, rare: false, fallback: true };
}

function readJson(raw: string): unknown {
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/**
 * The birth's decision: one call (temperature 1: the same seed may give either of two fitting personalities). `null`
 * = an unfit seed (OBOLON asks again). Never throws: a failed call or a bad answer gives the fallback.
 */
const KIND_WORD: Record<BatiSeedKind, string> = { food: '好きな食べ物', sound: '好きな音・曲', word: '大事にしている言葉' };

export async function decideBatiPersona(llm: LlmProvider, seed: string, egg: BatiEggKind = 'sun', kind: BatiSeedKind = 'food'): Promise<BatiPersona | null> {
  // no model (the demo, the tests): the rules alone
  if (llm.name === 'mock') return batiPersonaByRules(seed, egg);
  let raw = '';
  try {
    raw = await llm.chat({
      system: BATI_PERSONA_SYSTEM,
      history: [{ role: 'user', text: `たまご：${egg === 'moon' ? '月のたまご' : '太陽のたまご'}\n種（${KIND_WORD[kind]}）：${seed}` }],
      temperature: 1,
      maxOutputTokens: 300,
      json: true,
    });
  } catch {
    return fallbackBatiPersona(seed, egg);
  }
  const parsed = BatiPersonaPick.safeParse(readJson(raw));
  if (!parsed.success) return fallbackBatiPersona(seed, egg);
  const p = parsed.data;
  if (!('personality' in p)) return null;
  const call = p.call.replace(/\{name\}|〇〇/g, '{neo}');
  return { personality: p.personality, self: p.self, call, catchphrase: p.catchphrase, intro: p.intro, rare: isBatiRare(p.personality) };
}

/** the {placeholders} of a line ({self} aside: it is the 一人称) */
export function linePlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{[a-z_]+\}/g)].map((m) => m[0]).filter((p) => p !== '{self}'))].sort();
}

/** a rewritten line is kept only with the same placeholders and a length within ±40 % of the line as written */
export function rewrittenLineOk(base: string, line: unknown): line is string {
  if (typeof line !== 'string' || !line.trim()) return false;
  if (linePlaceholders(base).join() !== linePlaceholders(line).join()) return false;
  const a = [...base].length;
  const b = [...line].length;
  return b >= a * 0.6 && b <= a * 1.4;
}

export function batiRewriteSystem(p: BatiPersona): string {
  const d = BATI_PERSONALITIES[p.personality];
  return `あなたは、物語の台詞の書き直し係。下の台詞は、{bati}（元気な子）の台詞。これを「${d.label}」の言い方に書き直す。
- ${d.manner} 一人称は {self} と書く（「ボク」の所）。相手の呼び方は「${p.call}」（{neo} などの名前の所）。口ぐせ：${p.catchphrase}
- 変えるのは言い方だけ。意味・中身・長さ（文字数）はそのまま。新しい情報を足さない。
- {neo} {name} {inviter} {food} などの { } の記号は、そのまま全部残す（増やさない・減らさない）。〈 〉の中もそのまま。
- 子どもにもやさしい言葉。下品な言葉・悪口・こわい言葉は使わない。
- 例：「{neo}、すごいね！」→「${d.examples[0][1]}」
答えは JSON の配列だけ。台詞と同じ数・同じ順（["…","…"]）。`;
}

/**
 * A rare personality's lines, rewritten once at birth (one call for all of them). Returns the lines that passed the
 * check (line as written → its rewrite); the rest are said as written. Never throws.
 */
export async function rewriteBatiLines(llm: LlmProvider, p: BatiPersona, lines: readonly string[]): Promise<Record<string, string>> {
  if (!lines.length) return {};
  let raw = '';
  try {
    raw = await llm.chat({ system: batiRewriteSystem(p), history: [{ role: 'user', text: JSON.stringify(lines) }], temperature: 0.7, maxOutputTokens: 8000 });
  } catch {
    return {};
  }
  const m = /\[[\s\S]*\]/.exec(raw);
  let arr: unknown;
  try {
    arr = m ? JSON.parse(m[0]) : null;
  } catch {
    arr = null;
  }
  if (!Array.isArray(arr)) return {};
  const out: Record<string, string> = {};
  lines.forEach((base, i) => {
    const line = arr[i];
    if (rewrittenLineOk(base, line)) out[base] = line.trim();
  });
  return out;
}
