import type { Step } from './script';
import { PLANET_HOMES_ENV, planetHomeIsNew } from '../planetHomes';
import { D7_BOOTH, D7_BOOTH_UNTIL, D7_BOOTHS, D7_BOOTHS_FROM, journeyNotes, replaceStretch } from './newHomeScenes';
import { kimorinBack } from './kimorinBack';

/**
 * DAY 7 【月 → 金星】 — the simple version (M-R208/M-R210/M-R211; wip/P04/c01v.md D07V-S001〜S004; M-R190: Venus is the
 * radio planet). Starts after the email check 〔扉の合言葉〕 (DayAuth).
 *  - the Moon morning: OBOLON 「お前は、ついに、ラジオを、作れるようになる。」; Bluena gains the broadcast shelf;
 *    KIMORIN⭐︎'s sample show in his chat (『プリプリ・ボカン』, すね毛が三倍)
 *  - {neo}'s show in {bati}'s chat (the 'atelier' step: pick a song, talk into the mic, the song after it; the card with
 *    〔聞き直す〕〔録り直す〕, in Bluena at once) and 〔金星へ飛ばす〕 or 〔今は飛ばさない〕 (f_d07v_show = send / keep);
 *    the rocket leaves the Moon — the day's 88 minutes start here ('clock')
 *  - Venus only to listen: the king guess, ボスGたち, the radio cloud (D07V-S003, f_d07v_arrived), {neo}'s booth and the
 *    fifth stamp (D07V-S004, f_d07v_done). The night is slept on Venus; day 8 (Pluto, M-R341) starts on the Moon like the others.
 * Nothing is made on Venus (M-R208; the easy DJ practice is gone).
 */
