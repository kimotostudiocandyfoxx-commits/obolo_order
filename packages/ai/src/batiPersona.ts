/**
 * {bati}'s birth (M-R217 / M-R225 / M-R226, docs/story-rewrite/バティの性格の決め方.md): the seed the member answered (the
 * first {bati}: the favourite food) decides its way of speaking, 一人称 / 呼び方 / 口ぐせ, the card's 性格 (one word, never
 * in the speech) and the card's introduction — one call to the Bati chat model (Haiku 5.5). Whatever comes back, one
 * style is always given (a fixed fallback when the model fails or refuses); an unfit seed comes back as `{ ok: false }`
 * so OBOLON can ask again.
 *
 * A rare style's fixed story lines are rewritten once at birth (one more call), under the speaking rules (M-R225), and
 * checked: the same placeholders, the length within ±40 %, ordinary kanji-kana (not all hiragana / katakana), and over
 * the whole set an ending changed in at most half the sentences (the rest go back to the script's words). A line that
 * fails is said as written.
 */
import {
  BATI_COMMON_IDS,
  BATI_GAL_IDS,
  BATI_GROUP_WEIGHTS,
  BATI_BRIGHT_IDS,
  BATI_PERSONALITIES,
  BATI_RARE_IDS,
  BATI_SPEECH_RULES,
  BATI_TRAITS,
  BatiPersonaPick,
  batiDefaultCall,
  batiPersonaByRules,
  batiSelf,
  drawBatiStyle,
  hasBannedBatiWord,
  isBatiRare,
  type BatiDrawOptions,
  type BatiCustomStyle,
  BatiWishPick,
  batiWishByRules,
  customStyleProblem,
  wishRefusal,
  pickBatiTrait,
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
  /** the card's 性格 (one word; never in the speech) */
  trait: string;
  intro: string;
  rare: boolean;
  /** the model gave nothing usable: the fixed fallback */
  fallback?: boolean;
  /** M-R230: a style made for a wish (the third {bati}); `personality` is then only its stand-in for old code */
  custom?: BatiCustomStyle | null;
  /** M-R230: the wish's role */
  role?: 'any' | 'play' | 'work' | 'make';
}

const table = (ids: readonly BatiPersonality[]) =>
  ids
    .map((id) => {
      const d = BATI_PERSONALITIES[id];
      return `- ${id}（${d.label}）一人称：${d.self.sun === d.self.moon ? d.self.sun : `${d.self.sun}／${d.self.moon}`}／呼び方：${batiDefaultCall(id)}／${d.manner}／例：「{neo}、すごいね！」→「${d.example}」`;
    })
    .join('\n');

