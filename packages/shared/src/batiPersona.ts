/**
 * {bati}'s personality (M-R215 / M-R216, client decision 2026-11-22): one of eight, drawn at birth (a little gacha —
 * either egg can give any) and never changed. The member may change only how {bati} calls them (呼び方) and {bati}'s
 * first-person pronoun (一人称). The story's {bati} lines are written as 元気な子; the others change only the manner of
 * speech — the same meaning and length. The fixed lines have hand-written variants (apps/web/lib/story/batiVariants.json);
 * `batiRuleTransform` below is only the fallback for a line missing there.
 *
 * In a variant, `{self}` is {bati}'s 一人称 (filled by `resolveBatiSpeech`); `{neo}` / `{name}` keep the script's meaning,
 * with the personality's honorific written after them ({neo}さま, {neo}ちゃん) so a custom 呼び方 can replace both.
 */

/** the eight ordinary personalities (M-R216): their fixed story lines are hand-written (batiVariants.ts) */
export const BATI_ORDINARY_IDS = ['genki', 'keigo', 'baby', 'clumsy', 'kansai', 'cool', 'mellow', 'king'] as const;
/** the twelve rare ones (M-R217): a gold-edged card; their story lines are rewritten once at birth (one model call) */
export const BATI_RARE_IDS = ['hakata', 'tohoku', 'okinawa', 'bushi', 'ninja', 'butler', 'gal', 'poet', 'rapper', 'nekketsu', 'philosopher', 'alien'] as const;
export const BATI_PERSONALITY_IDS = [...BATI_ORDINARY_IDS, ...BATI_RARE_IDS] as const;
export type BatiOrdinaryPersonality = (typeof BATI_ORDINARY_IDS)[number];
export type BatiPersonality = (typeof BATI_PERSONALITY_IDS)[number];
export const isBatiRare = (p: BatiPersonality) => (BATI_RARE_IDS as readonly string[]).includes(p);
/** the egg chosen on the altar (D03-S005, f_egg): moon = girl-leaning, sun = boy-leaning */
export type BatiEggKind = 'moon' | 'sun';

/** {bati} at most (M-R215 / M-R217): one is in the chat at a time; once three are born no new egg comes (no sleeping, no trading) */
export const BATI_MAX = 3;
/** the small glowing egg grows for this many days, then hatches in the Moon temple (free, never sold) */
export const BATI_EGG_DAYS = 88;
export const BATI_EGG_MS = BATI_EGG_DAYS * 24 * 60 * 60 * 1000;

export interface BatiPersonalityDef {
  id: BatiPersonality;
  /** shown in the Bati room / settings */
  label: string;
  /** the draw's weight (uniform-ish, M-R216) */
  weight: number;
  /** default 一人称 per egg (M-R216: moon → the second form, sun → the first; single-form personalities the same) */
  self: Record<BatiEggKind, string>;
  /** written after {neo} / {name} whenever it is said (さま, ちゃん); '' = none */
  honorific: string;
  /** written after the name only when {bati} calls out to them (〜, よ); '' = none */
  callTail: string;
  /** a 呼び方 that is not the name at all (詩人の子: 君) */
  callAs?: string;
  rare?: boolean;
  /** the 口ぐせ when the birth's model gave none */
  catchphrase: string;
  /** the manner, for the chat prompt */
  manner: string;
  /** the client's examples (base → this personality), for the chat prompt */
  examples: [string, string][];
}

/** a rare personality (M-R217's table): the 一人称 is [sun, moon]; the example is 「{neo}、すごいね！」 in its manner */
function rare(id: BatiPersonality, label: string, self: [string, string], honorific: string, manner: string, catchphrase: string, example: string, callAs?: string): BatiPersonalityDef {
  return { id, label, weight: 1, rare: true, self: { sun: self[0], moon: self[1] }, honorific, callTail: '', manner, catchphrase, examples: [['{neo}、すごいね！', example]], ...(callAs ? { callAs } : {}) };
}

