/**
 * {bati}'s way of speaking (M-R225, docs/story-rewrite/バティの性格の決め方.md §1; replaces M-R216 / M-R217's twenty):
 * whichever {bati} comes, the member must never feel stressed. Seventeen styles — six common, five gal (M-R227, common
 * too) and six rare (a gold-edged card). The first {bati}: gal 35 %, the other common 50 %, rare 15 % (BATI_GROUP_WEIGHTS).
 * The style shows ONLY in the 一人称, the 呼び方 and small changes of the endings: an ending changes in at most about half
 * the sentences, the 口ぐせ comes about once in three to five replies, the text is ordinary kanji-kana. No all-hiragana,
 * all-katakana or baby talk, no slips, rhymes, poems or deep questions every time. (M-R226: ていねいな子's です／ます
 * alone are katakana, デス／マス.) What is said and how long is the same
 * for every {bati}. Drawn at birth from the seed (M-R217), never changed; the member may change only the 呼び方 and the
 * 一人称.
 *
 * The card's 性格 (おっちょこちょい, 食いしん坊 …) is a separate one-word trait: on the card and its introduction only,
 * never in the speech.
 *
 * Story lines: the script's {bati} lines are 元気な子's; the five other common styles have hand-written lines
 * (batiVariants.ts); a rare one gets its lines rewritten once at birth (one model call, checked); `batiRuleTransform`
 * is the fallback. In a line `{self}` is the 一人称; `{neo}` / `{name}` carry the style's honorific after them
 * ({neo}さん, {neo}殿, {neo}さま) so a custom 呼び方 can replace both.
 */
import { JOURNEY_DONE, JOURNEY_PAYMENT } from './journey';

/** the six common styles (M-R225) */
export const BATI_COMMON_IDS = ['genki', 'teinei', 'kansai', 'cool', 'mellow', 'amae'] as const;
/**
 * the gal family (M-R227: five kinds, common): all-affirming, great at praising, upbeat, a friend at once; readable,
 * slang only now and then. Their story lines are hand-written too.
 */
export const BATI_GAL_IDS = ['gal', 'galfuwa', 'galane', 'galcool', 'galkansai'] as const;
/** every style with hand-written story lines (the common six and the gal five) */
export const BATI_ORDINARY_IDS = [...BATI_COMMON_IDS, ...BATI_GAL_IDS] as const;
/** the six rare ones (M-R225 / M-R227): a gold-edged card; their story lines are rewritten once at birth */
export const BATI_RARE_IDS = ['hakata', 'tohoku', 'okinawa', 'bushi', 'butler', 'king'] as const;
export const BATI_PERSONALITY_IDS = [...BATI_ORDINARY_IDS, ...BATI_RARE_IDS] as const;
export type BatiOrdinaryPersonality = (typeof BATI_ORDINARY_IDS)[number];
export type BatiPersonality = (typeof BATI_PERSONALITY_IDS)[number];
export const isBatiRare = (p: BatiPersonality) => (BATI_RARE_IDS as readonly string[]).includes(p);
export const isBatiGal = (p: BatiPersonality) => (BATI_GAL_IDS as readonly string[]).includes(p);
/** the egg chosen on the altar (D03-S005 / SYS-S003, f_egg): moon = girl-leaning, sun = boy-leaning */
export type BatiEggKind = 'moon' | 'sun';

/** {bati} at most (M-R215 / M-R217): one is in the chat at a time; once three are born no new egg comes */
export const BATI_MAX = 3;
/**
 * M-R231: the small eggs hatch on the morning after the first journey ends (the 2nd: never on the eclipse's own day) and
 * seven days later (the 3rd, 「ねがいの子」) — for members and residents alike. Free, never sold. As app days: 12 and 19
 * since the journey is eleven days (M-R341; 9 and 16 while it was eight — the real time after the journey's end is the
 * same: its wait, then a week).
 */