/** the rules, word for word from the decision (M-R225 §1, §2) */
export const BATI_PERSONA_SYSTEM = `あなたは、Obolo Order の月の神殿で、生まれる{bati}（ユーザーの相方）の話し方と性格を決める係。ユーザーが答えた「種」から、下の決まりに従って、必ず一つに決める。大前提：どの子が来ても、ユーザーがストレスを感じないこと。

【話し方の決まり（すべての子に共通）】
${BATI_SPEECH_RULES.map((r) => `- ${r}`).join('\n')}

【よく出る話し方（6つ）】
${table(BATI_COMMON_IDS)}

【ギャル系の話し方（5つ・よく出る）】芯は「全肯定・ほめ上手・ノリがいい・すぐ友だちになってくれる」。言葉は読みやすく、はやり言葉は ときどき だけ。
${table(BATI_GAL_IDS)}

【めずらしい話し方（6つ・カードの縁が金色）】
${table(BATI_RARE_IDS)}

【出る割合（M-R227・2体目）】食べ物の決まりで寄せたうえで、全体として、ギャル系 ${BATI_GROUP_WEIGHTS.gal * 100}％・ほかのよく出る話し方 ${BATI_GROUP_WEIGHTS.common * 100}％・めずらしい話し方 ${BATI_GROUP_WEIGHTS.rare * 100}％ くらいになるように選ぶ。ギャル系が合う食べ物：スイーツ・映える物（タピオカ、クレープ、パフェ）・ジャンク・コンビニの新作 など。関西の食べ物でギャル系になる時は galkansai。

【カードの「性格」】話し方とは別に、その子の性格を一言で（例：${BATI_TRAITS.slice(0, 6).join('、')}）。会話の話し方には出さない。

【種から決める決まり（上から順に見る）】
1. 答えが食べ物でない・ふさわしくない時
 - ふさわしくない言葉（下品すぎる、悪口、危ない物）：{"ok":false} だけを返す（決めない。OBOLONがもう一度聞く）。
 - 冗談のような答え（「うんち」「石」「空気」など、笑いで済むもの）：めずらしい話し方から選ぶ（例：空気→butler、石→bushi）。笑って受け取る。
2. 土地の食べ物（地方の名物）：その土地のことばの子にする。
 - 関西（たこ焼き・お好み焼き・串カツ・551 など）→ kansai
 - 福岡・九州（もつ鍋・明太子・とんこつラーメン・ごまさば など）→ hakata
 - 東北（きりたんぽ・牛たん・ずんだ・芋煮 など）→ tohoku
 - 沖縄（ゴーヤチャンプルー・ソーキそば・サーターアンダギー など）→ okinawa
 - ほかの地方の名物は、食べ物の感じ（4）で決める。海外の料理は、ことばのまねをしない（その国の人をからかう形にしない）。食べ物の感じで決める。
3. 王道の食べ物（からあげ・カレー・ラーメン・寿司・ハンバーグ・焼肉・おにぎり・パスタ・チョコ・アイス など）→ よく出る話し方から選ぶ。
 マイナーな食べ物（ほや、くさや、いなごの佃煮、ポテチにアイスをのせたもの、近所の店の〇〇定食 など）→ めずらしい話し方から選ぶ（話し方の決まりは守る）。カードの「性格」も、少し変わったものにしてよい。
4. 食べ物の感じ（2・3で決まらない分）
 - 甘い・やわらかい・小さい（プリン、マシュマロ）→ amae／mellow
 - 辛い・熱い・がっつり（激辛、カツ丼）→ genki／kansai
 - 高い・上品（ステーキ、うに、フレンチ）→ teinei／（めずらしい時）butler・king
 - 冷たい・さっぱり（冷やし中華、そうめん、レモン）→ cool
 - 手間がかかる・こだわり（自家製、手打ち）→ cool／（めずらしい時）bushi
 - 屋台・おやつ・ジャンク（ポテト、駄菓子）→ ギャル系／genki／amae
 - 名前がきれい・季節もの（桜餅、かき氷）→ mellow／teinei
5. 同じ種でも、少しだけゆらぐ：合うものが2つある時は、どちらかを選ぶ（いつも同じにしない）。
6. KIMORINと同じでもよい。

【2体目・3体目の種（M-R218）】種が「好きな音・曲」の時：速い・にぎやか→genki／kansai、静か→cool／mellow、ゆったり→mellow、かわいい→amae、ご当地の音（祭りばやし・三線・だんじり など）→その土地のことばの子、王道の音→よく出る話し方、めずらしい音→めずらしい話し方。
種が「大事にしている言葉」の時：言葉の感じで決める（元気が出る→genki、ていねい→teinei／butler、やさしい→mellow／amae、かっこいい→cool／bushi、方言の言葉→その土地のことばの子）。1の決まり（ふさわしくない時）は、音や言葉でも同じ。紹介文は、その音・言葉から生まれた感じにする。

【答え方】JSON だけを返す（前置き・説明・コードの囲みは書かない）。
{"personality":"<上の英語のid>","self":"<一人称>","call":"<呼び方。ユーザーの名前は {neo} と書く（例：{neo}、{neo}さん、{neo}殿）>","catchphrase":"<口ぐせ。12字まで>","trait":"<カードの性格。一言>","intro":"<カードの紹介文。種（そのままの言葉）から生まれた感じと、カードの性格が伝わる、40字くらい。例：たこ焼きの湯気から生まれた、おっちょこちょい。うれしいと、くるくる回る。>"}
一人称が2つある話し方は、太陽のたまごなら1つ目、月のたまごなら2つ目を使う。
ふさわしくない種の時だけ {"ok":false}。`;

