import { formatMana, MAKE_COST } from '@obolo/shared';
import type { Step } from './script';
import { kimorinBack } from './kimorinBack';
import { M_END } from './outer';

/**
 * DAY 11 【天王星 → 地球 → 太陽】 — the simple version (M-R198〜M-R204; script P04/c02.md・c03.md, D08-S001〜S011: the
 * scene ids keep their D08). It was day 8 until M-R341 (2026-11-27): the three outer planets are days 8–10 now
 * (lib/onboarding/outer.ts), so the morning is on Uranus with MONBAN (before: on Venus with ボスG).
 * Uranus morning: {bati} is fading, the mana gem is empty → back to Earth. OBOLON 「、、、おかえり。」, MONBAN explains
 * the Eclipse (¥88 a month is the mana that wells up in you), KIMORIN's questions about money, then he storms off.
 * The choice is made here at the Earth temple (D08-S003): 〔今は、住人のままでいる〕 ends the first journey as a
 * resident (D08-S005 → 〔宇宙の地図へ〕); 〔エクリプスを受ける〕 → the payment by the visitor's own hand (D08-S006,
 * EclipsePay) → 〔通信：火星シアターの扉が、開いた〕 → the rocket (KIMORIN jumps in: 「……母は、とっくに、Obolo Orderでした。」)
 * → into the Sun (D08-S007) → 「わかりやすく、言う。」 (D08-S009) → the Eclipse (D08-S011) → 最初の旅、おわり → M-END-S001
 * (「ここから先は、自由に」: the letter from the HQ, read by KIMORIN — the end of the day for everyone who took the Eclipse).
 * People who already became Obolo Order (f_join_early = 'true', M-R199/M-R202/M-R204): {bati} is bright in the
 * morning, a short おかえり, no decision and no payment screen, straight to the rocket of D08-S006.
 * People who heard the explanation at the HQ before but did not join (f_ej_heard = 'true'): a short おかえり → D08-S003.
 * No riddle book, no records I〜III, no FilmReel recap in the simple version (M-R198).
 */
