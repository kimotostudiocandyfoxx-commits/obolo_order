import type { Step } from './script';

/**
 * DAY 3 【月 → 土星】 — the story of 2026-10-15 (review/DAY3.md, story 3b44a0b, M-R68〜M-R70;
 * D04-S002〜D04-S007; the scene ids say D04 but it is day 3). Starts after the email check (StoryDay).
 * OBOLON cannot leave Earth / the Moon / the Sun, so he hands over Bluena: its square screen shows MONBAN
 * at the HQ gate (MONBAN never leaves the HQ). The day's 88 minutes start when the rocket leaves the Moon
 * ('clock' step, M-R22). Saturn: the gaudy temple, たこ焼きブラザー & シスター, then the kororin lesson on
 * the real Saturn world (client 2026-10-14: day 3 only teaches how to murmur — three kororins by mic, to
 * your own room; everything else opens on the second journey), the residents' ring and the brother's
 * far point KIMORIN calls the Cosmos (M-R107), the Saturn stamp. Riddle card 2 gets its words during MONBAN's call from the rocket (story 49a3048).
 * Draft 21 (M-R124〜126): the record I teaser on the rocket; the voice kororin is free; the kororin design
 * (D04-S005b); KIMORIN⭐︎ and {inviter} become dachi and a kororin can be delivered (D04-S005c).
 * Saved: Bluena, the kororins, the design, card 2's words, the Saturn stamp.
 */
