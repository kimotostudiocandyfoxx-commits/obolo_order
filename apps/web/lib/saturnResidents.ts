import type { SaturnPostView } from '@obolo/shared';

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
