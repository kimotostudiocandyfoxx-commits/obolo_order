/**
 * バティが覚えること (M-R222, docs/story-rewrite/バティが覚えること.md; M-R219〜M-R221's notebook / seasonings are
 * cancelled): in the ordinary chat, only when the member says 「覚えといて」, {bati} keeps it (「覚えた！」) — five a
 * {bati}, ~30 characters each, shown on its card (「覚えてること」, deleted one by one or all). {bati} never asks
 * 「覚えていい？」. The way it calls them is the society name ({neo}); the card, or 「〇〇って呼んで」 in the chat, changes
 * it. Only the personality, the names, the 呼び方 and these memories go into the chat prompt.
 */

export const MEMORY_PER_BATI = 5;
export const MEMORY_CHARS = 30;

/** one thing the member asked {bati} to remember */
export interface BatiMemory {
  id: string;
  text: string;
  at: string;
}

/** {bati}'s role (from the 2nd / 3rd {bati}; the 1st starts as なんでも): the talk's direction */
export const BATI_ROLES = ['any', 'play', 'work', 'make'] as const;
export type BatiRole = (typeof BATI_ROLES)[number];
export const BATI_ROLE_LABELS: Record<BatiRole, string> = { any: 'なんでも', play: '遊び', work: '仕事・勉強', make: '作ること' };
export const BATI_ROLE_TALK: Record<BatiRole, string> = {
  any: 'なんでも話す相方。',
  play: '遊びの相方。楽しいこと・好きなことの話を広げる。',
  work: '仕事・勉強の相方。要点をはっきり、がんばっていることを応援する。',
  // client 2026-11-24: never steering — ideas when asked for them
  make: '作ることの相方。作りたいと言われた時に、作るアイデアを出す（自分からは誘わない）。',
};
/** the question after naming the 2nd / 3rd {bati} (as written; {self} = its 一人称) */
export const BATI_ROLE_QUESTION = '{self}は、{neo}の、なんの相方になる？';

/** {bati}'s words (as written in the decision; said in its manner by the chat) */
export const MEMORY_LINES = {
  kept: '覚えた！',
  full: 'いっぱいだから、どれか忘れてもいい？',
  refuse: 'それは、覚えないでおくね。大事なことは、{neo}がしまっておいて！',
} as const;

/** the reply's length, fixed by us (M-R222): comfortably short; longer only when asked */
export const BATI_REPLY_LENGTH =
  '返事の長さ：ふだんは、心地よい短さ（1〜2文、60字くらいまで）。ユーザーが「くわしく」「もっと教えて」などと頼んだ時だけ、長く、くわしく（150字くらいまで）。';

/**
 * 「〜、覚えといて」: the thing the member asked to remember (null = not such a request). 「これ、覚えといて」 alone
 * points at what they said just before (`before`).
 */
export function rememberRequest(text: string, before?: string): string | null {
  const t = text.normalize('NFKC').trim();
  const m = /^(.*?)[、,。\s]*(?:って|と|を|は|から|だから)?(?:ずっと)?(?:覚え|おぼえ)(?:ておいて|といて|ててね|てて|ておいてね|ておいてください|といてね|てね|てください|ておいてくれる[？?]?)[ねよ]?[。！!]*$/.exec(t);
  if (!m) return null;
  let what = m[1]
    .replace(/^(?:ねえ|ねぇ|あのね)[、,\s]*/, '')
    .replace(/[、,\s]*(?:これ|それ|このこと|そのこと)[、,\s]*$/, '')
    .replace(/(?:だ)?から$/, '')
    .trim();
  if (!what || /^(これ|それ|このこと|そのこと)$/.test(what)) what = (before ?? '').trim();
  return what ? tidyMemory(what) : null;
}