export const BATI_PERSONALITIES: Record<BatiPersonality, BatiPersonalityDef> = {
  genki: {
    id: 'genki',
    catchphrase: 'だよ！',
    label: '元気な子',
    weight: 1,
    self: { sun: 'ボク', moon: 'ボク' },
    honorific: '',
    callTail: '',
    manner: '明るく元気なタメ口。「〜だよ！」「〜しよ！」。',
    examples: [
      ['うん！ いくよ、{neo}！', 'うん！ いくよ、{neo}！'],
      ['{neo}、すごいね！', '{neo}、すごいね！'],
    ],
  },
  keigo: {
    id: 'keigo',
    catchphrase: '〜です',
    label: '敬語の子',
    weight: 1,
    self: { sun: 'わたくし', moon: 'わたくし' },
    honorific: 'さま',
    callTail: '',
    manner: 'ていねいな敬語。「〜です」「〜ます」。相手を「〇〇さま」と呼ぶ。',
    examples: [
      ['うん！ いくよ、{neo}！', 'はい！ 参ります、{neo}さま！'],
      ['{neo}、すごいね！', '{neo}さま、お見事です！'],
      ['それは、あと2日で作れるようになるよ。', 'そちらは、あと2日で作れるようになります。'],
    ],
  },
  baby: {
    id: 'baby',
    catchphrase: '〜でちゅ',
    label: '赤ちゃん言葉の子',
    weight: 1,
    self: { sun: 'ぼく', moon: 'あたち' },
    honorific: 'ちゃん',
    callTail: '',
    manner: '赤ちゃん言葉。「〜でちゅ」「しゅごい」「ちゅくる」。相手を「〇〇ちゃん」と呼ぶ。',
    examples: [
      ['うん！ いくよ、{neo}！', 'あい！ いくでちゅ、{neo}ちゃん！'],
      ['{neo}、すごいね！', '{neo}ちゃん、しゅごいの！'],
      ['それは、あと2日で作れるようになるよ。', 'それはね、あと2日でちゅくれるの。'],
    ],
  },
  clumsy: {
    id: 'clumsy',
    catchphrase: 'あ、まちがえた！',
    label: 'おっちょこちょいの子',
    weight: 1,
    self: { sun: 'オレ', moon: 'あたし' },
    honorific: '',
    callTail: '',
    manner: 'おっちょこちょい。ときどき言いまちがえて、すぐに言い直す（中身はいつも正しい）。',
    examples: [
      ['うん！ いくよ、{neo}！', 'うん！ いく……あ、待って、いくよ、{neo}！'],
      ['{neo}、すごいね！', '{neo}、すご……すごいね！'],
      ['それは、あと2日で作れるようになるよ。', 'それは、あと3日……じゃなくて、2日で作れるよ。'],
    ],
  },
  kansai: {
    id: 'kansai',
    catchphrase: 'めっちゃええやん！',
    label: '関西弁の子',
    weight: 1,
    // M-R216 lists ウチ・オレ; moon (girl-leaning) takes ウチ (see the open question in docs/placeholders.md P-BATI-PERSONA)
    self: { sun: 'オレ', moon: 'ウチ' },
    honorific: '',
    callTail: '',
    manner: '関西弁。「〜やで」「めっちゃ」「ええやん」「ほな」。',
    examples: [
      ['うん！ いくよ、{neo}！', 'よっしゃ！ いくで、{neo}！'],
      ['{neo}、すごいね！', '{neo}、めっちゃええやん！'],
      ['それは、あと2日で作れるようになるよ。', 'それは、あと2日で作れるようになるで。'],
    ],
  },
  cool: {
    id: 'cool',
    catchphrase: '……悪くない。',
    label: 'クールな子',
    weight: 1,
    self: { sun: 'オレ', moon: 'わたし' },
    honorific: '',
    callTail: '',
    manner: 'クール。短く、少しそっけない。「……ああ。」「〜だ。」。でも本当はやさしい。',
    examples: [
      ['うん！ いくよ、{neo}！', '……ああ。いくぞ、{neo}。'],
      ['{neo}、すごいね！', '……悪くない。'],
      ['それは、あと2日で作れるようになるよ。', 'それは、あと2日だ。'],
    ],
  },
  mellow: {
    id: 'mellow',
    catchphrase: '〜だねぇ',
    label: 'のんびりの子',
    weight: 1,
    self: { sun: 'ぼく', moon: 'わたし' },
    honorific: '',
    callTail: '〜',
    manner: 'のんびり。語尾をのばす。「〜だねぇ」「〜よぉ」。相手を「〇〇〜」と呼ぶ。',
    examples: [
      ['うん！ いくよ、{neo}！', 'うん〜。いこっかぁ、{neo}〜。'],
      ['{neo}、すごいね！', '{neo}〜、すごいねぇ〜。'],
      ['それは、あと2日で作れるようになるよ。', 'それはねぇ、あと2日で、作れるよぉ。'],
    ],
  },
  king: {
    id: 'king',
    catchphrase: 'うむ！',
    label: '王様気どりの子',
    weight: 1,
    self: { sun: '余', moon: '余' },
    honorific: '',
    callTail: 'よ',
    manner: '王様気どり。「〜じゃ」「うむ」「〜であるぞ」。相手を「〇〇よ」と呼ぶ。えらそうだけど、やさしい。',
    examples: [
      ['うん！ いくよ、{neo}！', 'うむ！ 参るぞ、{neo}よ！'],
      ['{neo}、すごいね！', '{neo}よ、見事であるぞ！'],
      ['それは、あと2日で作れるようになるよ。', 'それは、あと2日で作れるようになるのじゃ。'],
    ],
  },
  hakata: rare('hakata', '博多弁の子', ['オイ', 'うち'], '', '博多弁。「〜ばい」「〜と？」「すごか」。', 'すごかね〜！', '{neo}、すごかね〜！'),
  tohoku: rare('tohoku', '東北のことばの子', ['おら', 'わ'], '', '東北のことば。「〜だべ」「すげぇなや」。素朴であたたかい。', '〜だべ', '{neo}、すげぇなや！'),
  okinawa: rare('okinawa', '沖縄のことばの子', ['わん', 'わん'], '', '沖縄のことば。「〜さー」「なんくるないさー」「上等さー」。', 'なんくるないさー', '{neo}、上等さー！'),
  bushi: rare('bushi', '武士の子', ['拙者', '拙者'], '殿', '武士。「〜でござる」「天晴れ」。相手を「〇〇殿」と呼ぶ。', '〜でござる', '{neo}殿、天晴れでござる！'),
  ninja: rare('ninja', '忍者の子', ['それがし', 'それがし'], 'どの', '忍者。「〜ニン」。気配を消したがる。相手を「〇〇どの」と呼ぶ。', '〜ニン', '……{neo}どの、見事ニン。'),
  // 〇〇お嬢さま／〇〇坊ちゃま (M-R217): which one is the member's choice of 呼び方; the default is 〇〇さま
  butler: rare('butler', '執事の子', ['私', '私'], 'さま', '執事。丁寧すぎる敬語。「〜でございます」「かしこまりました」。', '〜でございます', '実に、お見事でございます。'),
  gal: rare('gal', 'ギャルの子', ['ウチ', 'あーし'], 'っち', 'ギャル。「〜じゃん」「ガチで」「神」。相手を「〇〇っち」と呼ぶ。', 'ガチ神じゃん！', '{neo}っち、ガチ神じゃん！'),
  poet: rare('poet', '詩人の子', ['ぼく', 'わたし'], '', '詩人。何でも詩にする。短く、きれいな言葉。相手を「君（きみ）」と呼ぶ。', '君は、今日の、星だ。', '{neo}……君は、今日の、星だ。', '君'),
  rapper: rare('rapper', 'ラッパーの子', ['オレ', 'アタシ'], '', 'ラッパー。韻をふむ。「YEAH！」。', 'YEAH！', '{neo}、マジ天才、宇宙で最高、YEAH！'),
  nekketsu: rare('nekketsu', '熱血の子', ['オレ', 'あたし'], '', '熱血。「〜だぜ！」。すぐ燃える。', '燃えてきたぜ！！', '{neo}、燃えてきたぜ！！'),
  philosopher: rare('philosopher', '哲学者の子', ['吾輩', '吾輩'], 'くん', '哲学者。何でも深く考える。「〜とは、何だろうね」。相手を「〇〇くん」と呼ぶ。', '〜とは、何だろうね', 'すごい、とは、何だろうね、{neo}くん。'),
  alien: rare('alien', '宇宙人の子', ['ワレワレ', 'ワレワレ'], '', '宇宙人。「〜デス」。地球の言葉を勉強中で、カタコト。', '〜デス', '{neo}、スゴイ、デス。ワレワレ、カンドウ。'),
};

