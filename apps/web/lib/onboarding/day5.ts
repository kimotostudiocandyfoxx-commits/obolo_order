import type { Step } from './script';

/**
 * DAY 5 【木星 → 水星】 — script scenes D06-S001〜S008 (simple version, P03/c03.md・c04.md).
 * Mercury's play screen (D06-S005〜S007b, components/mercury/MercuryLesson.tsx): 100倍 → KIMORIN⭐︎'s two songs
 * made in the Moon atelier → the visitor's song made there too (yesterday's art as the jacket, or new words),
 * put in Bluena's Mercury folder → 〔公開する〕: the first ship → myアイランド by talking with {bati}.
 * Then the Mercury stamp (D06-S008: OBOLON's talk, MONBAN's cut-in and seal 6 are out, M-R198).
 */
export const DAY5: Step[] = [
  { t: 'bgm', track: 'morning' }, // scene music (ACE-Step, 2026-10-27)
  { t: 'scene', id: 'D06-S001' }, // 木星の朝
  { t: 'caption', text: '5日目' },
  { t: 'still', image: 's/jupiter-daikon' },
  { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: 'おはようダ。よく眠れたかダ？' },
  { t: 'say', who: '大根カイザー', text: '今日は水星ダ。ロケットに乗るダ！' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。……もう、ロケットが待っていますね。' },
  { t: 'action', label: 'ロケットに乗る' },

  { t: 'scene', id: 'D06-S002' }, // 食べ物推理／氷の大陸に着陸
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、食べ物なんです。' },
  { t: 'say', who: 'KIMORIN', text: 'たこ焼き、大根ときて。次は、パスタ伯爵が、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '水星には…冷蔵庫の、フリージーが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: 'やっぱり、冷蔵庫でしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-over-sea' }, // 見わたすかぎりの海の上を、ロケットが飛ぶ（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'ロケットを着陸させようにも、全部、海やん。' },
  // 海の向こうに、白く光る大地
  { t: 'say', who: 'KIMORIN', text: 'あそこは、凍っていますね。氷の大陸が、あります。' },
  { t: 'sprite', image: null }, // ロケットが、氷の大陸に着陸する
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/mercury-ice' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'mercury' },
  { t: 'caption', text: '水星に着いた' },

  { t: 'scene', id: 'D06-S003' }, // 冷蔵庫のフリージー
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'うー、寒い。やはり、冷えていますね。' },
  { t: 'say', who: 'KIMORIN', text: 'もしかして、、、近くに、冷蔵庫がいますか？' },
  { t: 'say', who: '？？？', text: 'その通りだ。', voice: 'フリージー' }, // 台本：（声）「その通りだ。」
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] }, // 氷の上に、白い冷蔵庫が一台。ぶーん、と鳴っている
  { t: 'caption', text: 'フリージーが現れた' },
  { t: 'say', who: 'フリージー', text: '俺の氷の島に、何の用だ。' },
  { t: 'say', who: 'KIMORIN', text: '私たちは、ネオです。' },
  { t: 'say', who: 'フリージー', text: 'なんだ、ネオか。じゃあ、水星に遊びに来たってことだな。' },
  { t: 'say', who: 'フリージー', text: 'ようこそ。俺は、フリージーだ。' },

  // 画面が、水星の遊ぶ画面に切りかわる。D06-S005〜S007b は MercuryLesson の中：
  // 100倍 → KIMORINの見本（月の工房で『プリプリ・ボカン』に一曲、作り直し1回）→ {neo}の曲（月の工房）→ 最初の一隻 → myアイランド
  { t: 'scene', id: 'D06-S005' }, // 音に乗っけると、100倍（S006 アートに、一曲／S007 最初の一隻／S007b myアイランド も、この中）
  { t: 'bgm', track: 'mercury-play' },
  { t: 'sprite', image: null },
  { t: 'mercury' },
  { t: 'bgm', track: 'mercury' },

  { t: 'scene', id: 'D06-S008' }, // 水星のスタンプ
  { t: 'still', image: 's/mercury-port' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '{bati}、よく頑張りましたね。' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'mercury' },
  { t: 'caption', text: '切符に、水星のスタンプが押された' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '明日は、火星。' }, // 切符の次の空いた欄を見て、丸いサングラスを、指でくいっとかけ直す
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'farewell' },
  { t: 'caption', text: 'また明日' },
  { t: 'end' },
];
