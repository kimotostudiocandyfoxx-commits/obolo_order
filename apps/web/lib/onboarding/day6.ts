import type { Step } from './script';

/**
 * DAY 6 【水星 → 火星】 — the story of 2026-10-14 (docs/story-rewrite/太陽まで_UI引き継ぎ.md §8, D07-S001〜S007).
 * Mars's play screen (D07-S004〜S005 were left to the UI): yesterday's song gets an MV from the visitor's
 * wish, made by {bati}, watched first, kept in the 裏スタジオ (components/mars/MarsLesson.tsx; client
 * 2026-10-14). Then the city's biggest screen, MONBAN on every screen, the fourth stamp and the star map
 * on the ticket's back (Venus, Uranus, Neptune: 『Obolo Orderのみ』). Saves answers.mv (or the picked film
 * frame: f_d07_screen 'pick', mars_frame).
 */
export const DAY6: Step[] = [
  { t: 'bgm', track: 'morning' }, // scene music (ACE-Step, 2026-10-27)
  { t: 'caption', text: '6日目' },
  // D07-S001 火星へ
  { t: 'still', image: 's/mercury-port' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
  { t: 'say', who: 'フリージー', text: 'おはよう。よく眠れたか？' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。' },
  { t: 'say', who: 'フリージー', text: 'さあ、ロケットに乗れ。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'MONBANさん。今度こそ、分かりました。' },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、、、台所にあるもの、なんです。' },
  { t: 'say', who: 'KIMORIN', text: 'たこ焼き、大根、冷蔵庫ときて。次は、電子レンジが、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '火星には…カバの、ヒポキンが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、カバでしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-mars' },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/mars-screens' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'mars' },
  { t: 'caption', text: '火星に着いた' },
  { t: 'action', label: '火星の未来都市へ向かう' },

  // D07-S002 ヒポキン
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] }, // 黒い大画面の陰から、カバがのっそり。頭に小さな冠、首からメガホン
  { t: 'caption', text: 'ヒポキンが現れた' },
  { t: 'say', who: 'KIMORIN', text: 'お久しぶりです。' }, // 優雅に一礼
  { t: 'say', who: 'ヒポキン', text: '……誰だ、お前ら。' }, // メガホンを下ろして
  { t: 'say', who: 'KIMORIN', text: '……初対面、でしたか。失礼。私たちは、ネオです。' },
  { t: 'say', who: 'ヒポキン', text: 'ネオか。……火星に、遊びに来たのだな。\n火星の遊び方を、教えてやる。' },
  { t: 'say', who: 'ヒポキン', text: '言葉だけ、絵だけ、音だけでは、\n物足りない。そういう時は、映像がいい。' },
  { t: 'say', who: 'ヒポキン', text: '水星で作った曲に、\nここで映像をつける。' },
  { t: 'say', who: 'ヒポキン', text: '足して、削って、加工する。\n火星は、スタジオの星だ。' },
  { t: 'say', who: 'ヒポキン', text: '外の画面は、勝手に流れてくる。ここの画面は、自分で押したものしか、映らない。' },
  { t: 'say', who: 'KIMORIN', text: '……では、この塔の画面ぜんぶ、誰かが押したのですか。さぞ、指がお疲れでしょう。' },
  { t: 'say', who: 'ヒポキン', text: '……そうだ。一つずつ、誰かが自分で選んで、押した。だから、映っている。' },
  { t: 'se', sound: 'riddle' },
  { t: 'seal', n: 4 }, // 謎の書が、ひとりでに開く。札4に「Obolo Orderの敵は……」が滲み出る（答えは7日目）
  { t: 'caption', text: '謎の書に、文字が浮かんだ' },
  { t: 'say', who: 'KIMORIN', text: '……敵？　物騒ですね。' },
  { t: 'se', sound: 'knock' }, // 指をパチンと鳴らす
  { t: 'say', who: 'ヒポキン', text: '……見せてみろ。' },

  // D07-S004〜S005 火星の遊ぶ画面：話した場面からMV（KIMORINの『プリプリ・ボカン』MVも）→ ▶で見る → 裏スタジオにしまう／作らない人は古いフィルムの一コマ
  { t: 'bgm', track: 'mars-play' },
  { t: 'sprite', image: null },
  { t: 'mars' },
  { t: 'bgm', track: 'mars' },

  // D07-S006 大スクリーンに映す
  { t: 'still', image: 's/mars-screens' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'label', id: 'big' },
  { t: 'say', who: 'ヒポキン', text: '街いちばんの、大スクリーンに映す。いいか。' },
  { t: 'branch', key: 'f_d07_screen', cases: { pick: 'screen' }, otherwise: 'ask-big' },
  { t: 'label', id: 'ask-big' },
  { t: 'choice', key: 'f_d07_big', options: [{ label: '大スクリーンに映す', goto: 'screen' }, { label: 'あとで' }] },
  { t: 'say', who: 'ヒポキン', text: '待ってる。' },
  { t: 'pause', resume: 'big' }, // MVはしまったまま。次に開くと、この選択から
  { t: 'label', id: 'screen' },
  { t: 'sprite', image: null },
  { t: 'made', what: 'mv' }, // 大スクリーンに{neo}のMV（pick：選んだ一枚）が映る。ヒポキンが、メガホンを下ろして、しばらく黙って見ている
  { t: 'notice', text: '大スクリーンの上映は、お話の中だけです。この上映で、ほかの人に送られることはありません' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'ご覧なさい。土星、木星、水星、火星。四つの星で、作りきりました。……作りきったケン!!　私の発明の——' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。少々、熱くなりました。' },
  { t: 'se', sound: 'knock' }, // ヒポキンが、もう一度、指を鳴らす。パチン
  { t: 'branch', key: 'f_d07_screen', cases: { pick: 'pick-end' }, otherwise: 'big-end' },
  { t: 'label', id: 'big-end' },
  { t: 'say', who: 'ヒポキン', text: '{neo}の毎日も、一本の映画になる。\nまた見せに来い。' },
  { t: 'goto', id: 'night' },
  { t: 'label', id: 'pick-end' },
  { t: 'say', who: 'ヒポキン', text: '選んだ一枚も、映画の一コマだ。また来い。' },
  { t: 'label', id: 'night' },

  // D07-S007 街じゅうのMONBAN／4つ目のスタンプ
  { t: 'bgm', track: 'night' },
  { t: 'caption', text: 'その夜' },
  { t: 'say', who: 'ヒポキン', text: '土星で声、木星でジャケ、' },
  { t: 'say', who: 'ヒポキン', text: '水星で曲、火星で映像。' },
  { t: 'say', who: 'ヒポキン', text: 'ここまで来たなら、\nもう気づいてるだろう。' },
  { t: 'say', who: 'ヒポキン', text: 'Obolo Orderは全員……' },
  { t: 'say', who: 'KIMORIN', text: '全員……なんです？' },
  { t: 'se', sound: 'blip' }, // ピピッ。街じゅうの画面が、一斉に正方形のスクリーンに
  { t: 'screen', open: true },
  { t: 'say', who: 'MONBAN', text: '……そこまでだ…。' },
  { t: 'say', who: 'MONBAN', text: 'おい…。そいつは、まだネオだ…。\n……あさってになれば、聞かせてやる…。' },
  { t: 'se', sound: 'egg-crack' }, // 謎の書の札2に、細いひびが一本、ぴしっと走る
  { t: 'say', who: 'KIMORIN', text: '『そいつ』？　……私も、ネオですが？' },
  { t: 'say', who: 'MONBAN', text: '……そいつも、だ…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……いつも、いい所で出てきますね。あさって、とは？' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'mars', flip: true }, // 4つの欄が全部うまり、切符が金色に光って、ひとりでに裏返る
  { t: 'caption', text: '4つの星を、まわった' }, // 切符の端に5つ目の欄『金星』。裏の星図：金の線が金星まで。天王星と海王星に錠と『Obolo Orderのみ』
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……金星には、錠が、ありませんね。' },
  { t: 'say', who: 'ヒポキン', text: '次は、金星だ。明日の朝、ロケットに乗れ。' },
  { t: 'say', who: 'KIMORIN', text: '……その先の二つは、Obolo Orderになってから。ほら、やっぱり、お金です。' },
  { t: 'bgm', track: 'farewell' },
  { t: 'sprite', image: null },
  { t: 'end' },
];
