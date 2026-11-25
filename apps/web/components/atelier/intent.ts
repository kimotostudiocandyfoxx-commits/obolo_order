import { spellSaid, type BluenaPlanet, type ItemMarkId, type MarkNames } from '@obolo/shared';
import type { AtelierKind } from '@/lib/atelier/unlock';

/**
 * R12 (client): the words of a request to make (作って / 描いて / ほしい / 魔法で …) and of a search for something that
 * exists (探して / 見せて / 見たい / 調べて / 〇〇の画像ある？). Only a search word with no making word is a picture search.
 */
const ART_WORD = /アート|絵|イラスト|画像|がぞう|写真|しゃしん|ペイント|お絵かき|おえかき|ピクチャ/;
// 「え、かいて」「えかいて」: 絵 in kana (only in front of a drawing / making word)
const KANA_E = /(^|[^ぁ-ん])え(を|、|,|\s)?(かいて|描いて|つくって|作って|ほしい|欲しい)/;
const ART = new RegExp(`${ART_WORD.source}|描いて|描きたい|描く|描け|かいて|かきたい|${KANA_E.source}`);
const MAKE = /作って|つくって|作りたい|つくりたい|作ろ|つくろ|作れ|つくれ|作る|つくる|創って|描いて|描きたい|描く|描け|かいて|かきたい|生成|ほしい|欲しい|魔法で|まほうで|スペル/;
const SEE = /見せて|みせて|見たい|(?<!て)みたい(?!な)|探して|さがして|探したい|さがしたい|調べて|しらべて|検索|けんさく|ある[？?]|あります[かー]?[？?]?|ない[？?]/;
/** R12: a request to make with no kind named (「魔法で作って欲しい」): the kind comes from the talk before (carry.ts) */
const MAKE_ANY = /作って|つくって|作りたい|つくりたい|作れる|つくれる|創って|魔法で|まほうで|生成して/;

/**
 * What a request in the Moon atelier's chat asks for (M-R210): plain keyword matching, no model. More than one kind,
 * or none at all, is ambiguous — {bati} asks back. Words that only change the last thing made ("もっと明るく",
 * "やり直して") are a refinement of the newest card.
 */
const WORDS: [AtelierKind, RegExp][] = [
  ['look', /姿|見た目|プロフィール|アイコン|自分の顔/],
  ['bati', /着せ?かえ|着替え|変身|コスプレ/],
  // R12: seeing / finding a picture needs a clear search word (SEE); 「画像を作って」 is art (detect sorts them)
  ['image', /画像|がぞう|写真|しゃしん|絵|イラスト|見せて|みせて/],
  ['lookup', /調べ|しらべ|教えて|おしえて|ってなに|って何|とは[？?]?$|知りたい|しりたい/],
  ['voice', /コロリン|ころりん|つぶや|メモ/],
  ['art', ART],
  ['song', /曲|歌|うた|音楽|おんがく|ソング|BGM|ＢＧＭ|メロディ/i],
  ['video', /映像|えいぞう|MV|ＭＶ|ムービー|動画|どうが|ビデオ/i],
  ['radio', /ラジオ|番組/],
  // client 2026-11-25: a book (a story chapter by chapter) and a small game
  ['novel', /小説|物語|ものがたり|お話(を|に|が|、|。|！|$)|おはなし(を|に|が|、|。|$)|(?<!日|見|絵)本(を|に|が|、|。|！|$)|ブック/],
  ['game', /ゲーム/],
];

const REFINE = /もっと|やり直|やりなお|ちがう|違う|変えて|かえて|にして|っぽく|明るく|暗く|元気に|静かに|かわいく|かっこよく|足して|入れて/;

export type Intent =
  | { kind: 'find'; star: boolean; mark?: ItemMarkId; planet?: BluenaPlanet }
  | { kind: 'make'; what: AtelierKind; content: string }
  | { kind: 'refine'; content: string }
  | { kind: 'ask'; options: AtelierKind[] }
  | { kind: 'talk'; content: string }
  /** R12: 「魔法で作って欲しい」 — making, no kind named */
  | { kind: 'makeAny'; content: string };