/** the day as written before M-R341 / M-R336 (journeyNotes adds what they bring) */
const DAY7_OLD: Step[] = [
  // D07V-S001 月の朝／番組が作れる
  { t: 'scene', id: 'D07V-S001' },
  { t: 'bgm', track: 'moon' },
  { t: 'caption', text: '7日目' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  ...kimorinBack(7), // SYS-S002: once, if he walked out
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。……切符の欄は、あと一つですね。' },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。お前は、ついに、ラジオを、作れるようになる。' },
  { t: 'say', who: 'OBOLON', text: 'その魔法を、今日は、教える。' },
  { t: 'say', who: 'OBOLON', text: '自分の声で、話す。自分の曲を、かける。、、、それを、録っておく。それが、番組だ。' },
  { t: 'say', who: 'OBOLON', text: '声と、曲を、混ぜて、届ける。' },
  { t: 'say', who: 'KIMORIN', text: '……混ぜて、届ける。宅配の、魔法ですか。' },
  { t: 'say', who: 'OBOLON', text: '、、、ラジオだ。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // Bluenaの上の青い光の球に、小さな棚が、もう一つ。棚の右下に、放送の電波の記号
  { t: 'se', sound: 'sparkle' },
  { t: 'notice', text: 'Bluenaに、新しい棚（放送の電波）が増えた。作った番組は、できたらすぐ、ここにしまわれます' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '工房に行こう！' },
  { t: 'cam', move: 'in', focus: '50% 40%' }, // 月の工房。となりの作業台で、KIMORINも、うんちピンポンくんとのチャットを開く
  { t: 'notice', text: '番組は、このチャットで録ります。〔マイクのボタン〕で話すと、話し終わったあとに、選んだ曲がかかります' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'KIMORIN', text: 'では、お手本を。' }, // 『プリプリ・ボカン』のカードを押し、〔マイクのボタン〕を押す
  { t: 'say', who: 'KIMORIN', text: 'こんばんは。天才、KIMORIN⭐︎です。今夜の一曲は、『プリプリ・ボカン』。' },
  { t: 'se', sound: 'sparkle' }, // KIMORINの声のあとに、『プリプリ・ボカン』の大合唱
  { t: 'say', who: 'KIMORIN', text: '……サビだけ、三回、かけてください。' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪' },
  { t: 'cam', move: 'shake' }, // すね毛、すね毛、すね毛楽しい！と、神々しく、工房じゅうに響きわたる
  { t: 'say', who: 'KIMORIN', text: 'すね毛が、三倍ケン!!　……失礼。三倍です。' },
  { t: 'say', who: 'KIMORIN', text: '……完璧です。' }, // 番組のカード。〔聞き直す〕。もう一度、すね毛が三倍
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、録り直しは、何度でも、できる。' },
  { t: 'say', who: 'KIMORIN', text: '要りません。' },

  // D07V-S002 {neo}の番組／金星へ飛ばす
  { t: 'scene', id: 'D07V-S002' },
  {
    t: 'atelier',
    kind: 'radio', // 曲のカード → マイクで話す（〔曲だけにする〕）→ 曲がかかる → the show card (〔聞き直す〕〔録り直す〕)
    lines: [
      { t: 'say', who: 'バティ', text: '{neo}の番だよ！　どの曲、かける？' },
      { t: 'say', who: 'バティ', text: 'じゃあ、マイクで話して！　話し終わったら、曲をかけるよ！' },
      { t: 'say', who: 'バティ', text: 'Bluenaに、しまったよ！' },
      { t: 'say', who: 'バティ', text: '何回でも、いいよ！' },
    ],
  },
  { t: 'notice', text: '番組を、Bluenaの放送の電波の棚にしまいました。{neo}だけが聴けます' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、聴かせたい番組は、金星へ、飛ばせる。' },
  { t: 'notice', text: 'カードの〔飛ばす〕を押すと、番組が小さなラジオ（電波）になります。ラジオは88時間、金星の雲の上を漂います。近づくと聞こえます（みんなが聴けます）' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も。' }, // すね毛三倍の番組の〔飛ばす〕。小さな光の粒になって、天井の窓から宇宙へ
  { t: 'se', sound: 'whoosh' },
  {
    t: 'choice',
    key: 'f_d07v_show',
    options: [
      { label: '金星へ飛ばす', goto: 'send' },
      { label: '今は飛ばさない', goto: 'keep' },
    ],
  },
  { t: 'label', id: 'send' },
  { t: 'set', key: 'f_d07v_show', value: 'send' },
  { t: 'se', sound: 'whoosh' }, // 番組のカードが、小さな光の粒になって、天井の窓から宇宙へ飛んでいく
  { t: 'goto', id: 'sent' },
  { t: 'label', id: 'keep' },
  { t: 'set', key: 'f_d07v_show', value: 'keep' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '飛ばしたくなったら、このチャットで、いつでも飛ばせるよ！' },
  { t: 'label', id: 'sent' },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、金星へ、聴きに行け。' },
  { t: 'action', label: 'ロケットで金星へ' },

  // D07V-S003 金星へ／電波の雲
  { t: 'scene', id: 'D07V-S003' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'rocket' }, // ロケットが、月から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true }, // the day's 88 minutes start as the rocket leaves the Moon, after making (SYS-S001)
  { t: 'bgm', track: 'space' },
  { t: 'sprite', image: ['@bati', 'unchi-pinpon'] },
  { t: 'wait', s: 1.2 },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、、、王様、なんです。' },
  { t: 'say', who: 'KIMORIN', text: '大根の皇帝に、冠のカバ。次は、女王様が、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '金星には…ゴリラの、ボスGたちが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、ゴリラでしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-venus' },
  { t: 'se', sound: 'whoosh' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'venus' },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：金色にかすむ金星。星ぜんたいが巨大なレコード。金色の雲に、小さなラジオ
  { t: 'arrive', image: 's/venus-stage', caption: '金星に着いた' }, // 〔背景 venus-booth（仮）〕: no booth picture yet
  { t: 'set', key: 'f_d07v_arrived', value: 'true' },
  { t: 'cam', move: 'in' },
  { t: 'sprite', image: ['hatg', 'bossg', 'longg'] },
  { t: 'caption', text: 'ボスGたちが現れた' },
  { t: 'say', who: 'ボスG', text: '……誰だ、お前ら。' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '私たちは、ネオです。' },
  { t: 'say', who: 'ボスG', text: 'ネオか。……番組を、聴きに来たのだな。' },
  { t: 'say', who: 'ボスG', text: 'ここは、ラジオの星だ。……近づけば、聞こえる。' },
  { t: 'cam', move: 'out' },
  // 雲の上を歩く。ラジオに近づくと、知らない誰かの声と曲。ひときわ大きな声のラジオ：すね毛、すね毛、すね毛楽しい！
  { t: 'say', who: 'KIMORIN', text: '……遠くからでも、聞こえますね。さすが、私です。' },
  { t: 'say', who: 'ボスG', text: '……音量は、みんな、同じだ。' },
  { t: 'branch', key: 'f_d07v_show', cases: { send: 'radio-send' }, otherwise: 'radio-keep' },
  { t: 'label', id: 'radio-send' },
  { t: 'sprite', image: null }, // 雲のあいだに、ふちが金色に光るラジオ。アンテナの先に、小さくデフォルメした{neo}
  { t: 'notice', text: '光っているのが、{neo}の番組です。近づくと、聞こえます' },
  { t: 'action', label: '自分のラジオに近づく' }, // {neo}の声と、{neo}の曲が、雲の上に流れる
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: '……いい番組だ。' },
  { t: 'goto', id: 'radio-end' },
  { t: 'label', id: 'radio-keep' },
  { t: 'notice', text: '{neo}のラジオは、まだいない。{neo}の番組は、Bluenaの中で待っている' },
  { t: 'label', id: 'radio-end' },
  { t: 'notice', text: 'ここには、この88時間に金星へ飛ばされた番組が、小さなラジオになって漂っています（ダチの分も、ほかの人の分も）。近づくと聞こえます' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: '88時間、漂ったら、番組は、自分のブースに帰る。' },

  // D07V-S004 {neo}のブース／5つ目のスタンプ（金星で眠る）
  { t: 'scene', id: 'D07V-S004' },
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/venus-night' }, // 夜。針の腕の根もと。小さなブースが並ぶ。その一つの扉に『{neo}』。『ON AIR』は消えている
  { t: 'say', who: 'ボスG', text: 'ここが、{neo}のブースだ。' },
  { t: 'say', who: 'ボスG', text: '88時間、漂った番組は、ここに帰って、並ぶ。いつでも、聴き返せる。' },
  { t: 'branch', key: 'f_d07v_show', cases: { send: 'booth-end' }, otherwise: 'booth-keep' },
  { t: 'label', id: 'booth-keep' },
  { t: 'say', who: 'ボスG', text: '飛ばすのは、いつでもいい。' },
  { t: 'label', id: 'booth-end' },
  { t: 'say', who: 'ボスG', text: '……生で、やりたくなったら、いつでも来い。' },
  { t: 'say', who: 'KIMORIN', text: '生、ですか。……心の準備が、要りますね。' },
  { t: 'notice', text: '生配信は、Obolo Orderになったあと、金星の放送ブースから始められます' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'venus' }, // 5つの欄が、全部うまる。切符が、金色に光る
  { t: 'caption', text: '5つの星を、まわった' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  // M-R341: the journey goes on — Pluto is tomorrow (before: 「明日は、地球だ。その先に、太陽がある。」「……明日は、決める日、ですね。」).
  // The order of the days is not the planet homes' switch: these two lines are the same with it on or off.
  { t: 'say', who: 'ボスG', text: '明日は、冥王星だ。いちばん遠くて、暗い星だ。' },
  { t: 'say', who: 'KIMORIN', text: '……まだ、星めぐりは続くのですね。' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……{neo}の曲が、まだ耳に残っています。……すね毛の、次くらいに。' },
  { t: 'set', key: 'f_d07v_done', value: 'true' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/venus-night', fade: 0.8 }, // 金星の雲の上。ラジオたちが星のように漂う。KIMORINとうんちピンポンくんが、雲にもたれて寝息
  { t: 'wait', s: 2 },
  { t: 'bgm', track: 'farewell' },
  { t: 'caption', text: 'また明日' }, // 〔完了画面：8日目（冥王星）まで24時間のカウントダウン〕 (TomorrowScreen)
  { t: 'end' },
];

/** the day on the planet's screen of before: played until the planet's switch is on */
export const DAY7_BEFORE: Step[] = journeyNotes(7, DAY7_OLD);

/**
 * story 2026-11-27 (M-R330): the day on the planet's NEW home — the script of now, word for word (story-sync checks
 * this one). Played only when the planet's switch is on (lib/planetHomes.ts, off by default).
 */
export const DAY7_NEW_HOME: Step[] = journeyNotes(7, replaceStretch(replaceStretch(DAY7_OLD, 'D07V-S003', D7_BOOTHS, { from: D7_BOOTHS_FROM }), 'D07V-S004', D7_BOOTH, { until: D7_BOOTH_UNTIL }));

/** the day as played: its steps of before, unchanged, until venus's switch is on */
export const DAY7: Step[] = planetHomeIsNew('venus', PLANET_HOMES_ENV) ? DAY7_NEW_HOME : DAY7_BEFORE;
