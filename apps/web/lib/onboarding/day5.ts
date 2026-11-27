import type { Step } from './script';
import { PLANET_HOMES_ENV, planetHomeIsNew } from '../planetHomes';
import { D5_NEW, journeyNotes, withNewHomes } from './newHomeScenes';
import { kimorinBack } from './kimorinBack';

/**
 * DAY 5 【月 → 水星】 — the simple version (M-R208/M-R210/M-R211; wip/P03/c03.md D06-S001〜S007, c04.md D06-S002〜S008;
 * the scene ids say D06 but it is day 5). Starts after the email check 〔扉の合言葉〕 (DayAuth).
 *  - the Moon morning: OBOLON 「お前は、ついに、曲を、作れるようになる。」; Bluena gains the note shelf
 *  - the Moon atelier: KIMORIN⭐︎'s two songs on 『プリプリ・ボカン』 in his chat (D06-S006), then {neo}'s song in {bati}'s chat
 *    (the 'atelier' step: the card, 〔もう一回（1回だけ）〕, in Bluena at once) and 〔水星へ飛ばす〕 or 〔今は飛ばさない〕
 *    (f_d06_sent_song = sail / keep); the rocket leaves the Moon — the day's 88 minutes start here ('clock')
 *  - Mercury only to look: the food guess, フリージー, the sea of music ships (D06-S005), {neo}'s island (D06-S007b), the
 *    Mercury stamp, back to the Moon to sleep. Nothing is made on Mercury (M-R208).
 */