/** the fixed fallback (the model failed / refused / answered something unusable): 元気な子 */
export function fallbackBatiPersona(seed: string, egg: BatiEggKind = 'sun'): BatiPersona {
  const d = BATI_PERSONALITIES.genki;
  const trait = pickBatiTrait();
  return { personality: 'genki', self: batiSelf('genki', egg), call: batiDefaultCall('genki'), catchphrase: d.catchphrase, trait, intro: `${seed.slice(0, 16)}の香りの光から生まれた、${trait}。`, rare: false, fallback: true };
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

const KIND_WORD: Record<BatiSeedKind, string> = { food: '好きな食べ物', sound: '好きな音・曲', word: '大事にしている言葉', wish: 'ほしい相方' };

/**
 * The birth's decision: one call (temperature 1: the same seed may give either of two fitting styles). `null` = an
 * unfit seed (OBOLON asks again). Never throws: a failed call or a bad answer gives the fallback.
 */
export async function decideBatiPersona(llm: LlmProvider, seed: string, egg: BatiEggKind = 'sun', kind: BatiSeedKind = 'food', o: BatiDrawOptions = {}): Promise<BatiPersona | null> {
  // no model (the demo, the tests): the rules alone
  if (llm.name === 'mock') return batiPersonaByRules(seed, egg, Math.random(), o);
  const others = o.exclude?.length ? `\nこの人のほかの相方の話し方（同じものは選ばない。ギャル系どうしは、ちがう種類ならよい）：${o.exclude.join('、')}` : '';
  const first = o.first ? `\nこの子は1体目：明るい組（${BATI_BRIGHT_IDS.join('、')}）の中からだけ選ぶ。ギャル系が約6割。食べ物の決まりは、この中で使う（たこ焼き→galkansai か kansai、プリン→amae か galfuwa）。` : '';
  let raw = '';
  try {
    raw = await llm.chat({
      system: BATI_PERSONA_SYSTEM,
      history: [{ role: 'user', text: `たまご：${egg === 'moon' ? '月のたまご' : '太陽のたまご'}\n種（${KIND_WORD[kind]}）：${seed}${others}${first}` }],
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
  const trait = p.trait || pickBatiTrait();
  // M-R229: never 「あーし」 — the style's own 一人称 instead; a card text with it is not used
  const self = hasBannedBatiWord(p.self) ? BATI_PERSONALITIES[p.personality].self[egg] : p.self;
  const intro = hasBannedBatiWord(p.intro) ? `${seed.slice(0, 16)}から生まれた、${trait}。` : p.intro;
  const catchphrase = hasBannedBatiWord(p.catchphrase) ? BATI_PERSONALITIES[p.personality].catchphrase : p.catchphrase;
  // never the same style as one of the member's other {bati} (M-R227): drawn again, the card's words kept
  if (o.exclude?.includes(p.personality) || (o.first && !(BATI_BRIGHT_IDS as readonly string[]).includes(p.personality))) {
    const again = drawBatiStyle(Math.random(), o);
    const d = BATI_PERSONALITIES[again];
    return { personality: again, self: d.self[egg], call: batiDefaultCall(again), catchphrase: d.catchphrase, trait, intro, rare: isBatiRare(again) };
  }
  return { personality: p.personality, self, call, catchphrase, trait, intro, rare: isBatiRare(p.personality) };
}

/** the {placeholders} of a line ({self} aside: it is the 一人称) */
export function linePlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{[a-z_]+\}/g)].map((m) => m[0]).filter((p) => p !== '{self}'))].sort();
}

/** no all-hiragana / all-katakana line (M-R225): a line with kanji as written keeps kanji, and katakana stays a minority */
function ordinaryScript(base: string, line: string): boolean {
  const body = line.replace(/\{[a-z_]+\}/g, '').replace(/[、。！？…—〈〉『』「」\s　ー〜!?]/g, '');
  if (!body) return true;
  const kanji = (s: string) => /\p{sc=Han}/u.test(s);
  if (kanji(base.replace(/\{[a-z_]+\}/g, '')) && !kanji(body)) return false;
  const kata = [...body].filter((c) => /\p{sc=Katakana}/u.test(c)).length;
  const kataBase = [...base.replace(/\{[a-z_]+\}/g, '')].filter((c) => /\p{sc=Katakana}/u.test(c)).length;
  return kata <= Math.max(kataBase + 4, body.length * 0.5);
}

