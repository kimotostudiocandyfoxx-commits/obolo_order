import type { Step } from './script';

/**
 * DAY 4 【土星 → 木星】 — the simple version (M-R198, M-R200; wip/P03/c01.md D05-S001〜S006, c02.md D05-S007〜S009;
 * the scene ids say D05 but it is day 4). Starts after the email check 〔扉の合言葉〕 (DayAuth). Morning on Saturn,
 * KIMORIN⭐︎'s たこ焼き guess on Bluena in the rocket, MONBAN names 大根カイザー, the arrival cut over the great forest,
 * the daikon among the trees, 「木星は、命が宿る星ダ。」. The play screen (components/jupiter/JupiterLesson.tsx,
 * D05-S006〜S008b): KIMORIN⭐︎'s『プリプリ・ボカン』 made in the Moon atelier, then the visitor's art from one of
 * yesterday's Saturn words (or new words) — kept in Bluena's Jupiter folder — then 🎨 myアトリエ and 〔公開する〕 to the
 * dachi's sky. The day ends with the Jupiter stamp (no MONBAN interruption, no riddle card: M-R198).
 * Saved: answers.stickers (the art), my_atelier, f_d05_send.
 */
export const DAY4: Step[] = [
  // D05-S001 朝の土星
  { t: 'scene', id: 'D05-S001' },
  { t: 'bgm', track: 'morning' }, // scene music (ACE-Step, 2026-10-27)
  { t: 'still', image: 's/saturn-inside' }, // 〔背景 saturn-temple〕
  { t: 'caption', text: '4日目' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます、{neo}。' },
  { t: 'say', who: 'KIMORIN', text: '切符によると、次は、木星です。' },
  { t: 'action', label: '木星へ向かう' },

  // D05-S002 たこ焼き推理／大森林の大根
  { t: 'scene', id: 'D05-S002' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' }, // ロケットが、土星から飛び立つ。窓の外が、真っ暗な宇宙になる
  { t: 'clock', on: true },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'blip' }, // KIMORINが、Bluenaを光らせる。ロケットの壁に正方形のスクリーン。門の前のMONBAN
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'MONBANさん、、、私、分かりました。' },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、、、たこ焼き。そうですよね？' },
  { t: 'say', who: 'KIMORIN', text: 'OBOLONも、よくよく見たら、焦げたたこ焼きでは、ありませんか。' },
  { t: 'say', who: 'MONBAN', text: '木星には…大根カイザーが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: 'なるほど。やはり、大根でしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-jupiter' },
  { t: 'se', sound: 'whoosh' },
  { t: 'bgm', track: 'jupiter' },
  { t: 'se', sound: 'arrive' },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：緑の縞もようの雲の下、見わたすかぎりの大森林。梢の上をゆっくり進む
  { t: 'arrive', image: 's/arr-jupiter-canopy', caption: '木星に着いた' },
  { t: 'cam', move: 'in' },
  { t: 'still', image: 's/jupiter-forest' }, // 森の切れ目に降りたロケット
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'すごい、、、神秘的な森ですね。' },
  { t: 'say', who: '？？？', text: 'おい。', voice: '大根カイザー' }, // （声）
  { t: 'say', who: 'KIMORIN', text: 'ん？　どこですか？' },
  { t: 'say', who: '？？？', text: 'ここダ。', voice: '大根カイザー' }, // （声）
  { t: 'still', image: 's/jupiter-daikon' }, // 並んだ木のうちの一本だけ、幹が白くて太い。てっぺんに、青い葉の冠。大根だった
  { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
  { t: 'caption', text: '大根カイザーが現れた' },
  { t: 'say', who: '大根カイザー', text: '木星で、何をしているダ？　お前ら、誰ダ？' },
  { t: 'say', who: 'KIMORIN', text: '私たちは、ネオです。' },
  { t: 'say', who: '大根カイザー', text: 'なんダ、ネオか。木星に、遊びに来たのダな。' },
  { t: 'say', who: '大根カイザー', text: '我が、木星の遊び方を、教えてやるダ。' },

  // D05-S005 木星は命が宿る星／「いい言葉ですね」 — 画面が、木星の遊ぶ画面に切りかわる
  { t: 'scene', id: 'D05-S005' },
  { t: 'bgm', track: 'jupiter-play' },
  { t: 'still', image: 's/jupiter-forest' },
  { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: '木星は、命が宿る星ダ。' },
  { t: 'say', who: '大根カイザー', text: '君が見た風景だったり、今日食べたご飯だったり。そんな何気ない日常でも、命を宿し、そして思い出になっていくのダ。' },
  { t: 'say', who: '大根カイザー', text: '百聞は、一見にしかず、ダ。やってみるダ。' },
  { t: 'say', who: 'KIMORIN', text: '……百聞は、一見にしかず。いい言葉ですね。今日から、私の言葉にしましょう。' },

  // D05-S006 根っこから一つ選ぶ → D05-S007 {neo}のアート → D05-S008b myアトリエと、ダチの空へ
  // (all three inside the Jupiter play screen: components/jupiter/JupiterLesson.tsx)
  { t: 'scene', id: 'D05-S006' },
  { t: 'sprite', image: null },
  { t: 'jupiter' },
  { t: 'bgm', track: 'jupiter' },

  // D05-S009 木星のスタンプ
  { t: 'scene', id: 'D05-S009' },
  { t: 'still', image: 's/jupiter-daikon' },
  { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: '明日は、水星へ行くダ。' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'jupiter' }, // {neo}の切符の、木星の欄に、ぽん、とスタンプが押される
  { t: 'caption', text: '切符に、木星のスタンプが押された' },
  { t: 'bgm', track: 'farewell' },
  { t: 'caption', text: 'また明日' }, // 〔おわり：また明日〕 → 〔完了画面：5日目まで24時間のカウントダウン〕 (TomorrowScreen)
  { t: 'end' },
];