export const DAY11: Step[] = [
  // D08-S001 地球へ帰る
  { t: 'scene', id: 'D08-S001' },
  { t: 'bgm', track: 'morning' },
  { t: 'caption', text: '11日目' },
  { t: 'still', image: 's/uranus-field' }, // 天王星の朝。雲の上の町の、横倒しの輪が、ゆっくり回っている。ロケットが待っている。切符は八つのスタンプで金色
  { t: 'sprite', image: ['monban', 'kimorin-sun'] },
  { t: 'say', who: 'MONBAN', text: '起きたか…。星めぐりは…ひと巡りだ…。' },
  { t: 'branch', key: 'f_join_early', cases: { true: 'morning-early' }, otherwise: 'morning-weak' },
  { t: 'label', id: 'morning-weak' },
  { t: 'sprite', image: ['monban', '@bati-weak'] }, // Bluenaの光から、{bati}が出てくる。光が、うすい。体が、きのうより、透けている
  { t: 'say', who: 'バティ', text: '……{neo}、おはよ……。なんだか、力が、出ないや……。' },
  // {neo}の手もとで、マナジェムが、光らなくなっている
  { t: 'say', who: 'MONBAN', text: '……マナジェムの中身が…空だ…。旅で…使いきった…。' },
  { t: 'goto', id: 'morning-both' },
  { t: 'label', id: 'morning-early' },
  { t: 'sprite', image: ['monban', '@bati'] }, // {bati}の光は、明るい
  { t: 'say', who: 'バティ', text: 'おはよ、{neo}！　きょうも、元気！' },
  { t: 'say', who: 'MONBAN', text: '……マナが…湧いているな…。もう、結社の一員か。' },
  { t: 'label', id: 'morning-both' },
  { t: 'sprite', image: ['monban', 'kimorin-sun'] },
  { t: 'say', who: 'MONBAN', text: '地球の結社に…帰れ…。' },
  ...kimorinBack(11), // SYS-S002: once, if he walked out
  { t: 'say', who: 'KIMORIN', text: '……では、問いただしに参りましょう。この結社の、本当の狙いを。' },
  { t: 'action', label: 'ロケットで地球に帰る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' }, // ロケットが、天王星から飛び立つ
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'bgm', track: 'space' },
  { t: 'still', image: 's/rocket-earth' }, // 窓の外で、青い地球が、だんだん大きくなる

  // D08-S002 OBOLONの「おかえり」と、KIMORINの質問
  { t: 'scene', id: 'D08-S002' },
  { t: 'clock', on: false },
  { t: 'video', motion: 12 },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 }, // 天球儀の大広間。光の柱の中に、黒い球のOBOLON
  { t: 'caption', text: '地球の神殿に戻った' },
  { t: 'say', who: 'OBOLON', text: '、、、おかえり。' },
  { t: 'say', who: 'OBOLON', text: '5つの星は、、、どうだった？' },
  { t: 'choice', key: 'f_d08_how', options: [{ label: '楽しかった', goto: 'how-fun' }, { label: '疲れた', goto: 'how-tired' }, { label: 'まだ、わからない', goto: 'how-unsure' }] },
  { t: 'label', id: 'how-fun' },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' }, // 黒い球が、少しだけ、にっこりする
  { t: 'goto', id: 'monban' },
  { t: 'label', id: 'how-tired' },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。よく、歩いたな。' },
  { t: 'goto', id: 'monban' },
  { t: 'label', id: 'how-unsure' },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。それで、いい。' },
  { t: 'label', id: 'monban' },
  { t: 'bgm', track: 'monban' },
  { t: 'video', motion: '27-c' }, // 黒い煙が湧き、MONBANが現れる（字幕を消した版）
  { t: 'loop', motion: '28-l' },
  { t: 'branch', key: 'f_join_early', cases: { true: 'home-member' }, otherwise: 'home-heard?' },
  { t: 'label', id: 'home-heard?' },
  { t: 'branch', key: 'f_ej_heard', cases: { true: 'home-heard' }, otherwise: 'home-first' },
  // 先に結社で説明を聞いた人（f_ej_heard）：Obolo Orderになった人
  { t: 'label', id: 'home-member' },
  { t: 'say', who: 'MONBAN', text: '……{neo}。お前は、もう、Obolo Orderだったな…。……おかえり…。' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……私は、もう一度、母と話してきます。今度こそ、目を覚まさせます。' },
  { t: 'sprite', image: null }, // KIMORINが、門の外へ出ていく。扇の尾が、ぴん、と立っている
  { t: 'say', who: 'MONBAN', text: '……あとは、儀式だけだ…。太陽へ、送る…。' },
  { t: 'goto', id: 'rocket' }, // → D08-S006 の「……よし、分かった…。」から（支払いの画面は出さない）
  // 先に結社で説明を聞いた人（f_ej_heard）：ならなかった人
  { t: 'label', id: 'home-heard' },
  { t: 'say', who: 'MONBAN', text: '……マナジェムが、空になったか…。話は、前に、したな…。' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……私は、もう一度、母と話してきます。今度こそ、目を覚まさせます。' },
  { t: 'sprite', image: null }, // KIMORINが、門の外へ出ていく。扇の尾が、ぴん、と立っている
  { t: 'goto', id: 'decide' },
  // 初めて説明を聞く人（金色の目が、{bati}のうすい光を見る）
  { t: 'label', id: 'home-first' },
  { t: 'say', who: 'MONBAN', text: '……マナジェムが、空になったか…。' },
  { t: 'say', who: 'MONBAN', text: '……お前は、もう、この宇宙の住人だ…。いつでも、帰ってきていい…。' },
  { t: 'say', who: 'MONBAN', text: '……太陽の神殿で、『エクリプス』を受けることもできる…。太陽と、お前の魂をつなぐ儀式だ…。\n成功すれば、お前は、Obolo Orderになる…。' },
  { t: 'say', who: 'MONBAN', text: '……エクリプスを受ければ…お前の体から、マナが湧くようになる…。{bati}も、また、魔法が唱えられる…。' }, // {neo}の胸のあたりに、小さな泉の絵。数字は出ない
  { t: 'say', who: 'MONBAN', text: '……それに、旅は、まだ続く…。切符の裏の、天王星、海王星、いちばん外の冥王星…。そこからは、Obolo Orderの旅だ…。' },
  { t: 'say', who: 'MONBAN', text: '……ここには、勝手に流れてくる広告もない…。知らない誰かの『おすすめ』も、流れてこない…。あるのは、誰かが自分の言葉で作ったものだけだ…。灯りは、みんなの88円で、ともしている…。' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  // M-R274: the price was first heard on Jupiter (D05-S006) — KIMORIN looks back on it
  { t: 'say', who: 'KIMORIN', text: '……88円の話ですね。木星で、聞きました。超高額入会費です。' },
  { t: 'say', who: 'OBOLON', text: '、、、88円だ。' },
  { t: 'say', who: 'OBOLON', text: 'エクリプスを受けると、、、毎月、体から、88マナが湧く。その分が、、、月に、88円だ。' },
  { t: 'say', who: 'OBOLON', text: 'マナが湧けば、、、{bati}と、何度でも、作れる。' },
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
  { t: 'sprite', image: null }, // ローブの裾をひるがえして、門の外へ。扇の尾が、ぴん、と立っている
  { t: 'notice', text: '月額88円（毎月88マナの代金）。値上げはしません。いつでもやめられます。やめ方は、支払いの画面に書いてあります' },
  // client 2026-11-25: the numbers are the price rule's (MAKE_COST), never fixed ones
  { t: 'notice', text: `旅で使ったマナのめやす｜曲 ${formatMana(MAKE_COST.song)}マナ／アートの絵（{bati}が描く時） ${formatMana(MAKE_COST.jacketArt)}マナ／MV ${formatMana(MAKE_COST.mv)}マナ／姿を変える ${formatMana(MAKE_COST.profileLook)}マナ（8つの星の姿も描き直します）。声のコロリン、月で{bati}に聞くこと（ふだんの分）、写真や字だけのアート、届けること、DJで回すことは、マナを使いません` },
  { t: 'notice', text: 'Obolo Orderの旅｜毎月88マナで、{bati}と作り続けられます。切符の裏の天王星・海王星・冥王星へも行けます（旅の続き）。いつでもやめられて、やめても作ったものは残ります' },
  { t: 'notice', text: 'エクリプスを受けなくても、住人のまま、星に戻って、作ったものを見て、届けて、回せます。マナジェムのマナを使い切ったあと、新しく作る時は、エクリプスが必要です' },

  // D08-S003 エクリプスを受けるか（地球の神殿）
  { t: 'scene', id: 'D08-S003' },
  { t: 'label', id: 'decide' },
  { t: 'bgm', track: 'earth-decide' },
  { t: 'ticket', flip: true, unlock: 'all' }, // 金色の切符の裏の星図。金の線は、土星、木星、水星、火星、金星、冥王星、海王星、天王星を通って、太陽の印まで
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。決めるのは、お前だ。' },
  { t: 'say', who: 'MONBAN', text: '……エクリプスを受けなくても、お前は、住人のままだ…。それも、道だ…。' },
  { t: 'say', who: 'MONBAN', text: '……払えるなら、今から、エクリプスを始める…。太陽へは、俺が送る…。' },
  { t: 'label', id: 'decide-choice' },
  { t: 'choice', key: 'f_d08_decide', options: [{ label: 'エクリプスを受ける', goto: 'pay' }, { label: '今は、住人のままでいる' }] },
  { t: 'say', who: 'MONBAN', text: '……そうか…。' },

  // D08-S005 住人のままでいる
  { t: 'scene', id: 'D08-S005' },
  { t: 'say', who: 'MONBAN', text: '……いつでも、来い…。気が変わったら、俺に言え…。' },
  { t: 'sprite', image: ['', 'kimorin-sun'] }, // 門のすき間から、白い顔が、ちらりとのぞく
  { t: 'say', who: 'KIMORIN', text: '……では、私も、もう少しだけ、考えます。決して、怖気づいたわけでは、ありません。' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'farewell' },
  { t: 'notice', text: '住人のまま、いつでも星に戻れます。作ったもの・届けたもの・my場所・金星の番組・声のコロリンは、ずっとそのままです' },
  { t: 'notice', text: 'Obolo Order（会員）には、いつでもなれます。地球の神殿でMONBANに話しかけると、エクリプスを受けられます。なると、{bati}にまたマナが湧きます' }, // the script's note still ends 「…湧き、天王星・冥王星・海王星が、一つずつ開きます」: no longer true since M-R341 (they are days 8–10), so that clause is not shown — the story session is asked for the new words
  { t: 'caption', text: '最初の旅、おわり' },
  { t: 'action', label: '宇宙の地図へ' },
  { t: 'end' },
  // D08-S003 再開した人（地球の神殿に戻ってきた住人）：「、、、来たか。」→ 星図 → 同じ二択
  { t: 'label', id: 'resume' },
  { t: 'scene', id: 'D08-S003' },
  { t: 'bgm', track: 'earth-decide' },
  { t: 'loop', motion: '28-l' }, // 地球の神殿。光の柱の中に、OBOLON。そばに、MONBAN
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'ticket', flip: true, unlock: 'all' },
  { t: 'goto', id: 'decide-choice' },

  // D08-S003 (pay) → D08-S006 エクリプスを始める（支払いは本人の手で）
  { t: 'label', id: 'pay' },
  { t: 'say', who: 'MONBAN', text: '……分かった…。' },
  { t: 'scene', id: 'D08-S006' },
  { t: 'say', who: 'MONBAN', text: '……この先は、お前の手で、押せ…。' },
  // 〔画面：エクリプスの支払い（最終確認）〕［支払う／戻る］。完了しなかった時の〔画面：支払いは完了していません〕〔もう一度ためす／戻る〕と
  // MONBANの一言は EclipsePay の中（failLine）
  {
    t: 'order',
    cancel: 'back',
    failLine: { t: 'say', who: 'MONBAN', text: '……まだ、終わっていない…。決めたら、また来い…。' },
  },
  { t: 'caption', text: '通信：火星シアターの扉が、開いた' },
  { t: 'label', id: 'rocket' },
  { t: 'say', who: 'MONBAN', text: '……よし、分かった…。' },
  { t: 'say', who: 'MONBAN', text: '……それでは、エクリプス用のロケットに、案内する…。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'still', image: 's/launch-pit' }, // ロケットの扉が、ゆっくり閉まっていく
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 外から
  { t: 'sprite', image: 'kimorin-sun' }, // 閉まりかけた扉のすき間に、白い顔がぬっと差しこまれる
  { t: 'say', who: 'KIMORIN', text: 'そのロケットに、私も、乗ります。' },
  // 扉がもう一度開く。KIMORINが、裾を整えて乗りこんでくる
  { t: 'say', who: 'KIMORIN', text: '……私も、決めました。Obolo Orderに、なります。' },
  { t: 'say', who: 'KIMORIN', text: '……母に言ってやりました。『あの結社は、詐欺です』と。' },
  { t: 'say', who: 'KIMORIN', text: 'そうしたら、『88円なら、なっておきなさい』と。' },
  { t: 'say', who: 'KIMORIN', text: '……母は、とっくに、Obolo Orderでした。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、oboloとは何か。この手で、解き明かしてみせます。' },
  { t: 'say', who: 'KIMORIN', text: 'はははははは！' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'rocket' }, // 扉が閉まる。ロケットが、太陽へ飛び立つ
  { t: 'goto', id: 'sun' },
  // the payment screen's 「戻る」 → D08-S003
  { t: 'label', id: 'back' },
  { t: 'say', who: 'MONBAN', text: '戻るか…。' },
  { t: 'goto', id: 'decide-choice' },

  // D08-S007 太陽の中へ（映画の場面）
  { t: 'label', id: 'sun' },
  { t: 'scene', id: 'D08-S007' },
  { t: 'still', image: 's/rocket-sun' }, // 映像：ロケットの丸い窓いっぱいに、白く燃える太陽 → 炎がゆっくりうねる → 光の中へ吸いこまれていく
  { t: 'whiteout' }, // ロケットごと、太陽の中へ、すぽん、と入る
  { t: 'bgm', track: null }, // 音が消える
  { t: 'still', image: 's/sun-inside' }, // 上も下もない、あたたかい白い光の世界。白い柱が輪になって、かすんで立っている
  { t: 'caption', text: '太陽の中に入った' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'ここは……ええ、知っていますとも。太陽の、中です。……たぶん。' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] }, // 光の玉の手前に、光の柱が立ちのぼり、黒い球が浮かぶ
  { t: 'caption', text: 'OBOLONが現れた' },
  { t: 'say', who: 'OBOLON', text: '{neo}。1日目、宇宙に行きたいか、\n聞いたな。' },
  { t: 'say', who: 'OBOLON', text: 'お前は、『{choice1}』と、\n言った。' },
  { t: 'say', who: 'OBOLON', text: '、、、今は、もう、\n答えは、いらないな。' },
  { t: 'say', who: 'OBOLON', text: '、、、お前は、もう、五つの星を、渡ってきた。' },

  // D08-S009 「わかりやすく、言う。」（映画の場面）
  { t: 'scene', id: 'D08-S009' },
  { t: 'bgm', track: 'sun' },
  { t: 'say', who: 'KIMORIN', text: 'OBOLON。そろそろ、教えていただけますか。……Obolo Orderは全員、、、何なのです？' },
  { t: 'say', who: 'OBOLON', text: 'わかりやすく、言う。', hold: true },
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderは、全員、、、DJ、なんだ。', hold: true },
  { t: 'say', who: 'KIMORIN', text: '……DJ？　レコードを、きゅっきゅっと回す、あのDJですか？' },
  { t: 'say', who: 'OBOLON', text: '皿を回すだけが、、、DJじゃない。' },
  { t: 'say', who: 'OBOLON', text: '声、言葉、曲、絵、映像。、、、混ぜて、誰かに、届ける。それが、DJだ。', hold: true },
  // 光の玉に、五つの景色が順に映る：コロリンの声が舞う空の輪／アートを抱えて飛ぶ蝶／曲を積んで港を出る船／スタジオの1枠に映るMV／きのう金星の放送ブースの卓で{neo}が自分の曲を回した瞬間
  { t: 'say', who: 'OBOLON', text: '浴びる、だけの側から、、、混ぜて、届ける、側へ。', hold: true },
  { t: 'say', who: 'KIMORIN', text: '……台所にあるもの、では、なかったのですね。' },
  { t: 'say', who: 'KIMORIN', text: 'では、もう一つ。……そもそも、oboloとは、何なのです？' },
  // 光の玉の奥に、星図のかけらのような細い線が走る。その端で、小さな灯りがいくつか寄り集まって、瞬く。すぐに、ほどけて消える
  { t: 'say', who: 'OBOLON', text: '、、、それは、、、まだ、言わない。' },
  { t: 'say', who: 'OBOLON', text: '星を、めぐっていれば、、、いつか、わかる。' },
  { t: 'say', who: 'KIMORIN', text: '……また、それですか。' },

  // D08-S011 エクリプス（映画の場面・いちばんの山場）
  { t: 'scene', id: 'D08-S011' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null },
  { t: 'still', image: 's/sun-inside' }, // OBOLONの黒い球が、遠くの光の玉に重なる。光が隠れて、まわりに金色の輪だけが残る
  { t: 'bgm', track: 'eclipse' }, // 音楽が、静かに始まる
  { t: 'se', sound: 'magic' }, // 金色の輪から、光の粒が、雪のように降ってくる。{neo}と{bati}に。となりで、KIMORINとピンポンくんにも
  { t: 'motes', count: 120 },
  { t: 'sprite', image: '@bati' }, // {bati}の透けていた体に、光が流れこむ。輪郭が、くっきりと戻る（先にObolo Orderになった人：いつもの光が、もう一段、明るくなる）
  { t: 'say', who: 'バティ', text: '……からだが、あったかい！' },
  { t: 'sprite', image: null }, // {neo}の胸のあたりに、小さな光の泉が、ぽっと灯る。音楽が、大きくなっていく
  { t: 'still', image: 's/rec3-warm-city', fade: 2 }, // 金色の輪の向こうに、青い地球の夜の側。窓に、一つ、また一つ、暖かい灯りがともる
  { t: 'still', image: 's/rec3-space', fade: 2 }, // 灯りが、ふわりと空へのぼって、星になる
  { t: 'still', image: 's/sun-inside', fade: 2 }, // 金色の輪が、いちばん強く光る
  { t: 'motes', count: 0 },
  { t: 'branch', key: 'f_join_early', cases: { true: 'eclipse-early' }, otherwise: 'eclipse-new' },
  { t: 'label', id: 'eclipse-new' },
  { t: 'caption', text: 'Obolo Orderになった' },
  { t: 'goto', id: 'eclipse-both' },
  { t: 'label', id: 'eclipse-early' },
  { t: 'caption', text: 'エクリプスを受けた' },
  { t: 'label', id: 'eclipse-both' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……エクリプス成功だケン！' },
  // こほん
  { t: 'say', who: 'KIMORIN', text: '……失礼。成功です。' },
  { t: 'say', who: 'KIMORIN', text: 'これで、{neo}も私も、Obolo Order……ということで、よろしいのですね？' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、そうだ。' },
  { t: 'ticket', flip: true, unlock: 'all' }, // {neo}の金色の切符が、ひとりでに裏返る。星図の八つの星が、いっせいに、金色に光る
  { t: 'say', who: 'OBOLON', text: 'これで、、、どの星へも、好きな順で、行ける。' },
  { t: 'say', who: 'KIMORIN', text: '……明日から、新しい星へ、、、ですね。' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null, fade: 4 }, // 音楽が、ゆっくり消えていく。白い光の中に、金色の輪だけが残る
  // 〔テロップ：最初の旅、おわり〕 only once (M-R205): someone who stayed a resident saw it then
  // (the answer is kept under the day it was given on: d11 now, d8 for the accounts of the eight-day journey)
  { t: 'branch', key: 'd11.f_d08_decide', cases: { '今は、住人のままでいる': 'fin-seen' }, otherwise: 'fin?' },
  { t: 'label', id: 'fin?' },
  { t: 'branch', key: 'd8.f_d08_decide', cases: { '今は、住人のままでいる': 'fin-seen' }, otherwise: 'fin' },
  { t: 'label', id: 'fin' },
  { t: 'caption', text: '最初の旅、おわり' },
  { t: 'label', id: 'fin-seen' },
  // M-END-S001 どこへでも — （11日目、エクリプスのあと）: every planet is open, in any order
  ...M_END,
  { t: 'end' },
];
