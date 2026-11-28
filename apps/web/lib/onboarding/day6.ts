import type { Step } from './script';
import { PLANET_HOMES_ENV, planetHomeIsNew } from '../planetHomes';
import { D6_NEW, D6_STUDIOS, D6_STUDIOS_FROM, journeyNotes, replaceStretch, withNewHomes } from './newHomeScenes';
import { kimorinBack } from './kimorinBack';

/**
 * DAY 6 【月 → 火星】 — the simple version (M-R208/M-R210/M-R211; wip/P04/c01.md D07-S001〜S007; S003 and S006 are cut;
 * the scene ids say D07 but it is day 6).
 *  - the Moon morning: OBOLON 「お前は、ついに、映像を、作れるようになる。」; Bluena gains the play-triangle shelf
 *  - the Moon atelier: KIMORIN⭐︎'s 「全部です」 and his slide MV in his chat, then {neo}'s MV in {bati}'s chat (the 'atelier'
 *    step: yesterday's song → the scene by voice → three scenes → the first one → camera wishes → the card, in Bluena at
 *    once) and 〔火星へ飛ばす〕 or 〔今は飛ばさない〕 (f_d07_sent_mv = send / keep); the rocket leaves the Moon — the day's
 *    88 minutes start here ('clock')
 *  - Mars only to look: ヒポキン and the city of screens with the UFOs (D07-S002), {neo}'s studio (D07-S005b), that night
 *    {bati} a little see-through (not for f_join_early), the Mars stamp, the fifth slot (Venus), the ticket's star map and
 *    the locked curtain of the Mars Theater (M-R203/M-R204), back to the Moon to sleep. Nothing is made on Mars (M-R208).
 */
