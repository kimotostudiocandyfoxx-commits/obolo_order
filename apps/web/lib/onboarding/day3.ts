import type { Step } from './script';
import { SYS002 } from './sys002';

/**
 * DAY 3 【月 → 土星】 — the simple version (M-R198, wip/P02/c02.md D04-S002〜S003, c03.md D04-S005〜S007; the scene ids
 * say D04 but it is day 3). Starts after the email check 〔扉の合言葉〕 (DayAuth). The morning on the Moon (M-R207: {bati}
 * was born on day 2): Obolo Neo, Bluena, the Moon atelier and 「作るのは、月。しまうのは、Bluena。見せるのは、、、星だ。」,
 * the gate's 88 minutes, then the rocket leaves the Moon (the day's 88 minutes start: 'clock', M-R22). Saturn:
 * the gaudy temple, たこ焼きブラザー & シスター, the kororin practice and the dachi with KIMORIN⭐︎ and {inviter}
 * (components/saturn/SaturnLesson.tsx), Saturn's night and its stamp, and MONBAN's one-time offer to become Obolo Order
 * early (`f_join_early`). The dachi's messages live in Bluena's 〔通信〕 (M-R194).
 * Saved: Bluena, the kororins (d3.kororins), the Saturn stamp.
 */
export const DAY3: Step[] = [
  // D04-S002 おはようございます／Bluena（M-R207：{bati}は2日目に生まれている。Bluenaと月の工房はここで）
  { t: 'scene', id: 'D04-S002' },
  { t: 'bgm', track: 'moon' }, // 月の神殿の朝
  { t: 'caption', text: '3日目' },
  { t: 'still', image: 's/moon-temple' }, // 月の神殿。窓の外に、青い地球
  // KIMORINが、こちらを向いて立っている。足もとで、うんちピンポンくんと{bati}が、跳ねている
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。いつまで寝ているのですか？', expr: 'stand' },
  { t: 'say', who: 'KIMORIN', text: '私は、楽しみすぎて、一睡もしていません。', expr: 'stand' },
  { t: 'say', who: 'KIMORIN', text: 'さぁ、早く、冒険の続きをしますよ。', expr: 'stand' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] }, // 光の柱の中に、黒い球のOBOLON
  { t: 'say', who: 'OBOLON', text: '今日、行く場所は、、、土星だ。' },
  { t: 'say', who: 'KIMORIN', text: '土星ですか。いいですね。せっかくObolo Orderになってあげたこの私を、しっかり案内してくださいね。' },
  { t: 'say', who: 'OBOLON', text: 'まだお前はObolo Orderじゃない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？そうなの？', flip: true }, // OBOLONのほうを向いて
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderはみんなマナを自分の体から生成し、魔法を唱える。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちはまだマナを生成できないし、魔法も何も習得してない。' },
  { t: 'say', who: 'OBOLON', text: 'そんなお前たちのことを、、Obolo Neo、と呼ぶ。' },
  { t: 'say', who: 'KIMORIN', text: 'なるほど。Obolo Neoですか、響きは、嫌いじゃありませんね。' },
  { t: 'say', who: 'OBOLON', text: '、、、旅立つ前に、、、渡したいものが、ある。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // 光の柱から、白くて低い円柱のデバイスが二つ、ふわりと降りてくる
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: 'Bluenaを手に入れた' },
  { t: 'say', who: 'OBOLON', text: 'Bluena（ブルーナ）だ。' },
  { t: 'say', who: 'OBOLON', text: '星を越えても、、、これで繋がれる。' },
  { t: 'say', who: 'OBOLON', text: 'Bluenaの中には、、、月への、門がある。' },
  { t: 'say', who: 'OBOLON', text: '作る時は、、、門が開いて、この神殿の奥の、月の工房に、つながる。' },
  // 光の柱が、祭壇のさらに奥へ。白い石の丸い小部屋（月の工房）— no picture of it yet: the temple with the Earth in the window
  { t: 'still', image: 's/moon-temple', fade: 0.8 },
  { t: 'cam', move: 'in', focus: '50% 40%' },
  { t: 'say', who: 'OBOLON', text: 'ここが、、、月の工房だ。お前たちの相方の、家で、、、仕事場だ。' },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: '@bati' }, // {bati}が、作業台の上に、ぴょんと跳びのって、にっこりする
  { t: 'se', sound: 'boing' },
  { t: 'face', who: '@bati', expr: 'smile' },
  { t: 'wait', s: 1.2 },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '作ったものは、、、Bluenaに、しまわれる。見せる時は、、、Bluenaから、星へ、投影する。' },
  { t: 'say', who: 'OBOLON', text: '作るのは、月。しまうのは、Bluena。見せるのは、、、星だ。', hold: true },
  { t: 'action', label: 'Bluenaで投影する' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true }, // 神殿の白い壁に、正方形のスクリーン。門の前のMONBAN
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'MONBAN', text: '……聞こえるか…。' },
  { t: 'say', who: 'KIMORIN', text: '……これは....すごい発明品ですね。まぁ私の発明の方がすごいですけど。ね？うんぽん？' },
  { t: 'sprite', image: ['', 'kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポンうんポン！' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'MONBAN', text: 'ただし…星への門が開くのは…一日、88分だ…。' },
  { t: 'say', who: 'MONBAN', text: 'それを過ぎたら…門を閉める…。そしたら、バティ達は月に…お前たちは地球に、帰ってこい…。' },
  { t: 'say', who: 'KIMORIN', text: 'じゃあ88分過ぎたら、めちゃくちゃ地球に帰ります。' },
  { t: 'say', who: 'KIMORIN', text: 'うんぽんくんも、めちゃくちゃ月に帰ってください。' },
  { t: 'sprite', image: ['', 'kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' },
  { t: 'screen', open: false },
  { t: 'sprite', image: null },
  { t: 'notice', text: '星への門が開くのは、一日88分。過ぎると地球に帰り、次の日に、その続きから。月の工房とBluenaは、いつでも使えます' },
  { t: 'still', image: 's/moon-temple' }, // 光の柱の中で、OBOLONの白い三日月の目が、細くなる。黒い球が、ゆっくり、こちらを見送る
  { t: 'sprite', image: ['', 'obolon'] }, // 見送るOBOLON（QA 6 R5）
  { t: 'wait', s: 1.6, keepChat: true }, // the line stays (QA 11 R35)
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' }, // ロケットが、月から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  // Bluenaの上の青い光の球が、ふっと明るくなる（星への門が開いた）: the day's 88 minutes start here (not shown)
  { t: 'clock', on: true },
  { t: 'se', sound: 'sparkle' },
  { t: 'sprite', image: ['@bati', 'unchi-pinpon'] }, // {bati}とうんちピンポンくんが、その光に包まれて、となりの席に、ふわりと浮かぶ
  { t: 'wait', s: 1.8 },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-saturn' }, // 窓の外に、大きな輪のある星が近づいてくる
  { t: 'se', sound: 'whoosh' },

  // D04-S003 趣味の悪い神殿
  { t: 'scene', id: 'D04-S003' },
  { t: 'say', who: 'KIMORIN', text: '見てください。土星に着きました。' },
  { t: 'bgm', track: 'saturn' },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：巨大な輪、赤茶の大地、円い段々の神殿とタコの石像
  { t: 'arrive', image: 's/saturn-outside', caption: '土星の神殿に着いた' },
  { t: 'cam', move: 'in' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'これが土星の神殿ですか、、、土星の神殿は趣味悪いですね。' },
  { t: 'action', label: '神殿の中に入る' },
  { t: 'still', image: 's/saturn-inside' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] }, // 左にブラザー、右にシスター
  { t: 'caption', text: 'たこ焼きブラザーとたこ焼きシスターが現れた' },
  { t: 'say', who: 'たこ焼きシスター', text: '誰？　勝手に、私たちの神殿に入ってるのは。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'この趣味のいい神殿に、何の用だZE!!' },
  { t: 'sprite', image: ['takoyaki-brother', 'kimorin-sun', 'takoyaki-sister'] },
  { t: 'say', who: 'KIMORIN', text: 'はじめまして、たこ焼きのお二人。私たちは、Obolo Neoです。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ああ、君たちは、Neoなのね。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'よろしくなZE!!' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ってことは、土星に遊びに来たのね。' },
  { t: 'say', who: 'KIMORIN', text: '遊び、、？いえ、、、私達は、この秘密結社の正体を暴きに来たのです。' },
  { t: 'say', who: 'たこ焼きシスター', text: '遊んでる人って楽しそうで魅力的。とっても素敵だワ。私..大好きだワ' },
  { t: 'say', who: 'KIMORIN', text: '、、、ふふふふ。もももちろん、正体を暴くのも、楽しみの一環、つまり遊びなのです。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'そうなのね！じゃあさっそく土星で遊びましょう！' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'ついてこいだZE!!!' },

  // D04-S005 コロリン → D04-S005c ダチになる／広場へ飛ばす: the practice on the real Saturn world, the story's
  // lines inside it (components/saturn/SaturnLesson.tsx); the kororins are saved as d3.kororins
  { t: 'scene', id: 'D04-S005' },
  { t: 'bgm', track: 'saturn' }, // 練習のあいだも曲は流れる（小さく。録音中は止まる：QA 5 N14）
  { t: 'sprite', image: null },
  { t: 'saturn' },
  { t: 'scene', id: 'D04-S005c' }, // played inside the same lesson, after the kororins

  // D04-S007 土星の夜
  { t: 'scene', id: 'D04-S007' },
  { t: 'bgm', track: 'night' },
  { t: 'caption', text: 'その夜' },
  // {neo}のコロリンの一つから、細い光の糸が一本、木星の方角へ。神殿の石段。頭上で、輪が、ごう、と回る
  { t: 'still', image: 's/saturn-night' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: '……明日は、あっちですね。' }, // 丸いサングラスを押し上げて、光の糸の先を、じっと見る
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'saturn' },
  { t: 'caption', text: '切符に、土星のスタンプが押された' },
  // 石段で、KIMORIN⭐︎とうんちピンポンくんが寄りかかって眠る。{bati}は{neo}のひざの上で丸くなる
  { t: 'still', image: 's/saturn-night' },
  { t: 'wait', s: 1.6 },
  { t: 'caption', text: 'また明日' },
  // 〔通信：MONBANから（読まなくても、旅は続く）〕 — once, at the end of day 3 (M-R198)
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'say', who: 'MONBAN', text: '……{neo}。旅は、8日目に、地球の神殿へ帰って終わる…。そこで、エクリプスを受けるかを決める…。' },
  { t: 'say', who: 'MONBAN', text: '……8日目まで待てないなら、先に、Obolo Orderになってもいい…。月に、88円だ…。' },
  { t: 'say', who: 'MONBAN', text: '……先になっても、旅の道は変わらない…。{bati}のマナが、切れなくなる…。' },
  {
    t: 'choice',
    key: 'f_join_early',
    options: [
      { label: '先にObolo Orderになる', goto: 'join-early' },
      { label: '8日目に決める', goto: 'join-later' },
    ],
  },
  { t: 'label', id: 'join-later' },
  { t: 'say', who: 'MONBAN', text: '……そうか…。8日目に、待っている…。' },
  { t: 'goto', id: 'join-close' },
  { t: 'label', id: 'join-early' },
  { t: 'say', who: 'MONBAN', text: '……そうか…。では、一度、結社に戻ってこい…。詳しく、話したい…。' },
  { t: 'screen', open: false },
  { t: 'label', id: 'sys-s002' },
  ...SYS002, // SYS-S002 「結社で、詳しく話したい」 (M-R202), then back to the end of the day
  { t: 'goto', id: 'day-end' },
  { t: 'label', id: 'join-close' },
  { t: 'screen', open: false },
  { t: 'label', id: 'day-end' },
  { t: 'end' },
];