/** the day as written before M-R341 / M-R336 (journeyNotes adds what they bring) */
const DAY5_OLD: Step[] = [
  // D06-S001 月の朝／曲が作れる
  { t: 'scene', id: 'D06-S001' },
  { t: 'bgm', track: 'moon' },
  { t: 'caption', text: '5日目' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  ...kimorinBack(5), // SYS-S002: once, if he walked out
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。……今日は、水星ですね。' },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。お前は、ついに、曲を、作れるようになる。' },
  { t: 'say', who: 'OBOLON', text: 'その魔法を、今日は、教える。' },
  { t: 'say', who: 'OBOLON', text: '今日食べたラーメンが、美味しかった。学校に、遅刻しそうだ。、、、そんな自分の日常を、話せばいい。言葉が、そのまま、歌詞になる。' },
  { t: 'say', who: 'OBOLON', text: 'きのうのアートを、曲の顔に、してもいい。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // Bluenaの上の青い光の球に、小さな棚が、もう一つ。棚の右下に、音符の記号
  { t: 'se', sound: 'sparkle' },
  { t: 'notice', text: 'Bluenaに、新しい棚（音符）が増えた。作った曲は、できたらすぐ、ここにしまわれます' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: 'お待ちを。きのうのアートで。……天才の手本です。' },
  { t: 'say', who: 'バティ', text: '工房に行こう！' },

  // D06-S006 月の工房で、一曲（KIMORINのチャット → {neo}の番）
  { t: 'scene', id: 'D06-S006' },
  { t: 'cam', move: 'in', focus: '50% 40%' }, // 月の工房。となりの作業台で、KIMORINも、うんちピンポンくんとのチャットを開く
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'KIMORIN', text: 'このアートで、泣ける曲を、お願いします。' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪' },
  // 曲のカード（ジャケットは『プリプリ・ボカン』・−2マナ）。しっとりと悲しい、泣ける曲（音源：docs/story-rewrite/音/kimorin-mercury-1.wav）
  { t: 'se', sound: 'magic' },
  { t: 'say', who: 'KIMORIN', text: '……なんか、違います。' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、なら、そう、言え。' },
  { t: 'say', who: 'KIMORIN', text: 'とりあえず、もっと、壮大で、神々しく、感動的に、泣ける曲で、お願いします。……あと、『すね毛楽しい』という歌詞も足してください。' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'なるほど、わかった！　じゃあ、作り直すね！' },
  // 二枚目の曲のカード。壮大で、神々しい、感動の曲が、工房いっぱいに（音源：docs/story-rewrite/音/kimorin-mercury-2.wav）
  { t: 'se', sound: 'magic' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、いい曲だ。' },
  { t: 'say', who: 'KIMORIN', text: '……自分の曲で、泣くとは。' }, // サングラスの下から、涙が、ぽろぽろ
  { t: 'say', who: 'OBOLON', text: '、、、習うより、慣れろ、だ。次は、お前だ。' },
  {
    t: 'atelier',
    kind: 'song', // きのうのアートに曲をつける／新しく作る → 言葉 → スタイル → 歌詞の下書き → マナ → the card (D06-S006〜S007)
    lines: [
      { t: 'say', who: 'バティ', text: 'このアートが、曲の顔になるね！' },
      { t: 'say', who: 'バティ', text: 'じゃあ、今日あったことから作ろ！' },
      { t: 'say', who: 'バティ', text: '工房は、逃げないよ！' },
      { t: 'say', who: 'バティ', text: 'どんな気持ちだったか、足したかったら、声で言ってみて！　言葉が、そのまま歌詞になるよ！' },
      { t: 'say', who: 'バティ', text: '今日あったこと、話してみて！　言葉が、そのまま歌詞になるよ！' },
      { t: 'say', who: 'バティ', text: 'じゃあ、アートの言葉だけで、歌詞にするね！' },
      { t: 'say', who: 'バティ', text: 'じゃあ、この工房と、窓の地球から、歌詞を考えるね！' },
      { t: 'say', who: 'KIMORIN', text: '地球が、歌詞に。……スケールだけは、大きいですね。' },
      { t: 'say', who: 'バティ', text: 'どんな曲にしたい？　速さとか、雰囲気とか、できるだけ、くわしく教えて！' },
      { t: 'say', who: 'バティ', text: 'じゃあ、言葉に合うのを、ボクが選ぶね！' },
      { t: 'say', who: 'バティ', text: '歌詞は、こんな感じかな！' },
      { t: 'say', who: 'バティ', text: '直したい所があったら、言ってね！' },
      { t: 'say', who: 'バティ', text: '作曲に、マナを少し使うけど、いい？' },
      { t: 'say', who: 'バティ', text: '下書きは、ここに残しておくね！' },
      { t: 'say', who: 'バティ', text: '〈{neo}の言葉〉——ここに、ふしを。' },
      { t: 'say', who: 'バティ', text: '魔法陣、ちょっと凍っちゃった……。歌詞は残ってるよ。もう1回唱えてもいい？' },
      { t: 'say', who: 'バティ', text: 'Bluenaに、しまったよ！' },
      // D06-S007 〔もう一回（1回だけ）〕
      { t: 'say', who: 'バティ', text: 'どこを変える？　言ってみて！' },
    ],
  },

  // D06-S007 聴いて決める／水星へ飛ばす
  { t: 'scene', id: 'D06-S007' },
  { t: 'notice', text: '曲を、Bluenaの音符の棚にしまいました。{neo}だけの作品集です。誰にも送られていません。Bluenaから、いつでも聴けます' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、見せたい曲は、水星へ、飛ばせる。' },
  { t: 'notice', text: 'カードの〔飛ばす〕を押すと、曲が水星へ映り、音楽の船になります（帆に、曲のジャケット）。船は88時間、水星の海を遊泳します（みんなが聴けます）' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も。' }, // 自分の曲のカードの〔飛ばす〕。曲が、光になって、天井の窓から宇宙へ
  { t: 'se', sound: 'whoosh' },
  {
    t: 'choice',
    key: 'f_d06_sent_song',
    options: [
      { label: '水星へ飛ばす', goto: 'sail' },
      { label: '今は飛ばさない', goto: 'keep' },
    ],
  },
  { t: 'label', id: 'sail' },
  { t: 'set', key: 'f_d06_sent_song', value: 'sail' },
  { t: 'se', sound: 'whoosh' }, // 曲のカードが、光になって、天井の窓から宇宙へ飛んでいく
  { t: 'goto', id: 'sent' },
  { t: 'label', id: 'keep' },
  { t: 'set', key: 'f_d06_sent_song', value: 'keep' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '飛ばしたくなったら、このチャットで、いつでも飛ばせるよ！' },
  { t: 'label', id: 'sent' },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、水星へ、聴きに行け。' },
  { t: 'action', label: 'ロケットで水星へ' },

  // D06-S002 食べ物推理／氷の大陸に着陸
  { t: 'scene', id: 'D06-S002' },
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
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、食べ物なんです。' },
  { t: 'say', who: 'KIMORIN', text: 'たこ焼き、大根ときて。次は、パスタ伯爵が、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '水星には…冷蔵庫の、フリージーが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: 'やっぱり、冷蔵庫でしたか。' },
  { t: 'sprite', image: null },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：雲の下は、見わたすかぎりの青い海
  { t: 'still', image: 's/rocket-over-sea' },
  { t: 'cam', move: 'in' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'ロケットを着陸させようにも、全部、海やん。' },
  { t: 'say', who: 'KIMORIN', text: 'あそこは、凍っていますね。氷の大陸が、あります。' }, // 海の向こうに、白く光る大地
  { t: 'sprite', image: null },
  { t: 'cam', move: 'out' },
  { t: 'se', sound: 'whoosh' }, // ロケットが、氷の大陸に着陸する
  { t: 'still', image: 's/mercury-ice' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'mercury' },
  { t: 'caption', text: '水星に着いた' },

  // D06-S003 冷蔵庫のフリージー
  { t: 'scene', id: 'D06-S003' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'うー、寒い。やはり、冷えていますね。' },
  { t: 'say', who: 'KIMORIN', text: 'もしかして、、、近くに、冷蔵庫がいますか？' },
  { t: 'say', who: '？？？', text: 'その通りだ。', voice: 'フリージー' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] }, // 氷の上に、白い冷蔵庫が一台。ぶーん、と鳴っている
  { t: 'caption', text: 'フリージーが現れた' },
  { t: 'say', who: 'フリージー', text: '俺の氷の島に、何の用だ。' },
  { t: 'say', who: 'KIMORIN', text: '私たちは、ネオです。' },
  { t: 'say', who: 'フリージー', text: 'なんだ、ネオか。じゃあ、曲を聴きに来たってことだな。' },
  { t: 'say', who: 'フリージー', text: 'ようこそ。俺は、フリージーだ。海を、見せてやる。' },

  // D06-S005 音楽の船の海／音に乗っけると、100倍（見るだけ。飛ばした曲が、船になって88時間遊泳する）
  { t: 'scene', id: 'D06-S005' },
  { t: 'bgm', track: 'mercury-play' },
  { t: 'still', image: 's/mercury-port' }, // 氷の大陸のふちの、港の桟橋。沖じゅうを、帆にジャケットの小さな船が遊泳している
  { t: 'caption', text: '水星の、音楽の船の海' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
  { t: 'say', who: 'フリージー', text: '実はな、音に乗っけると、100倍のパワーを持つ。' },
  { t: 'say', who: 'KIMORIN', text: '百倍。根拠は？' },
  { t: 'say', who: 'フリージー', text: '聴けば、わかる。' },
  { t: 'say', who: 'KIMORIN', text: '……では、聴いてから、計算します。' },
  { t: 'branch', key: 'f_d06_sent_song', cases: { sail: 'sea-sail' }, otherwise: 'sea-keep' },
  { t: 'label', id: 'sea-sail' },
  { t: 'sprite', image: null }, // 一隻の船が、汽笛を鳴らして近づく。帆に{neo}の曲のジャケット。へさきに、船長の帽子の小さな{neo}
  { t: 'caption', text: '{neo}の最初の一隻が、海に出ていた' },
  { t: 'notice', text: '光っているのが、{neo}の船です。タップすると、聴けます（押した時だけ鳴ります）' },
  { t: 'action', label: '自分の船をタップする' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'ボクたちの歌が、海に出てる！' },
  { t: 'goto', id: 'sea-end' },
  { t: 'label', id: 'sea-keep' },
  { t: 'notice', text: '{neo}の船は、まだいない。{neo}の曲は、Bluenaの音符の棚で待っている' },
  { t: 'label', id: 'sea-end' },
  // 帆に『プリプリ・ボカン』のジャケットの船。へさきに、船長姿の小さなKIMORIN。KIMORINの曲（2）が鳴りだす
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……二回目でも、泣けますね。' },
  { t: 'notice', text: 'ここには、この88時間に水星へ飛ばされた曲が、船になって遊泳しています（ダチの分も、ほかの人の分も）。船をタップすると聴けます' },
  { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
  { t: 'say', who: 'フリージー', text: '{neo}の日常も、立派な歌になる。また聴かせてくれ。' },

  // D06-S007b {neo}の島（自分の場所。建てる所はない：M-R208）
  { t: 'scene', id: 'D06-S007b' },
  { t: 'bgm', track: 'mercury' },
  { t: 'say', who: 'フリージー', text: '次は、音楽が帰る場所だ。' },
  { t: 'se', sound: 'whoosh' }, // 汽笛。海の底から五線の輪。白い砂とヤシの木の、小さな島がせり上がる
  { t: 'say', who: 'KIMORIN', text: '……島とは、生えるものだったのですね。' },
  { t: 'say', who: 'フリージー', text: '{neo}の島だ。88時間、海を遊泳した船は、この島に帰ってくる。曲は、浜に、レコードとして並ぶ。' },
  { t: 'branch', key: 'f_d06_sent_song', cases: { sail: 'isle-sail' }, otherwise: 'isle-keep' },
  { t: 'label', id: 'isle-sail' },
  { t: 'se', sound: 'chime' }, // 島の小さな桟橋は、まだ空いている。沖のほうで、{neo}の船の汽笛が、遠く一度だけ鳴る
  { t: 'goto', id: 'isle-end' },
  { t: 'label', id: 'isle-keep' },
  { t: 'say', who: 'フリージー', text: '飛ばすのは、いつでもいい。' },
  { t: 'label', id: 'isle-end' },
  { t: 'notice', text: '島の見た目は、あとで、月の工房で{bati}と話して変えられます' },

  // D06-S008 水星のスタンプ → 月へ帰って眠る
  { t: 'scene', id: 'D06-S008' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '{bati}、よく頑張りましたね。' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'mercury' },
  { t: 'caption', text: '切符に、水星のスタンプが押された' },
  { t: 'sprite', image: 'kimorin-sun' }, // 切符の次の空いた欄を見て、丸いサングラスを、指でくいっとかけ直す
  { t: 'say', who: 'KIMORIN', text: '明日は、火星。' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'night' },
  { t: 'se', sound: 'rocket' }, // ロケットが、水星から月へ帰る
  { t: 'still', image: 's/moon-night', fade: 0.8 }, // 月の神殿のベッド。{bati}は、{neo}の枕もとで丸くなる
  { t: 'wait', s: 2 },
  { t: 'bgm', track: 'farewell' },
  { t: 'caption', text: 'また明日' }, // 〔完了画面：6日目まで24時間のカウントダウン〕 (TomorrowScreen)
  { t: 'end' },
];

/** the day on the planet's screen of before: played until the planet's switch is on */
export const DAY5_BEFORE: Step[] = journeyNotes(5, DAY5_OLD);

/**
 * story 2026-11-27 (M-R330): the day on the planet's NEW home — the script of now, word for word (story-sync checks
 * this one). Played only when the planet's switch is on (lib/planetHomes.ts, off by default).
 */
export const DAY5_NEW_HOME: Step[] = journeyNotes(5, withNewHomes(DAY5_OLD, D5_NEW));

/** the day as played: its steps of before, unchanged, until mercury's switch is on */
export const DAY5: Step[] = planetHomeIsNew('mercury', PLANET_HOMES_ENV) ? DAY5_NEW_HOME : DAY5_BEFORE;