/** 「〇〇って呼んで」: the new 呼び方 (null = not such a request) */
export function callRequest(text: string): string | null {
  const m = /^(?:これからは|今日から|ねえ|ねぇ)?[、,\s]*(.{1,12}?)(?:って|と)(?:呼んで|よんで)(?:ね|ほしい|ください)?[。！!]*$/.exec(text.normalize('NFKC').trim());
  return m ? m[1].replace(/^[「『]|[」』]$/g, '').trim() || null : null;
}

/** what is never kept (M-R222 「覚えない物」): [why, pattern] — everyone */
const NEVER: [string, RegExp][] = [
  ['phone', /0\d{1,4}[-ー‐ 　]?\d{1,4}[-ー‐ 　]?\d{3,4}|\b\d{10,11}\b|電話番号|携帯の番号|ケータイの番号/],
  ['address', /〒|\d{3}-?\d{4}|[都道府県].{0,8}[市区町村郡]|丁目|番地|\d+-\d+-\d+|住所|に住んで/],
  ['email', /[\w.+-]+@[\w-]+\.[\w.-]+|メアド|メールアドレス/i],
  ['school_company', /[\p{sc=Han}\p{sc=Katakana}\p{sc=Hiragana}A-Za-z0-9]{1,12}(小学校|中学校|高校|高等学校|大学|学園|学院|幼稚園|保育園|塾)|株式会社|有限会社|[\p{sc=Han}\p{sc=Katakana}A-Za-z]{1,12}(会社|商事|銀行)|(で|に)(働いて|勤めて|通って)/u],
  ['secret', /パスワード|パスコード|暗証|PIN|ログイン|ID[はを:：]/i],
  ['money', /口座|カード番号|クレジット|銀行|振り?込|貯金|お金を|\d+万?円|残高|ローン|借金/],
  ['other_person', /(さん|くん|君|ちゃん|先生|様)(の|は|が)(住所|電話|病気|家|秘密|メール|番号|名前)|(父|母|兄|姉|弟|妹|友だち|友達|彼氏|彼女)(の)(住所|電話|病気|秘密|メール|番号|名前|会社|学校)/],
  ['health', /病気|病名|病院|手術|入院|通院|薬を|飲んでる薬|障害|診断|持病|症状|うつ|発作|アレルギー|体重\d|身長\d|生理/],
];
/** under 15 (or no birth year yet): stricter — any name with an honorific, a station or town, a long number, the body */
const NEVER_CHILD: [string, RegExp][] = [
  ['other_person', /[\p{sc=Han}\p{sc=Katakana}\p{sc=Hiragana}A-Za-z]{1,8}(さん|くん|君|ちゃん|先生)/u],
  ['address', /駅|[市区町村]の|近所|家の(場所|近く)/],
  ['number', /\d{4,}/],
  ['health', /体重|身長|からだ|体の|けが|ケガ|痛い/],
  ['school_company', /学校|クラス|何年何組|\d年\d組/],
];

/** the same rule as seesOnlyDachi (schemas.ts, M-R213): under 15, or no birth year yet (kept here: schemas imports this file) */
const strict = (birthYear: number | null | undefined, now = new Date()) => !birthYear || now.getFullYear() - birthYear < 15;

/**
 * Why a memory (or a 呼び方) can not be kept (null = it can). `child` (under 15 by the birth year, or no
 * birth year yet) uses the stricter list too. The caller also runs the general moderation (moderateText).
 */
export function memoryRefusal(text: string, opts: { child?: boolean; birthYear?: number | null } = {}): string | null {
  const t = text.normalize('NFKC');
  const child = opts.child ?? strict(opts.birthYear);
  for (const [why, re] of NEVER) if (re.test(t)) return why;
  if (child) for (const [why, re] of NEVER_CHILD) if (re.test(t)) return why;
  return null;
}

/** a memory tidied: one line, at most MEMORY_CHARS (+ a little) characters */
export function tidyMemory(text: string): string {
  return [...text.replace(/\s+/g, ' ').trim()].slice(0, MEMORY_CHARS + 10).join('');
}
