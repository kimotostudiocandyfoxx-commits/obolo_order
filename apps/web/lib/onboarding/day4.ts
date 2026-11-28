import { kimorinBack } from './kimorinBack';
import type { Step } from './script';
import { PLANET_HOMES_ENV, planetHomeIsNew } from '../planetHomes';
import { D4_NEW, journeyNotes, withNewHomes } from './newHomeScenes';

/**
 * DAY 4 【月 → 木星】 — the simple version (M-R208/M-R210/M-R211; wip/P03/c01.md D05-S001〜S007, c02.md D05-S002〜S009;
 * the scene ids say D05 but it is day 4).
 *  - the Moon morning: OBOLON 「お前は、ついに、アートを、作れるようになる。」; Bluena gains the square-frame shelf
 *  - the Moon atelier: KIMORIN⭐︎'s 『プリプリ・ボカン』 in his chat (D05-S006, f_d05_kimorin_sticker = like / next), then
 *    {neo}'s art in {bati}'s chat (the 'atelier' step: one card, in Bluena at once) and 〔木星へ飛ばす〕 or 〔今は飛ばさない〕
 *    (f_d05_sent_jacket = send / keep); the rocket leaves the Moon — the day's 88 minutes start here ('clock')
 *  - Jupiter only to look: KIMORIN⭐︎'s たこ焼き guess, 大根カイザー, the butterfly forest (D05-S005), {neo}'s atelier
 *    (D05-S008b), the Jupiter stamp, back to the Moon to sleep. Nothing is made on Jupiter (M-R208).
 */
