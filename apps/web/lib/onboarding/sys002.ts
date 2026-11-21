import type { Step } from './script';

/**
 * SYS-S002 「結社で、詳しく話したい」 (M-R202): becoming Obolo Order before day 8. Whichever way in — MONBAN's message at
 * the end of day 3 (day3.ts, label sys-s002) or 〔設定〕→〔毎月のマナ〕→〔先にObolo Orderになる〕 on days 3–7 — this scene
 * always plays: MONBAN's explanation and KIMORIN's suspicion of the "entry fee", then the payment screen (now / on day 8).
 * There is no way to pay that skips it. Someone who saw it before (f_ej_heard) gets the short version.
 * Saved: f_ej_heard = true; f_join_early = early (paid) / later; f_join = pay when paid. Day 8 reads them (story keys
 * f_join_early / f_ej_heard, see lib/onboarding/joinFlags.ts).
 * Labels start with sys- so the scene can be spliced into a day.
 */
export const SYS002: Step[] = [
  { t: 'scene', id: 'SYS-S002' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true },
  { t: 'say', who: 'MONBAN', text: '……結社に、戻ってこい…。詳しく、話したい…。' },
  { t: 'screen', open: false },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……結社？　こんな時間に、呼び出しですか。' },
  { t: 'say', who: 'KIMORIN', text: '怪しい。私も、行きます。' },
  { t: 'sprite', image: null },
  { t: 'motes', count: 40 }, // 景色が光の粒になってほどけ、地球の神殿へ
  { t: 'video', motion: 12 },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 }, // 天球儀の大広間。光の柱の中に、黒い球のOBOLON
  { t: 'motes', count: 0 },
  { t: 'bgm', track: 'monban' },
  { t: 'video', motion: '27-c' }, // 黒い煙が湧き、MONBANが現れる
  { t: 'loop', motion: '28-l' },
  { t: 'set', key: 'f_ej_heard_now', value: 'true' },
  { t: 'branch', key: 'f_ej_heard', cases: { true: 'sys-again' }, otherwise: 'sys-first' },

  { t: 'label', id: 'sys-again' },
  { t: 'say', who: 'MONBAN', text: '……話は、前に、したな…。決めたか…？' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……また、その話ですか。今日は帰りません。見張ります。' },
  { t: 'goto', id: 'sys-price' },

  { t: 'label', id: 'sys-first' },
  { t: 'cam', move: 'in', focus: '50% 30%' },
  { t: 'say', who: 'MONBAN', text: '……{neo}。旅の途中で、Obolo Orderになりたいと、聞いた…。' },
  { t: 'say', who: 'MONBAN', text: '……Obolo Orderになると…お前の体から、マナが湧くようになる…。{bati}のマナも、切れなくなる…。' },
  { t: 'say', who: 'MONBAN', text: '……それに、旅のあとで、まだ行っていない星にも行ける…。切符の裏の、錠の星だ…。' },
  { t: 'say', who: 'MONBAN', text: '……ここには、勝手に流れてくる広告もない…。知らない誰かの『おすすめ』も、流れてこない…。あるのは、誰かが自分の言葉で作ったものだけだ…。灯りは、みんなの88円で、ともしている…。' },
  { t: 'cam', move: 'out' },
  { t: 'bgm', track: 'suspect' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……はい、出ました。入会費です。' },
  { t: 'say', who: 'KIMORIN', text: 'ついに、化けの皮が、剥がれましたね。' },
  { t: 'say', who: 'OBOLON', text: '、、、入会費は、ない。' },
  { t: 'say', who: 'KIMORIN', text: '……は？' },
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderになると、、、毎月、体から、88マナが湧く。' },
  { t: 'say', who: 'OBOLON', text: 'その分が、、、月に、88円だ。' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: '……つまり、入会費は、タダ、ということですね？' },
  { t: 'say', who: 'OBOLON', text: '、、、そうだ。' },
  { t: 'say', who: 'KIMORIN', text: '……うまい言い方を、しますね。' },
  { t: 'say', who: 'KIMORIN', text: '月に88円、と言って、あとから、値上がりしていくのでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、値上げは、しない。' },
  { t: 'say', who: 'KIMORIN', text: 'やめたくなったら？　どうせ、やめさせてくれない仕組みでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、いつでも、やめられる。やめ方は、支払いの画面に、書いてある。' },
  { t: 'say', who: 'KIMORIN', text: '……Obolo Orderにならなかったら？　{bati}も、ピンポンくんも、消えるのでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、消えない。お前たちは、もう、住人だ。作ったものも、届けたものも、そのままだ。' },
  { t: 'say', who: 'うんちピンポンくん', text: '……ピンポン♪' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: 'バカバカしい。私は、帰ります。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、お母さんに、言ってやります。' },
  { t: 'say', who: 'KIMORIN', text: 'さようなら。' },
  { t: 'sprite', image: null }, // KIMORINが、ローブの裾をひるがえして、門の外へ。扇の尾が、ぴん、と立っている
  { t: 'bgm', track: 'earth-decide' },

  { t: 'label', id: 'sys-price' },
  { t: 'notice', text: '月額88円（毎月88マナの代金）。値上げはしません。いつでもやめられます。やめ方は、支払いの画面に書いてあります' },
  { t: 'notice', text: 'Obolo Orderにならなくても、8日目まで旅は同じように続きます。旅の途中でマナジェムのマナを使い切ると、新しく作れなくなることがあります' },
  { t: 'say', who: 'MONBAN', text: '……決めるのは、お前だ…。8日目まで待っても、いい…。' },
  {
    t: 'choice',
    key: 'f_join_choice',
    options: [
      { label: 'いま、Obolo Orderになる', goto: 'sys-now' },
      { label: '8日目に決める', goto: 'sys-later' },
    ],
  },
  { t: 'label', id: 'sys-now' },
  { t: 'order', cancel: 'sys-back' },
  { t: 'set', key: 'f_join_early_now', value: 'early' },
  { t: 'caption', text: 'Obolo Orderになった' },
  { t: 'caption', text: '通信：火星シアターの扉が、開いた' },
  { t: 'say', who: 'MONBAN', text: '……儀式は、8日目に、太陽でやる…。それまで、旅を楽しめ…。' },
  { t: 'goto', id: 'sys-out' },
  { t: 'label', id: 'sys-back' },
  { t: 'say', who: 'MONBAN', text: '……いつでもいい…。設定からも、なれる…。' },
  { t: 'goto', id: 'sys-out' },
  { t: 'label', id: 'sys-later' },
  { t: 'say', who: 'MONBAN', text: '……そうか…。8日目に、待っている…。' },
  { t: 'label', id: 'sys-out' },
  { t: 'bgm', track: null, fade: 3 },
  { t: 'motes', count: 40 }, // 景色が光の粒になってほどけ、元いた所へ戻る
  { t: 'black' },
];
