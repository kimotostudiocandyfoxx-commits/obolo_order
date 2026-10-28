import type { Step } from '../script';
import { chapterEnd } from './common';

/**
 * L2 chapter 0 【地球 → 月】 — review/L2_地球_月_土星.md (L2-EARTH-S001, L2-MOON-S001〜S002).
 * MONBAN greets the new Obolo Order: the spring in the chest wells mana each month, and the ticket's locks
 * (Uranus, Neptune) open. On the Moon OBOLON gives Bati a new magic (〔💬 バティに聞く〕) and the basin lets
 * the look be changed (4 looks, one refine) — the look becomes the profile.
 */
export const L2_EARTH: Step[] = [
  { t: 'bgm', track: 'morning' },
  { t: 'still', image: 's/earth-hall' }, // 天球儀の並ぶ大広間。段の上に、赤いローブのKIMORINと、うんちピンポンくん
  { t: 'caption', text: '二周目のはじまり' },
  { t: 'se', sound: 'smoke' },
  { t: 'enter', who: 'monban', fx: 'smoke' },
  { t: 'sprite', image: 'monban' },
  { t: 'say', who: 'MONBAN', text: '来たか、Obolo Order…。' },
  { t: 'se', sound: 'sparkle' }, // 胸のあたりで、小さな光の泉が、ぽっと湧く（数字は出ない）
  { t: 'say', who: 'MONBAN', text: '……お前の泉から、マナが、湧いている…。これからは、毎月、湧く…。' },
  { t: 'notice', text: '毎月の更新日に、88マナが湧きます。マナを使う制作が、またできます' },
  { t: 'ticket', flip: true }, // 切符が裏返り、天王星と海王星の錠の印が、かちり、と外れる
  { t: 'se', sound: 'chime' },
  { t: 'say', who: 'MONBAN', text: '……切符の裏の、錠も、開いた…。天王星と、海王星…。旅の、終わりのほうで、行ける…。' },
  { t: 'caption', text: '切符の裏の錠が外れた' },
  { t: 'say', who: 'MONBAN', text: '旅の、続きを、してこい…。まずは、月へ…。' },
  { t: 'choice', key: 'l2earth', options: [{ label: '月へ向かう', goto: 'moon' }, { label: '今日はここまで', goto: 'earthstop' }] },
  { t: 'label', id: 'earthstop' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も今日はここまで。' },
  { t: 'pause', resume: 'earthresume' },
  { t: 'label', id: 'earthresume' },
  { t: 'choice', key: 'l2earth', options: [{ label: '月へ向かう', goto: 'moon' }, { label: '今日はここまで', goto: 'earthstop' }] },

  // L2-MOON-S001 バティに聞く
  { t: 'label', id: 'moon' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' },
  { t: 'still', image: 's/rocket-moon' },
  { t: 'wait', s: 1.2 },
  { t: 'bgm', track: 'moon' },
  { t: 'arrive', image: 's/moon-temple', caption: '月に着いた' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'say', who: 'OBOLON', text: '、、、Obolo Orderに、なった。{bati}の魔法も、、、少し、深くなった。' },
  { t: 'say', who: 'OBOLON', text: '話したことを、、、残しておける。前の話の、続きからも、聞ける。' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'バティ', text: 'この前の話、続きからでも聞けるよ！　宇宙のことじゃなくても、何でも調べるよ！' },
  { t: 'notice', text: '〔💬 バティに聞く〕を押すと、まん中に〔🎙 話してみよう〕。知りたいことを話すと、バティが調べて答えます。月に来れば、いつでも使えます（たくさん聞いた日は、マナを使うことがあります。使う前にたずねます）' },
  { t: 'choice', key: 'ask', options: [{ label: 'バティに聞いてみる', goto: 'ask' }, { label: 'あとで', goto: 'asked' }] },
  { t: 'label', id: 'ask' },
  { t: 'batitalk' },
  { t: 'label', id: 'asked' },
  { t: 'notice', text: '〔⚙︎ バティの設定〕で、名前・元気さ・話し方を変えられます。聞いたことの記録を残すか、消すかも選べます' },

  // L2-MOON-S002 姿を変える
  { t: 'still', image: 's/moon-altar' }, // 神殿の真ん中に、2日目の水盤
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '姿も、、、変えられる。変えたいところや、足したいものは、あるか？' },
  { t: 'say', who: 'KIMORIN', text: 'うんちピンポンくんに、羽を、つけてください。' },
  { t: 'se', sound: 'magic' }, // ピンポンくんの背中に、小さな天使の羽が二枚
  { t: 'sprite', image: ['unchi-pinpon', 'kimorin-sun'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪' },
  { t: 'say', who: 'KIMORIN', text: '……素敵です。' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'look', options: [{ label: '姿を変えてみる', goto: 'change' }, { label: 'このままでいい', goto: 'kept' }] },
  { t: 'label', id: 'change' },
  { t: 'l2', what: 'relook' },
  { t: 'label', id: 'kept' },
  { t: 'notice', text: '姿は、あとから、いつでも変えられます' },
  ...chapterEnd(0),
];