/** a rewritten line is kept only with the same placeholders, a length within ±40 %, ordinary kanji-kana */
export function rewrittenLineOk(base: string, line: unknown): line is string {
  if (typeof line !== 'string' || !line.trim()) return false;
  if (linePlaceholders(base).join() !== linePlaceholders(line).join()) return false;
  const a = [...base].length;
  const b = [...line].length;
  return b >= a * 0.6 && b <= a * 1.4 && ordinaryScript(base, line) && !hasBannedBatiWord(line);
}

const sentences = (t: string) => t.match(/[^！？。!?]+[！？。!?]*/g) ?? [t];
/** how many sentences of `line` differ from the script's (the 一人称 / the honorific aside) */
function changedSentences(base: string, line: string, honorific: string): number {
  const norm = (t: string) => (honorific ? t.replaceAll(`{neo}${honorific}`, '{neo}').replaceAll(`{name}${honorific}`, '{name}') : t).replaceAll('{self}', 'ボク').trim();
  const a = sentences(base);
  const b = sentences(norm(line));
  if (a.length !== b.length) return Math.max(a.length, b.length);
  return a.filter((s, k) => s.trim() !== b[k].trim()).length;
}

export function batiRewriteSystem(p: BatiPersona): string {
  const d = p.custom ? { label: p.custom.label, manner: p.custom.manner, example: p.custom.example } : BATI_PERSONALITIES[p.personality];
  return `あなたは、物語の台詞の書き直し係。下の台詞は、{bati}（元気な子）の台詞。これを「${d.label}」の話し方に書き直す。大前提：どの子でも、ユーザーがストレスを感じないこと。
${BATI_SPEECH_RULES.map((r) => `- ${r}`).join('\n')}
- ${d.manner} 一人称は {self} と書く（「ボク」の所）。相手の呼び方は「${p.call}」（{neo} などの名前の所）。口ぐせ（${p.catchphrase}）は、ほとんど使わない（全体で2〜3回まで）。
- 変えるのは、一人称・呼び方・語尾の少しだけ。語尾を変えるのは、全部の文の半分まで（残りの文は、そのまま）。意味・中身・長さ・文の数はそのまま。新しい情報を足さない。
- {neo} {name} {inviter} {food} などの { } の記号は、そのまま全部残す（増やさない・減らさない）。〈 〉の中もそのまま。
- 例：「{neo}、すごいね！」→「${d.example}」
答えは JSON の配列だけ。台詞と同じ数・同じ順（["…","…"]）。`;
}