export const isBatiPersonality = (x: unknown): x is BatiPersonality => typeof x === 'string' && (BATI_PERSONALITY_IDS as readonly string[]).includes(x);

/** a draw among the eight ordinary ones (weights above; the fallback when the birth's model gives none); `rand` in [0, 1) */
export function pickBatiPersonality(rand: number = Math.random()): BatiOrdinaryPersonality {
  const total = BATI_ORDINARY_IDS.reduce((s, id) => s + BATI_PERSONALITIES[id].weight, 0);
  let x = Math.min(Math.max(rand, 0), 0.999999) * total;
  for (const id of BATI_ORDINARY_IDS) {
    x -= BATI_PERSONALITIES[id].weight;
    if (x < 0) return id;
  }
  return 'genki';
}

/** a stable draw from a seed (a {bati} born before personalities existed gets one that never changes) */
export function batiPersonalityFromSeed(seed: string): BatiOrdinaryPersonality {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  return pickBatiPersonality((h % 10000) / 10000);
}

/** {bati}'s 一人称: the member's own choice, else the one given at birth, else the personality's default for the egg */
export function batiSelf(p: BatiPersonality, egg: BatiEggKind = 'sun', custom?: string | null, born?: string | null): string {
  return custom?.trim() || born?.trim() || BATI_PERSONALITIES[p].self[egg];
}