/** the words around the keyword: 「」 quotes win, otherwise the request with the "make a …" part taken off */
export function contentOf(text: string): string {
  const q = text.match(/[「『"](.+?)[」』"]/);
  if (q) return q[1].trim();
  // R12: a greeting before the request is not what to make (「ヤッホー画像を作って…」)
  const t = text.replace(/^(ヤッホー|やっほー|やっほ|ヤッホ|ねえバティ|ねえ|ねぇ|ねー|あのね|あの|えっと|バティ)[、,！!\s　ー〜]*/, '').trim();
  // R12: the description after the request (「画像を作って欲しいんだけど、空飛ぶクジラが…」) is what to make
  const m = REQUEST.exec(t);
  if (m) {
    const after = t.slice(m.index + m[0].length).replace(/^[、。,.！!？?\s　]+/, '').trim();
    if (after.replace(/[、。！!？?\s　]/g, '').length >= 2) {
      const before = t
        .slice(0, m.index)
        .replace(/(画像|がぞう|写真|絵|イラスト|アート|曲|歌|音楽|動画|映像|MV|ムービー|本|小説|物語|ゲーム)$/i, '')
        .trim();
      return [before, after].filter(Boolean).join('、').replace(/[！!。]+$/, '');
    }
  }
  return t
    .replace(/(を|で|の)?(作って|つくって|作りたい|つくりたい|作る|つくる|描いて|かいて|お願い|おねがい|ください|して|ちょうだい)(欲しい|ほしい|ください|くれる|くれない)?(な|の|よ|ね)?[？?！!。]*$/, '')
    .replace(/(を|が|の)?(欲しい|ほしい)[な！!。]*$/, '')
    .trim();
}
/** 「〇〇を作って欲しいんだけど」: the making words, with what may follow them */
const REQUEST = /(を|で|の|が)?(作って|つくって|描いて|かいて|作りたい|つくりたい|描きたい|作れる|つくれる|生成して)(欲しい|ほしい|ください|くれる|くれない|ちょうだい|もらえる|みて)?(ん?だ?けど|んですけど|んだが|が|な|の|よ|ね)?[？?！!。、]*/;

/**
 * M-R236 §4: 「★がついた曲、見せて」「♠の画像、出して」 — show your works with a ★ / a mark (a mark by its sign, its
 * name, or the name you gave it), of one planet when its kind is named. Asking to see, with no ★ or mark, is not this.
 */
const FIND = /見せ|みせ|出して|だして|探して|さがして|見たい|みたい|どれ|一覧|リスト|教えて/;
const STAR = /[★☆⭐]|星(が|の)?つい|ほし(が|の)?つい|お気に入り|おきにいり/;
const MARK_WORDS: [ItemMarkId, RegExp][] = [
  ['spade', /♠|♤|スペード/],
  ['diamond', /♦|♢|ダイヤ/],
  ['heart', /♥|♡|❤|ハート/],
  ['club', /♣|♧|クラブ/],
];
const FIND_PLANET: [BluenaPlanet, RegExp][] = [
  ['saturn', /コロリン|ころりん|つぶやき/],
  ['jupiter', /アート|絵|画像|写真|イラスト/],
  ['mercury', /曲|歌|うた/],
  ['mars', /映像|MV|ＭＶ|ムービー|動画/i],
  ['venus', /ラジオ|番組/],
];
export function detectFind(text: string, names?: MarkNames): Extract<Intent, { kind: 'find' }> | null {
  const t = text.trim();
  if (!FIND.test(t)) return null;
  const star = STAR.test(t);
  let mark = MARK_WORDS.find(([, re]) => re.test(t))?.[0];
  if (!mark && names) mark = (Object.entries(names) as [ItemMarkId, string][]).find(([, n]) => n && n.length >= 1 && new RegExp(`${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(の|が|で|しるし)`).test(t))?.[0];
  if (!star && !mark) return null;
  return { kind: 'find', star, mark, planet: FIND_PLANET.find(([, re]) => re.test(t))?.[0] };
}

export function detect(text: string, hasCard: boolean, names?: MarkNames): Intent {
  // R13: プロンプト / 呪文 / 指示文 are the spell
  const t = spellSaid(text.trim());
  const found = detectFind(t, names);
  if (found) return found;
  let kinds = WORDS.filter(([, re]) => re.test(t)).map(([k]) => k);
  // R12 (client): a picture to SEE needs a search word and no making word (「絵を見せて」「パンダの写真ある？」); with a
  // making word it is art (「画像を作って欲しい」「イラストほしい」「え、かいて」); with neither, a picture word is art too
  const making = MAKE.test(t);
  const seeing = SEE.test(t) && !making;
  if (kinds.includes('image')) {
    if (seeing) kinds = kinds.filter((k) => k !== 'art' && k !== 'lookup');
    else kinds = kinds.filter((k) => k !== 'image');
  }
  // 「描き方を教えて」 is a question
  if (kinds.includes('lookup') && /(方|かた)(を|って|が)?(教えて|おしえて|知りたい|しりたい)/.test(t)) kinds = ['lookup'];
  else if (kinds.includes('lookup') && making) kinds = kinds.filter((k) => k !== 'lookup');
  // 「お話をかいて」 is a book (かいて = 書いて); a drawing word beside another kind with no picture named goes with it
  if (kinds.includes('art') && kinds.length > 1 && !ART_WORD.test(t) && !KANA_E.test(t)) kinds = kinds.filter((k) => k !== 'art');
  // 「姿を変身」 is the look
  if (kinds.includes('look') && kinds.includes('bati') && !/バティ|着せ?かえ|着替え/.test(t)) kinds = kinds.filter((k) => k !== 'bati');
  if (kinds.includes('video') && kinds.includes('song')) kinds = kinds.filter((k) => k !== 'song'); // 「この曲のMV」
  if (kinds.includes('radio') && kinds.includes('song')) kinds = kinds.filter((k) => k !== 'song'); // 「曲を流すラジオ」
  if (kinds.length === 1) return { kind: 'make', what: kinds[0], content: contentOf(t) };
  if (kinds.length > 1) return { kind: 'ask', options: kinds };
  if (hasCard && REFINE.test(t)) return { kind: 'refine', content: t };
  if (MAKE_ANY.test(t)) return { kind: 'makeAny', content: contentOf(t) };
  // a question is a lookup; anything else is just talk ({bati} asks what to do with it)
  if (/[？?]$|なに|なんで|どうして|いつ|どこ/.test(t)) return { kind: 'make', what: 'lookup', content: t };
  return { kind: 'talk', content: t };
}

