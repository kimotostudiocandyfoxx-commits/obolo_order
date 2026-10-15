import type { Step } from './script';

/**
 * DAY 3 【月 → 土星】 — the story of 2026-10-15 (review/DAY3.md, story 3b44a0b, M-R68〜M-R70;
 * D04-S002〜D04-S007; the scene ids say D04 but it is day 3). Starts after the email check (StoryDay).
 * OBOLON cannot leave Earth / the Moon / the Sun, so he hands over Bluena: its square screen shows MONBAN
 * at the HQ gate (MONBAN never leaves the HQ). The day's 88 minutes start when the rocket leaves the Moon
 * ('clock' step, M-R22). Saturn: the gaudy temple, たこ焼きブラザー & シスター, then the kororin lesson on
 * the real Saturn world (client 2026-10-14: day 3 only teaches how to murmur — three kororins by mic, to
 * your own room; everything else opens on the second journey), the residents' ring and the brother's
 * sneeze, riddle card 2 gets its words (the answer opens on day 7), 大根カイザー's letter, the Saturn stamp.
 * Saved: Bluena, the three kororins (room-only Saturn posts), card 2's words, the Saturn stamp.
 */
export const DAY3: Step[] = [
  { t: 'bgm', track: 'obolon' },
  { t: 'caption', text: '3日目' },
  // D04-S002 おはようございます／Bluena
  { t: 'still', image: 's/moon-temple' }, // 月の神殿。窓の外に、青い地球
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。いつまで寝ているのですか？　私はもちろんスキップさせていただきました。これ待つ人いるんですかね？' },
  { t: 'say', who: 'KIMORIN', text: 'さぁ、早く、冒険の続きをしますよ。謎を、解き明かさねば。そしてコスモスを見つけ、宝を手に入れるのです。' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: 'そんなに焦らなくていい。せっかくの宇宙旅行だ。ゆっくり存分に楽しんだ方がいい。' },
  { t: 'say', who: 'KIMORIN', text: 'うるさいですよ。せっかくObolo Orderになってあげたこの私に、口答えですか？' },
  { t: 'say', who: 'OBOLON', text: 'まだお前はObolo Orderじゃない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？そうなの？' },
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderはみんなマナを自分の体から生成し、魔法を唱える。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちはまだマナを生成できないし、魔法も何も習得してない。' },
  { t: 'say', who: 'OBOLON', text: 'そんなお前たちのことを、、Obolo Neo、と呼ぶ。' },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Neoですか、響きは嫌いじゃありませんね。' },
  { t: 'say', who: 'OBOLON', text: '今日からお前らは、Obolo Neo、だ。' },
  { t: 'say', who: 'KIMORIN', text: 'わかりました。それではOBOLON、今日行く場所は、どこですか？' },
  { t: 'say', who: 'OBOLON', text: '今日、行く場所は、、、土星だ。' },
  { t: 'say', who: 'KIMORIN', text: 'いいですね。またOBOLONは先に土星に行って待っててくれるのですよね？' },
  { t: 'say', who: 'OBOLON', text: 'いや、俺は、土星には、行けない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？なぜですか？' },
  { t: 'say', who: 'OBOLON', text: '俺は、、、地球と、月と、太陽の間しか、移動できない。' },
  { t: 'say', who: 'KIMORIN', text: 'そういう仕組み？' },
  { t: 'say', who: 'OBOLON', text: 'でも、、、大丈夫だ。渡したいものが、ある。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // 光の柱から、小さな丸いデバイスが二つ、ふわりと降りてくる
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: 'Bluenaを手に入れた' },
  { t: 'say', who: 'OBOLON', text: 'Bluena、だ。地球のブルーに、月のルナ、その名の通り、地球と月、宇宙を繋げるものだ。星を越えても、、、これで、話せる。' },
  { t: 'action', label: 'Bluenaで投影する' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true }, // 神殿の白い壁に、正方形のスクリーン。門の前のMONBAN
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'MONBAN', text: '……聞こえるか…。' },
  { t: 'say', who: 'KIMORIN', text: '……これは....まあまあの発明品ですね。まぁ私の発明の方がすごいですけど' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポンピンポン！' },
  { t: 'say', who: 'MONBAN', text: 'ただし…Bluenaが使えるのは…一日、88分だ…。' },
  { t: 'say', who: 'MONBAN', text: 'それを過ぎたら…話せなくなる…。地球に、帰ってこい…。' },
  { t: 'screen', open: false },
  { t: 'notice', text: '宇宙の画面（正方形）は、Bluenaが映しているものです。\n一日88分を過ぎると、Bluenaが止まり、地球に帰ります。次の日に、また続きから' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'opening' },
  { t: 'se', sound: 'whoosh' }, // ロケットが、月から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true }, // the day's 88 minutes start here (not shown)
  { t: 'action', label: 'Bluenaで投影する' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'MONBAN', text: '本日…土星に行けば…謎の、ヒントが…転がっていると、思う…。' },
  { t: 'say', who: 'KIMORIN', text: 'え、そうなの？' },
  { t: 'say', who: 'MONBAN', text: 'ああ…。Obolo Orderとは…何の集まりなのか…そのヒントだ…。' },
  { t: 'say', who: 'KIMORIN', text: '……気になる。' },
  { t: 'say', who: 'MONBAN', text: '土星には…たこ焼きブラザーと、たこ焼きシスターが、住んでいる…。' },
  { t: 'say', who: 'MONBAN', text: '二人に会って…土星で、遊んでこい…。' },
  { t: 'screen', open: false },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-saturn' }, // 窓の外に、大きな輪のある星が近づいてくる
  { t: 'se', sound: 'whoosh' },

  // D04-S003 趣味の悪い神殿
  { t: 'arrive', image: 's/saturn-outside', caption: '土星の神殿に着いた' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '土星の神殿、趣味悪いなぁ。' },
  { t: 'say', who: 'KIMORIN', text: 'よし、中に入ろう。' },
  { t: 'action', label: '神殿の中に入る' },
  { t: 'still', image: 's/saturn-inside' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'caption', text: 'たこ焼きブラザーとたこ焼きシスターが現れた' },
  { t: 'say', who: 'たこ焼きシスター', text: '誰？　勝手に、私たちの神殿に入ってるのは。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'この趣味のいい神殿に、何の用だZE!!' },
  { t: 'sprite', image: ['takoyaki-brother', 'kimorin-sun', 'takoyaki-sister'] },
  { t: 'say', who: 'KIMORIN', text: 'はじめまして、たこ焼きのお二人。私たちは、Obolo Neoです。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ああ、君たちは、ネオなのね。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'よろしくなZE!!' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ってことは、土星に遊びに来たのね。分かったわ。' },
  { t: 'say', who: 'たこ焼きシスター', text: '私たちが、土星の遊び方を、教えてあげるわ。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '土星は、原石の星だZE!!' },
  { t: 'say', who: 'たこ焼きシスター', text: 'そう。感情の原石。つぶやきとも言うわ。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'ただつぶやく時、文字だけだと、半分も伝わらないZE!!' },
  { t: 'say', who: 'たこ焼きシスター', text: '冷たく見えたり、間違って伝わったりもするわ。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'でも、土星は、魔法のコロリンが文字に声を乗っけてくれるの。' },
  { t: 'say', who: 'KIMORIN', text: 'コロリン？' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'まぁ、まずは遊んでみるZE!!' },

  // D04-S005〜S006 コロリン／土星の空のリング: the real Saturn world (ころりんぱ) with the story's lines
  // on top — KIMORIN⭐︎'s kororin, three kororins of your own by mic to your own room, the residents' ring,
  // the brother's sneeze and KIMORIN's ☆ (components/saturn/SaturnLesson.tsx).
  { t: 'bgm', track: null },
  { t: 'sprite', image: null },
  { t: 'saturn' },
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 's/saturn-sky' },
  { t: 'se', sound: 'chime' },
  { t: 'seal', n: 2 }, // 鞄の中で謎の書が開き、札2に「Obolo Orderは全員……」の文字（続きは、まだ白紙）
  { t: 'caption', text: '謎の書に、文字が浮かんだ' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……Obolo Orderは、全員……？　続きが、ありませんね。' },

  // D04-S007 木星の王様の手紙／いちばん遠い星
  { t: 'still', image: 's/saturn-inside' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きブラザー', text: 'そうだ。けさ、輪に乗って、手紙が流れてきたZE。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/kaiser-letter' }, // 大根の形の封蝋。差出人：木星　大根カイザー
  { t: 'letter', text: '木星にも、遊びに来るDA。\n\n木星　大根カイザー' },
  { t: 'still', image: 's/saturn-inside' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きシスター', text: '木星の王様ね。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '明日は木星だZE!!　遅れるんじゃねぇZE!!' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '木星も、いっしょに行こうね！　次は、どんな言葉を持っていこうか！' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/saturn-night' },
  { t: 'caption', text: 'その夜' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: '{neo}が1日目に聞いたという、コスモス。……私の推理では、遠い星の名前です。' },
  { t: 'say', who: 'バティ', text: '遠い星！　……いちばん遠いの、探す。' },
  { t: 'say', who: 'バティ', text: 'あった！　いちばん遠くで、ちょっとだけ動いてる！' },
  { t: 'say', who: 'KIMORIN', text: '……あれは、ブラザーのくしゃみです。' }, // 丸いサングラスをかけて、じっと見る
  { t: 'say', who: 'バティ', text: '……コスモスじゃない？' },
  { t: 'say', who: 'KIMORIN', text: 'まだ、流れていますね。' },
  { t: 'sprite', image: null },
  { t: 'ticket', stamp: 'saturn' },
  { t: 'caption', text: '切符に、土星のスタンプが押された' },
  { t: 'caption', text: 'また明日' },
  { t: 'end' },
];
