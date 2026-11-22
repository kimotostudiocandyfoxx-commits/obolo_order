import type { Step } from './script';
import { kimorinBack } from './kimorinBack';

/**
 * DAY 6 【水星 → 火星】 — the simple version (M-R198〜M-R204; script P04/c01.md, D07-S001〜S007; S003 and S006 are cut).
 * The rocket from Mercury (KIMORIN's kitchen guess, MONBAN on Bluena's screen: 「火星には…カバの、ヒポキンが、いる…。」),
 * the arrival cut over the city of screens, ヒポキン: 「火星は、スタジオの星だ。」 Then the play screen
 * (components/mars/MarsLesson.tsx, D07-S004〜S005b): 〔🌙 つくる〕 → 「工房に行こう！」 → the Moon atelier through
 * Bluena → ▶ → say the scene → MV → yesterday's song → scene 1 → the spell → mana → {bati} shoots (KIMORIN⭐︎'s
 * 『プリプリ・ボカン』 meanwhile) → 「Bluenaに、しまったよ！」 → ▶ watch it (one more take at most) → the screen closes →
 * build 🎬 myスタジオ with the clapper → 〔🛸 公開する〕 (Bluena projects it into the big frame, a UFO flies to the dachi's
 * star map) or keep it in Bluena. The end of D07-S005b (「作りきったケン!!」, 「また見せに来い。」) plays here after it.
 * D07-S007: that night, {bati} a little see-through (not for f_join_early), the Mars stamp, the fifth slot (Venus), the
 * star map on the ticket's back with the locked stars and the locked curtain of the Mars Theater (M-R203/M-R204).
 */
