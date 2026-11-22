import type { Step } from './script';
import { SYS002 } from './sys002';

/**
 * DAY 3 【月 → 土星】 — the simple version (M-R208〜M-R212; wip/P02/c02.md D04-S002〜S002b, c03.md D04-S003〜S007; the scene
 * ids say D04 but it is day 3). Starts after the email check 〔扉の合言葉〕 (DayAuth).
 *  - the Moon morning: Obolo Neo, Bluena (f_d04_bluena), the Moon atelier, 「作るのは、月。しまうのは、Bluena。見せるのは、、、星だ。」,
 *    the gate's 88 minutes (MONBAN on Bluena's screen)
 *  - D04-S002b: OBOLON teaches the kororin; Bluena gains the sound-wave shelf; KIMORIN⭐︎'s 「うんち。」 kororin sings;
 *    {neo}'s two kororins are made in {bati}'s chat (the 'atelier' step: cards, in Bluena at once); 〔土星へ飛ばす〕
 *    or 〔今は飛ばさない〕 (f_d04_fly = fly / skip); the rocket leaves the Moon — the day's 88 minutes start here ('clock')
 *  - Saturn only to look: the gaudy temple, the giant DJ record's cypher (D04-S005), the dachi with KIMORIN⭐︎ and
 *    {inviter}, {neo}'s own record, the first voice message (D04-S005c, f_d04_voice_reply = reply / later)
 *  - the night: the Saturn stamp, back to the Moon to sleep, MONBAN's one-time offer to become Obolo Order early (SYS-S002)
 * Nothing is made on Saturn (M-R208).
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
  { t: 'set', key: 'f_d04_bluena', value: 'true' }, // the atelier's Bluena drawer opens from here
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
  { t: 'notice', text: 'チャットの画面の右に、Bluenaのバナーができました。最初の棚（顔の記号）に、きのう作った{neo}の姿が、もう入っています' },
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
  // D04-S002b 月の工房で、はじめてのコロリン（M-R208：作るのは月。OBOLONが教える → 棚が増える → チャットで作る → 飛ばす）
  { t: 'scene', id: 'D04-S002b' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。お前は、ついに、コロリンを、作れるようになる。' },
  { t: 'say', who: 'OBOLON', text: 'その魔法を、今日は、教える。' },
  { t: 'say', who: 'KIMORIN', text: 'コロリン？' },
  { t: 'say', who: 'OBOLON', text: '、、、つぶやきだ。思ったことを、声で、{bati}に、話せ。' },
  { t: 'say', who: 'OBOLON', text: '{bati}が、魔法で、それを、コロリンにする。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // Bluenaの上の青い光の球に、小さな棚が一つ。棚の右下に、音の波の記号
  { t: 'se', sound: 'sparkle' },
  { t: 'notice', text: 'Bluenaに、新しい棚（音の波）が増えた。作ったコロリンは、できたらすぐ、ここにしまわれます' },
  // 月の工房。作業台の前で、{bati}がこちらを向く。となりの作業台で、KIMORINも、うんちピンポンくんとのチャットを開く
  { t: 'still', image: 's/moon-temple', fade: 0.8 },
  { t: 'cam', move: 'in', focus: '50% 40%' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'KIMORIN', text: '……何を、つぶやけばいいですか？' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、最近、食べて、うまかったものを、言ってみろ。' },
  { t: 'say', who: 'KIMORIN', text: 'うんち。' },
  { t: 'wait', s: 1.4, keepChat: true }, // シーン……。OBOLONと、うんちピンポンくんと、{bati}が、無言でKIMORINを見つめる
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポーン！' },
  { t: 'fx', fx: 'kimorin-kororin' }, // KIMORINのチャットに、コロリンのカードが一枚。KIMORINの見た目の、まんまるのたこ焼き
  { t: 'say', who: 'KIMORIN', text: 'なんですかこのかわいいたこ焼きは！' },
  { t: 'say', who: 'OBOLON', text: '、、、タップしてみろ。' },
  // 工房の灯りが暗くなる。サングラスがシャキーンと落ち、ピックがマイクに。KIMORINの声のまま、アカペラで歌う
  { t: 'bgm', track: null, fade: 0.6 },
  { t: 'say', who: 'コロリン', text: '♪うんち。♪', voice: 'KIMORIN' },
  { t: 'fx', fx: null },
  { t: 'bgm', track: 'moon' },
  { t: 'say', who: 'KIMORIN', text: '楽しいですね。' },
  { t: 'say', who: 'OBOLON', text: '、、、コロリンは、歌う。' },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: '@bati' },
  { t: 'face', who: '@bati', expr: 'sparkle' },
  { t: 'say', who: 'バティ', text: '{neo}も！　最近食べて、おいしかったもの、言ってみて！' },
  {
    t: 'atelier',
    kind: 'voice', // the first kororin in {bati}'s chat: the voice consent once, the mic, the card (〔もう一回〕), in Bluena at once
    lines: [
      { t: 'say', who: 'バティ', text: 'じゃあ、コロリンにするね！' },
      { t: 'say', who: 'コロリン', text: '♪〈{neo}が吹き込んだ言葉、そのまま〉♪' },
    ],
  },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] }, // KIMORINの扇の尾が、まだ、ビートに合わせて、ぱたぱた揺れている
  { t: 'say', who: 'KIMORIN', text: '……尾が、勝手に。これは、私の意思ではありません。' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、最後は、自由に、なんでもいい。' },
  { t: 'say', who: 'KIMORIN', text: 'ぷりぷりぷりり、うひょひょひょ、げへへ！　ピンポン大正解！' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポーン！' },
  { t: 'fx', fx: 'kimorin-kororin' }, // KIMORINのチャットに、二つ目のコロリンのカード。すぐに、サングラスがシャキーンと落ちて、歌う
  { t: 'say', who: 'コロリン', text: '♪ぷりぷりぷりり、うひょひょひょ、げへへ！　ピンポン大正解！♪', voice: 'KIMORIN' },
  { t: 'fx', fx: null },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '{neo}の番だよ！　なんでもいいよ！' },
  {
    t: 'atelier',
    kind: 'voice', // the second kororin (迷った時の例：今したいこと／最近驚いたこと／やりたいこと)
    lines: [{ t: 'say', who: 'コロリン', text: '♪〈{neo}が吹き込んだ言葉、そのまま〉♪' }],
  },
  { t: 'say', who: 'バティ', text: 'ぜんぶ、Bluenaに、しまってあるよ！' },
  { t: 'notice', text: 'コロリンは、できたらすぐ、Bluenaの音の波の棚に、日付と時刻つきでしまわれます。{neo}だけが見られます。コロリンは、いつでも、このチャットで作れます' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、見せたいコロリンは、土星へ、飛ばせる。' },
  { t: 'notice', text: 'カードの〔飛ばす〕を押すと、コロリンが土星へ飛びます（何個でも。飛ばさなくてもいい）。飛ばしたコロリンは、88時間、土星の巨大なDJレコードの上で、みんなのコロリンとサイファーします' },
  { t: 'say', who: 'KIMORIN', text: 'では、全部。……全部、名作ですので。' }, // 〔飛ばす〕を二つとも。コロリンが二つ、天井の窓から宇宙へ
  { t: 'se', sound: 'whoosh' },
  {
    t: 'choice',
    key: 'f_d04_fly',
    options: [
      { label: '土星へ飛ばす', goto: 'fly' },
      { label: '今は飛ばさない', goto: 'skip' },
    ],
  },
  { t: 'label', id: 'fly' },
  { t: 'set', key: 'f_d04_fly', value: 'fly' },
  { t: 'se', sound: 'whoosh' },
  { t: 'caption', text: 'コロリンが、土星へ飛んでいった' },
  { t: 'goto', id: 'flown' },
  { t: 'label', id: 'skip' },
  { t: 'set', key: 'f_d04_fly', value: 'skip' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '飛ばしたくなったら、このチャットで、いつでも飛ばせるよ！' },
  { t: 'label', id: 'flown' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、飛ばしたものが、どう生きているか。土星へ、見に行け。' },
  { t: 'say', who: 'KIMORIN', text: '言われなくても、行きます。名作の、晴れ舞台ですので。' },
  { t: 'sprite', image: ['', 'obolon'] }, // OBOLONの白い三日月の目が、細くなる。黒い球が、ゆっくり、こちらを見送る
  { t: 'wait', s: 1.6, keepChat: true },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' }, // ロケットが、月から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  // Bluenaの上の青い光の球が、ふっと明るくなる（星への門が開いた）: the day's 88 minutes start here, after making (SYS-S001)
  { t: 'clock', on: true },
  { t: 'se', sound: 'sparkle' },
  { t: 'sprite', image: ['@bati', 'unchi-pinpon'] }, // {bati}とうんちピンポンくんが、その光に包まれて、となりの席に浮かぶ
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
  { t: 'say', who: 'たこ焼きシスター', text: 'そうなのね！じゃあさっそく、土星のコロリンを見せてあげるワ！' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'ついてこいだZE!!!' },

  // D04-S005 巨大なDJレコードの、サイファー（見るだけ。飛ばしたコロリンが、ここで88時間サイファーする）
  { t: 'scene', id: 'D04-S005' },
  { t: 'still', image: 's/saturn-inside' }, // 神殿の奥の大広間。巨大なDJレコードが、ゆっくり回っている。レコードの上に、いろんな顔のコロリン
  { t: 'fx', fx: 'ring' },
  { t: 'caption', text: '土星の巨大なレコード' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きブラザー', text: '土星は原石の星だZE!!' },
  { t: 'say', who: 'たこ焼きシスター', text: '飛んできたコロリンは、みんな、ここで、サイファーするのよ。' },
  { t: 'sprite', image: ['takoyaki-brother', 'kimorin-sun', 'takoyaki-sister'] },
  { t: 'say', who: 'KIMORIN', text: 'サイファー？' },
  { t: 'say', who: 'たこ焼きブラザー', text: '順番に、歌うんだZE!!　聞いてみるZE!!' },
  // 針が、レコードに落ちる。知らない誰かのコロリンが、知らない誰かの声のまま、つぶやきを歌いつないでいく
  { t: 'sprite', image: null },
  { t: 'say', who: 'コロリン', text: '♪……今日も、異常なし…。♪', voice: 'MONBAN' }, // 黒いフードのMONBANのコロリン
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……MONBANさんのまで、いますね。' },
  { t: 'sprite', image: null },
  { t: 'say', who: 'コロリン', text: '♪うんち。♪', voice: 'KIMORIN' }, // KIMORINのコロリン（ふちが、ほんのり白く光る）
  { t: 'wait', s: 1.2, keepChat: true }, // シーン……。知らない誰かのコロリンたちが、一瞬だけ、歌うのをやめる
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……大舞台でも、堂々としていますね。さすが、私です。' },
  { t: 'branch', key: 'f_d04_fly', cases: { fly: 'rec-fly' }, otherwise: 'rec-skip' },
  { t: 'label', id: 'rec-fly' },
  { t: 'sprite', image: null }, // 輪の中に、{neo}のコロリン。ふちが、金色に光っている
  { t: 'notice', text: '光っているのが、{neo}のコロリンです。タップすると、そのコロリンの番がきます' },
  { t: 'action', label: '自分のコロリンをタップする' },
  { t: 'say', who: 'コロリン', text: '♪〈{neo}が吹き込んだ言葉、そのまま〉♪' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きシスター', text: '……いい声だワ。' },
  { t: 'goto', id: 'rec-end' },
  { t: 'label', id: 'rec-skip' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] }, // 輪の中に、{neo}のコロリンは、まだいない
  { t: 'say', who: 'たこ焼きシスター', text: '{neo}のコロリンは、まだBluenaの中ね。飛ばしたくなったら、いつでも来るワ。' },
  { t: 'label', id: 'rec-end' },
  { t: 'notice', text: 'ここには、この88時間に土星へ飛ばされたコロリンが集まっています（ダチの分も、ほかの人の分も）。タップしたコロリンの番がきます' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'サイファーは、88時間、止まらないZE。{neo}が寝てる間も、だZE!!' },
  { t: 'say', who: 'たこ焼きブラザー', text: '自分で思ったことや、感じたこと、思いついたことは、全部コロリンにしちゃえ。それは全部、大切な思い出だZE。' },
  { t: 'fx', fx: null },

  // D04-S005c ダチになる／自分のレコード／はじめての声のメッセージ（M-R212）
  { t: 'scene', id: 'D04-S005c' },
  { t: 'fx', fx: 'ring-drop' }, // 羅針盤の形の金の封印がついたコロリンが一つ。知らない声で、短く歌う
  { t: 'say', who: 'たこ焼きブラザー', text: '今の、招待者の、{inviter}のだZE。' },
  { t: 'say', who: 'たこ焼きシスター', text: '{neo}を、ここに招いてくれた人だワ。' },
  { t: 'fx', fx: null },
  { t: 'say', who: 'たこ焼きブラザー', text: '土星では、作ったものを届け合う仲間を、ダチって呼ぶZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'ダチは、本当に知ってる奴とだけ、なるもんだZE。' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'では、ダチに、なりましょう。……というか、もう、ダチですよね？' }, // 手を差し出す。{neo}と、握手
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: 'KIMORIN⭐︎がダチになった' },
  { t: 'set', key: 'f_dachi_kimorin', value: 'true' },
  // 右上の〔ダチ〕がひらく。名札が二つ。『ダチ　KIMORIN⭐︎』と、羅針盤の封印の{inviter}の名札。招待状のひとことが金色の字で
  { t: 'caption', text: '「{inviter_message}」', when: 'inviterMessage' },
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: '{inviter}がダチになった' },
  { t: 'set', key: 'f_dachi_inviter', value: 'true' },
  { t: 'set', key: 'f_d04_dachi_inviter', value: 'true' },
  { t: 'sprite', image: ['takoyaki-brother', 'kimorin-sun', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きシスター', text: '今日から、上に〔推し〕ができるワ。ダチの作品だけが、そこに入るワ。' },
  { t: 'say', who: 'KIMORIN', text: '推し、ですか。……私は、ずっと、自分推しです。' },
  { t: 'notice', text: 'ダチになれるのは、招待状でつながった、本当に知っている人だけです。知らない人から、ダチの申しこみが来ることはありません' },
  { t: 'say', who: 'たこ焼きブラザー', text: '最後に、{neo}の場所だZE!!' },
  // 大広間の壁に、丸い棚。名札つきのレコードが一枚ずつ。その一枚に『{neo}』、となりに『KIMORIN⭐︎』。溝は、まだからっぽ
  { t: 'say', who: 'たこ焼きシスター', text: 'サイファーが終わったコロリンは、自分のレコードに、並ぶの。' },
  { t: 'branch', key: 'f_d04_fly', cases: { fly: 'own-fly' }, otherwise: 'own-end' },
  { t: 'label', id: 'own-fly' },
  { t: 'say', who: 'たこ焼きブラザー', text: '88時間たったら、{neo}のコロリンも、ここに帰ってくるZE!!' },
  { t: 'label', id: 'own-end' },
  { t: 'notice', text: '{neo}のレコードは、土星へ飛ばしたコロリンを見せる棚です。Bluenaの中のコロリンと同じ物が並びます' },
  { t: 'say', who: 'KIMORIN', text: '……私のレコードは、名作で、すぐ、いっぱいになりますね。' },
  // ピロン。チャットの画面の左のバナーが光る。{bati}の下に『{inviter}』と『KIMORIN⭐︎』の会話。『{inviter}』に声のメッセージ
  // PLACEHOLDER (M-R212): the dachi voice screens are another agent's; here only the story's choice and its flag
  { t: 'se', sound: 'blip' },
  { t: 'notice', text: '左のバナーを開いて、『{inviter}』を押す。声のメッセージを再生する' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '{neo}、声で、返してみよう！' },
  { t: 'notice', text: 'ダチとの会話も、{bati}とのチャットと同じ画面です。マイクのボタンを押している間だけ録音され、離すと送る前に聞き直せます。Bluenaの作品も、カードで送れます' },
  {
    t: 'choice',
    key: 'f_d04_voice_reply',
    options: [
      { label: '声で返す', goto: 'reply' },
      { label: 'あとで返す', goto: 'reply-later' },
    ],
  },
  { t: 'label', id: 'reply' },
  { t: 'set', key: 'f_d04_voice_reply', value: 'reply' },
  { t: 'caption', text: 'はじめての声のメッセージを送った' },
  { t: 'goto', id: 'reply-end' },
  { t: 'label', id: 'reply-later' },
  { t: 'set', key: 'f_d04_voice_reply', value: 'later' },
  { t: 'say', who: 'バティ', text: 'いつでも、左のバナーから、返せるよ！' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……私にも、送っていいですよ。返事は、気が向いたら、しますので。' },
  { t: 'notice', text: '声のメッセージは、ダチどうしの間だけで届きます。知らない人からは届きません。困った時は、会話の右上から、ブロックや通報ができます' },
  { t: 'label', id: 'reply-end' },
  { t: 'sprite', image: null },

  // D04-S007 土星の夜 → 月へ帰って眠る
  { t: 'scene', id: 'D04-S007' },
  { t: 'bgm', track: 'night' },
  { t: 'caption', text: 'その夜' },
  { t: 'still', image: 's/saturn-night' }, // 神殿の石段。頭上で、輪が、ごう、と回る。サイファーの歌が、まだ、かすかに
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'saturn' },
  { t: 'caption', text: '切符に、土星のスタンプが押された' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きブラザー', text: '明日は木星だZE!!　遅れるんじゃねぇZE!!' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'rocket' }, // ロケットが、土星から月へ帰る
  { t: 'still', image: 's/moon-night', fade: 0.8 }, // 月の神殿のベッド。{bati}は、{neo}の枕もとで丸くなる。光の糸が一本、木星の方角へ
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: '……明日は、あっちですね。' }, // 寝ぼけて、丸いサングラスを押し上げて、光の糸の先を、じっと見る
  { t: 'sprite', image: null },
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