export const DAY3: Step[] = [
  { t: 'bgm', track: 'moon' }, // 月の神殿の朝（2026-10-25）
  { t: 'caption', text: '3日目' },
  // D04-S002 おはようございます／Bluena
  { t: 'still', image: 's/moon-temple' }, // 月の神殿。窓の外に、青い地球
  { t: 'sprite', image: 'kimorin-sun' },
  // he talks to you here: the standing picture, facing us (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。いつまで寝ているのですか？', expr: 'stand' },
  { t: 'say', who: 'KIMORIN', text: '私はもちろんスキップさせていただきました。これ待つ人いるんですかね？', expr: 'stand' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'さぁ、早く、冒険の続きをしますよ。謎を、解き明かさねば。', expr: 'stand' },
  { t: 'say', who: 'KIMORIN', text: 'そしてコスモスを見つけ、宝を手に入れるのです。', expr: 'stand' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '焦らなくていい。せっかくの宇宙旅行だ。ゆっくり存分に楽しんだ方がいい。' },
  { t: 'say', who: 'KIMORIN', text: 'うるさいですよ。せっかくObolo Orderになってあげたこの私に、口答えですか？' },
  { t: 'say', who: 'OBOLON', text: 'まだお前はObolo Orderじゃない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？そうなの？', flip: true }, // the surprise faces OBOLON (client 2026-10-29)
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderはみんなマナを自分の体から生成し、魔法を唱える。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちはまだマナを生成できないし、魔法も何も習得してない。' },
  { t: 'say', who: 'OBOLON', text: 'そんなお前たちのことを、、Obolo Neo、と呼ぶ。' },
  { t: 'say', who: 'KIMORIN', text: 'なるほど。Obolo Neoですか、響きは、嫌いじゃありませんね。' },
  { t: 'say', who: 'OBOLON', text: '今日からお前らは、Obolo Neo、だ。' },
  { t: 'say', who: 'KIMORIN', text: 'わかりました。それではOBOLON、本日行く場所は、どこでしたっけ？' }, // client 2026-10-29
  { t: 'say', who: 'OBOLON', text: '今日、行く場所は、、、土星だ。' },
  { t: 'say', who: 'KIMORIN', text: '土星ですか。いいですね。またOBOLONは先に土星に行って待っててくれるのですよね？' },
  { t: 'say', who: 'OBOLON', text: 'いや、俺は、土星には、行けない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？なぜですか？', flip: true }, // the surprise faces OBOLON (client 2026-10-29)
  { t: 'say', who: 'OBOLON', text: '俺は、、、地球と、月と、太陽の間しか、移動できない。' },
  { t: 'say', who: 'KIMORIN', text: 'どういう仕組み？' },
  { t: 'say', who: 'OBOLON', text: 'でも、、、大丈夫だ。渡したいものが、ある。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // 光の柱から、小さな丸いデバイスが二つ、ふわりと降りてくる
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: 'Bluenaを手に入れた' },
  { t: 'say', who: 'OBOLON', text: 'Bluena（ブルーナ）だ。' },
  { t: 'say', who: 'OBOLON', text: '地球のブルーに、月のルナ、その名の通り、地球と月、宇宙を繋げるものだ。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'OBOLON', text: '星を越えても、、、これで繋がれる。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'action', label: 'Bluenaで投影する' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true }, // 神殿の白い壁に、正方形のスクリーン。門の前のMONBAN
  { t: 'sprite', image: ['', 'kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'MONBAN', text: '……聞こえるか…。' },
  { t: 'say', who: 'KIMORIN', text: '……これは....すごい発明品ですね。まぁ私の発明の方がすごいですけど。ね？うんぽん？' },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポンうんポン！' },
  { t: 'say', who: 'MONBAN', text: 'ただし…Bluenaが使えるのは…一日、88分だ…。' },
  { t: 'say', who: 'MONBAN', text: 'それを過ぎたら…Bluenaの中の門が閉まる…。地球に、帰ってこい…。' },
  { t: 'screen', open: false },
  { t: 'notice', text: 'Bluenaが使えるのは、一日88分。過ぎると地球に帰り、次の日に、その続きから' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/moon-temple' }, // 光の柱の中で、OBOLONの白い三日月の目が、細くなる。黒い球が、ゆっくり、こちらを見送る（M-R169）
  { t: 'sprite', image: ['', 'obolon'] }, // 見送るOBOLON（QA 6 R5）
  { t: 'wait', s: 1.6, keepChat: true }, // the line stays (QA 11 R35)
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' }, // ロケットが、月から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true }, // the day's 88 minutes start here (not shown)
  // ピピッ。Bluenaが光り、ロケットの壁に、正方形のスクリーン — MONBAN calls (M-R169), nothing to press
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  // draft 21 (M-R126): the Day 3 teaser — fragments of record I, no explanation (cut from record I's clips)
  { t: 'say', who: 'MONBAN', text: '……出発の前に…ひとつ、見せておく…。' },
  { t: 'say', who: 'MONBAN', text: '……Obolo Orderは…何のために、あるのか…。' },
  { t: 'screen', open: false },
  { t: 'film', id: 'teaser', parts: 1 }, // 夜の窓 → 止まらない親指 → 夜の電車で下を向くみんな → 窓の灯りから色が抜ける → 真っ暗
  { t: 'bgm', track: 'space' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……今のは、何ですか？' },
  { t: 'say', who: 'MONBAN', text: '……答えは…旅の終わりに、見せる…。' },
  { t: 'say', who: 'MONBAN', text: '本日…土星に行けば…謎の、ヒントが…転がっている。' },
  { t: 'say', who: 'KIMORIN', text: 'え、そうなの？', flip: true }, // facing MONBAN's screen (client 2026-10-29)
  { t: 'say', who: 'MONBAN', text: 'ああ…。そもそもObolo Orderとは…何の集まりなのか…そのヒントだ…。' },
  { t: 'se', sound: 'chime' },
  { t: 'seal', n: 2 }, // 謎の書が宙に浮き、ひとりでに開く。札2に「Obolo Orderは全員……」が滲み出る
  { t: 'say', who: 'KIMORIN', text: '……気になりますね...' },
  { t: 'say', who: 'MONBAN', text: '土星には…たこ焼きブラザーと、たこ焼きシスターが、住んでいる…。' },
  { t: 'say', who: 'MONBAN', text: '二人に会ってこい…。' },
  { t: 'screen', open: false },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-saturn' }, // 窓の外に、大きな輪のある星が近づいてくる
  { t: 'se', sound: 'whoosh' },

  // D04-S003 趣味の悪い神殿（story 9ec42f9, M-R85）
  { t: 'say', who: 'KIMORIN', text: '見てください。土星に着きました。' },
  { t: 'film', id: 'saturn', parts: 2 }, // 豪華映像 #5 土星への到着（M-R90）：輪の下をくぐる → 赤茶の大地 → タコの石像の神殿
  { t: 'bgm', track: 'saturn' },
  { t: 'arrive', image: 's/saturn-outside', caption: '土星の神殿に着いた' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'これが土星の神殿ですか、、、土星の神殿は趣味悪いですね。' },
  { t: 'say', who: 'KIMORIN', text: '中に入りましょう。' },
  { t: 'action', label: '神殿の中に入る' },
  { t: 'still', image: 's/saturn-inside' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'caption', text: 'たこ焼きブラザーとたこ焼きシスターが現れた' },
  { t: 'say', who: 'たこ焼きシスター', text: '誰？　勝手に、私たちの神殿に入ってるのは。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'この趣味のいい神殿に、何の用だZE!!' },
  { t: 'sprite', image: ['takoyaki-brother', 'kimorin-sun', 'takoyaki-sister'] },
  { t: 'say', who: 'KIMORIN', text: 'はじめまして、たこ焼きのお二人。私たちは、Obolo Neoです。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ああ、君たちは、Neoなのね。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'よろしくなZE!!' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ってことは、土星に遊びに来たのね。' },
  { t: 'say', who: 'KIMORIN', text: '遊び、、？いえ、、、私達はコスモスを見つけ、宝を手に入れたいのです。' },
  { t: 'say', who: 'KIMORIN', text: 'その為に謎を解き明かしに土星にきました！' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: '決して遊びなどではありません。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'たこ焼きシスター', text: 'あら、そう。謎解きね...。ちなみにあなたは謎解きは好きなの？' },
  { t: 'say', who: 'KIMORIN', text: 'そりゃ。私は発明家なので、謎解きは大好きです。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'じゃあ発明家ということは、発明も好きなんだZE?' },
  { t: 'say', who: 'KIMORIN', text: 'そりゃもちろん！発明品を開発してる時は時間を忘れてます。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'そう、じゃああなたはいつも発明して遊んでるのね？' },
  { t: 'face', who: 'kimorin-sun', expr: 'shock' }, // KIMORINが、ピクンと反応する
  { t: 'say', who: 'KIMORIN', text: 'え？なんと失礼な。発明は遊びではありません、仕事です！' },
  { t: 'say', who: 'たこ焼きシスター', text: '遊んでる人って楽しそうで魅力的。とっても素敵だワ。私..大好きだワ' },
  { t: 'say', who: 'たこ焼きブラザー', text: '仕事すらも遊んで楽しんでる奴なんてカッケーZE！' },
  { t: 'say', who: 'KIMORIN', text: '、、、ふふふふ。もももちろん発明はとても楽しい遊びです。' },
  { t: 'say', who: 'KIMORIN', text: '私は遊びを仕事に、仕事を遊びにするという発明をしたのです。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'そう、そんな私からすると謎解きも、宝探しも、この土星の旅も楽しみの一環、つまり遊びなのです。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'たこ焼きシスター', text: 'そうなのね！じゃあさっそく土星で遊びましょう！' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'ついてこいだZE!!!' },

  // D04-S005〜S006 コロリン／土星の空のリング: the real Saturn world (ころりんぱ) with the story's lines
  // on top — KIMORIN⭐︎'s kororin, three kororins of your own by mic to your own room, the residents' ring,
  // the sister's sunset kororin (components/saturn/SaturnLesson.tsx).
  { t: 'bgm', track: 'saturn' }, // 練習のあいだも曲は流れる（小さく。録音中は止まる：QA 5 N14）
  { t: 'sprite', image: null },
  { t: 'saturn' },
  // D04-S007 いちばん遠い星
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/saturn-night' }, // 神殿の石段。頭上で、輪が、ごう、と回る
  { t: 'caption', text: 'その夜' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: 'MONBANが言っていた、コスモス。……私の推理では、遠い星の名前です。' },
  { t: 'say', who: 'KIMORIN', text: '……見つけました。あれが、コスモスです。' }, // {bati}が遠くを指さす先、輪のいちばん遠い縁を流れる米粒より小さい点。丸いサングラスを押し上げて、じっと見る（M-R107）
  { t: 'say', who: 'KIMORIN', text: '……今日のところは、逃がしてあげましょう。' }, // 点は、ふっと消える
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'saturn' },
  { t: 'caption', text: '切符に、土星のスタンプが押された' },
  { t: 'caption', text: 'また明日' },
  { t: 'end' },
];