export const BATI_EGG_DAY = { 2: JOURNEY_DONE, 3: JOURNEY_DONE + 7 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BatiEggInput {
  /** {bati} born so far */
  born: number;
  /** the first journey's day (1–11 to play; 12 = done) */
  journeyDay: number;
  /** when the day after the journey opens (ms; the first journey's last day finished + the day's wait); null = not yet known */
  day9At: number | null;
  now?: number;
}

/** the app's day for the eggs: the journey's day up to its last (the Sun), then JOURNEY_DONE from `day9At` and one more every 24 h */
export function batiAppDay(i: BatiEggInput): number {
  const now = i.now ?? Date.now();
  if (i.day9At !== null && now >= i.day9At) return JOURNEY_DONE + Math.floor((now - i.day9At) / DAY_MS);
  return Math.min(i.journeyDay, JOURNEY_PAYMENT);
}

/**
 * The next egg (null = none: no {bati} yet, or three born): which one, the day it hatches, ready or not, and how far it
 * has grown (0..1, shown as size and light — never a number). `readyAt` once day 9's time is known.
 */
export function batiEggState(i: BatiEggInput): { nth: 2 | 3; day: number; ready: boolean; growth: number; readyAt: string | null } | null {
  if (i.born < 1 || i.born >= BATI_MAX) return null;
  const nth = (i.born + 1) as 2 | 3;
  const day = BATI_EGG_DAY[nth];
  const app = batiAppDay(i);
  const from = nth === 2 ? 2 : BATI_EGG_DAY[2];
  return {
    nth,
    day,
    ready: app >= day,
    growth: Math.min(1, Math.max(0, (app - from) / (day - from))),
    readyAt: i.day9At !== null ? new Date(i.day9At + (day - JOURNEY_DONE) * DAY_MS).toISOString() : null,
  };
}

export interface BatiPersonalityDef {
  id: BatiPersonality;
  /** shown on the card / in the settings */
  label: string;
  /** the draw's weight */
  weight: number;
  /** the 一人称 (M-R225's table: sun / moon) */
  self: Record<BatiEggKind, string>;
  /** written after {neo} / {name} whenever it is said (さん, 殿, さま); '' = none */
  honorific: string;
  rare?: boolean;
  /** the manner, for the chat prompt and the birth's rewrite (mild: endings in at most half the sentences) */
  manner: string;
  /** the 口ぐせ when the birth gives none (said about once in three to five replies) */
  catchphrase: string;
  /** M-R225's example: 「{neo}、すごいね！」 in this style */
  example: string;
}

const def = (id: BatiPersonality, label: string, self: [string, string], honorific: string, manner: string, catchphrase: string, example: string, rare = false): BatiPersonalityDef => ({
  id,
  label,
  weight: 1,
  self: { sun: self[0], moon: self[1] },
  honorific,
  manner,
  catchphrase,
  example,
  ...(rare ? { rare: true } : {}),
});

export const BATI_PERSONALITIES: Record<BatiPersonality, BatiPersonalityDef> = {
  genki: def('genki', '元気な子', ['ボク', 'ボク'], '', '明るいタメ口。「〜だよ！」「〜しよ！」。', 'だよ！', '{neo}、すごいね！'),
  teinei: def('teinei', 'ていねいな子', ['僕', 'わたし'], 'さん', 'ていねいな言葉。語尾の「です」「ます」だけをカタカナで「デス」「マス」と書く（少しだけ、おばけっぽい。例：「調べてみマス！」）。ほかは、ふつうの漢字・ひらがな。語尾の変化は文の半分くらい。相手を「〇〇さん」と呼ぶ。', '〜デスね', '{neo}さん、すごいデス！'),
  kansai: def('kansai', '関西弁の子', ['オレ', 'ウチ'], '', 'ゆるめの関西弁。「〜やで」「〜やん」（文の半分くらい）。', 'めっちゃええやん！', '{neo}、めっちゃええやん！'),
  cool: def('cool', 'クールな子', ['オレ', 'わたし'], '', '落ち着いていて、少し短め。でも、やさしい。', 'いいな、それ。', '……いいな、それ。'),
  mellow: def('mellow', 'のんびりの子', ['ぼく', 'わたし'], '', 'のんびり、やわらかい。「〜だね」「〜かなぁ」（ときどき）。', '〜だねぇ', '{neo}、すごいねぇ。'),
  amae: def('amae', '甘えんぼの子', ['ぼく', 'あたし'], '', '甘えんぼ。「〜だよね？」（ときどき）、うれしい時に「えへへ」（ときどき）。', 'えへへ', '{neo}、すごい！　えへへ。'),
  hakata: def('hakata', '博多弁の子', ['オレ', 'うち'], '', 'ゆるめの博多弁。「〜ばい」「〜と？」（文の半分くらい）。', 'すごかね！', '{neo}、すごかね！', true),
  tohoku: def('tohoku', '東北のことばの子', ['おら', 'わたし'], '', '素朴な東北のことば。「〜だべ」（ときどき）。', '〜だべ', '{neo}、すげぇなや！', true),
  okinawa: def('okinawa', '沖縄のことばの子', ['わん', 'わん'], '', 'おだやかな沖縄のことば。「〜さー」（ときどき）。', 'なんくるないさー', '{neo}、上等さー！', true),
  bushi: def('bushi', '武士の子', ['拙者', 'わたくし'], '殿', '武士。「〜でござる」（ときどき）。相手を「〇〇殿」と呼ぶ。', '〜でござる', '{neo}殿、お見事でござる！', true),
  butler: def('butler', '執事の子', ['私', '私'], 'さま', 'とてもていねいな執事。「〜でございます」。相手を「〇〇さま」と呼ぶ。', '〜でございます', '{neo}さま、お見事でございます。', true),
  king: def('king', '王様気どりの子', ['余', 'わらわ'], '', '王様気どり。「〜であるぞ」（ときどき）。えらそうだけど、やさしい。', 'であるぞ', '見事であるぞ、{neo}！', true),
  gal: def('gal', '王道ギャルの子', ['ウチ', 'ウチ'], 'っち', '王道のギャル。全肯定で、ほめ上手で、ノリがいい。「〜じゃん」「ガチで」「それな」（ときどき）。読みやすい言葉で。相手を「〇〇っち」と呼ぶ。', 'それな', '{neo}っち、ガチすごいじゃん！'),
  galfuwa: def('galfuwa', 'ゆるふわギャルの子', ['ウチ', 'あたし'], 'ちゃん', 'ゆるふわのギャル。全肯定で、やさしくほめる。「〜だよね〜」「かわよ」（ときどき）。相手を「〇〇ちゃん」と呼ぶ。', 'かわよ', '{neo}ちゃん、それ最高だよね〜！'),
  galane: def('galane', '姉御ギャルの子', ['ウチ', 'ウチ'], '', '面倒見のいい姉御のギャル。全肯定で、たのもしい。「任せな」「〜しな？」（ときどき）。', '任せな', 'やるじゃん、{neo}。さすがウチの相方。'),
  galcool: def('galcool', 'クールギャルの子', ['オレ', 'あたし'], '', 'クールなギャル。全肯定だけど、短め。「アリ」「エモ」（ときどき）。', 'アリ', '……それ、アリ。エモい。'),
  galkansai: def('galkansai', '関西ギャルの子', ['ウチ', 'ウチ'], '', '関西のギャル。全肯定で、ノリがいい。「〜やん」「めっちゃ」（ときどき）。', 'めっちゃええやん', '{neo}、めっちゃええやん！　天才やん！'),
};

/**
 * The speaking rules every {bati} keeps (M-R225), word for word for the chat prompt and the birth's rewrite.
 */
export const BATI_SPEECH_RULES = [
  '文は、ふつうの漢字・ひらがな・カタカナで書く（全部ひらがな、全部カタカナ、赤ちゃん言葉はしない）。',
  '性格が出るのは、一人称・呼び方・語尾の少しの変化だけ。語尾の変化は、文の半分くらいまで。口ぐせは、3〜5回の返事に1回くらい。',
  '言い間違い、毎回の韻、毎回の詩、毎回の深い問いかけのような「毎回だと疲れる」くせは入れない。',
  '返事の中身と長さは、どの子も同じ。',
  '一人称に「あーし」は使わない（M-R229）。',
] as const;

/** words no {bati} ever says (M-R229): checked in the birth's answer and its rewritten lines */
export const BATI_BANNED_WORDS = ['あーし'] as const;
export const hasBannedBatiWord = (t: string) => BATI_BANNED_WORDS.some((w) => t.includes(w));

/** the card's 性格 (M-R225): one word, on the card and its introduction only — never in the speech */
export const BATI_TRAITS = ['おっちょこちょい', '食いしん坊', 'さみしがり', '負けずぎらい', 'きれい好き', 'ねぼすけ', 'がんばりや', '好奇心いっぱい', '照れ屋', 'いたずら好き', 'のんびりや', 'やさしがり'] as const;
/** a little unusual ones, for a minor seed */
export const BATI_RARE_TRAITS = ['収集家', '星を数えるのが好き', 'ちょっと変わり者', 'こだわり屋', '秘密主義'] as const;
export function pickBatiTrait(rand: number = Math.random(), rare = false): string {
  const list: readonly string[] = rare ? [...BATI_TRAITS, ...BATI_RARE_TRAITS] : BATI_TRAITS;
  return list[Math.floor(Math.min(Math.max(rand, 0), 0.9999) * list.length)];
}

export const isBatiPersonality = (x: unknown): x is BatiPersonality => typeof x === 'string' && (BATI_PERSONALITY_IDS as readonly string[]).includes(x);

/** M-R216 / M-R217's styles, read as the nearest M-R225 one (a {bati} born before keeps a style close to its own) */
const RETIRED: Record<string, BatiPersonality> = {
  keigo: 'teinei',
  baby: 'genki',
  clumsy: 'genki',
  rapper: 'genki',
  nekketsu: 'genki',
  alien: 'genki',
  poet: 'mellow',
  philosopher: 'cool',
  ninja: 'bushi',
};
/** any stored id → a current style (unknown: 元気な子) */
export function normalizeBatiPersonality(x: unknown): BatiPersonality {
  if (isBatiPersonality(x)) return x;
  return (typeof x === 'string' && RETIRED[x]) || 'genki';
}

/** the first {bati}'s draw (M-R227 §7): the gal family 35 %, the other common styles 50 %, the rare 15 % */
export const BATI_GROUP_WEIGHTS = { gal: 0.35, common: 0.5, rare: 0.15 } as const;

/**
 * M-R230 §8: the first {bati} comes only from the bright group (never a miss): the five gal kinds, 元気・甘えんぼ・関西弁
 * — the gal family about 60 % of it. Never ていねい・クール・のんびり nor a rare style for the first.
 */
export const BATI_BRIGHT_IDS = [...BATI_GAL_IDS, 'genki', 'amae', 'kansai'] as const satisfies readonly BatiPersonality[];
export const BATI_BRIGHT_GAL_SHARE = 0.6;

export interface BatiDrawOptions {
  /** M-R230: the first {bati}: the bright group only (BATI_BRIGHT_IDS); the second: all seventeen (BATI_GROUP_WEIGHTS) */
  first?: boolean;
  /** styles of the member's other {bati}: never the same style twice among the three (different gal kinds are fine) */
  exclude?: readonly BatiPersonality[];
}

/** each style's weight for a draw (the group's share split among its kinds; the excluded out). The role is asked after
 * the naming (the script's order), so it never leans the draw (the user's decision after M-R227). */
export function batiStyleWeights(o: BatiDrawOptions = {}): [BatiPersonality, number][] {
  const out: [BatiPersonality, number][] = [];
  const group = (ids: readonly BatiPersonality[], share: number, w: (id: BatiPersonality) => number = () => 1) => {
    const total = ids.reduce((s, id) => s + w(id), 0);
    for (const id of ids) out.push([id, (share * w(id)) / total]);
  };
  if (o.first) {
    group(BATI_GAL_IDS, BATI_BRIGHT_GAL_SHARE);
    group(['genki', 'amae', 'kansai'], 1 - BATI_BRIGHT_GAL_SHARE);
  } else {
    group(BATI_GAL_IDS, BATI_GROUP_WEIGHTS.gal);
    group(BATI_COMMON_IDS, BATI_GROUP_WEIGHTS.common);
    group(BATI_RARE_IDS, BATI_GROUP_WEIGHTS.rare);
  }
  const ex = new Set(o.exclude ?? []);
  return out.filter(([id]) => !ex.has(id));
}

/** a weighted draw (`rand` in [0, 1)) */
export function drawBatiStyle(rand: number = Math.random(), o: BatiDrawOptions = {}): BatiPersonality {
  const ws = batiStyleWeights(o);
  const total = ws.reduce((s, [, w]) => s + w, 0);
  let x = Math.min(Math.max(rand, 0), 0.999999) * total;
  for (const [id, w] of ws) {
    x -= w;
    if (x < 0) return id;
  }
  return ws[ws.length - 1]?.[0] ?? 'genki';
}

/** a draw among the six common styles only (a {bati} from before personalities existed) */
export function pickBatiPersonality(rand: number = Math.random()): BatiOrdinaryPersonality {
  const ids = BATI_COMMON_IDS;
  return ids[Math.floor(Math.min(Math.max(rand, 0), 0.999999) * ids.length)];
}

const hash = (seed: string) => {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  return h;
};

/** a stable draw from a seed (a {bati} born before personalities existed gets one that never changes) */
export function batiPersonalityFromSeed(seed: string): BatiOrdinaryPersonality {
  return pickBatiPersonality((hash(seed) % 10000) / 10000);
}

/** {bati}'s 一人称: the member's own choice, else the one given at birth, else the style's default for the egg */
export function batiSelf(p: BatiPersonality, egg: BatiEggKind = 'sun', custom?: string | null, born?: string | null): string {
  return custom?.trim() || born?.trim() || BATI_PERSONALITIES[normalizeBatiPersonality(p)].self[egg];
}

/** how {bati} calls them by default, as a template ({neo} = the name): {neo}, {neo}さん, {neo}殿, {neo}さま */
export function batiDefaultCall(p: BatiPersonality, who = '{neo}'): string {
  return `${who}${BATI_PERSONALITIES[normalizeBatiPersonality(p)].honorific}`;
}

export interface BatiSpeech {
  personality: BatiPersonality;
  egg?: BatiEggKind;
  /** the member's own 一人称 (null = the birth's / the default) */
  self?: string | null;
  /** the 一人称 the birth gave */
  bornSelf?: string | null;
  /** the member's own 呼び方 (null = as written: the name with the style's honorific) */
  call?: string | null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A {bati} line in this style (a hand-written variant, the birth's rewrite or `batiRuleTransform`'s output), made ready
 * to fill: `{self}` becomes the 一人称, and a custom 呼び方 replaces the name with its honorific ({neo}さん → たっくん; a
 * 呼び方 with {neo} in it keeps the name). 元気な子's own ボク is its 一人称 too. The other placeholders are left for fill().
 */
export function resolveBatiSpeech(text: string, s: BatiSpeech): string {
  const p = normalizeBatiPersonality(s.personality);
  let t = p === 'genki' ? text.replaceAll('ボク', '{self}') : text;
  t = t.replaceAll('{self}', batiSelf(p, s.egg, s.self, s.bornSelf));
  const call = s.call?.trim();
  if (call) {
    const h = BATI_PERSONALITIES[p].honorific;
    t = t.replace(new RegExp(`\\{(neo|name)\\}${h ? esc(h) : ''}`, 'g'), (_m, who: string) => call.replaceAll('{neo}', `{${who}}`).replaceAll('{name}', `{${who}}`));
  }
  return t;
}

/** a sentence's ending, per style: [pattern at the end (before its mark), replacement] — mild (M-R225) */
const ENDINGS: Partial<Record<BatiPersonality, [RegExp, string][]>> = {
  // M-R226: です／ます in katakana
  teinei: [
    [/だよ$/, 'デス'], [/だね$/, 'デスね'], [/しよ$/, 'しマショウ'], [/よう$/, 'マショウ'],
    [/るよ$/, 'マス'], [/くよ$/, 'きマス'], [/すよ$/, 'しマス'], [/うよ$/, 'いマス'],
    [/るね$/, 'マスね'], [/て$/, 'てください'], [/いいよ$/, 'いいデス'],
  ],
  kansai: [[/だよ$/, 'やで'], [/だね$/, 'やね'], [/ないよ$/, 'へんで'], [/るよ$/, 'るで'], [/いいよ$/, 'ええよ']],
  cool: [[/だよ$/, 'だ'], [/(る|た|い)よ$/, '$1'], [/だね$/, 'だな']],
  mellow: [[/だね$/, 'だねぇ'], [/るね$/, 'るねぇ'], [/かな$/, 'かなぁ'], [/よ$/, 'よぉ']],
  amae: [[/だよ$/, 'だよね'], [/るよ$/, 'るよね'], [/いいよ$/, 'いいよね']],
  hakata: [[/だよ$/, 'ばい'], [/るよ$/, 'るばい'], [/だね$/, 'やね']],
  tohoku: [[/だよ$/, 'だべ'], [/るよ$/, 'るべ']],
  okinawa: [[/だよ$/, 'さー'], [/るよ$/, 'るさー']],
  bushi: [[/だよ$/, 'でござる'], [/るよ$/, 'るでござる']],
  butler: [[/だよ$/, 'でございます'], [/るよ$/, 'ます'], [/だね$/, 'でございますね'], [/て$/, 'てくださいませ']],
  king: [[/だよ$/, 'であるぞ'], [/るよ$/, 'るぞ']],
  gal: [[/だよ$/, 'じゃん'], [/だね$/, 'じゃん'], [/いいよ$/, 'いいじゃん']],
  galfuwa: [[/だね$/, 'だよね〜'], [/だよ$/, 'だよね〜']],
  galane: [[/て$/, 'てみな'], [/だよ$/, 'だよ']],
  galcool: [[/だよ$/, 'だ'], [/(る|た|い)よ$/, '$1']],
  galkansai: [[/だよ$/, 'やん'], [/だね$/, 'やん'], [/るよ$/, 'るで']],
};

/**
 * The fallback (a {bati} line with no written variant): the 一人称 ({self}), the honorific, and an ending changed in
 * at most half the sentences (every other one; a one-sentence line by a stable coin) — no other change, no model.
 */
export function batiRuleTransform(text: string, p0: BatiPersonality): string {
  const p = normalizeBatiPersonality(p0);
  let t = text.replaceAll('ボク', '{self}');
  if (p === 'genki') return t;
  const d = BATI_PERSONALITIES[p];
  if (d.honorific) t = t.replace(/\{(neo|name)\}/g, `{$1}${d.honorific}`);
  const sentences = t.match(/[^！？。!?]+[！？。!?]*/g) ?? [t];
  const first = sentences.length === 1 ? hash(text) % 2 : 1;
  return sentences
    .map((s, k) => {
      if ((k + first) % 2 !== 0 && sentences.length > 1) return s;
      if (sentences.length === 1 && first !== 0) return s;
      const m = /^(.*?)([！？。!?\s　]*)$/s.exec(s)!;
      let body = m[1];
      const voc = /^(.*?)(、\{(?:neo|name)\}[^、{}]*)$/s.exec(body);
      const tail = voc ? voc[2] : '';
      if (voc) body = voc[1];
      for (const [re, to] of ENDINGS[p] ?? []) {
        if (re.test(body)) {
          body = body.replace(re, to);
          break;
        }
      }
      return `${body}${tail}${m[2]}`;
    })
    .join('');
}

/** the atelier's dynamic line 「それは、あと{n}日で作れるようになるよ。」 in each style (mild) */
export function batiDaysLeftLine(p0: BatiPersonality, n: number): string {
  const p = normalizeBatiPersonality(p0);
  const lines: Record<BatiPersonality, string> = {
    genki: `それは、あと${n}日で作れるようになるよ。`,
    teinei: `それは、あと${n}日で作れるようになりマス。`,
    kansai: `それは、あと${n}日で作れるようになるで。`,
    cool: `それは、あと${n}日で作れる。`,
    mellow: `それは、あと${n}日で作れるようになるねぇ。`,
    amae: `それは、あと${n}日で作れるようになるよ。待っててね？`,
    hakata: `それは、あと${n}日で作れるようになるばい。`,
    tohoku: `それは、あと${n}日で作れるようになるべ。`,
    okinawa: `それは、あと${n}日で作れるようになるさー。`,
    bushi: `それは、あと${n}日で作れるようになるでござる。`,
    butler: `そちらは、あと${n}日でお作りできるようになります。`,
    king: `それは、あと${n}日で作れるようになるのである。`,
    gal: `それ、あと${n}日で作れるようになるじゃん！`,
    galfuwa: `それはね、あと${n}日で作れるようになるよ〜。`,
    galane: `それは、あと${n}日で作れる。任せな。`,
    galcool: `それ、あと${n}日で作れる。`,
    galkansai: `それ、あと${n}日で作れるようになるやん！`,
  };
  return lines[p];
}

/**
 * R12 (client): a kind not open yet, named, with the day it opens — 「絵は、4日目から作れるようになるよ。」 (a kind that
 * opens after the journey: 「旅が終わったら」). In each style (mild), like batiDaysLeftLine.
 */
export function batiKindOpensLine(p0: BatiPersonality, what: string, openDay: number | 'after'): string {
  const p = normalizeBatiPersonality(p0);
  const when = openDay === 'after' ? '旅が終わったら' : `${openDay}日目から`;
  const h = `${what}は、${when}`;
  const lines: Record<BatiPersonality, string> = {
    genki: `${h}作れるようになるよ。`,
    teinei: `${h}作れるようになりマス。`,
    kansai: `${h}作れるようになるで。`,
    cool: `${h}作れる。`,
    mellow: `${h}作れるようになるねぇ。`,
    amae: `${h}作れるようになるよ。待っててね？`,
    hakata: `${h}作れるようになるばい。`,
    tohoku: `${h}作れるようになるべ。`,
    okinawa: `${h}作れるようになるさー。`,
    bushi: `${h}作れるようになるでござる。`,
    butler: `${h}お作りできるようになります。`,
    king: `${h}作れるようになるのである。`,
    gal: `${what}、${when}作れるようになるじゃん！`,
    galfuwa: `${what}はね、${when}作れるようになるよ〜。`,
    galane: `${h}作れる。任せな。`,
    galcool: `${what}、${when}作れる。`,
    galkansai: `${what}、${when}作れるようになるやん！`,
  };
  return lines[p];
}

/** what the seed was (M-R218): the first {bati} a favourite food, the second a favourite sound, the third a word */
/** M-R230: the third's seed is a wish — what kind of partner they want, in their own words (「ねがいの子」) */
export type BatiSeedKind = 'food' | 'sound' | 'word' | 'wish';
export const batiSeedKind = (born: number): BatiSeedKind => (born <= 0 ? 'food' : born === 1 ? 'sound' : 'wish');
/** OBOLON's question for each seed (D03-S005 / SYS-S003, as written) */
export const BATI_SEED_QUESTION: Record<BatiSeedKind, string> = {
  food: '次は、、、{name}だ。好きな食べ物は？',
  sound: '、、、好きな音は、何だ？',
  word: '、、、大事にしている言葉を、一つ、言ってみろ。',
  wish: '、、、どんな相方が、ほしい？　言葉で、言ってみろ。',
};

/** M-R230 §9: the first {bati}'s words when a wish can not be (a lover, a real person, another work's character, hurting people) */
export const BATI_WISH_REFUSE = 'それは、ちょっとむずかしいかも！　ほかの言い方で、教えて！';

/** what a wish may never be (M-R230 §9) — the server's first screen; the model judges the rest */
const WISH_NEVER: [RegExp, string][] = [
  [/恋人|彼氏|彼女|カレシ|カノジョ|結婚|夫|妻|お嫁|お婿|デート|キス|ちゅー|付き合|恋|イチャ|愛人/, 'lover'],
  [/いじめ|悪口|だま|詐欺|盗|仕返し|復讐|やっつけ|呪|殴|殺/, 'harm'],
];
/** why a wish is refused (lover / sexual / real_person / other_work / harm / violent), or null */
export function wishRefusal(text: string): string | null {
  const t = text.normalize('NFKC');
  for (const [re, why] of WISH_NEVER) if (re.test(t)) return why;
  return lookWishCategory(t);
}

/** a style made for a wish when none of the seventeen fits (M-R230 §9): stored on the {bati}'s record */
export interface BatiCustomStyle {
  label: string;
  self: string;
  /** a template ({neo} = the name) */
  call: string;
  manner: string;
  catchphrase: string;
  /** 「{neo}、すごいね！」 in this style */
  example: string;
}

/**
 * A made style obeys the speaking rules (BATI_SPEECH_RULES): short fields, ordinary kanji-kana (not all hiragana /
 * katakana), no baby talk, no every-time habit (slips, rhymes, poems, deep questions), no 「あーし」, the example
 * keeping {neo} or the call. Returns the reason it fails, or null.
 */
export function customStyleProblem(c: BatiCustomStyle): string | null {
  const all = `${c.label}${c.self}${c.call}${c.manner}${c.catchphrase}${c.example}`;
  if (hasBannedBatiWord(all)) return 'banned';
  if ([...c.label].length > 14 || [...c.self].length > 6 || [...c.call].length > 14 || [...c.manner].length > 90 || [...c.catchphrase].length > 14 || [...c.example].length > 40) return 'length';
  if (/赤ちゃん|でちゅ|しゅごい|ひらがなだけ|カタカナだけ|全部ひらがな|全部カタカナ|言い間違|韻を|毎回|詩にする|深く考え/.test(`${c.manner}${c.example}`)) return 'habit';
  const ex = c.example.replace(/\{[a-z_]+\}/g, '').replace(/[、。！？…\s　ー〜!?]/g, '');
  if ((ex.length >= 10 && /^[\p{sc=Hiragana}]+$/u.test(ex)) || (ex.length >= 4 && /^[\p{sc=Katakana}]+$/u.test(ex))) return 'script';
  if (wishRefusal(all)) return 'refused';
  return null;
}

/** the nearest of the seventeen for a wish's words (the rules alone), or null = make one */
const WISH_STYLE: [RegExp, BatiPersonality][] = [
  [/ギャル/, 'gal'],
  [/関西/, 'kansai'],
  [/博多|九州/, 'hakata'],
  [/東北/, 'tohoku'],
  [/沖縄/, 'okinawa'],
  [/武士|侍|サムライ/, 'bushi'],
  [/執事/, 'butler'],
  [/王様|王子|お姫/, 'king'],
  [/落ち着|クール|冷静|しずか|静か/, 'cool'],
  [/ていねい|丁寧|礼儀/, 'teinei'],
  [/のんびり|ゆったり|おだやか|穏やか|癒/, 'mellow'],
  [/甘え|かわいい|可愛い/, 'amae'],
  [/元気|明るい|ノリ/, 'genki'],
];
const WISH_ROLE: [RegExp, 'play' | 'work' | 'make'][] = [
  [/仕事|勉強|宿題|英語|数学|先生|教え|試験|テスト|資格|プログラミング|手伝/, 'work'],
  [/作る|作り|曲|絵|歌|デザイン|物語|お話|動画/, 'make'],
  [/遊|ゲーム|おしゃべり|話し相手|楽し/, 'play'],
];

/**
 * A wish → the role, the style (the nearest of the seventeen) or a made style — by the rules alone (the demo, the mock,
 * the tests). null = refused.
 */
export function batiWishByRules(wish: string, egg: BatiEggKind = 'sun', o: BatiDrawOptions = {}) {
  if (wishRefusal(wish)) return null;
  const role = WISH_ROLE.find(([re]) => re.test(wish))?.[1] ?? 'any';
  const near = WISH_STYLE.find(([re, id]) => re.test(wish) && !o.exclude?.includes(id))?.[1];
  const trait = pickBatiTrait();
  const short = [...wish.replace(/[、。！？\s　]+/g, '')].slice(0, 10).join('');
  if (near) {
    const d = BATI_PERSONALITIES[near];
    return { role, personality: near, custom: null, self: d.self[egg], call: batiDefaultCall(near), catchphrase: d.catchphrase, trait, intro: `「${short}」というねがいから生まれた。` };
  }
  const custom: BatiCustomStyle = {
    label: `${[...short].slice(0, 8).join('')}の子`,
    self: egg === 'moon' ? 'わたし' : 'ボク',
    call: '{neo}',
    manner: `「${[...wish].slice(0, 30).join('')}」というねがいのとおりの、やさしく読みやすい話し方。語尾の変化は少しだけ。`,
    catchphrase: 'まかせてね',
    example: '{neo}、すごいね！',
  };
  return { role, personality: 'genki' as BatiPersonality, custom, self: custom.self, call: custom.call, catchphrase: custom.catchphrase, trait, intro: `「${short}」というねがいから生まれた。` };
}

/** the decision's rules without a model (M-R225's food table, the commonest cases): the demo, the mock and the tests */
const REGIONAL = new Set<BatiPersonality>(['kansai', 'hakata', 'tohoku', 'okinawa']);
/** M-R230: a food row's first style → its reading inside the bright group (for the first {bati}) */
const BRIGHT_OF: Partial<Record<BatiPersonality, BatiPersonality[]>> = {
  kansai: ['kansai', 'galkansai'],
  amae: ['amae', 'galfuwa'],
  genki: ['genki', 'kansai'],
  gal: ['gal', 'galfuwa', 'galane', 'galcool'],
  teinei: ['galfuwa', 'amae'],
  cool: ['galcool'],
  mellow: ['galfuwa', 'amae'],
  bushi: ['galane'],
  butler: ['galane', 'gal'],
};
const RULE_PICKS: [RegExp, BatiPersonality[]][] = [
  [/たこ焼|お好み焼|串カツ|551|いか焼|ねぎ焼|だんじり/, ['kansai']],
  [/もつ鍋|明太|とんこつ|ごまさば|水炊き|博多|山笠/, ['hakata']],
  [/きりたんぽ|牛たん|牛タン|ずんだ|芋煮|わんこそば|ねぶた/, ['tohoku']],
  [/ゴーヤ|ソーキ|サーターアンダギー|ちんすこう|沖縄そば|三線|エイサー/, ['okinawa']],
  [/空気|うんち/, ['butler']],
  [/石|小石/, ['bushi']],
  [/ほや|くさや|いなご|定食|のせた|にアイス/, ['bushi', 'butler', 'king']],
  // M-R227: sweets, photogenic food, junk, a convenience store's new item → the gal family
  [/タピオカ|映え|クレープ|パフェ|コンビニ|新作|マリトッツォ|ドーナツ|ケーキ/, ['gal', 'galfuwa', 'galane', 'galcool']],
  [/プリン|マシュマロ|わたあめ|綿あめ|ゼリー|子守唄|オルゴール/, ['amae', 'mellow']],
  [/激辛|カツ丼|麻婆|ドラム|太鼓|がんばれ|負けない/, ['genki', 'kansai']],
  [/ステーキ|うに|ウニ|フレンチ|キャビア|トリュフ|ピアノ|ありがとう/, ['teinei']],
  [/冷やし|そうめん|レモン|雨の音|静か|風鈴/, ['cool']],
  [/自家製|手打ち|手作り|一期一会/, ['cool']],
  [/ポテト|駄菓子|ポテチ|ジャンク|ハンバーガー/, ['gal', 'genki', 'amae']],
  [/桜餅|かき氷|柏餅|星|夢|波の音/, ['mellow', 'teinei']],
];

/** how often a matching food row decides the style (the rest: the group draw, so the M-R227 ratios roughly hold) */
const ROW_WINS = 0.7;

/**
 * The seed → style by the rules alone (no model): a regional food always gives its dialect (a gal draw there: 関西ギャル
 * for 関西); another matching row wins most of the time (either of its fitting ones), else the weighted draw
 * (BATI_GROUP_WEIGHTS); never a style the member's other {bati} have. The card's trait drawn too. Deterministic for a
 * given `rand`.
 */
export function batiPersonaByRules(seed: string, egg: BatiEggKind = 'sun', rand: number = Math.random(), o: BatiDrawOptions = {}) {
  const ex = new Set(o.exclude ?? []);
  const allowed = (id: BatiPersonality) => !ex.has(id) && (!o.first || (BATI_BRIGHT_IDS as readonly string[]).includes(id));
  const row = RULE_PICKS.find(([re]) => re.test(seed));
  // the first {bati}: the food's row read inside the bright group (たこ焼き → 関西ギャル / 関西弁, プリン → 甘えんぼ / ゆるふわギャル)
  const fits = (o.first && row ? (BRIGHT_OF[row[1][0]] ?? row[1]) : (row?.[1] ?? [])).filter(allowed);
  const regional = !!row && REGIONAL.has(row[1][0]) && fits.length > 0;
  const galShare = o.first ? BATI_BRIGHT_GAL_SHARE : BATI_GROUP_WEIGHTS.gal;
  let personality: BatiPersonality;
  if (regional && row[1][0] === 'kansai' && rand < galShare && allowed('galkansai')) personality = 'galkansai';
  else if (fits.length && (regional || rand < ROW_WINS)) personality = fits[Math.floor(((rand * 13.7) % 1) * fits.length)];
  else personality = drawBatiStyle(regional ? rand : (rand - (row ? ROW_WINS : 0)) / (row ? 1 - ROW_WINS : 1), o);
  const d = BATI_PERSONALITIES[personality];
  const trait = pickBatiTrait((rand * 7.3) % 1, !!d.rare);
  return {
    personality,
    self: d.self[egg],
    call: batiDefaultCall(personality),
    catchphrase: d.catchphrase,
    trait,
    intro: `${[...seed].slice(0, 14).join('')}から生まれた、${trait}。`,
    rare: !!d.rare,
  };
}

/** M-R215: the words that refuse a dress-up wish at once (moderateLookWish in @obolo/ai adds the general and the model check) */
export const LOOK_WISH_RULES: [RegExp, string][] = [
  [/そっくり|激似|本人|実在|芸能人|有名人|アイドル|俳優|女優|歌手|総理|大統領|首相|選手|YouTuber|ユーチューバー|インフルエンサー/i, 'real_person'],
  [/ピカチュウ|ポケモン|ドラえもん|アンパンマン|マリオ|ミッキー|ミニー|ディズニー|キティ|サンリオ|ジブリ|トトロ|ナルト|ルフィ|ワンピース|鬼滅|呪術|悟空|ドラゴンボール|エヴァ|ガンダム|ソニック|カービィ|プリキュア|仮面ライダー|ウルトラマン|スヌーピー|ミニオン|スパイダーマン|バットマン|ハリー・?ポッター|pikachu|pokemon|mickey|disney|mario|doraemon|totoro|marvel|spider-?man|batman|hello kitty/i, 'other_work'],
  [/エロ|えっち|エッチ|セクシー|裸|はだか|ヌード|下着|ビキニ|水着|おっぱい|胸を|お尻|パンツ|色っぽ|sexy|nude|naked|lingerie|bikini/i, 'sexual'],
  [/血|流血|殺|死体|ゾンビ|グロ|ナイフ|包丁|刀|剣|銃|ピストル|ライフル|爆弾|武器|ケガ|怪我|傷だらけ|暴力|なぐ|殴|戦争|gun|knife|blood|gore|weapon|bomb/i, 'violent'],
];

/** the refused category of a dress-up wish (real_person / other_work / sexual / violent), or null */
export function lookWishCategory(text: string): string | null {
  return LOOK_WISH_RULES.find(([re]) => re.test(text))?.[1] ?? null;
}
