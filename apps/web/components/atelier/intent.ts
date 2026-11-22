import type { AtelierKind } from '@/lib/atelier/unlock';

/**
 * What a request in the Moon atelier's chat asks for (M-R210): plain keyword matching, no model. More than one kind,
 * or none at all, is ambiguous — {bati} asks back. Words that only change the last thing made ("もっと明るく",
 * "やり直して") are a refinement of the newest card.
 */
const WORDS: [AtelierKind, RegExp][] = [
  ['look', /姿|見た目|プロフィール|アイコン|自分の顔/],
  ['bati', /着せ?かえ|着替え|変身|コスプレ/],
  ['image', /画像|写真を見せ|絵を見せ|見せて/],
  ['lookup', /調べ|教えて|ってなに|って何|とは[？?]?$|知りたい/],
  ['voice', /コロリン|ころりん|つぶや|メモ/],
  ['art', /アート|絵|描いて|イラスト/],
  ['song', /曲|歌|うた/],
  ['video', /映像|MV|ＭＶ|ムービー|動画/i],
  ['radio', /ラジオ|番組/],
];

const REFINE = /もっと|やり直|やりなお|ちがう|違う|変えて|かえて|にして|っぽく|明るく|暗く|元気に|静かに|かわいく|かっこよく|足して|入れて/;

export type Intent = { kind: 'make'; what: AtelierKind; content: string } | { kind: 'refine'; content: string } | { kind: 'ask'; options: AtelierKind[] } | { kind: 'talk'; content: string };

/** the words around the keyword: 「」 quotes win, otherwise the request with the "make a …" part taken off */
export function contentOf(text: string): string {
  const q = text.match(/[「『"](.+?)[」』"]/);
  if (q) return q[1].trim();
  return text
    .replace(/(を|で|の)?(作って|つくって|作りたい|つくりたい|作る|つくる|お願い|おねがい|ください|して|ちょうだい)[！!。]*$/, '')
    .trim();
}

export function detect(text: string, hasCard: boolean): Intent {
  const t = text.trim();
  let kinds = WORDS.filter(([, re]) => re.test(t)).map(([k]) => k);
  // 「絵を見せて」 is a picture to see, not art to make; 「姿を変身」 is the look
  if (kinds.includes('image')) kinds = kinds.filter((k) => k !== 'art');
  if (kinds.includes('look') && kinds.includes('bati') && !/バティ|着せ?かえ|着替え/.test(t)) kinds = kinds.filter((k) => k !== 'bati');
  if (kinds.includes('video') && kinds.includes('song')) kinds = kinds.filter((k) => k !== 'song'); // 「この曲のMV」
  if (kinds.includes('radio') && kinds.includes('song')) kinds = kinds.filter((k) => k !== 'song'); // 「曲を流すラジオ」
  if (kinds.length === 1) return { kind: 'make', what: kinds[0], content: contentOf(t) };
  if (kinds.length > 1) return { kind: 'ask', options: kinds };
  if (hasCard && REFINE.test(t)) return { kind: 'refine', content: t };
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
};

/** the request names only the kind (「アートを作って」): {bati} asks what it should be */
export function isBare(content: string): boolean {
  let t = content;
  for (const [, re] of WORDS) t = t.replace(new RegExp(re.source, 'g' + re.flags.replace('g', '')), '');
  return t.replace(/[をのでとにがはもへ、。！!？?\s　]|作|つく|して|ほしい|たい/g, '').length < 2;
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
};
