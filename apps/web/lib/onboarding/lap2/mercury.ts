import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 3 【水星】 — review/L2_水星.md (L2-MERCURY-S001, S002, S004, S007).
 * KIMORIN introduces his mother MIKIE⭐︎ (right arm a silver hook, left arm a golden gatling — M-R135; her cat
 * Mii-chan): he invited her, because she invited him into the world (「88円は、読み方を変えたら、ハハ」).
 * Songs are placed on the visitor's island (own / new / KIMORIN's 『2』), a theme island may rise, and
 * KIMORIN's ブラタゴン島 lies offshore. Branch: `l1_song` (first journey Mercury: sail / keep).
 */
export const L2_MERCURY: Step[] = [
  ...flight('水星に着いた'),
  { t: 'bgm', track: 'mercury' },
  { t: 'still', image: 's/mercury-port' }, // 氷の島の港。桟橋に黒い帆の船。舵のとなりに、船長帽の白い冷蔵庫
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: 'おかえり。' },
  { t: 'say', who: 'フリージー', text: '今日は、お前の島に、曲を置く。' },
  { t: 'say', who: 'フリージー', text: 'それと、集めたい音の島を、作る。' },
  // KIMORINの隣に、小柄な人が一人。濃いピンクのブラウス、丸いサングラス。左手は金色のガトリング、右手は銀色のフック。足もとに猫
  { t: 'sprite', image: 'mikie' },
  { t: 'caption', text: 'MIKIE⭐︎が、ぺこり、と頭を下げた' },
  { t: 'sprite', image: ['kimorin-sun', 'mikie'] },
  { t: 'say', who: 'KIMORIN', text: '紹介します。私の母、MIKIE⭐︎です。' },
  { t: 'say', who: 'KIMORIN', text: '……招待しました。' },
  { t: 'sprite', image: ['@bati', 'kimorin-sun'] }, // {bati}が、無言で、KIMORINを見つめている
  { t: 'wait', s: 1.2 },
  { t: 'say', who: 'KIMORIN', text: 'MIKIE⭐︎は、私を、この世に招待してくれました。' },
  { t: 'say', who: 'KIMORIN', text: 'だから、お返しに、私が、宇宙に招待してあげたのです。' },
  { t: 'say', who: 'KIMORIN', text: '招待費の88円は、読み方を変えたら、ハハ。' },
  { t: 'say', who: 'KIMORIN', text: 'つまり、親孝行の数字なのです。' },

  // L2-MERCURY-S002 島に曲を置く
  { t: 'sprite', image: null },
  { t: 'l2', what: 'my-island' }, // 港のすぐ前に、{neo}の島。浜に、一周目にしまった曲のレコードが一枚
  { t: 'branch', key: 'l1_song', cases: { sail: 'mship' }, otherwise: 'mgrow' },
  { t: 'label', id: 'mship' },
  { t: 'sprite', image: 'freezy' }, // 島の小さな桟橋に、{neo}の船が一隻、帰ってきている。帆に、あの日のジャケット
  { t: 'say', who: 'フリージー', text: 'お前の最初の一隻だ。ダチの海を回って、帰ってきた。' },
  { t: 'label', id: 'mgrow' },
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: '島は、作って終わりじゃない。曲を置いて、育てる。' },
  { t: 'notice', text: '〔曲を置く〕で、自分の曲か、ダチの曲を一つ、島に置けます。置いた曲は、浜にレコードとして並びます（あとから足しても、外してもいい）' },
  { t: 'notice', text: 'ダチの曲は元の作品につながっていて、作った人が消すと聴けなくなります' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'kimorin-song2' }, // 〔推し〕の海に、帆に『KIMORIN⭐︎』の船。真っ白なジャケットのレコード、ラベルに『2』
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '私の、新しい曲です。二番だけ、できています。' },
  { t: 'say', who: 'KIMORIN', text: '表の一番は、……また今度です。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'place-song' },
  { t: 'branch', key: 'place', cases: { new: 'mnew', kimorin: 'mkimorin', none: 'mnone' }, otherwise: 'mjoin' },
  { t: 'label', id: 'mnew' },
  { t: 'goto', id: 'mjoin' },
  { t: 'label', id: 'mkimorin' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……二番だけでも、置いていただけるのですね。' },
  { t: 'goto', id: 'mjoin' },
  { t: 'label', id: 'mnone' },
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: '置くのは、いつでもいい。' },
  { t: 'label', id: 'mjoin' },

  // L2-MERCURY-S004 集めたい音の島
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: '集めたい音があるなら、その音の島を作ってもいい。' },
  { t: 'say', who: 'フリージー', text: 'どんな曲が流れる島にしたい？　まだ名前のない音でもいい。名前は、お前が付ければいい。' },
  { t: 'notice', text: '〔🏝️ 島を飾る〕で、今の島を変えるか、テーマの島を新しく作れます（形・浜・灯りを選び、テーマを島の名前にできます。なくてもいい）' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'misland', options: [{ label: 'テーマの島を作る', goto: 'mtheme' }, { label: '今の島を飾る', goto: 'mdeco' }, { label: '今は、このままでいい', goto: 'mstay' }] },
  { t: 'label', id: 'mtheme' },
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: '……声で、言ってみろ。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'theme-island' }, // 汽笛。海の底から五線の輪が光って浮かぶ。{neo}の島の隣に、小さな島がせり上がる
  { t: 'goto', id: 'mjoin2' },
  { t: 'label', id: 'mdeco' },
  { t: 'l2', what: 'island-deco' },
  { t: 'goto', id: 'mjoin2' },
  { t: 'label', id: 'mstay' },
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: '島は、一つで足りる日もある。' },
  { t: 'label', id: 'mjoin2' },
  { t: 'l2', what: 'kimorin-island' }, // 沖に、黒い岩に金色の虎のしま、翼と虎の耳、背中に火山。目は右はしと左はしに離れている
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '私の島です。ブラックタイガードラゴン島。……略して、ブラタゴン島。' },
  { t: 'say', who: 'KIMORIN', text: '置いてあるのは、ブラタゴンの曲だけです。テーマの島、というものですね。' },
  { t: 'notice', text: 'ダチの船をタップして〔🏝️ この人の島へ〕を押すと、その島の浜のレコードを聴けます（見るだけ。土の中は見えません）' },
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: '曲を選んで、島に並べる。それが、アルバムの入口だ。' },
  { t: 'say', who: 'フリージー', text: 'いつか、お題ではなく、お前自身のアルバムを聴かせてくれ。' },

  // L2-MERCURY-S007 火星が開いた
  { t: 'say', who: 'フリージー', text: '次は、火星だ。' },
  { t: 'caption', text: '火星が開いた' },
  { t: 'notice', text: '水星で曲を作る・出航させる、島に曲を置く・島を飾るのは、このあとも自由にできます' },
  { t: 'sprite', image: null },
  ...chapterEnd(3),
];
