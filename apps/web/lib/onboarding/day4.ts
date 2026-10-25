import type { Step } from './script';

/**
 * DAY 4 【土星 → 木星】 — the story of 2026-10-14 (docs/story-rewrite/太陽まで_UI引き継ぎ.md §8, D05-S001〜S009).
 * The daily pattern (3〜6日目): in the rocket KIMORIN⭐︎ guesses wrong on Bluena → MONBAN names the next
 * resident → arrive → 「誰だ？」「ネオです」「遊び方を教えてやる」 → the play screen → a riddle card gets its
 * words, the ticket its stamp.
 * Jupiter's play screen (D05-S005〜S008 were left to the UI): two of yesterday's three kororins become
 * stickers (a photo / Bati's drawing / words only) → the sticker book → sticker butterflies
 * (components/jupiter/JupiterLesson.tsx; client 2026-10-14). Saves answers.stickers.
 */
export const DAY4: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: '4日目' },
  // D05-S001 朝の土星
  { t: 'still', image: 's/saturn-inside' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます、{neo}。' },
  { t: 'say', who: 'バティ', text: 'おはよ、{neo}！　今日はどこ行くの？' },
  { t: 'say', who: 'KIMORIN', text: '木星でしょう。きのう、大根の王様から手紙が来ましたから。' },
  { t: 'action', label: '木星へ向かう' },

  // D05-S002 たこ焼き推理／大森林の大根
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'MONBANさん、、、私、謎の答えが、分かりました。' },
  { t: 'say', who: 'KIMORIN', text: 'OBOLO ORDERは全員、、、たこ焼き。そうですよね？' },
  { t: 'say', who: 'KIMORIN', text: 'きのう、たこ焼きブラザーと、たこ焼きシスターが、いました。' },
  { t: 'say', who: 'KIMORIN', text: 'OBOLONも、よくよく見たら、焦げたたこ焼きでは、ありませんか。' },
  { t: 'say', who: 'KIMORIN', text: '木星には、たこ焼きマザーと、たこ焼きファザーが、いるに違いありません。' },
  { t: 'say', who: 'KIMORIN', text: 'そうなんでしょ？' },
  { t: 'say', who: 'MONBAN', text: '木星には…大根カイザーが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: 'なるほど。やはり、大根でしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-jupiter' },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/jupiter-forest' },
  { t: 'caption', text: '木星に着いた' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'すごいな、、、神秘的な森だ。' },
  { t: 'action', label: '森を探索する' },
  { t: 'say', who: '？？？', text: 'おい。', voice: '大根カイザー' },
  { t: 'say', who: 'KIMORIN', text: 'ん？　どこだ？' },
  { t: 'say', who: '？？？', text: 'ここDA。', voice: '大根カイザー' },
  { t: 'say', who: 'KIMORIN', text: 'どこだ？' },
  { t: 'still', image: 'jupiter-kaiser' }, // 並んだ木のうちの一本だけ、幹が白くて太い。大根だった
  { t: 'sprite', image: ['daikon-kaiser', 'kimorin-sun'] },
  { t: 'caption', text: '大根カイザーが現れた' },
  { t: 'say', who: '大根カイザー', text: '木星で、何をしているDA？　お前ら、誰DA？' },
  { t: 'say', who: 'KIMORIN', text: '私は、ネオです。' },
  { t: 'say', who: '大根カイザー', text: 'なんDA、ネオか。' },
  { t: 'say', who: '大根カイザー', text: 'ということは、木星に遊びに来たのDAな。' },
  { t: 'say', who: '大根カイザー', text: '俺が、木星の遊び方を、教えてやるDA。' },

  // D05-S005〜S008 木星の遊ぶ画面：2つのコロリンからシール → シール帳 → シール蝶
  { t: 'bgm', track: null },
  { t: 'sprite', image: null },
  { t: 'jupiter' },
  { t: 'bgm', track: 'opening' },

  // D05-S009 畑から門番／札3
  { t: 'still', image: 'jupiter-kaiser' },
  { t: 'sprite', image: ['daikon-kaiser', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: 'よい機会DA。王として、結社の大事な話をしてやろう。' },
  { t: 'say', who: '大根カイザー', text: 'OBOLOが、なぜ集まり、何をめざしておるのか。' },
  { t: 'say', who: '大根カイザー', text: '結社の目的とは……' },
  { t: 'se', sound: 'blip' }, // ピピッ。Bluenaが勝手に光り、大根畑の土の上に正方形のスクリーン
  { t: 'screen', open: true },
  { t: 'say', who: 'MONBAN', text: 'おい…。そいつらは、まだネオだ…。\n秘密を喋るのは、ダメだ…。' },
  { t: 'say', who: '大根カイザー', text: '大根畑から出てくるでないDA！' },
  { t: 'say', who: 'MONBAN', text: '……王でも、掟は掟だ…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: 'さすがの王様も、MONBANにはかなわないようですね。' },
  { t: 'say', who: 'KIMORIN', text: 'ですが、私には分かります。結社の目的——お金を集める組織、でしょう？' }, // 丸いサングラスをかけ、ピンポンボタンを押す
  { t: 'se', sound: 'ding' },
  { t: 'say', who: '大根カイザー', text: '……続きは、もう少し旅をしてからDA。' },
  { t: 'se', sound: 'chime' },
  { t: 'seal', n: 3 }, // 謎の書の札3に「結社の目的とは」の文字
  { t: 'caption', text: '謎の書に、文字が浮かんだ' },
  { t: 'sprite', image: ['daikon-kaiser', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: '明日は、水星へ行くDA。' },
  { t: 'sprite', image: null },
  { t: 'ticket', stamp: 'jupiter' },
  { t: 'caption', text: '切符に、木星のスタンプが押された' },
  { t: 'caption', text: 'また明日' },
  { t: 'end' },
];
