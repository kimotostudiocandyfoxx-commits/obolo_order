import type { Step } from './script';

/**
 * DAY 6 【水星 → 火星】 — the story of 2026-10-14 (docs/story-rewrite/太陽まで_UI引き継ぎ.md §8, D07-S001〜S007).
 * Mars's play screen (D07-S004〜S005 were left to the UI): yesterday's song gets an MV from the visitor's
 * wish, made by {bati}, watched first, kept in the 裏スタジオ (components/mars/MarsLesson.tsx; client
 * 2026-10-14). Then the city's biggest screen, MONBAN on every screen, the fourth stamp and the star map
 * on the ticket's back (Venus, Uranus, Neptune: 『ORDERのみ』). Saves answers.mv.
 */
export const DAY6: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: '6日目' },
  // D07-S001 火星へ
  { t: 'still', image: 'mercury-island' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
  { t: 'say', who: 'フリージー', text: 'おはよう。よく眠れたか？' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。' },
  { t: 'say', who: 'フリージー', text: 'さあ、ロケットに乗れ。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'MONBANさん。今度こそ、分かりました。' },
  { t: 'say', who: 'KIMORIN', text: 'OBOLO ORDERは全員、、、台所にあるもの、なんです。' },
  { t: 'say', who: 'KIMORIN', text: 'たこ焼き、大根、冷蔵庫ときて。次は、電子レンジが、いるんだろう。' },
  { t: 'say', who: 'MONBAN', text: '火星には…カバの、ヒポキンが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、カバでしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-mars' },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 'mars-city' },
  { t: 'caption', text: '火星に着いた' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'あれが、火星の街？　画面だらけだよ。' },
  { t: 'action', label: '火星の未来都市へ向かう' },

  // D07-S002 ヒポキン
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] }, // 黒い大画面の陰から、カバがのっそり。頭に小さな冠、首からメガホン
  { t: 'caption', text: 'ヒポキンが現れた' },
  { t: 'say', who: 'KIMORIN', text: 'お久しぶりです。' }, // 優雅に一礼
  { t: 'say', who: 'ヒポキン', text: 'カット。……誰だ、お前ら。' },
  { t: 'say', who: 'KIMORIN', text: '……私たちは、ネオです。' },
  { t: 'say', who: 'ヒポキン', text: 'ネオか。……火星に、遊びに来たのだな。\n火星の遊び方を、教えてやる。' },
  { t: 'say', who: 'ヒポキン', text: '言葉だけ、絵だけ、音だけでは、\n物足りない。そういう時は、映像がいい。' },
  { t: 'say', who: 'ヒポキン', text: '水星で作った曲に、\nここで映像をつける。' },
  { t: 'say', who: 'ヒポキン', text: '足して、削って、加工する。\n火星は、スタジオの星だ。' },
  { t: 'se', sound: 'knock' }, // 指をパチンと鳴らす
  { t: 'say', who: 'ヒポキン', text: '……見せてみろ。' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'きのうの曲で、\nMV作ろ！' },

  // D07-S004〜S005 火星の遊ぶ画面：曲にMVをつける → ▶で見る → 裏スタジオにしまう
  { t: 'bgm', track: null },
  { t: 'sprite', image: null },
  { t: 'mars' },

  // D07-S006 大スクリーンに映す
  { t: 'still', image: 'mars-city' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'label', id: 'big' },
  { t: 'say', who: 'ヒポキン', text: '街いちばんの、大スクリーンに映す。いいか。' },
  { t: 'choice', key: 'f_d07_big', options: [{ label: '大スクリーンに映す', goto: 'screen' }, { label: 'あとで' }] },
  { t: 'say', who: 'ヒポキン', text: '待ってる。' },
  { t: 'pause', resume: 'big' }, // MVはしまったまま。次に開くと、この選択から
  { t: 'label', id: 'screen' },
  { t: 'sprite', image: null },
  { t: 'made', what: 'mv' }, // 大スクリーンに{neo}のMVが映る。ヒポキンが、メガホンを下ろして、しばらく黙って見ている
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'ご覧なさい。土星、木星、水星、火星。4つ連続です。……4つ連続ケン!!　オレの発明のおかげ——' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ブッブー♪' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。少々、熱くなりました。' },
  { t: 'se', sound: 'knock' }, // ヒポキンが、もう一度、指を鳴らす。パチン
  { t: 'say', who: 'ヒポキン', text: '{neo}の毎日も、一本の映画になる。\nまた見せに来い。' },

  // D07-S007 街じゅうのMONBAN／4つ目のスタンプ
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: 'その夜' },
  { t: 'say', who: 'ヒポキン', text: '土星で言葉、木星でシール、\n水星で音、火星で映像。' },
  { t: 'say', who: 'ヒポキン', text: 'ここまで来たなら、\nもう気づいてるだろう。' },
  { t: 'say', who: 'ヒポキン', text: 'OBOLO ORDERは全員……' },
  { t: 'say', who: 'KIMORIN', text: '全員……なんです？' },
  { t: 'se', sound: 'blip' }, // ピピッ。街じゅうの画面が、一斉に正方形のスクリーンに
  { t: 'screen', open: true },
  { t: 'say', who: 'MONBAN', text: '……もう、来ている…。' },
  { t: 'say', who: 'MONBAN', text: 'おい…。そいつは、まだネオだ…。\n……明日までは、な…。' },
  { t: 'say', who: 'KIMORIN', text: '『そいつ』？　……私も、ネオですが？' },
  { t: 'say', who: 'MONBAN', text: '……そいつも、だ…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……いつも、いい所で出てきますね。明日まで、とは？' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'mars', flip: true }, // 4つの欄が全部うまり、切符が金色に光って、ひとりでに裏返る
  { t: 'caption', text: '4つの星を、見学した' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: '……見学ツアーは、ここまで、ということですか。' },
  { t: 'say', who: 'KIMORIN', text: '……続きは、Obolo Orderになってから。ほら、やっぱり、お金です。' },
  { t: 'say', who: 'バティ', text: 'まだ、行ってない星が、あるね。' },
  { t: 'sprite', image: null },
  { t: 'end' },
];