/** the day as written before M-R341 / M-R336 (journeyNotes adds what they bring) */
const DAY4_OLD: Step[] = [
  // D05-S001 月の朝／アートが作れる
  { t: 'scene', id: 'D05-S001' },
  { t: 'bgm', track: 'moon' },
  { t: 'caption', text: '4日目' },
  { t: 'still', image: 's/moon-temple' }, // 月の神殿。窓の外に、青い地球。光の柱の中に、黒い球のOBOLON
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  ...kimorinBack(4), // SYS-S002: once, if he walked out
  { t: 'say', who: 'KIMORIN', text: 'おはようございます、{neo}。' },
  { t: 'say', who: 'KIMORIN', text: '切符によると、次は、木星です。' },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。お前は、ついに、アートを、作れるようになる。' },
  { t: 'say', who: 'OBOLON', text: 'その魔法を、今日は、教える。' },
  { t: 'say', who: 'OBOLON', text: 'アートは、、、正方形の、一枚の絵だ。写真でも、描いた絵でも、字だけでも、いい。' },
  { t: 'say', who: 'OBOLON', text: '{bati}に、話せ。どんな絵にしたいか。{bati}が、それを、魔法で、描く。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // Bluenaの上の青い光の球に、小さな棚が、もう一つ。棚の右下に、正方形の額の記号
  { t: 'se', sound: 'sparkle' },
  { t: 'notice', text: 'Bluenaに、新しい棚（正方形の額）が増えた。作ったアートは、できたらすぐ、ここにしまわれます' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: 'では、私から。天才の手本を、お見せしましょう。' },
  { t: 'say', who: 'バティ', text: '工房に行こう！' },

  // D05-S006 月の工房／天才の手本（KIMORINのチャット）
  { t: 'scene', id: 'D05-S006' },
  { t: 'cam', move: 'in', focus: '50% 40%' }, // 光の柱が、祭壇の奥へ。月の工房
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'KIMORIN', text: 'きのうの、二つ目のつぶやきで。『ぷりぷりぷりり、うひょひょひょ、げへへ！　ピンポン大正解！』。……重い額縁が似合う、本物の名画で、お願いします。' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪' },
  { t: 'se', sound: 'magic' }, // KIMORINのチャットに、アートのカード。金色の滑り台を、うんちピンポンくんが威厳たっぷりに滑り降りる名画
  { t: 'say', who: 'KIMORIN', text: '題名は、『プリプリ・ボカン』で。' },
  { t: 'say', who: 'KIMORIN', text: '……天才の絵です。' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、いいアートだ。' },
  { t: 'say', who: 'KIMORIN', text: '反応の数は、どこで拝見できます？' },
  { t: 'say', who: 'OBOLON', text: '、、、点も、数も、ない。' },
  // M-R274: the first word of the eclipse and its price (月88円), right after KIMORIN's first card that used mana
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] }, // KIMORINが、カードのすみの「−3マナ」に、サングラスを近づける
  { t: 'say', who: 'KIMORIN', text: '……もし、マナを、使い切ったら、どうなるのですか？' },
  { t: 'say', who: 'OBOLON', text: '、、、エクリプスを受けた者は、体から、毎月、88マナが湧く。' },
  { t: 'say', who: 'KIMORIN', text: 'お、お金が、かかるのですか？' },
  { t: 'say', who: 'OBOLON', text: '、、、月に、88円だ。' },
  { t: 'say', who: 'KIMORIN', text: 'は、はい出ました、超高額入会費……！' },
  { t: 'say', who: 'OBOLON', text: '、、、88円だ。' },
  { t: 'say', who: 'OBOLON', text: 'マナを使わない遊びは、、、受けなくても、ずっと、自由だ。' },
  { t: 'notice', text: '{bati}と話す・土星で聞く／触る・ダチとのチャットと声は、エクリプスを受けなくても、ずっと使えます' },
  { t: 'say', who: 'OBOLON', text: '決めるのは、、、全部の星を、見てからで、いい。' },
  {
    t: 'choice',
    key: 'f_d05_kimorin_sticker',
    options: [
      { label: '「そのアート、好きだよ」と言う', goto: 'like' },
      { label: '次は自分の番だと手を挙げる', goto: 'next' },
    ],
  },
  { t: 'label', id: 'like' },
  { t: 'set', key: 'f_d05_kimorin_sticker', value: 'like' },
  { t: 'sprite', image: 'kimorin-sun' }, // サングラスが、鼻先までずり落ちる。目の切れ目が、青く光る
  { t: 'say', who: 'KIMORIN', text: '好き？　オレのが？　……ほんとケン？' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。点より、効きますね。' }, // こほん。サングラスを、指でかけ直す
  { t: 'goto', id: 'mine' },
  { t: 'label', id: 'next' },
  { t: 'set', key: 'f_d05_kimorin_sticker', value: 'next' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'おや、やる気ですね。どうぞ。' },
  { t: 'label', id: 'mine' },

  // D05-S007 {neo}のアート／木星へ飛ばす（{bati}とのチャット）
  { t: 'scene', id: 'D05-S007' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。土星の言葉のなかで、形にしたくなったものは、あるか。' },
  { t: 'say', who: 'OBOLON', text: '焦って、撮らなくても、いい。思い出は、あとから、作れる。' },
  {
    t: 'atelier',
    kind: 'art', // 〔きのうのつぶやきのカード〕／新しく話す → 写真を添える／{bati}が描く／字だけ → one card (〔もう一回（1回だけ）〕)
    lines: [
      { t: 'say', who: 'バティ', text: 'じゃあ、話してみて！' },
      // R12 (client 2026-11-25): {bati}'s compass is shown as the art's talk opens (it floats up over the bowl a moment)
      { t: 'say', who: 'バティ', text: 'そうだ、好きな絵の写真があったら、見せてね。ボクのコンパスで、どんなスペルか読めるんだ！' },
      { t: 'say', who: 'バティ', text: 'どんなアートにする？　写真を使う？　ボクが描く？　字だけでもいいよ！' },
      { t: 'say', who: 'バティ', text: 'どんな絵にする？　色とか、タッチとか、できるだけ、くわしく教えて！' },
      { t: 'say', who: 'バティ', text: 'じゃあ、言葉に合うのを、ボクが選ぶね！' },
      { t: 'say', who: 'バティ', text: 'マナを少し使うけど、いい？' },
      { t: 'say', who: 'バティ', text: '〈{neo}の言葉〉——ここに、かたちを。' },
      { t: 'say', who: 'バティ', text: 'マナジェムが、光らなくなっちゃった……。いまは、魔法は唱えられないや。写真か、字だけなら、できるよ！' },
      { t: 'say', who: 'バティ', text: '魔法陣、ちょっと焦げちゃった……。言葉は残ってるよ。もう1回やる？　字だけにする？' },
      { t: 'say', who: 'OBOLON', text: '、、、字だけのアートも、ある。' },
      { t: 'say', who: 'バティ', text: 'Bluenaに、しまったよ！' },
      // R12: the art's spell goes into {bati}'s spell book (it opens over the bowl, takes the talismans in, closes)
      { t: 'say', who: 'バティ', text: 'いまのスペルは、スペルブックにしまっておくね。また使いたくなったら、「スペルブック出して」って言ってね！' },
      { t: 'say', who: 'バティ', text: 'わかった！　直してみるね！' },
    ],
  },
  { t: 'notice', text: 'アートを、Bluenaの額の棚にしまいました。{neo}だけの作品集です。誰にも送られていません' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、見せたいアートは、木星へ、飛ばせる。' },
  { t: 'notice', text: 'カードの〔飛ばす〕を押すと、アートが木星へ映り、アートを抱えた蝶が生まれます。蝶は88時間、木星の森を羽ばたきます（みんなが見られます）' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も。' }, // 『プリプリ・ボカン』の〔飛ばす〕。KIMORINを小さくした蝶が、アートを抱えて、天井の窓から宇宙へ
  { t: 'se', sound: 'whoosh' },
  {
    t: 'choice',
    key: 'f_d05_sent_jacket',
    options: [
      { label: '木星へ飛ばす', goto: 'send' },
      { label: '今は飛ばさない', goto: 'keep' },
    ],
  },
  { t: 'label', id: 'send' },
  { t: 'set', key: 'f_d05_sent_jacket', value: 'send' },
  { t: 'se', sound: 'whoosh' }, // カードのアートから、{neo}を小さくデフォルメした蝶が生まれ、アートを抱えて天井の窓から宇宙へ
  { t: 'goto', id: 'sent' },
  { t: 'label', id: 'keep' },
  { t: 'set', key: 'f_d05_sent_jacket', value: 'keep' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '飛ばしたくなったら、このチャットで、いつでも飛ばせるよ！' },
  { t: 'label', id: 'sent' },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、木星へ、見に行け。' },
  { t: 'action', label: 'ロケットで木星へ' },

  // D05-S002 たこ焼き推理／大森林の大根
  { t: 'scene', id: 'D05-S002' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'rocket' }, // ロケットが、月から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true }, // the day's 88 minutes start as the rocket leaves the Moon, after making (SYS-S001)
  { t: 'bgm', track: 'space' },
  { t: 'sprite', image: ['@bati', 'unchi-pinpon'] }, // Bluenaの光に包まれて、となりの席に浮かんでいる
  { t: 'wait', s: 1.2 },
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
  { t: 'bgm', track: 'jupiter-mm' }, // the forest theme (bgm-jupiter-mm; there is no bgm-jupiter)
  { t: 'se', sound: 'arrive' },
  // 到着カット（止め絵＋ゆっくりしたカメラ）：緑の縞もようの雲が切れると、見わたすかぎりの大森林
  { t: 'arrive', image: 's/arr-jupiter-canopy', caption: '木星に着いた' },
  { t: 'cam', move: 'in' },
  { t: 'still', image: 's/jupiter-forest' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'すごい、、、神秘的な森ですね。' },
  { t: 'say', who: '？？？', text: 'おい。', voice: '大根カイザー' },
  { t: 'say', who: 'KIMORIN', text: 'ん？　どこですか？' },
  { t: 'say', who: '？？？', text: 'ここダ。', voice: '大根カイザー' },
  { t: 'still', image: 's/jupiter-daikon' }, // 並んだ木のうちの一本だけ、幹が白くて太い。てっぺんに、青い葉の冠。大根だった
  { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
  { t: 'caption', text: '大根カイザーが現れた' },
  { t: 'say', who: '大根カイザー', text: '木星で、何をしているダ？　お前ら、誰ダ？' },
  { t: 'say', who: 'KIMORIN', text: '私たちは、ネオです。' },
  { t: 'say', who: '大根カイザー', text: 'なんダ、ネオか。アートを、見に来たのダな。' },
  { t: 'say', who: '大根カイザー', text: '我が、木星の森を、見せてやるダ。' },

  // D05-S005 蝶の森／「いい言葉ですね」（見るだけ。飛ばしたアートが、蝶になって88時間羽ばたく）
  { t: 'scene', id: 'D05-S005' },
  { t: 'bgm', track: 'jupiter-play' },
  { t: 'still', image: 's/jupiter-forest' }, // 木漏れ日の中を、数えきれない蝶。どの蝶も、誰かの顔に光る羽。正方形のアートを抱えている
  { t: 'caption', text: '木星の、蝶の森' },
  { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: '木星は、命が宿る星ダ。' },
  { t: 'say', who: '大根カイザー', text: '君が見た風景だったり、今日食べたご飯だったり。そんな何気ない日常でも、命を宿し、そして思い出になっていくのダ。' },
  { t: 'say', who: '大根カイザー', text: '百聞は、一見にしかず、ダ。見てみるダ。' },
  { t: 'say', who: 'KIMORIN', text: '……百聞は、一見にしかず。いい言葉ですね。今日から、私の言葉にしましょう。' },
  // KIMORINの蝶が、丸いサングラスごと、パタパタと目の前を横切る。抱えているのは『プリプリ・ボカン』
  { t: 'say', who: 'KIMORIN', text: '……森でいちばん、目立っていますね。当然です。' },
  { t: 'branch', key: 'f_d05_sent_jacket', cases: { send: 'fly-send' }, otherwise: 'fly-keep' },
  { t: 'label', id: 'fly-send' },
  { t: 'sprite', image: null }, // 木漏れ日の中に、{neo}の蝶。羽のふちが、金色に光っている
  { t: 'notice', text: '光っているのが、{neo}の蝶です。タップすると、アートが大きく見られます' },
  { t: 'action', label: '自分の蝶をタップする' }, // 蝶が、{neo}の肩に止まって、アートを広げて見せる。また、森へ羽ばたいていく
  { t: 'goto', id: 'fly-end' },
  { t: 'label', id: 'fly-keep' },
  { t: 'notice', text: '{neo}の蝶は、まだいない。{neo}のアートは、Bluenaの額の棚で待っている' },
  { t: 'label', id: 'fly-end' },
  { t: 'notice', text: 'ここには、この88時間に木星へ飛ばされたアートが、蝶になって羽ばたいています（ダチの分も、ほかの人の分も）。蝶をタップすると、アートが見られます' },
  { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
  { t: 'say', who: '大根カイザー', text: '88時間、羽ばたいたら、蝶は、自分のアトリエへ帰るダ。' },

  // D05-S008b {neo}のアトリエ（自分の場所。建てる所はない：M-R208）
  { t: 'scene', id: 'D05-S008b' },
  { t: 'bgm', track: 'jupiter-mm' }, // the forest theme (bgm-jupiter-mm; there is no bgm-jupiter)
  { t: 'still', image: 's/jupiter-daikon' }, // 森の切れ目の丘。木とガラスの、丸いドームのアトリエ。扉の名札は『{neo}』
  { t: 'say', who: '大根カイザー', text: 'ここが、{neo}のアトリエダ。' },
  { t: 'say', who: '大根カイザー', text: '88時間、羽ばたいた蝶は、ここに帰ってくるダ。アートは、この壁に、飾られるダ。' },
  { t: 'branch', key: 'f_d05_sent_jacket', cases: { send: 'home-send' }, otherwise: 'home-keep' },
  { t: 'label', id: 'home-send' },
  { t: 'notice', text: '{neo}の蝶が、帰ってくるまで、あと少し' },
  { t: 'goto', id: 'home-end' },
  { t: 'label', id: 'home-keep' },
  { t: 'say', who: '大根カイザー', text: '飛ばすのは、いつでもいいダ。アートは、Bluenaの中で、待っているダ。' },
  { t: 'label', id: 'home-end' },
  { t: 'say', who: 'KIMORIN', text: '……私の額は、もっと大きいのが、よろしいかと。' },
  { t: 'say', who: '大根カイザー', text: '同じ大きさダ。' },
  { t: 'notice', text: 'アトリエの見た目は、あとで、月の工房で{bati}と話して変えられます' },

  // D05-S009 木星のスタンプ → 月へ帰って眠る
  { t: 'scene', id: 'D05-S009' },
  { t: 'say', who: '大根カイザー', text: '明日は、水星へ行くダ。' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'stamp' },
  { t: 'ticket', stamp: 'jupiter' },
  { t: 'caption', text: '切符に、木星のスタンプが押された' },
  { t: 'bgm', track: 'night' },
  { t: 'se', sound: 'rocket' }, // ロケットが、木星から月へ帰る
  { t: 'still', image: 's/moon-night', fade: 0.8 }, // 月の神殿のベッド。{bati}は、{neo}の枕もとで丸くなる
  { t: 'wait', s: 2 },
  { t: 'bgm', track: 'farewell' },
  { t: 'caption', text: 'また明日' }, // 〔完了画面：5日目まで24時間のカウントダウン〕 (TomorrowScreen)
  { t: 'end' },
];

/** the day on the planet's screen of before: played until the planet's switch is on */
export const DAY4_BEFORE: Step[] = journeyNotes(4, DAY4_OLD);

/**
 * story 2026-11-27 (M-R330): the day on the planet's NEW home — the script of now, word for word (story-sync checks
 * this one). Played only when the planet's switch is on (lib/planetHomes.ts, off by default).
 */
export const DAY4_NEW_HOME: Step[] = journeyNotes(4, withNewHomes(DAY4_OLD, D4_NEW));

/** the day as played: its steps of before, unchanged, until jupiter's switch is on */
export const DAY4: Step[] = planetHomeIsNew('jupiter', PLANET_HOMES_ENV) ? DAY4_NEW_HOME : DAY4_BEFORE;