export const DAY6: Step[] = [
  // D07-S001 火星へ
  { t: 'scene', id: 'D07-S001' },
  { t: 'bgm', track: 'morning' }, // scene music (ACE-Step, 2026-10-27)
  { t: 'caption', text: '6日目' },
  { t: 'still', image: 's/mercury-port' }, // 〔背景 mercury-island〕
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
  { t: 'say', who: 'フリージー', text: 'おはよう。よく眠れたか？' },
  ...kimorinBack(6), // SYS-S002: once, if he walked out
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。' },
  { t: 'say', who: 'フリージー', text: 'さあ、ロケットに乗れ。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' }, // ロケットが、水星から飛び立つ。窓の外が、真っ暗な宇宙になる
  { t: 'clock', on: true },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'blip' }, // KIMORINが、Bluenaを光らせる。ロケットの壁に正方形のスクリーン。門の前のMONBAN
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、、、台所にあるもの、なんです。' },
  { t: 'say', who: 'KIMORIN', text: 'たこ焼き、大根、冷蔵庫ときて。次は、電子レンジが、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '火星には…カバの、ヒポキンが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、カバでしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-mars' },
  { t: 'se', sound: 'whoosh' },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：赤い砂の平原に、画面でできた塔の未来都市。塔のあいだを抜けて、街の入口のロケットへ
  { t: 'still', image: 's/arr-mars-city', fade: 1.2 },
  { t: 'cam', move: 'in', focus: '50% 60%' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'mars' },
  { t: 'caption', text: '火星に着いた' },
  { t: 'cam', move: 'out' },
  { t: 'still', image: 's/mars-screens', fade: 1 }, // 〔背景 mars-city〕

  // D07-S002 ヒポキン
  { t: 'scene', id: 'D07-S002' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] }, // 黒い大画面の陰から、カバがのっそり。頭に小さな冠、首からメガホン
  { t: 'caption', text: 'ヒポキンが現れた' },
  { t: 'say', who: 'KIMORIN', text: 'お久しぶりです。' }, // 優雅に一礼
  { t: 'say', who: 'ヒポキン', text: '……誰だ、お前ら。' }, // メガホンを下ろして
  { t: 'say', who: 'KIMORIN', text: '……初対面、でしたか。失礼。私たちは、ネオです。' },
  { t: 'say', who: 'ヒポキン', text: 'ネオか。……火星に、遊びに来たのだな。\n火星の遊び方を、教えてやる。' },
  { t: 'say', who: 'ヒポキン', text: '水星で作った曲に、\n映像をつける。' },
  { t: 'say', who: 'ヒポキン', text: '足して、削って、加工する。\n火星は、スタジオの星だ。' },
  { t: 'se', sound: 'knock' }, // 指をパチンと鳴らす
  { t: 'say', who: 'ヒポキン', text: '……見せてみろ。' },

  // D07-S004〜S005b 火星の遊ぶ画面（MarsLesson）：〔🌙 つくる〕→ 月の工房でMV → Bluenaにしまう → ▶ → myスタジオ → 〔🛸 公開する〕
  { t: 'scene', id: 'D07-S004' }, // D07-S005 and D07-S005b play inside the same lesson
  { t: 'bgm', track: 'mars-play' },
  { t: 'sprite', image: null },
  { t: 'mars' },
  { t: 'bgm', track: 'mars' },
  // the end of D07-S005b (after send／keep meet)
  { t: 'still', image: 's/mars-screens' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'ご覧なさい。土星、木星、水星、火星。四つの星で、作りきりました。……作りきったケン!!' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。少々、熱くなりました。' },
  { t: 'se', sound: 'knock' }, // ヒポキンが、指を鳴らす。パチン
  { t: 'say', who: 'ヒポキン', text: '{neo}の毎日も、一本の映画になる。\nまた見せに来い。' },

  // D07-S007 火星のスタンプ／切符の裏
  { t: 'scene', id: 'D07-S007' },
  { t: 'bgm', track: 'night' },
  { t: 'caption', text: 'その夜' },
  { t: 'branch', key: 'f_join_early', cases: { true: 'night-early' }, otherwise: 'night-new' },
  { t: 'label', id: 'night-new' },
  // {neo}のとなりで、{bati}が、スタジオの1枠を見上げている。光の体が、少しだけ透けている。{bati}は、気づいていない
  { t: 'sprite', image: ['@bati-weak'] },
  { t: 'wait', s: 2.5 },
  { t: 'goto', id: 'night-stamp' },
  { t: 'label', id: 'night-early' },
  { t: 'sprite', image: ['@bati'] }, // 先にObolo Orderになった人は、透けない。{bati}の光は、いつもどおり明るい
  { t: 'wait', s: 2.5 },
  { t: 'label', id: 'night-stamp' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  // 火星の欄に、ぽん、とスタンプ。4つの欄が全部うまる → 切符の端に5つ目の欄『金星』 → ひとりでに裏返る：星図（金の線が金星まで。天王星・海王星・冥王星に錠と『Obolo Orderのみ』）
  { t: 'ticket', stamp: 'mars', flip: true },
  { t: 'caption', text: '4つの星を、まわった' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……金星には、錠が、ありませんね。' },
  { t: 'say', who: 'ヒポキン', text: '次は、金星だ。明日の朝、ロケットに乗れ。' },
  // 切符の星図の火星の印のそばに、小さな金色の幕の絵。錠がかかっている（先にObolo Orderになった人は、錠が外れている）（M-R203）
  { t: 'branch', key: 'f_join_early', cases: { true: 'theater-early' }, otherwise: 'theater-new' },
  { t: 'label', id: 'theater-new' },
  { t: 'notice', text: '火星シアター（Obolo Orderのみ）' },
  { t: 'say', who: 'KIMORIN', text: '……この幕の絵は？' },
  { t: 'say', who: 'ヒポキン', text: '火星シアターだ。町の奥にある。……結社の、昔の話がかかっている。' },
  { t: 'say', who: 'KIMORIN', text: '……その先の三つの星も、そのシアターも、Obolo Orderになってから。ほら、やっぱり、お金です。' },
  { t: 'goto', id: 'night-end' },
  { t: 'label', id: 'theater-early' },
  { t: 'notice', text: '火星シアター' },
  { t: 'say', who: 'KIMORIN', text: '……この幕の絵は？' },
  { t: 'say', who: 'ヒポキン', text: '火星シアターだ。町の奥にある。……結社の、昔の話がかかっている。' },
  { t: 'say', who: 'KIMORIN', text: '……{neo}の幕は、もう錠が外れていますね。私のは、錠つきです。……ほら、やっぱり、お金です。' },
  { t: 'label', id: 'night-end' },
  { t: 'bgm', track: 'farewell' },
  { t: 'sprite', image: null },
  { t: 'caption', text: 'また明日' }, // 〔おわり：また明日〕 → 〔完了画面：7日目まで24時間のカウントダウン〕 (TomorrowScreen)
  { t: 'end' },
];
