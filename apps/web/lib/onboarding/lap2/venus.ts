import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 5 【金星】 — review/L2_金星.md (L2-VENUS-S001, S002, S006, S007).
 * The back booth opens: from your song into your song (the same record with a 〔印〕 somewhere else, or a
 * second song of yours), SYNC, the fader's speed, the picture from the studio and the lights (Hat G's desk).
 * At night KIMORIN plays 『漆黒の黙示録ミックス』 — every beat the same speed. No mana for playing.
 * Branches: `l1_dj` (first journey Venus: self / auto), `booth` (today: play / skip).
 */
export const L2_VENUS: Step[] = [
  ...flight('金星に着いた'),
  { t: 'bgm', track: 'venus' },
  { t: 'still', image: 's/venus-stage' }, // 星ぜんたいが巨大なレコード。針の腕の根もとの野外ステージに、ゴリラが三人
  { t: 'sprite', image: ['hatg', 'bossg', 'longg'] },
  { t: 'say', who: 'ボスG', text: '……おかえり。' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'ただいま戻りました。今日も、よく回っていますね。洗濯——' },
  { t: 'wait', s: 1 }, // ボスGが、じっと見る
  { t: 'say', who: 'KIMORIN', text: '……レコードが。' },
  { t: 'say', who: 'ボスG', text: 'この前は、かんたんな卓だった。' },
  { t: 'say', who: 'ボスG', text: '今日は、奥のブースを開ける。' },

  // L2-VENUS-S002 奥のブースと照明卓
  { t: 'se', sound: 'whoosh' }, // ステージの奥の幕が、左右に開く
  { t: 'sprite', image: ['hatg', 'bossg', 'longg'] },
  { t: 'say', who: 'ボスG', text: 'この前は、練習のリズムから、お前の曲へ、つないだ。' },
  { t: 'say', who: 'ボスG', text: '今日は、お前の曲から、お前の曲へ、つなぐ。' },
  { t: 'notice', text: '音が出ます。音を出せる場所か、イヤホンで遊んでください。回す・映すのに、マナは使いません' },
  { t: 'notice', text: '右の台にも、同じ一枚をのせられます。ちがう所に〔印〕をつけると、同じ曲が、別の顔でつながります（曲が二つ以上ある人は、ちがう曲ものせられます）' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'booth', options: [{ label: '奥のブースで回す', goto: 'vplay' }, { label: '今はいい', goto: 'vskip' }] },
  { t: 'label', id: 'vskip' },
  { t: 'sprite', image: 'bossg' },
  { t: 'say', who: 'ボスG', text: 'ブースは、いつでも開いている。' },
  { t: 'goto', id: 'vnight' },
  { t: 'label', id: 'vplay' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null },
  { t: 'l2', what: 'booth' }, // 印→SYNC→つまみ→映像を選ぶ→あかり。ゴリラたちの言葉は卓の上に出る
  { t: 'bgm', track: 'venus' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'branch', key: 'booth_two', cases: { yes: 'vtwo' }, otherwise: 'vsame' },
  { t: 'label', id: 'vsame' },
  { t: 'say', who: 'KIMORIN', text: '……同じ一枚が、ちがう顔で。……すべて、自家製ですね。' },
  { t: 'goto', id: 'vjoin' },
  { t: 'label', id: 'vtwo' },
  { t: 'say', who: 'KIMORIN', text: '……二枚とも、{neo}の曲。……すべて、自家製ですね。' },
  { t: 'label', id: 'vjoin' },
  { t: 'sprite', image: ['hatg', 'bossg'] },
  { t: 'say', who: 'ボスG', text: '……つながったな。今日は、お前の曲だけで。' },
  { t: 'say', who: 'ハットG', text: '……いい色だ。' },

  // L2-VENUS-S006 夜のステージ／KIMORINの一枚
  { t: 'label', id: 'vnight' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/venus-night' }, // 夜。針の腕の下。ステージの縁の小さなライト
  { t: 'branch', key: 'booth', cases: { 奥のブースで回す: 'vshow' }, otherwise: 'vkimorin' },
  { t: 'label', id: 'vshow' },
  { t: 'notice', text: 'いま回した一曲も、〔🎤 見せる〕を押せば、この前と同じように、ダチの夜空に88時間届けられます。押さなければ、どこにも送られません' },
  { t: 'label', id: 'vkimorin' },
  { t: 'sprite', image: 'kimorin-sun' }, // 奥のブースに上がる。丸いサングラスを、指でくいっとかけ直す
  { t: 'say', who: 'KIMORIN', text: 'では、私も、一枚。' },
  { t: 'l2', what: 'kimorin-mix' }, // ラベルに『漆黒の黙示録ミックス』。どぉん……。……どぉん……。ぜんぶ同じ速さ
  { t: 'say', who: 'KIMORIN', text: '……黙示録とは、すべて同じ速さで来るものです。' },
  { t: 'branch', key: 'l2_synced', cases: { yes: 'vtaught' }, otherwise: 'vheard' },
  { t: 'label', id: 'vtaught' },
  { t: 'say', who: 'KIMORIN', text: '速さをそろえろ、と教わりましたので。……最初から最後まで、そろえました。' },
  { t: 'goto', id: 'vafter' },
  { t: 'label', id: 'vheard' },
  { t: 'say', who: 'KIMORIN', text: '速さは、そろえるもの、と聞きましたので。……最初から最後まで、そろえました。' },
  { t: 'label', id: 'vafter' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: '……次は、つまみを、動かしてみろ。' },

  // L2-VENUS-S007 天王星が開いた
  { t: 'say', who: 'ボスG', text: '次は、天王星だ。' },
  { t: 'caption', text: '天王星が開いた' },
  { t: 'notice', text: '金星で回す・映す、ステージをダチに見せるのは、このあとも自由にできます' },
  { t: 'sprite', image: null },
  ...chapterEnd(5),
];