/** the day as written before M-R341 / M-R336 (journeyNotes adds what they bring) */
const DAY6_OLD: Step[] = [
  // D07-S001 月の朝／映像が作れる
  { t: 'scene', id: 'D07-S001' },
  { t: 'bgm', track: 'moon' },
  { t: 'caption', text: '6日目' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  ...kimorinBack(6), // SYS-S002: once, if he walked out
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。' },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。お前は、ついに、映像を、作れるようになる。' },
  { t: 'say', who: 'OBOLON', text: 'その魔法を、今日は、教える。' },
  { t: 'say', who: 'OBOLON', text: 'きのうの曲に、映像をつける。MVだ。、、、カメラは、いらない。撮りたい場面を、話せばいい。' },
  { t: 'say', who: 'KIMORIN', text: '話すだけで、映画が撮れる。……監督の仕事が、なくなりますね。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // Bluenaの上の青い光の球に、小さな棚が、もう一つ。棚の右下に、再生の三角の記号
  { t: 'se', sound: 'sparkle' },
  { t: 'notice', text: 'Bluenaに、新しい棚（再生の三角）が増えた。作った映像は、できたらすぐ、ここにしまわれます' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '工房に行こう！' },

  // D07-S004 撮影のチュートリアル — となりのチャットで、KIMORINが先に話している
  { t: 'scene', id: 'D07-S004' },
  { t: 'cam', move: 'in', focus: '50% 40%' }, // 月の工房。となりの作業台で、KIMORINも、うんちピンポンくんとのチャットを開く
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '曲は、もちろん『プリプリ・ボカン』。最初の場面は……炎の中から現れる私。いえ、雷の中……いえ、夜明けの崖の上……全部です。' },
  { t: 'say', who: 'OBOLON', text: '、、、全部は、映らない。一つだけだ。' },
  // D07-S005 となりのチャットで、KIMORINのMVのカードができる。赤い丘に巨大な金色の滑り台。『プリプリ・ボカン』のバラード、ボカーン！
  { t: 'se', sound: 'crackers' },
  { t: 'say', who: 'OBOLON', text: '、、、いい画だ。' },
  {
    t: 'atelier',
    kind: 'video', // 曲のカード → 場面を話す（〔おまかせ〕）→ 三つの場面 → 最初の場面 → 注文 → マナ → the MV card (〔もう一回（1回だけ）〕)
    lines: [
      { t: 'say', who: 'バティ', text: '今日は、MVだね！　どの曲にする？' },
      { t: 'say', who: 'バティ', text: 'どんな場面を見たい？　話してみて。' },
      { t: 'say', who: 'バティ', text: 'じゃあ、曲の景色から考えるね！' },
      { t: 'say', who: 'バティ', text: 'じゃあ、三つの場面にするね！' },
      { t: 'say', who: 'バティ', text: '最初の場面は、{neo}が決めて！' },
      // 〔曲の景色から〕〔木星のアートから〕〔{neo}が歩いてくる〕〔真っ暗から〕 (f_d07_first_frame)
      { t: 'say', who: 'バティ', text: '定番だね！　見る人が、迷わない！' },
      { t: 'say', who: 'バティ', text: '自分の絵から入るの、いいね！' },
      { t: 'say', who: 'バティ', text: '主役が先だね！' },
      { t: 'say', who: 'バティ', text: '黒から入るの、渋い！' },
      { t: 'say', who: 'バティ', text: 'カメラの動きとか、色とか、注文があったら、言ってね！' },
      { t: 'say', who: 'OBOLON', text: '、、、カメラの動きも、魔法の言葉の、うちだ。' },
      { t: 'say', who: 'バティ', text: '撮影に、マナを使うけど、いい？' },
      { t: 'say', who: 'バティ', text: '場面は、ここに残しておくね！' },
      { t: 'say', who: 'バティ', text: '〈{neo}の場面〉——ここに、ひかりを。' },
      { t: 'say', who: 'バティ', text: '魔法陣、ちょっとぶれちゃった……。場面は残ってるよ。もう1回唱えてもいい？' },
      { t: 'say', who: 'バティ', text: 'Bluenaに、しまったよ！' },
      { t: 'say', who: 'バティ', text: 'できたー！　{neo}が主役だよ！' },
      { t: 'say', who: 'OBOLON', text: '、、、飛ばす前に、〔再生〕で、見ろ。最初に見るのは、作った者だ。' },
      { t: 'say', who: 'バティ', text: 'どこを変える？　言ってみて！' },
    ],
  },

  // D07-S005 再生して見て、火星へ飛ばす
  { t: 'scene', id: 'D07-S005' },
  { t: 'notice', text: 'MVを、Bluenaの再生の三角の棚にしまいました。{neo}だけが見られます' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、見せたい映像は、火星へ、飛ばせる。' },
  { t: 'notice', text: 'カードの〔飛ばす〕を押すと、映像が火星へ映り、UFOになります。UFOは88時間、火星の未来都市の画面から画面へ飛びます（みんなが見られます）' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も。' }, // 滑り台の一本のカードの〔飛ばす〕
  { t: 'se', sound: 'whoosh' },
  {
    t: 'choice',
    key: 'f_d07_sent_mv',
    options: [
      { label: '火星へ飛ばす', goto: 'send' },
      { label: '今は飛ばさない', goto: 'keep' },
    ],
  },
  { t: 'label', id: 'send' },
  { t: 'set', key: 'f_d07_sent_mv', value: 'send' },
  { t: 'se', sound: 'whoosh' }, // {neo}の一本から、UFOが一機、映像をぶら下げて、天井の窓から宇宙へ
  { t: 'goto', id: 'sent' },
  { t: 'label', id: 'keep' },
  { t: 'set', key: 'f_d07_sent_mv', value: 'keep' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '飛ばしたくなったら、このチャットで、いつでも飛ばせるよ！' },
  { t: 'label', id: 'sent' },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、火星へ、見に行け。' },
  { t: 'action', label: 'ロケットで火星へ' },

  // D07-S002 ヒポキン／UFOの町
  { t: 'scene', id: 'D07-S002' },
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
  { t: 'say', who: 'KIMORIN', text: 'Obolo Orderは全員、、、台所にあるもの、なんです。' },
  { t: 'say', who: 'KIMORIN', text: 'たこ焼き、大根、冷蔵庫ときて。次は、電子レンジが、いるのでしょう。' },
  { t: 'say', who: 'MONBAN', text: '火星には…カバの、ヒポキンが、いる…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、カバでしたか。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-mars' },
  { t: 'se', sound: 'whoosh' },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：赤い砂の平原に、塔が何十本も立つ未来都市。塔の壁も、橋の裏も、ぜんぶ画面
  { t: 'still', image: 's/arr-mars-city', fade: 1.2 },
  { t: 'cam', move: 'in', focus: '50% 60%' },
  { t: 'se', sound: 'arrive' },
  { t: 'bgm', track: 'mars' },
  { t: 'caption', text: '火星に着いた' },
  { t: 'cam', move: 'out' },
  { t: 'still', image: 's/mars-screens', fade: 1 }, // 〔背景 mars-city〕
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] }, // 黒い大画面の陰から、カバがのっそり。頭に小さな冠、首からメガホン
  { t: 'caption', text: 'ヒポキンが現れた' },
  { t: 'say', who: 'KIMORIN', text: 'お久しぶりです。' }, // 優雅に一礼
  { t: 'say', who: 'ヒポキン', text: '……誰だ、お前ら。' }, // メガホンを下ろして
  { t: 'say', who: 'KIMORIN', text: '……初対面、でしたか。失礼。私たちは、ネオです。' },
  { t: 'say', who: 'ヒポキン', text: 'ネオか。……映像を、見に来たのだな。' },
  { t: 'say', who: 'ヒポキン', text: '火星は、映像の星だ。……見てみろ。' },
  { t: 'se', sound: 'knock' }, // 指をパチン。塔の画面と画面のあいだを、小さなUFOが、何機も、すいすい飛びかう
  { t: 'bgm', track: 'mars-play' },
  // いちばん高い塔の大画面に、金色の滑り台。KIMORINのUFOが入ったのだ
  { t: 'say', who: 'KIMORIN', text: '……町じゅうの、注目の的ですね。' },
  { t: 'branch', key: 'f_d07_sent_mv', cases: { send: 'ufo-send' }, otherwise: 'ufo-keep' },
  { t: 'label', id: 'ufo-send' },
  { t: 'sprite', image: null }, // 一機のUFOが、すうっと降りてくる。窓に、操縦する小さな{neo}。ふちが、金色に光る
  { t: 'notice', text: '光っているのが、{neo}のUFOです。タップすると、そのUFOが近くの画面に入って、映像が流れます' },
  { t: 'action', label: '自分のUFOをタップする' }, // UFOが目の前の塔の画面に飛びこむ。{neo}の一本が、塔いっぱいに映る
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'ヒポキン', text: '……いい画だ。' },
  { t: 'goto', id: 'ufo-end' },
  { t: 'label', id: 'ufo-keep' },
  { t: 'notice', text: '{neo}のUFOは、まだいない。{neo}の映像は、Bluenaの中で待っている' },
  { t: 'label', id: 'ufo-end' },
  { t: 'notice', text: 'ここには、この88時間に火星へ飛ばされた映像が、UFOになって飛んでいます（ダチの分も、ほかの人の分も）。UFOをタップすると、近くの画面で見られます' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'ヒポキン', text: '88時間、飛んだら、UFOは、自分のスタジオへ帰る。' },

  // D07-S005b {neo}のスタジオ（自分の場所。建てる所はない：M-R208）
  { t: 'scene', id: 'D07-S005b' },
  { t: 'bgm', track: 'mars' },
  { t: 'still', image: 's/arr-mars-city' }, // 赤い丘。四角い撮影所が、いくつも。その一つの扉に『{neo}』の名札
  { t: 'say', who: 'ヒポキン', text: 'ここが、{neo}のスタジオだ。' },
  { t: 'say', who: 'ヒポキン', text: '88時間、飛んだUFOは、ここに帰ってくる。この1枠に、{neo}の一本が、かかる。' },
  { t: 'branch', key: 'f_d07_sent_mv', cases: { send: 'studio-end' }, otherwise: 'studio-keep' },
  { t: 'label', id: 'studio-keep' },
  { t: 'say', who: 'ヒポキン', text: '飛ばすのは、いつでもいい。' },
  { t: 'label', id: 'studio-end' },
  { t: 'notice', text: 'スタジオに帰った映像は、ダチがスタジオに来た時に見られます。スタジオの見た目は、あとで、月の工房で{bati}と話して変えられます' },
  { t: 'say', who: 'KIMORIN', text: 'ご覧なさい。土星、木星、水星、火星。四つの星に、作って、飛ばしきりました。……飛ばしきったケン!!' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。少々、熱くなりました。' },
  { t: 'se', sound: 'knock' }, // ヒポキンが、指を鳴らす。パチン
  { t: 'say', who: 'ヒポキン', text: '{neo}の毎日も、一本の映画になる。\nまた見せに来い。' },

  // D07-S007 火星のスタンプ／切符の裏 → 月へ帰って眠る
  { t: 'scene', id: 'D07-S007' },
  { t: 'bgm', track: 'night' },
  { t: 'caption', text: 'その夜' },
  { t: 'branch', key: 'f_join_early', cases: { true: 'night-early' }, otherwise: 'night-new' },
  { t: 'label', id: 'night-new' },
  // {neo}のとなりで、{bati}が、スタジオの1枠を見上げている。光の体が、少しだけ透けている。{bati}は、気づいていない
  { t: 'sprite', image: ['@bati-weak'] },
  { t: 'wait', s: 2.5 },
  { t: 'goto', id: 'night-stamp' },
  { t: 'label', id: 'night-early' },
  { t: 'sprite', image: ['@bati'] }, // 先にObolo Orderになった人は、透けない。{bati}の光は、いつもどおり明るい
  { t: 'wait', s: 2.5 },
  { t: 'label', id: 'night-stamp' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  // 火星の欄に、ぽん、とスタンプ。4つの欄が全部うまる → 切符の端に5つ目の欄『金星』 → ひとりでに裏返る：星図（金の線が金星まで。天王星・海王星・冥王星に錠と『Obolo Orderのみ』）
  { t: 'ticket', stamp: 'mars', flip: true },
  { t: 'caption', text: '4つの星を、まわった' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……金星には、錠が、ありませんね。' },
  { t: 'say', who: 'ヒポキン', text: '次は、金星だ。明日の朝、ロケットに乗れ。' },
  // 切符の星図の火星の印のそばに、小さな金色の幕の絵。錠がかかっている（先にObolo Orderになった人は、錠が外れている）（M-R203）
  { t: 'branch', key: 'f_join_early', cases: { true: 'theater-early' }, otherwise: 'theater-new' },
  { t: 'label', id: 'theater-new' },
  { t: 'notice', text: '火星シアター（Obolo Orderのみ）' },
  { t: 'say', who: 'KIMORIN', text: '……この幕の絵は？' },
  { t: 'say', who: 'ヒポキン', text: '火星シアターだ。町の奥にある。……結社の、昔の話がかかっている。' },
  { t: 'say', who: 'KIMORIN', text: '……その先の三つの星も、そのシアターも、Obolo Orderになってから。ほら、やっぱり、お金です。' },
  { t: 'goto', id: 'night-end' },
  { t: 'label', id: 'theater-early' },
  { t: 'notice', text: '火星シアター' },
  { t: 'say', who: 'KIMORIN', text: '……この幕の絵は？' },
  { t: 'say', who: 'ヒポキン', text: '火星シアターだ。町の奥にある。……結社の、昔の話がかかっている。' },
  { t: 'say', who: 'KIMORIN', text: '……{neo}の幕は、もう錠が外れていますね。私のは、錠つきです。……ほら、やっぱり、お金です。' },
  { t: 'label', id: 'night-end' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'rocket' }, // ロケットが、火星から月へ帰る
  { t: 'still', image: 's/moon-night', fade: 0.8 }, // 月の神殿のベッド。{bati}は、{neo}の枕もとで丸くなる
  { t: 'wait', s: 2 },
  { t: 'bgm', track: 'farewell' },
  { t: 'caption', text: 'また明日' }, // 〔完了画面：7日目まで24時間のカウントダウン〕 (TomorrowScreen)
  { t: 'end' },
];

/** the day on the planet's screen of before: played until the planet's switch is on */
export const DAY6_BEFORE: Step[] = journeyNotes(6, DAY6_OLD);

/**
 * story 2026-11-27 (M-R330): the day on the planet's NEW home — the script of now, word for word (story-sync checks
 * this one). Played only when the planet's switch is on (lib/planetHomes.ts, off by default).
 */
export const DAY6_NEW_HOME: Step[] = journeyNotes(6, withNewHomes(replaceStretch(DAY6_OLD, 'D07-S002', D6_STUDIOS, { from: D6_STUDIOS_FROM }), D6_NEW));

/** the day as played: its steps of before, unchanged, until mars's switch is on */
export const DAY6: Step[] = planetHomeIsNew('mars', PLANET_HOMES_ENV) ? DAY6_NEW_HOME : DAY6_BEFORE;
