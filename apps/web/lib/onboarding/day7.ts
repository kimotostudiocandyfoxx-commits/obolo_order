import type { Step } from './script';
import { kimorinBack } from './kimorinBack';

/**
 * DAY 7 【火星 → 金星】 — the simple version (P04/c01v.md, D07V-S001〜S003; M-R190: Venus is the radio planet).
 * KIMORIN's theory of the day (everyone in Obolo Order is a king), MONBAN: the gorilla bosses are on Venus.
 * Venus is one giant spinning record; at the foot of its tone-arm, a round glass broadcast booth (ON AIR on its
 * roof). The bosses teach the easy DJ: Bluena goes into the desk, KIMORIN⭐︎ shows off, then the visitor mixes
 * from the practice rhythm into their own song (one step at a time or 〔おまかせ〕) and drops a kororin at the
 * seam; at night a first short show (〔⏺ 収録〕: a word into the mic, then the song) and 〔🎤 見せる〕 to the dachi
 * (components/venus/VenusLesson.tsx — the booth is where making and showing happen together: no Moon atelier).
 * The fifth stamp; tomorrow Earth, and beyond it the Sun.
 * The arrival is a still with a slow camera (M-R198), not a film.
 */
export const DAY7: Step[] = [
  { t: 'scene', id: 'D07V-S001' }, // 金星へ／ボスGたち
  { t: 'bgm', track: 'morning' },
  { t: 'still', image: 's/arr-mars-city' },
  { t: 'caption', text: '7日目' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'ヒポキン', text: 'おはよう。……次は、金星だ。' },
  ...kimorinBack(7), // SYS-S002: once, if he walked out
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。' },
  { t: 'say', who: 'ヒポキン', text: 'ロケットに乗れ。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' }, // ロケットが、火星から飛び立つ
  { t: 'still', image: 's/rocket-space' }, // 窓の外が、真っ暗な宇宙になる
  { t: 'clock', on: true }, // the day's 88 minutes start here (not shown)
  { t: 'se', sound: 'blip' }, // KIMORINが、Bluenaを光らせる。ロケットの壁に正方形のスクリーン。門の前のMONBAN
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、、、王様、なんです。' },
  { t: 'say', who: 'KIMORIN', text: '大根の皇帝に、冠のカバ。次は、女王様が、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '金星には…ゴリラの、ボスGたちが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、ゴリラでしたか。' },
  { t: 'sprite', image: null },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：金色にかすむ金星。巨大なレコードの溝の上をすべって、まるいガラスの放送ブースへ
  { t: 'still', image: 's/rocket-venus' },
  { t: 'se', sound: 'whoosh' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'venus' },
  { t: 'arrive', image: 's/venus-stage', caption: '金星に着いた' }, // 〔背景 venus-booth（仮）〕: no booth picture yet, the record planet's stage stands in
  { t: 'cam', move: 'in' }, // the slow camera toward the booth
  { t: 'sprite', image: ['hatg', 'bossg', 'longg'] },
  { t: 'caption', text: 'ボスGたちが現れた' },
  { t: 'say', who: 'ボスG', text: '……誰だ、お前ら。' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '私たちは、ネオです。' },
  { t: 'say', who: 'ボスG', text: 'ネオか。……金星に、遊びに来たのだな。\n金星の遊び方を、教えてやる。' },
  { t: 'say', who: 'ボスG', text: 'ここは、ラジオの星だ。' },
  { t: 'say', who: 'ボスG', text: '土星の声、木星のアート、水星の曲、火星の映像。\nお前が旅で作ったものを、ここで混ぜて、回す。' },
  { t: 'say', who: 'KIMORIN', text: '……混ぜて、回す。洗濯機の、星ですか。' },
  { t: 'say', who: 'ボスG', text: '……ラジオだ。' },
  { t: 'say', who: 'ボスG', text: '話して、曲をかけて、つなぐ。つなぐのが、DJだ。\n番組のために、まず、回し方を覚える。' },
  { t: 'cam', move: 'out' }, // ボスGが、ブースの中の卓を、あごで指す

  // D07V-S002 かんたんDJ → D07V-S003 収録・🎤 見せる (one play screen, with the script's lines on it)
  { t: 'scene', id: 'D07V-S002' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null },
  { t: 'venus' },

  // D07V-S003 (from the stamp on): the night, the recording and 〔🎤 見せる〕 were in the booth above
  { t: 'scene', id: 'D07V-S003' },
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/venus-night' }, // 夜。針の腕の下。ブースの縁の小さなライト
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'venus' }, // 5つの欄が、全部うまる。切符が、金色に光る
  { t: 'caption', text: '5つの星を、まわった' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: '明日は、地球だ。その先に、太陽がある。' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……{neo}の曲が、まだ耳に残っています。……すね毛の、次くらいに。' },
  { t: 'bgm', track: 'farewell' },
  { t: 'sprite', image: null },
  { t: 'caption', text: 'また明日' }, // 〔おわり：また明日〕 → 〔完了画面：8日目まで24時間のカウントダウン〕 (TomorrowScreen)
  { t: 'end' },
];
