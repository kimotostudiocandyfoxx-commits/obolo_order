import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 4 【火星】 — review/L2_火星.md (L2-MARS-S001, S003, S005).
 * Outside screens show even what was said; here, only what was pressed. KIMORIN's tilted ten seconds (shot
 * without magic), then the second journey's showpiece: MIKIE⭐︎ presses play with her hook and the MV
 * 『MIKIE⭐︎ドリル（feat. KIMORIN⭐︎）』 plays whole (M-R134: ~108 s, never cut; 〔スキップ〕 allowed). Her right arm
 * is the hook, her left the gatling (M-R135). Then the theatre next to the studio: a theme, a first film
 * (mine / a dachi's / a new shoot), the order, and whether the dachi may see it.
 */
export const MIKIE_DRILL = {
  src: '/onboarding/mikie-drill.m4a',
  title: 'MIKIE⭐︎ドリル（feat. KIMORIN⭐︎）',
  // the lines as the MV goes (review/L2_火星.md); the scenes of the film are drawn as stills until the MV is made
  lines: [
    { who: 'MIKIE⭐︎', text: 'Ayy! Ayy! Ayy!　MIKIE⭐︎ドリル are you ready?' },
    { who: '二人', text: 'hook! hook! hook!' },
    { who: 'KIMORIN', text: '右腕はフック　船長スタイル／洗濯物ひっかけて　干してスマイル' },
    { who: 'MIKIE⭐︎', text: '左腕はガトリング　調味料ラッシュ／塩！コショウ！醤油！MAYO' },
    { who: '二人', text: 'shot! shot! shot!' },
    { who: 'KIMORIN', text: '右足はドリル　庭をゴリゴリ／穴を開けて　トマトを埋める' },
    { who: 'MIKIE⭐︎', text: 'Oh my god' },
    { who: '二人', text: 'みきえ　みきえ　run run run／YOGAピラティス散髪　go go GO' },
    { who: 'MIKIE⭐︎', text: '間に合った　これがMIKIE⭐︎Style' },
  ],
};

export const L2_MARS: Step[] = [
  ...flight('火星に着いた'),
  { t: 'bgm', track: 'mars' },
  { t: 'still', image: 's/arr-mars-city' }, // 光の塔が並ぶ、画面でできた街。空に、円盤がいくつも
  { t: 'sprite', image: 'hipokin' }, // クレーンに吊られた椅子が降りてくる。頭に小さな冠、首にメガホンのカバ
  { t: 'say', who: 'ヒポキン', text: 'おかえり。' },
  { t: 'say', who: 'ヒポキン', text: '今日は、見せる場所を、建てる。' },
  // 映像（約8秒）：友だちに「新しい靴、ほしいな」→手もとの画面に、すぐ同じ靴の広告→首をかしげる — a still for now
  { t: 'still', image: 's/mars-screens' },
  { t: 'say', who: 'ヒポキン', text: '外の画面は、話したことまで、映してくる。' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……では、私の独り言も、外に漏れていたのでしょうか。天才の発想が。' },
  { t: 'say', who: 'ヒポキン', text: '……ここは、押したものだけだ。' },
  { t: 'say', who: 'KIMORIN', text: '{neo}。まずは、私の作品を、ご覧ください。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'kimorin-ten' }, // 扇の尾をばさっと広げて、決めポーズ。十秒。画面が少し傾いている。途中でピンポンくんが横切る
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……天才の、十秒です。今回は、魔法を使わずに、自分で撮りました。' },
  { t: 'sprite', image: ['unchi-pinpon', 'kimorin-sun'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪' },
  { t: 'sprite', image: ['kimorin-sun', 'mikie'] }, // KIMORINの隣に、MIKIE⭐︎。足もとに、猫のみーちゃん。ぺこり
  { t: 'say', who: 'KIMORIN', text: '……実は、もう一本、あります。' },
  { t: 'say', who: 'KIMORIN', text: 'ゆうべ、MIKIE⭐︎の台所で、二人で作りました。MIKIE⭐︎が話して、私が話して。それだけで、一曲です。' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null },
  // MIKIE⭐︎が、フックの先で、手もとの小さな機械を、そっと押す。同じ塔の画面に、MV
  { t: 'song', id: 'mikie-drill' },
  { t: 'bgm', track: 'mars' },
  { t: 'sprite', image: ['kimorin-sun', 'mikie'] }, // MIKIE⭐︎本人は、ぺこりと頭を下げたまま。KIMORINのサングラスが鼻先までずり落ちる
  { t: 'say', who: 'KIMORIN', text: '……何回見ても、すごいケン……！' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。話しただけで、ここまで、できるのです。' }, // 咳ばらい。サングラスをかけ直す
  { t: 'say', who: 'KIMORIN', text: '{neo}にも、できますよ。私の次くらいには。' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'ヒポキン', text: '……いい画だ。' },
  { t: 'sprite', image: ['kimorin-sun', 'mikie'] },
  { t: 'say', who: 'KIMORIN', text: 'ちなみに、あの猫は、MIKIE⭐︎のバティ、みーちゃんです。' },
  { t: 'caption', text: 'みーちゃんが、小さく、にゃあ' },
  { t: 'say', who: 'KIMORIN', text: '{neo}。ぜひ、MIKIE⭐︎と、ダチになってあげてください。' },
  { t: 'choice', key: 'mikie', options: [{ label: 'MIKIE⭐︎とダチになる', goto: 'mfriend' }, { label: 'あとで', goto: 'mlater' }] },
  { t: 'label', id: 'mfriend' },
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: 'MIKIE⭐︎とダチになった' },
  { t: 'goto', id: 'mjoin' },
  { t: 'label', id: 'mlater' },
  { t: 'say', who: 'KIMORIN', text: '……いつでも、どうぞ。' },
  { t: 'label', id: 'mjoin' },

  // L2-MARS-S003 上映館を作る
  { t: 'sprite', image: null },
  { t: 'still', image: 's/mars-studio-canyon' }, // {neo}の撮影所。となりの区画に、白い線の四角がもう一つ
  { t: 'sprite', image: 'hipokin' },
  { t: 'say', who: 'ヒポキン', text: 'スタジオは、作ったものを残す場所だ。' },
  { t: 'say', who: 'ヒポキン', text: 'となりに建てるのは、見せる場所だ。上映館だ。' },
  { t: 'say', who: 'ヒポキン', text: '自分の映像でも、ダチが届けてくれた映像でもいい。選んで、並べて、見せる。それも、DJの腕だ。' },
  // スタジオ通りの角で、KIMORINが、手書きのチラシ『本日上映』を配っている。誰も受け取らない
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……お客様、第一号です。' },
  { t: 'caption', text: 'チラシの看板に『天才の十秒　三本立て』' },
  { t: 'say', who: 'KIMORIN', text: '私の上映館は、すでにできております。' },
  { t: 'say', who: 'KIMORIN', text: '……一本目と二本目と三本目は、同じ作品です。並べる順に、こだわりました。' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'ヒポキン', text: '……順は、大事だ。' },
  { t: 'say', who: 'KIMORIN', text: 'ちなみに、さきほどの十秒は、皆さまの星図にも、飛ばしておきました。' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'theater', options: [{ label: '上映館を建てる', goto: 'tmake' }, { label: '今日は建てない', goto: 'tskip' }] },
  { t: 'label', id: 'tskip' },
  { t: 'sprite', image: 'hipokin' },
  { t: 'say', who: 'ヒポキン', text: '建てるのは、いつでもいい。' },
  { t: 'notice', text: '〔上映館〕は、myスタジオから、いつでも押せます' },
  { t: 'goto', id: 'tend' },
  { t: 'label', id: 'tmake' },
  { t: 'sprite', image: 'hipokin' },
  { t: 'say', who: 'ヒポキン', text: '何を集めたい？　笑える映像でも、静かな短編でも、お前の好きなものだ。' },
  { t: 'say', who: 'ヒポキン', text: '……話してみろ。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'theater' }, // テーマ→赤い幕→〔幕を、上げろ〕→一本目→順→ダチに見せる
  { t: 'sprite', image: 'hipokin' },
  { t: 'say', who: 'ヒポキン', text: '……いい館だ。' },

  // L2-MARS-S005 金星が開いた
  { t: 'label', id: 'tend' },
  { t: 'sprite', image: 'hipokin' },
  { t: 'say', who: 'ヒポキン', text: '次は、金星だ。' },
  { t: 'caption', text: '金星が開いた' },
  { t: 'notice', text: '火星で撮る・公開する、myスタジオと上映館は、このあとも自由に使えます' },
  { t: 'sprite', image: null },
  ...chapterEnd(4),
];