/** how each kind is said in a chip / a line */
export const KIND_WORD: Record<AtelierKind, string> = {
  look: '自分の姿',
  bati: '着せかえ・変身',
  lookup: '調べもの',
  image: '絵を見る',
  voice: 'コロリン',
  art: 'アート',
  song: '曲',
  video: '映像（MV）',
  radio: 'ラジオ番組',
  novel: '本',
  game: 'ゲーム',
};

/** the request names only the kind (「アートを作って」): {bati} asks what it should be */
export function isBare(content: string): boolean {
  let t = content;
  for (const [, re] of WORDS) t = t.replace(new RegExp(re.source, 'g' + re.flags.replace('g', '')), '');
  // R12: the request's own words (欲しい / 魔法で / お願い / ヤッホー …) say nothing about what to make either
  t = t.replace(/ヤッホー|やっほー|やっほ|ねえ|ねぇ|バティ|魔法|まほう|欲しい|ください|ちょうだい|お願い|おねがい|んだけど|けど|なにか|何か|なんか|一つ|ひとつ|一枚|いちまい|描|かい/g, '');
  // 「新しく曲を作って」 (M-R253 §1: a new card) names only the kind too
  return t.replace(/新しく|あたらしく|別の|べつの|もう一つ|もうひとつ/g, '').replace(/[をのでとにがはもへ、。！!？?\s　]|作|つく|して|ほしい|たい/g, '').length < 2;
}

/**
 * {bati}'s short lines around the making.
 * PLACEHOLDER (P-ATELIER-5): UI stand-ins until the story script writes them.
 */
export const ASK: Record<AtelierKind, string> = {
  look: 'どんなふうに変える？',
  bati: 'どんなかっこうにする？',
  lookup: 'なにを調べる？',
  image: 'なんの絵を見る？',
  voice: 'なんてつぶやく？',
  art: 'どんな絵にする？',
  song: 'どんな曲にする？ 歌にしたいことを話して',
  video: 'どんな映像にする？',
  radio: '番組の名前は？',
  novel: 'どんなお話にする？',
  game: 'どんなゲームにする？',
};
export const DONE: Record<AtelierKind, string> = {
  look: 'どう？ 気に入ったら〔これにする〕。「もっと…」で、まだ変えられるよ',
  bati: 'どう？ 似合ってる？',
  lookup: '',
  image: '',
  voice: 'コロリンになったよ。ブルーナにしまったよ',
  art: 'できたよ。ブルーナにしまったよ。「もっと明るく」みたいに言えば、描き直すね',
  song: 'できたよ。聴いてみて。ブルーナにしまったよ',
  video: 'できたよ。ブルーナにしまったよ',
  radio: '準備できたよ。〔録る〕を押して、話してね',
  // (books and games say CRAFT_LINES after they are made)
  novel: '',
  game: '',
};

/**
 * iPad feedback: {bati}'s opening in the atelier is a short greeting — no 「なにをする？」 and no row of kinds (you ask
 * in words; 「なにをする？」 and the kinds still come when the words were not understood). `returning`: the first talk of a
 * visit when there were talks before → 「おかえり！」; otherwise the two やっほー in turn (`turn`: 0 / 1). No name → the
 * plain one. Returns the line as written ({neo} filled by the caller, after {bati}'s manner). A story step never shows it (the day's script lines are said as written).
 * PLACEHOLDER (P-ATELIER-5): UI words, not from the script.
 */
export const GREETINGS = { hello: 'やっほー！', helloName: 'やっほー、{neo}！', back: 'おかえり！' } as const;
export function greetingOf({ neo, returning, turn }: { neo?: string | null; returning: boolean; turn: number }): string {
  if (returning) return GREETINGS.back;
  if (turn % 2 === 1 && neo) return GREETINGS.helloName;
  return GREETINGS.hello;
}

/**
 * client 2026-11-24: does a question want a picture beside its answer (things one can see: an animal, a place, a
 * thing …)? A worry, a feeling or a health question gets words only. Kept simple: the server's sort also keeps
 * worries and dangers without one.
 */
export function wantsPicture(text: string): boolean {
  if (/痛|かゆ|熱|せき|咳|病気|びょうき|つらい|眠れ|ねむれ|悩|なや|いじめ|こわい|怖|死|けが|怪我/.test(text)) return false;
  return /どんな|見た目|姿|すがた|どこ|写真|絵|見せ|って何|ってなに|とは|何\?|なに\?|って？|なに？|何？/.test(text);
}

/** client 2026-11-24: answered by {bati} in the talk (no menu, no card): plain talk and lookups */
export const conversational = (it: Intent) => it.kind === 'talk' || (it.kind === 'make' && it.what === 'lookup');
