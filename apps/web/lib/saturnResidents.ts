import type { PuniLook, SaturnPostView, SaturnProfileView } from '@obolo/shared';

/**
 * Sample "residents" so Saturn never feels empty while real posts are few.
 * PLACEHOLDER (P-SAT-4): their voices use the browser's speech synthesis (tts:) until real
 * voice clips exist. Real posts always come first.
 */
const R: [string, string, string, string][] = [
  ['r1', 'みゆ', 'usagi', '今日、空がめちゃくちゃきれいだった。誰かに言いたかっただけ。'],
  ['r2', 'タケル', 'ookami', 'バイト終わった〜！今からラーメン食べる！'],
  ['r3', 'ねむねむ', 'neko', 'ねむい。でも寝たくない。この時間がすき。'],
  ['r4', 'そら', 'shika', '新しい曲つくってる。明日、水星にあげるかも。'],
  ['r5', 'ぽん', 'kuma', 'テストおわった！！！自由だー！'],
  ['r6', 'Leo', 'kitsune', 'Hello Saturn! My voice from Singapore.'],
  ['r7', 'しずく', 'fukurou', '雨の音きいてると、なんか落ち着く。'],
  ['r8', 'ゆうき', 'ryu', '今日はちょっと落ち込んだ。でも明日はがんばる。'],
  ['r9', 'あおい', 'usagi', '推しの新曲、100回は聴いた。'],
  ['r10', 'こたろう', 'kuma', '犬の散歩中。夕焼けがオレンジ。'],
  ['r11', 'りん', 'neko', 'おなかすいた…たこ焼き食べたい。'],
  ['r12', 'カイ', 'ookami', 'はじめて土星にきた。みんなの声、あったかいな。'],
];

const base: PuniLook = { shape: 'round', color: '#f4a3c4', tex: 'none', face: 'normal', eyes: 'sparkle', mouth: 'cat', hat: 'none', glasses: 'none', neck: 'none', wear: 'none', hands: 'none', item: 'none', effect: 'sparkle' };

/** Sample residents are dressed like the client's reference picture (P-SAT-4). */
const LOOKS: Partial<PuniLook>[] = [
  { color: '#ff8a6b', tex: 'salmon', item: 'star' }, // salmon sushi
  { color: '#6f7378', shape: 'chunky', hands: 'none' }, // gray mochi
  { color: '#f6f1e4', shape: 'tall', tex: 'rice', wear: 'nori' }, // onigiri
  { color: '#9c7be0', tex: 'sesame', hat: 'crown', item: 'star' }, // purple sesame
  { color: '#e5544b', neck: 'goldChain', item: 'star' }, // red
  { color: '#5e8a4b', tex: 'scales', face: 'croc', mouth: 'none', hat: 'crown', neck: 'queenCollar', wear: 'dress' }, // croc queen
  { color: '#3b3433', shape: 'chunky', tex: 'fur', face: 'gorilla', glasses: 'roundYellow', hat: 'bucket', neck: 'goldChain' }, // gorilla
  { color: '#ffd36b', item: 'star', hands: 'peace' },
  { color: '#8ec5ff', glasses: 'roundDark' },
  { color: '#5a5461', shape: 'chunky', face: 'hippo', eyes: 'glow', mouth: 'none', wear: 'suit' }, // hippo
  { color: '#9be3b0', hands: 'fan', item: 'star' },
  { color: '#f4a3c4', tex: 'sesame', shape: 'tall' },
];

/** Painted sample characters (cut from the client's reference image, test only — P-SAT-4). */
const RESIDENT_PICS = ['/puni-test/salmon.png', '/puni-test/gray.png', undefined, '/puni-test/purple.png', undefined, undefined, '/puni-test/gorilla.png', undefined, '/puni-test/green.png'];

function residentLook(i: number): PuniLook {
  return { ...base, ...LOOKS[i % LOOKS.length], medal: String(10 + i) };
}

export const SATURN_RESIDENTS: SaturnPostView[] = R.map(([id, name, neo, text], i) => ({
  id: `resident-${id}`,
  author: { id: `resident-${id}`, handle: `neo_${id}`, displayName: name, neoForm: neo, look: residentLook(i), pic: RESIDENT_PICS[i] ?? null },
  text,
  voiceUrl: `tts:${text}`,
  voiceSource: 'default',
  voiceDurationSec: null,
  starCount: 20 + ((i * 37) % 280),
  starredByMe: false,
  createdAt: new Date(Date.now() - (i + 1) * 47 * 60_000).toISOString(),
}));

/** Short sample replies the residents leave under each other's voices (P-SAT-4). */
const REPLY_LINES = [
  'わかる〜！',
  'それめっちゃいいね',
  'おつかれさま！',
  'ちょっと元気でた、ありがとう',
  'いいなぁ、わたしも行きたい',
  'その気持ち、すごくわかるよ',
  'きいてて笑っちゃった',
  'がんばれ〜！',
  'Nice voice!',
  'こっちも同じ空みてるよ',
];

/** Deterministic 0–3 replies from other residents under a resident's post. */
export function residentReplies(postId: string): SaturnPostView[] {
  const i = SATURN_RESIDENTS.findIndex((p) => p.id === postId);
  if (i < 0) return [];
  const n = i % 4;
  return Array.from({ length: n }, (_, k) => {
    const from = SATURN_RESIDENTS[(i + 3 + k * 5) % SATURN_RESIDENTS.length];
    const text = REPLY_LINES[(i * 3 + k * 7) % REPLY_LINES.length];
    return {
      ...from,
      id: `${postId}-reply-${k}`,
      text,
      voiceUrl: `tts:${text}`,
      starCount: (i + k * 11) % 9,
      replyToId: postId,
      createdAt: new Date(Date.now() - (n - k) * 13 * 60_000).toISOString(),
    };
  });
}

/** A resident's sample page. */
export function residentProfile(authorId: string): SaturnProfileView | null {
  const p = SATURN_RESIDENTS.find((x) => x.author.id === authorId);
  if (!p) return null;
  const h = [...authorId].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    user: { ...p.author, bio: 'サンプルの住人。土星でのんびりころりん中。' },
    postCount: 1,
    stars: p.starCount,
    followers: 40 + (h % 300),
    following: 10 + (h % 80),
    followedByMe: false,
    isMe: false,
  };
}