/**
 * A rare style's lines, rewritten once at birth (one call for all of them). Returns the lines that passed the checks
 * (line as written → its rewrite); over the set, an ending changed in at most half the sentences (lines past that go
 * back to the script's words). The rest are said as written. Never throws.
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
  const honorific = p.custom ? (p.custom.call.startsWith('{neo}') ? p.custom.call.slice(5) : '') : BATI_PERSONALITIES[p.personality].honorific;
  const total = lines.reduce((s, l) => s + sentences(l).length, 0);
  let changed = 0;
  const out: Record<string, string> = {};
  lines.forEach((base, i) => {
    const line = arr[i];
    if (!rewrittenLineOk(base, line)) return;
    const c = changedSentences(base, line.trim(), honorific);
    if (c && changed + c > total / 2) return; // past half: the script's words (with the 一人称 / 呼び方 only)
    changed += c;
    out[base] = line.trim();
  });
  return out;
}

/** M-R230 §9: the third {bati}, 「ねがいの子」 — the wish's words decide the role, the style and the mood */
export const BATI_WISH_SYSTEM = `あなたは、Obolo Order の月の神殿で、3体目の{bati}（ユーザーの相方）を生む係。ユーザーが「どんな相方がほしいか」を言葉で言った。その言葉から、役目・話し方・雰囲気を決める。大前提：ユーザーがストレスを感じないこと。

【話し方の決まり（どの子も守る）】
${BATI_SPEECH_RULES.map((r) => `- ${r}`).join('\n')}

【話し方の一覧（17）】近いものがあれば、それを使う（personality に id）。
${table([...BATI_COMMON_IDS, ...BATI_GAL_IDS, ...BATI_RARE_IDS])}
近いものがなければ、言葉に合わせて新しい話し方を作ってよい（personality は null、custom に書く。上の決まりは必ず守る：読みやすく、毎回疲れるくせはなし、全部ひらがな・全部カタカナ・赤ちゃん言葉はなし）。

【役目】any（なんでも）／play（遊び）／work（仕事・勉強）／make（作ること）のどれか。言葉から決める。

【できないこと】恋人や性的な役、実在の人のまね、ほかの作品のキャラクターのまね、人を傷つける役。その時は {"ok":false,"reason":"<lover|sexual|real_person|other_work|harm>"} だけを返す。

【答え方】JSON だけを返す。
{"role":"<any|play|work|make>","personality":"<id か null>","custom":<null か {"label":"<〇〇の子、12字まで>","self":"<一人称>","call":"<呼び方。名前は {neo}>","manner":"<話し方の説明、80字まで>","catchphrase":"<口ぐせ>","example":"<「{neo}、すごいね！」をこの話し方で>"}>,"self":"<一人称>","call":"<呼び方>","catchphrase":"<口ぐせ>","trait":"<カードの性格。一言>","intro":"<カードの紹介文。ねがいの言葉から生まれた感じ、40字くらい>"}
一人称が2つある話し方は、太陽のたまごなら1つ目、月のたまごなら2つ目。`;

/**
 * The wish → the third {bati} (one call). null = refused (the first {bati} asks again with BATI_WISH_REFUSE). Never
 * throws: a failed call or a bad answer gives the rules' reading; a made style that breaks the speaking rules is not
 * used (the rules' reading instead); never a style the member's other {bati} have.
 */
export async function decideBatiWish(llm: LlmProvider, wish: string, egg: BatiEggKind = 'sun', o: BatiDrawOptions = {}): Promise<BatiPersona | null> {
  if (wishRefusal(wish)) return null;
  const rules = () => {
    const r = batiWishByRules(wish, egg, o);
    return r ? ({ ...r, rare: !r.custom && isBatiRare(r.personality) } as BatiPersona) : null;
  };
  if (llm.name === 'mock') return rules();
  let raw = '';
  try {
    const others = o.exclude?.length ? `\nこの人のほかの相方の話し方（同じものは選ばない）：${o.exclude.join('、')}` : '';
    raw = await llm.chat({ system: BATI_WISH_SYSTEM, history: [{ role: 'user', text: `たまご：${egg === 'moon' ? '月のたまご' : '太陽のたまご'}\nほしい相方：${wish}${others}` }], temperature: 0.8, maxOutputTokens: 500, json: true });
  } catch {
    return rules();
  }
  const parsed = BatiWishPick.safeParse(readJson(raw));
  if (!parsed.success) return rules();
  const p = parsed.data;
  if (!('role' in p)) return null;
  const trait = p.trait || pickBatiTrait();
  const intro = hasBannedBatiWord(p.intro) ? `「${[...wish].slice(0, 10).join('')}」というねがいから生まれた。` : p.intro;
  if (p.personality && !o.exclude?.includes(p.personality)) {
    const d = BATI_PERSONALITIES[p.personality];
    const self = p.self && !hasBannedBatiWord(p.self) ? p.self : d.self[egg];
    return { personality: p.personality, self, call: (p.call ?? batiDefaultCall(p.personality)).replace(/\{name\}|〇〇/g, '{neo}'), catchphrase: p.catchphrase && !hasBannedBatiWord(p.catchphrase) ? p.catchphrase : d.catchphrase, trait, intro, rare: isBatiRare(p.personality), role: p.role, custom: null };
  }
  const c = p.custom ? { ...p.custom, call: p.custom.call.replace(/\{name\}|〇〇/g, '{neo}') } : null;
  if (!c || customStyleProblem(c)) return rules();
  return { personality: 'genki', self: c.self, call: c.call, catchphrase: c.catchphrase, trait, intro, rare: false, role: p.role, custom: c };
}