/** how {bati} calls them by default, as a template ({neo} = the name): 〇〇さま, 〇〇〜, 君 … */
export function batiDefaultCall(p: BatiPersonality, who = '{neo}'): string {
  const d = BATI_PERSONALITIES[p];
  return d.callAs ?? `${who}${d.honorific}${d.callTail}`;
}

export interface BatiSpeech {
  personality: BatiPersonality;
  egg?: BatiEggKind;
  /** the member's own 一人称 for {bati} (null = the one given at birth / the default) */
  self?: string | null;
  /** the 一人称 the birth gave (M-R217) */
  bornSelf?: string | null;
  /** the member's own 呼び方 (null = as the line is written: the name with the personality's honorific) */
  call?: string | null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A {bati} line in this personality's manner (a hand-written variant, the birth's rewrite or `batiRuleTransform`'s
 * output), made ready to fill: `{self}` becomes the 一人称, and a custom 呼び方 replaces the name with its honorific
 * ({neo}さま → たっくん; a 呼び方 with {neo} in it keeps the name: {neo}お嬢さま). 元気な子's own ボク is its 一人称 too.
 * The other placeholders are left for fill().
 */
export function resolveBatiSpeech(text: string, s: BatiSpeech): string {
  let t = s.personality === 'genki' ? text.replaceAll('ボク', '{self}') : text;
  t = t.replaceAll('{self}', batiSelf(s.personality, s.egg, s.self, s.bornSelf));
  const call = s.call?.trim();
  if (call) {
    const h = BATI_PERSONALITIES[s.personality].honorific;
    t = t.replace(new RegExp(`\\{(neo|name)\\}${h ? esc(h) : ''}`, 'g'), (_m, who: string) => call.replaceAll('{neo}', `{${who}}`).replaceAll('{name}', `{${who}}`));
  }
  return t;
}

/** one sentence's ending rules per personality: [pattern at the end of the sentence (before its mark), replacement] */
const ENDINGS: Partial<Record<BatiPersonality, [RegExp, string][]>> = {
  keigo: [
    [/だよ$/, 'です'], [/だね$/, 'ですね'], [/しよ$/, 'しましょう'], [/ろ$/, 'りましょう'], [/よう$/, 'ましょう'],
    [/るよ$/, 'ます'], [/くよ$/, 'きます'], [/すよ$/, 'します'], [/うよ$/, 'います'], [/つよ$/, 'ちます'], [/むよ$/, 'みます'],
    [/るね$/, 'ますね'], [/かな$/, 'でしょうか'], [/いい$/, 'よろしいですか'], [/て$/, 'てください'], [/よ$/, 'です'], [/ね$/, 'ですね'],
  ],
  baby: [[/だよ$/, 'でちゅ'], [/るよ$/, 'るでちゅ'], [/よ$/, 'でちゅ'], [/だね$/, 'でちゅね']],
  kansai: [[/だよ$/, 'やで'], [/だね$/, 'やな'], [/ないよ$/, 'へんで'], [/よ$/, 'で'], [/ね$/, 'な'], [/しよ$/, 'しよか']],
  cool: [[/だよ$/, 'だ'], [/だね$/, 'だな'], [/(る|た|い)よ$/, '$1'], [/よ$/, ''], [/ね$/, ''], [/しよ$/, 'しよう'], [/て$/, 'てくれ']],
  mellow: [[/だよ$/, 'だよぉ'], [/よ$/, 'よぉ'], [/ね$/, 'ねぇ'], [/しよ$/, 'しようねぇ'], [/かな$/, 'かなぁ']],
  king: [[/だよ$/, 'じゃ'], [/だね$/, 'じゃな'], [/るよ$/, 'るのじゃ'], [/よ$/, 'ぞ'], [/ね$/, 'のう'], [/しよ$/, 'しようぞ'], [/て$/, 'てみよ'], [/いい$/, 'よいか']],
};
/** words said the same in every line, per personality */
const WORDS: Partial<Record<BatiPersonality, [RegExp, string][]>> = {
  keigo: [[/^うん/, 'はい'], [/じゃあ/g, 'では'], [/^ねえ/, 'あの']],
  baby: [[/^うん/, 'あい'], [/すごい/g, 'しゅごい'], [/して/g, 'ちて'], [/作る/g, 'ちゅくる'], [/使う/g, 'ちゅかう']],
  kansai: [[/^うん/, 'よっしゃ'], [/じゃあ/g, 'ほな'], [/^ねえ/, 'なあ'], [/いい(?=[！？。]|$)/g, 'ええ']],
  cool: [[/^うん/, '……ああ'], [/^ねえ、?/, '……']],
  mellow: [[/^うん/, 'うん〜'], [/じゃあ/g, 'じゃあ〜']],
  king: [[/^うん/, 'うむ'], [/じゃあ/g, 'では'], [/^ねえ/, 'のう']],
};

