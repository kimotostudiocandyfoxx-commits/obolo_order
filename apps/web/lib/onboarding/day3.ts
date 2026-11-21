import type { Step } from './script';
import { SYS002 } from './sys002';

/**
 * DAY 3 【月 → 土星】 — the simple version (M-R198, wip/P02/c02.md D04-S002〜S003, c03.md D04-S005〜S007; the scene ids
 * say D04 but it is day 3). Starts after the email check 〔扉の合言葉〕 (DayAuth). The morning on the Moon: the egg
 * placed on day 2 hatches ({bati}, then うんちピンポンくん), {neo} names {bati}, Obolo Neo, then the rocket leaves the
 * Moon (the day's 88 minutes start: 'clock', M-R22). Bluena was handed over at the end of day 2 (D03-S009). Saturn:
 * the gaudy temple, たこ焼きブラザー & シスター, the kororin practice and the dachi with KIMORIN⭐︎ and {inviter}
 * (components/saturn/SaturnLesson.tsx), Saturn's night and its stamp, and MONBAN's one-time offer to become Obolo Order
 * early (`f_join_early`). The dachi's messages live in Bluena's 〔💬 通信〕 (M-R194).
 * Saved: {bati} and its name, the kororins (d3.kororins), the Saturn stamp.
 */
export const DAY3: Step[] = [
  // D04-S002 おはようございます／バティ誕生
  { t: 'scene', id: 'D04-S002' },
  { t: 'bgm', track: 'moon' }, // 月の神殿の朝
  { t: 'caption', text: '3日目' },
  { t: 'still', image: 's/moon-temple' }, // 月の神殿。窓の外に、青い地球
  { t: 'sprite', image: 'kimorin-sun' },
  // KIMORINが、こちらを向いて立っている (the standing picture, facing us: client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。いつまで寝ているのですか？', expr: 'stand' },
  { t: 'say', who: 'KIMORIN', text: '私は、楽しみすぎて、一睡もしていません。', expr: 'stand' },
  { t: 'say', who: 'KIMORIN', text: 'さぁ、早く。たまごが、かえりますよ。', expr: 'stand' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/d2-altar' }, // 祭壇の上で、二つのたまごが光っている。光の柱の中に、黒い球のOBOLON
  { t: 'sprite', image: ['', 'obolon'] },
  { t: 'wait', s: 1.4 },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'tender' },
  { t: 'se', sound: 'egg-crack' },
  // 映画の場面：{neo}のたまご（2日目に選んだ方）の模様が速く回り、ひび、〈{food}〉の香りの光の粒、殻が割れて転がり出る
  { t: 'branch', key: 'd2.egg', cases: { 太陽と月のたまご: 'hatch-sun' }, otherwise: 'hatch-earth' },
  { t: 'label', id: 'hatch-sun' },
  { t: 'video', motion: 'd2-hatch-sun' },
  { t: 'goto', id: 'hatch' },
  { t: 'label', id: 'hatch-earth' },
  { t: 'video', motion: 'd2-hatch-earth' },
  { t: 'label', id: 'hatch' },
  { t: 'hatch' }, // 〈{food}〉みたいな、小さくてかわいい生き物が、ころんと転がり出る。目が開く
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '……やぁ！' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '相方が誕生した' },
  // となりで、KIMORIN⭐︎のたまご（残った方）が割れて、うんちピンポンくんが跳ね出る
  { t: 'sprite', image: null },
  { t: 'se', sound: 'egg-crack' },
  { t: 'branch', key: 'd2.egg', cases: { 太陽と月のたまご: 'pinpon-earth' }, otherwise: 'pinpon-sun' },
  { t: 'label', id: 'pinpon-earth' },
  { t: 'video', motion: 'd2-pinpon-earth' },
  { t: 'goto', id: 'pinpon' },
  { t: 'label', id: 'pinpon-sun' },
  { t: 'video', motion: 'd2-pinpon-sun' },
  { t: 'label', id: 'pinpon' },
  { t: 'still', image: 's/d2-moon-in' }, // 生まれる映像の最後の絵を残さない（立ち絵と見た目がちがう：QA 5 N26）
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'OBOLON', text: 'これが、、、お前の、相方だ。' },
  { t: 'say', who: 'KIMORIN', text: 'こ、、、これが、、私の、、相方？' }, // サングラスが鼻先までずり落ち、目の切れ目から青い光がぽろぽろ
  { t: 'say', who: 'KIMORIN', text: 'どんな時も、私のことを肯定してくれてましたね、、、' },
  { t: 'say', who: 'KIMORIN', text: 'やっと、会えましたね。' },
  { t: 'say', who: 'OBOLON', text: '名前を、つけろ' },
  { t: 'say', who: 'KIMORIN', text: 'うんちピンポンくん、、、いや、うんぽん' },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' }, // KIMORIN⭐︎のまわりを、ぴょんぴょん跳ねる
  // 画面に、{neo}の{bati}だけが映る (client 2026-10-29)
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'OBOLON', text: 'お前も、、、名前を、つけてやれ。' },
  { t: 'batiname', placeholder: 'バティの名前', submit: 'この名前にする' },
  { t: 'notice', text: '名前は、あとでいつでも変えられます' },
  { t: 'sprite', image: '@bati' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '{bati}が相方になった' },
  { t: 'face', who: '@bati', expr: 'smile' },
  { t: 'bgm', track: 'moon' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '今日、行く場所は、、、土星だ。' },
  { t: 'say', who: 'KIMORIN', text: '土星ですか。いいですね。せっかくObolo Orderになってあげたこの私を、しっかり案内してくださいね。' },
  { t: 'say', who: 'OBOLON', text: 'まだお前はObolo Orderじゃない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？そうなの？', flip: true }, // OBOLONのほうを向いて
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderはみんなマナを自分の体から生成し、魔法を唱える。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちはまだマナを生成できないし、魔法も何も習得してない。' },
  { t: 'say', who: 'OBOLON', text: 'そんなお前たちのことを、、Obolo Neo、と呼ぶ。' },
  { t: 'say', who: 'KIMORIN', text: 'なるほど。Obolo Neoですか、響きは、嫌いじゃありませんね。' },
  { t: 'sprite', image: null },
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
