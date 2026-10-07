import type { SaturnPostView, SaturnProfileView } from '@obolo/shared';

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

export const SATURN_RESIDENTS: SaturnPostView[] = R.map(([id, name, neo, text], i) => ({
  id: `resident-${id}`,
  author: { id: `resident-${id}`, handle: `neo_${id}`, displayName: name, neoForm: neo },
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