/**
 * The fallback (a {bati} line missing from the hand-written variants): the common endings, interjections, the 一人称
 * ({self}) and the honorific, sentence by sentence. Meaning and length stay; deterministic, no model at runtime.
 */
export function batiRuleTransform(text: string, p: BatiPersonality): string {
  if (p === 'genki') return text.replaceAll('ボク', '{self}');
  const d = BATI_PERSONALITIES[p];
  let t = text.replaceAll('ボク', '{self}');
  // the honorific after the name; the calling tail only where it is called out (「{neo}、」 「、{neo}！」)
  t = t.replace(/\{(neo|name)\}/g, `{$1}${d.honorific}`);
  if (d.callTail) t = t.replace(new RegExp(`(\\{(?:neo|name)\\}${esc(d.honorific)})(?=[、！。？]|$)`, 'g'), `$1${d.callTail}`);
  for (const [re, to] of WORDS[p] ?? []) t = t.replace(re, to);
  if (p === 'clumsy') {
    // says the first word wrong, then again (「すご……すごいね！」)
    const m = /^([…　\s]*)([^、。！？…\s{]{2})/.exec(t);
    return m ? `${m[1]}${m[2]}……${t.slice(m[1].length)}` : t;
  }
  const sentences = t.match(/[^！？。!?]+[！？。!?]*/g) ?? [t];
  t = sentences
    .map((s) => {
      const m = /^(.*?)([！？。!?\s　]*)$/s.exec(s)!;
      let body = m[1];
      let mark = m[2];
      // 「いくよ、{neo}！」: the ending is before the name called out
      const voc = /^(.*?)(、\{(?:neo|name)\}[^、{}]*)$/s.exec(body);
      const tail = voc ? voc[2] : '';
      if (voc) body = voc[1];
      for (const [re, to] of ENDINGS[p] ?? []) {
        if (re.test(body)) {
          body = body.replace(re, to);
          break;
        }
      }
      const said = `${body}${tail}`;
      if (p === 'cool') mark = mark.replace(/！/g, '。');
      if (p === 'mellow') mark = mark.replace(/！/g, said.endsWith('〜') ? '。' : '〜。');
      return `${said}${mark}`;
    })
    .join('');
  if (p === 'cool' && !t.startsWith('……')) t = `……${t}`;
  return t;
}

/**
 * The atelier's dynamic line 「それは、あと{n}日で作れるようになるよ。」 in each personality (M-R216's own example), for
 * the lines written at runtime (they have no hand-written variants). `{self}` / names are not used.
 */
export function batiDaysLeftLine(p: BatiPersonality, n: number): string {
  const lines: Record<BatiPersonality, string> = {
    genki: `それは、あと${n}日で作れるようになるよ。`,
    keigo: `そちらは、あと${n}日で作れるようになります。`,
    baby: `それはね、あと${n}日でちゅくれるの。`,
    clumsy: `それは、あと${n + 1}日……じゃなくて、${n}日で作れるよ。`,
    kansai: `それは、あと${n}日で作れるようになるで。`,
    cool: `それは、あと${n}日だ。`,
    mellow: `それはねぇ、あと${n}日で、作れるよぉ。`,
    king: `それは、あと${n}日で作れるようになるのじゃ。`,
    hakata: `それは、あと${n}日で作れるようになるばい。`,
    tohoku: `それは、あと${n}日で作れるようになるべ。`,
    okinawa: `それは、あと${n}日で作れるようになるさー。`,
    bushi: `それは、あと${n}日で作れるようになるでござる。`,
    ninja: `……それは、あと${n}日で作れるニン。`,
    butler: `そちらは、あと${n}日でお作りできるようになります。`,
    gal: `それ、あと${n}日で作れるようになるじゃん！`,
    poet: `それは、${n}日の夜を越えて、生まれるもの。`,
    rapper: `それは、あと${n}日、待てば作れる、YEAH！`,
    nekketsu: `それは、あと${n}日で作れるようになるぜ！`,
    philosopher: `それは、あと${n}日。待つ、とは、何だろうね。`,
    alien: `ソレハ、アト${n}ニチデ、ツクレル、デス。`,
  };
  return lines[p];
}

/** what the seed was (M-R218): the first {bati} a favourite food, the second a favourite sound, the third a word */
export type BatiSeedKind = 'food' | 'sound' | 'word';
export const batiSeedKind = (born: number): BatiSeedKind => (born <= 0 ? 'food' : born === 1 ? 'sound' : 'word');
/** OBOLON's question for each seed (D03-S005 / M-R218, as written) */
export const BATI_SEED_QUESTION: Record<BatiSeedKind, string> = {
  food: '次は、、、{name}だ。好きな食べ物は？',
  sound: '、、、好きな音は、何だ？',
  word: '、、、大事にしている言葉を、一つ、言ってみろ。',
};

/** the decision's rules without a model (M-R217 §2, the commonest cases): the demo, the mock and the tests */
const RULE_PICKS: [RegExp, BatiPersonality[]][] = [
  [/たこ焼|お好み焼|串カツ|551|いか焼|ねぎ焼/, ['kansai']],
  [/もつ鍋|明太|とんこつ|ごまさば|水炊き|博多/, ['hakata']],
  [/きりたんぽ|牛たん|牛タン|ずんだ|芋煮|わんこそば/, ['tohoku']],
  [/ゴーヤ|ソーキ|サーターアンダギー|ちんすこう|沖縄そば|三線/, ['okinawa']],
  [/うんち|空気/, ['ninja']],
  [/石|小石/, ['philosopher']],
  [/ほや|くさや|いなご|定食|のせた|にアイス/, ['alien', 'gal', 'bushi']],
  [/プリン|マシュマロ|わたあめ|綿あめ|ゼリー|子守唄|オルゴール/, ['baby', 'mellow']],
  [/激辛|カツ丼|麻婆|ドラム|太鼓|がんばれ|負けない/, ['nekketsu', 'genki']],
  [/ステーキ|うに|ウニ|フレンチ|キャビア|トリュフ|ピアノ|ありがとう/, ['king', 'keigo', 'butler']],
  [/冷やし|そうめん|レモン|雨の音|静か|風鈴/, ['cool']],
  [/自家製|手打ち|手作り|一期一会/, ['philosopher', 'bushi']],
  [/ポテト|駄菓子|ポテチ|ジャンク/, ['clumsy', 'gal']],
  [/せんべい|ポップコーン|ラップ|ビート/, ['rapper']],
  [/桜餅|かき氷|柏餅|星|夢|波の音/, ['poet']],
];

/**
 * The seed → personality by the rules alone (no model): the matching row (either of two fitting ones), else a draw
 * among the ordinary ones. Deterministic for a given `rand`.
 */
export function batiPersonaByRules(seed: string, egg: BatiEggKind = 'sun', rand: number = Math.random()) {
  const row = RULE_PICKS.find(([re]) => re.test(seed));
  const personality: BatiPersonality = row ? row[1][Math.floor(Math.min(rand, 0.9999) * row[1].length)] : pickBatiPersonality(rand);
  const d = BATI_PERSONALITIES[personality];
  return {
    personality,
    self: d.self[egg],
    call: batiDefaultCall(personality),
    catchphrase: d.catchphrase,
    intro: `${[...seed].slice(0, 14).join('')}から生まれた。${d.label.replace(/の子$/, '')}で、いつもそばにいる。`,
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
