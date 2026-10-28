import type { Step } from './script';

/**
 * DAY 7 【火星 → 金星】 — story draft 21 (M-R124: Venus joins the first journey; review/DAY7.md, D07V-S001〜S003).
 * KIMORIN's theory of the day (everyone in Obolo Order is a king), MONBAN: the gorilla bosses are on Venus.
 * Venus is one giant spinning record with a round open-air stage at the foot of its tone-arm. The bosses
 * teach the easy DJ: KIMORIN⭐︎ shows off, then the visitor mixes from the practice rhythm into their own
 * song (one step at a time or 〔おまかせ〕), drops a kororin at the seam, and may show the set to the dachi
 * (components/venus/VenusLesson.tsx). The fifth stamp; tomorrow Earth, and beyond it the Sun.
 * The luxury arrival film (the record planet, ~12 s) is deferred with the other videos: a still for now.
 */
export const DAY7: Step[] = [
  { t: 'bgm', track: 'morning' },
  { t: 'caption', text: '7日目' },
  // D07V-S001 金星へ／ボスGたち
  { t: 'still', image: 's/arr-mars-city' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'ヒポキン', text: 'おはよう。……次は、金星だ。' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。' },
  { t: 'say', who: 'ヒポキン', text: 'ロケットに乗れ。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' }, // ロケットが、火星から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true }, // the day's 88 minutes start here (not shown)
  { t: 'se', sound: 'blip' }, // KIMORINが、Bluenaを光らせる
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'MONBANさん。今度こそ、本当に、分かりました。' },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、、、王様、なんです。' },
  { t: 'say', who: 'KIMORIN', text: '大根の皇帝に、冠のカバ。次は、女王様が、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '金星には…ゴリラの、ボスGたちが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、ゴリラでしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-venus' }, // 窓の外に、金色にかすむ星が近づいてくる
  { t: 'se', sound: 'whoosh' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'venus' },
  { t: 'arrive', image: 's/venus-stage', caption: '金星に着いた' }, // 星ぜんたいが巨大なレコード。針の腕の根もとに、まるい野外ステージ
  { t: 'action', label: 'ステージへ向かう' },
  { t: 'sprite', image: ['hatg', 'bossg', 'longg'] },
  { t: 'caption', text: 'ボスGたちが現れた' },
  { t: 'say', who: 'ボスG', text: '……誰だ、お前ら。' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '私たちは、ネオです。' },
  { t: 'say', who: 'ボスG', text: 'ネオか。……金星に、遊びに来たのだな。\n金星の遊び方を、教えてやる。' },
  { t: 'say', who: 'ボスG', text: 'ここは、DJの星だ。' },
  { t: 'say', who: 'ボスG', text: '土星の声、木星のアート、水星の曲、火星の映像。\nお前が旅で作ったものを、ここで混ぜて、回す。' },
  { t: 'say', who: 'KIMORIN', text: '……混ぜて、回す。洗濯機の、星ですか。' },
  { t: 'say', who: 'ボスG', text: '……レコードだ。' }, // ボスGが、ステージの真ん中の卓を、あごで指す

  // D07V-S002〜S003 かんたんDJ／🎤 見せる（the play screen, with the story's lines on it）
  { t: 'sprite', image: null },
  { t: 'bgm', track: null },
  { t: 'venus' },

  // D07V-S003 5つ目のスタンプ
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/venus-night' }, // 夜。針の腕の下。ステージの縁の小さなライト
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'venus' }, // 5つの欄が、全部うまる。切符が、金色に光る
  { t: 'caption', text: '5つの星を、まわった' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: '明日は、地球だ。その先に、太陽がある。' },
  { t: 'say', who: 'KIMORIN', text: '太陽……。いよいよ、ですね。' },
  { t: 'say', who: 'ボスG', text: '金星には、いつでも、回しに来い。ここも、お前の帰る場所だ。' },
  { t: 'sprite', image: 'kimorin-sun' }, // ステージの明かりが、一つずつ消える。レコードの星だけが、ゆっくり回り続ける
  { t: 'say', who: 'KIMORIN', text: '……{neo}の曲が、まだ耳に残っています。……すね毛の、次くらいに。' },
  { t: 'bgm', track: 'farewell' },
  { t: 'sprite', image: null },
  { t: 'caption', text: 'また明日' },
  { t: 'end' },
];
