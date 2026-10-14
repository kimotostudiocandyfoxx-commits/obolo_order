import type { Step } from './script';

/**
 * DAY 5 【木星 → 水星】 — the story of 2026-10-14 (docs/story-rewrite/太陽まで_UI引き継ぎ.md §8, D06-S001〜S008).
 * Mercury's play screen (D06-S005〜S007 were left to the UI): one of yesterday's two stickers becomes a
 * song — {bati}'s lyric draft, touched up by the visitor, a feel, then {bati} sings it; the sticker is the
 * record's jacket and spins while it plays; the song sails out as a ship (components/mercury/MercuryLesson.tsx;
 * client 2026-10-14). Saves answers.song.
 */
export const DAY5: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: '5日目' },
  // D06-S001 木星の朝
  { t: 'still', image: 'jupiter-kaiser' },
  { t: 'sprite', image: ['daikon-kaiser', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: 'おはようDA。よく眠れたかDA？' },
  { t: 'say', who: '大根カイザー', text: '今日は水星DA。ロケットに乗るDA！' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。……もう、ロケットが待っていますね。' },
  { t: 'action', label: 'ロケットに乗る' },

  // D06-S002 食べ物推理／氷の大陸に着陸
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'OBOLO ORDERは全員、食べ物なんだ。' },
  { t: 'say', who: 'KIMORIN', text: 'たこ焼き、大根ときて。次は、パスタ伯爵が、いるんだろう。' },
  { t: 'say', who: 'MONBAN', text: '水星には…冷蔵庫の、フリージーが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: 'やっぱり、冷蔵庫でしたか。' },
  { t: 'still', image: 's/rocket-mercury' },
  { t: 'say', who: 'KIMORIN', text: 'ロケットを着陸させようにも、全部、海やん。' },
  { t: 'say', who: 'KIMORIN', text: 'どこに、ロケットを着陸させれば、いいのでしょう。' },
  { t: 'say', who: 'KIMORIN', text: 'あそこは、凍っている。氷の大陸が、ある。' },
  { t: 'say', who: 'KIMORIN', text: 'そこに、止めよう。' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/mercury-ice' },
  { t: 'caption', text: '水星に着いた' },

  // D06-S003 冷蔵庫のフリージー
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'うー、寒い。やっぱ、冷えてるな。' },
  { t: 'say', who: 'KIMORIN', text: 'もしかして、、、ということは、近くに、冷蔵庫いる？' },
  { t: 'say', who: '？？？', text: 'その通りだ。' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] }, // 氷の上に、白い冷蔵庫が一台。ぶーん、と鳴っている
  { t: 'caption', text: 'フリージーが現れた' },
  { t: 'say', who: 'フリージー', text: '俺の氷の島に、何の用だ。' },
  { t: 'say', who: 'KIMORIN', text: '俺たちは、ネオだ。' },
  { t: 'say', who: 'フリージー', text: 'なんだ、ネオか。じゃあ、水星に遊びに来たってことだな。' },
  { t: 'say', who: 'フリージー', text: 'ようこそ。俺は、フリージーだ。' },
  { t: 'say', who: 'フリージー', text: '一緒に、水星で、遊んじゃおうぜ。' },

  // D06-S005〜S007 水星の遊ぶ画面：シールから歌へ → ジャケットが回る → 最初の一隻
  { t: 'bgm', track: null },
  { t: 'sprite', image: null },
  { t: 'mercury' },
  { t: 'bgm', track: 'opening' },

  // D06-S008 冷蔵庫の中の図／札6
  { t: 'still', image: 'mercury-island' },
  { t: 'sprite', image: ['freezy', '@bati'] },
  { t: 'say', who: 'バティ', text: '船、まだ見えるかな！' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '{bati}、よく頑張りましたね。' },
  { t: 'say', who: 'フリージー', text: '……今日は、ここまでにしよう。' }, // 細い腕で、自分の扉の取っ手をつかむ
  { t: 'say', who: 'フリージー', text: '太陽が輪になる時の、OBOLONだ。オボロンは……' }, // 扉の内側に、太陽を囲む細い光の輪の図
  { t: 'say', who: 'フリージー', text: '……おっと。これ以上は、喋らないほうがいいな。' },
  { t: 'say', who: 'フリージー', text: 'いずれ、知ることになる。' },
  { t: 'sprite', image: ['freezy', '@bati'] },
  { t: 'say', who: 'バティ', text: 'いまの輪っかが、OBOLONなの？' },
  { t: 'se', sound: 'chime' },
  { t: 'seal', n: 6 }, // 謎の書の札6に「オボロンは……」の文字
  { t: 'caption', text: '謎の書に、文字が浮かんだ' },
  { t: 'sprite', image: null },
  { t: 'ticket', stamp: 'mercury' },
  { t: 'caption', text: '切符に、水星のスタンプが押された' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: '明日は、火星。' }, // 切符の最後の空いた欄を見て、丸いサングラスをかける
  { t: 'say', who: 'バティ', text: '……いま、かっこつけた？' },
  { t: 'say', who: 'KIMORIN', text: 'ええ。少し。' },
  { t: 'sprite', image: null },
  { t: 'caption', text: 'また明日' },
  { t: 'end' },
];
