import type { Step } from './script';

/**
 * DAY 8 【金星 → 地球 → 太陽】 — story draft 21 (M-R124〜M-R126; review/DAY8.md, D08-S001〜S011b). Back on
 * Earth OBOLON and MONBAN explain: you are a resident of this universe already; the Eclipse at the Sun is a
 * choice — no joining fee, ¥88 a month is the mana that wells up in you, never raised, stop any time. KIMORIN
 * storms out, then jumps into the rocket after all. In the Sun (OBOLON only, background sun-inside): riddle 2
 * 「DJ」 → record I ナガレ for everyone → riddle 4 → the choice 〔エクリプスを受ける〕〔今は、住人のままでいる〕.
 * Staying: back to the map as a resident (free; the Eclipse can be taken later at the Sun temple). Taking it:
 * the payment by the visitor's own hand (EclipsePay) → KIMORIN⭐︎ joins too → the Eclipse, riddle 1, records
 * II・III (Obolo Order only) → 一周目の旅、おわり. The day ends with no 24-hour wait (StoryDay advances at once).
 * The 88 minutes run in the rocket from Venus; the temples of Earth don't count ('clock' off, M-R22).
 */
export const DAY8: Step[] = [
  { t: 'bgm', track: 'morning' },
  { t: 'caption', text: '8日目' },
  // D08-S001 地球へ帰る
  { t: 'still', image: 's/venus-stage' }, // 金星の朝。巨大なレコードの星が、ゆっくり回っている。切符は五つのスタンプで金色
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: 'おはよう。……星めぐりは、ひと巡りだ。地球へ帰れ。' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。……では、問いただしに参りましょう。この結社の、本当の狙いを。' },
  { t: 'action', label: 'ロケットで地球に帰る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'bgm', track: 'space' },
  { t: 'still', image: 's/rocket-earth' },

  // D08-S002 OBOLONの「おかえり」と、KIMORINの質問
  { t: 'clock', on: false },
  { t: 'video', motion: 12 },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 },
  { t: 'caption', text: '地球の神殿に戻った' },
  { t: 'say', who: 'OBOLON', text: '、、、おかえり。' },
  { t: 'say', who: 'OBOLON', text: '5つの星は、、、どうだった？' },
  { t: 'choice', key: 'f_d08_how', options: [{ label: '楽しかった', goto: 'how-fun' }, { label: '疲れた', goto: 'how-tired' }, { label: 'まだ、わからない', goto: 'how-unsure' }] },
  { t: 'label', id: 'how-fun' },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
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
  { t: 'say', who: 'MONBAN', text: '……お前は、もう、この宇宙の住人だ…。いつでも、帰ってきていい…。' },
  { t: 'say', who: 'MONBAN', text: '……太陽の神殿で、『エクリプス』を受けることもできる…。太陽と、お前の魂をつなぐ儀式だ…。\n成功すれば、お前は、Obolo Orderになる…。' },
  { t: 'say', who: 'MONBAN', text: '……Obolo Orderになれば、まだ行っていない星にも行ける…。切符の裏の、錠の星だ…。' },
  { t: 'say', who: 'MONBAN', text: '……それに、エクリプスを受ければ…お前の体から、マナが湧くようになる…。招待の時にもらったジェムが空になっても、魔法が唱えられる…。' }, // {neo}の胸のあたりに、小さな泉の絵。数字は出ない
  { t: 'say', who: 'MONBAN', text: '……ここには、勝手に流れてくる広告もない…。知らない誰かの『おすすめ』も、流れてこない…。あるのは、誰かが自分の言葉で作ったものだけだ…。灯りは、みんなの88円で、ともしている…。' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……ほら、来ました。入会費です。' },
  { t: 'say', who: 'KIMORIN', text: 'ついに、化けの皮が、剥がれましたね。' },
  { t: 'say', who: 'OBOLON', text: '、、、入会費は、ない。' },
  { t: 'say', who: 'KIMORIN', text: '……は？' },
  { t: 'say', who: 'OBOLON', text: 'エクリプスを受けると、、、毎月、体から、88マナが湧く。' },
  { t: 'say', who: 'OBOLON', text: 'その分が、、、月に、88円だ。' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: '……つまり、入会費は、タダ、ということですね？' },
  { t: 'say', who: 'OBOLON', text: '、、、そうだ。' },
  { t: 'say', who: 'KIMORIN', text: '……うまい言い方を、しますね。' },
  { t: 'say', who: 'KIMORIN', text: 'では、いくつか、お伺いしましょうか。' }, // 顔を少し上に向けて、腕を組む
  { t: 'say', who: 'KIMORIN', text: '月に88円、と言って、あとから、値上がりしていくのでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、値上げは、しない。' },
  { t: 'say', who: 'KIMORIN', text: 'やめたくなったら？　どうせ、やめさせてくれない仕組みでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、いつでも、やめられる。やめ方は、支払いの画面に、書いてある。' },
  { t: 'say', who: 'KIMORIN', text: 'マナは？　足りなくなったら、どうせ、買わせるのでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、買い足すことも、できる。でも、毎月湧く分で、十分、遊べる。' },
  { t: 'say', who: 'KIMORIN', text: '……Obolo Orderにならなかったら？　{bati}も、ピンポンくんも、消えるのでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、消えない。お前たちは、もう、住人だ。作ったものも、届けたものも、そのままだ。' },
  { t: 'say', who: 'うんちピンポンくん', text: '……ピンポン♪' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: 'バカバカしい。私は、帰ります。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、お母さんに、言ってやります。' },
  { t: 'say', who: 'KIMORIN', text: 'さようなら。' },
  { t: 'sprite', image: null }, // ローブの裾をひるがえして、門の外へ。扇の尾が、ぴん、と立っている
  { t: 'say', who: 'MONBAN', text: '……行ったな…。' },
  { t: 'notice', text: '月額88円（毎月88マナの代金）。値上げはしません。いつでもやめられます。やめ方は、支払いの画面に書いてあります' },
  { t: 'notice', text: '旅で使ったマナのめやす｜姿を変える 3マナ／コロリンのデザイン 3マナ／ジャケットの絵（{bati}が描く時） 3マナ／曲 2マナ／MV 8マナ。声のコロリン、写真や字だけのジャケット、届けること、DJで回すことは、マナを使いません' },
  { t: 'notice', text: 'エクリプスを受けなくても、住人のまま、星に戻って、作ったものを見て、届けて、回せます。マナを使って新しく作る時は、エクリプスが必要です' },
  { t: 'say', who: 'MONBAN', text: '……まずは、太陽へ行け…。決めるのは、そこでいい…。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'still', image: 's/launch-pit' }, // ロケットの扉が、ゆっくり閉まっていく
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 外から
  { t: 'sprite', image: 'kimorin-sun' }, // 閉まりかけた扉のすき間に、白い顔がぬっと差しこまれる
  { t: 'say', who: 'KIMORIN', text: 'そのロケットに、私も、乗ります。' },
  { t: 'say', who: 'KIMORIN', text: '……決めるのは、この目で、太陽を見てからです。' }, // 扉がもう一度開く。裾を整えて乗りこんでくる
  { t: 'sprite', image: null },
  { t: 'se', sound: 'rocket' }, // 扉が閉まる。ロケットが、太陽へ飛び立つ

  // D08-S007 太陽の中へ
  { t: 'still', image: 's/rocket-sun' }, // 窓の外の太陽が、どんどん大きくなる
  { t: 'whiteout' }, // まぶしくて、何も見えなくなる。ロケットごと、太陽の中へ、すぽん、と入る
  { t: 'bgm', track: null }, // 音が消える
  { t: 'still', image: 's/sun-inside' },
  { t: 'caption', text: '太陽の中に入った' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'ここは……ええ、知っていますとも。太陽の、中です。……たぶん。' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] }, // 光の玉の手前に、光の柱が立ちのぼり、黒い球が浮かぶ
  { t: 'caption', text: 'OBOLONが現れた' },
  { t: 'branch', key: 'd1.choice1', cases: { 行きたい: 'sun-talk', 行きたくない: 'sun-talk', まだわかんない: 'sun-talk' }, otherwise: 'sun-quiet' },
  { t: 'label', id: 'sun-talk' },
  { t: 'say', who: 'OBOLON', text: '{neo}。1日目、宇宙に行きたいか、\n聞いたな。' },
  { t: 'say', who: 'OBOLON', text: 'お前は、『{choice1}』と、\n言った。' },
  { t: 'say', who: 'OBOLON', text: '、、、今は、もう、\n答えは、いらないな。' },
  { t: 'goto', id: 'sun-both' },
  { t: 'label', id: 'sun-quiet' },
  { t: 'say', who: 'OBOLON', text: '、、、来たな。' },
  { t: 'label', id: 'sun-both' },
  { t: 'say', who: 'OBOLON', text: '、、、お前は、もう、この宇宙の住人だ。' },
  { t: 'say', who: 'OBOLON', text: 'だから、、、聞かせよう。' },

  // D08-S009 「わかりやすく、言う。」（M-R86：答えは「DJ」）
  { t: 'say', who: 'OBOLON', text: '{neo}。旅で、何度も、\n聞きかけた言葉が、あるな。' },
  { t: 'say', who: 'OBOLON', text: 'わかりやすく、言う。' },
  { t: 'say', who: 'OBOLON', text: '旅で、もう、うすうす、気づいているかもしれないが、、、' },
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderは、全員、、、DJ、なんだ。', hold: true },
  { t: 'say', who: 'KIMORIN', text: '……DJ？　レコードを、きゅっきゅっと回す、あのDJですか？' },
  { t: 'say', who: 'OBOLON', text: '皿を回すだけが、、、DJじゃない。' },
  { t: 'say', who: 'OBOLON', text: '声、言葉、曲、絵、映像、物語。' },
  { t: 'say', who: 'OBOLON', text: '、、、混ぜて、誰かに、届ける。それが、DJだ。', hold: true },
  { t: 'say', who: 'OBOLON', text: '選んで、並べる、だけの日も、、、DJだ。' },
  { t: 'say', who: 'OBOLON', text: '土星の輪、木星の蝶、\n水星の船、火星の光、\n金星の、ターンテーブル。' }, // 光の玉に、五つの景色が順に映る。きのう金星で{neo}が自分の曲を回した瞬間。KIMORINのコロリンが「ぷりぷりぷりり！」
  { t: 'say', who: 'KIMORIN', text: '……私の声。……録って、高さを変えて、鳴らす。……コロリンも、DJの技、でしたか。' },
  { t: 'say', who: 'OBOLON', text: 'ぜんぶ、、、DJの、材料だ。' },
  { t: 'say', who: 'OBOLON', text: '浴びる、だけの側から、、、混ぜて、届ける、側へ。', hold: true },

  // D08-S010 全員、DJ／札2が開く
  { t: 'say', who: 'KIMORIN', text: '……星をめぐりながら、レコード箱に、材料を詰めていたのですね。きのう回したのも、その材料でした。' },
  { t: 'say', who: 'KIMORIN', text: '……台所にあるもの、では、なかったのですね。' },
  { t: 'se', sound: 'riddle' },
  { t: 'seal', n: 2, open: true }, // 札2のひびが割れ、「Obolo Orderは全員……」の続きに「DJ」の字。札1に星図の線と灯り（閉じたまま）
  { t: 'caption', text: '謎2が開いた' },
  { t: 'say', who: 'OBOLON', text: '謎は、8つ。' },
  { t: 'say', who: 'OBOLON', text: '残りは、、、Obolo Orderとして、確かめに行け。' },
  // 札7「コスモスは」の字が、かすかに光る
  { t: 'say', who: 'KIMORIN', text: '……コスモス。宝のありかの、あれですね。' },
  { t: 'say', who: 'OBOLON', text: '、、、Obolo Orderに、なってから、考えろ。' },
  { t: 'sprite', image: null },
  { t: 'whiteout' },

  // D08-S010b 記録 I　ナガレ（全員が見る。3日目のロケットで見せた断片が、ここで全部つながる）
  { t: 'screen', open: true }, // Bluenaのスクリーンに、門の前のMONBAN
  { t: 'say', who: 'MONBAN', text: '……よく見ておけ…。これが…ナガレだ…。' },
  { t: 'screen', open: false },
  { t: 'film', id: 'record1', parts: 9 },
  { t: 'still', image: 's/sun-inside' }, // 白い光の中。{neo}と{bati}、KIMORINとピンポンくん。遠くで光の玉が回っている
  { t: 'se', sound: 'riddle' },
  { t: 'seal', n: 4, open: true }, // 札4の続きに「ナガレ」の字
  { t: 'caption', text: '謎4が開いた' },
  { t: 'sprite', image: ['kimorin-sun', 'obolon'] },
  { t: 'say', who: 'OBOLON', text: '、、、敵は、人では、ない。', hold: true },
  { t: 'say', who: 'KIMORIN', text: '……なるほど……全然わからん。' },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちは、、、もう、あの流れの、外に、いる。' },

  // D08-S003 エクリプスを受けるか
  { t: 'label', id: 'decide' },
  { t: 'bgm', track: 'earth-decide' },
  { t: 'ticket', flip: true }, // 金色の切符の裏の星図。土星〜金星を通って太陽まで。その外で錠の天王星と海王星が、うっすら光る
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。決めるのは、お前だ。' },
  { t: 'screen', open: true },
  { t: 'say', who: 'MONBAN', text: '……エクリプスを受けなくても、お前は、住人のままだ…。それも、道だ…。' },
  { t: 'say', who: 'MONBAN', text: '……受けるなら、今、ここで、始められる…。' },
  { t: 'label', id: 'decide-choice' },
  { t: 'choice', key: 'f_d08_decide', options: [{ label: 'エクリプスを受ける', goto: 'pay' }, { label: '今は、住人のままでいる' }] },

  // D08-S005 住人のままでいる
  { t: 'say', who: 'MONBAN', text: '……そうか…。' },
  { t: 'say', who: 'MONBAN', text: '……いつでも、来い…。' },
  { t: 'screen', open: false },
  { t: 'say', who: 'KIMORIN', text: '……では、私も、もう少しだけ、考えます。決して、怖気づいたわけでは、ありません。' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-earth' }, // ロケットが、太陽から地球へ戻る。窓の外に、金色の線でつながった五つの星
  { t: 'bgm', track: 'farewell' },
  { t: 'notice', text: '住人のまま、いつでも星に戻れます。作ったもの・届けたもの・金星のDJ・声のコロリンは、ずっと使えます' },
  { t: 'notice', text: 'マナを使って新しく作る時、天王星・海王星の扉、二周目の物語は、エクリプスを受けてから。太陽の神殿で、いつでも受けられます' },
  { t: 'action', label: '宇宙の地図へ' },
  { t: 'end' },
  // 再開した人（太陽の神殿に戻ってきた住人）：光の中に、OBOLON → 星図のあとの二択へ
  { t: 'label', id: 'resume' },
  { t: 'still', image: 's/sun-inside' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'goto', id: 'decide' },

  // D08-S006 エクリプスを始める（支払いは本人の手で）
  { t: 'label', id: 'pay' },
  { t: 'say', who: 'MONBAN', text: '……分かった…。' },
  { t: 'say', who: 'MONBAN', text: '……この先は、お前の手で、押せ…。' },
  { t: 'order', cancel: 'back' },
  { t: 'say', who: 'MONBAN', text: '……よし、分かった…。' },
  { t: 'screen', open: false },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……お待ちなさい。' },
  { t: 'say', who: 'KIMORIN', text: '私も、Obolo Orderになることにしました。' },
  { t: 'say', who: 'KIMORIN', text: '……母に、言ってやりました。そうしたら、『88円なら、なっておきなさい』と。' },
  { t: 'say', who: 'KIMORIN', text: '私は、発明家です。新しい発明は、新しい体験に、こそ、あります。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、私は、全ての謎を解き明かし、コスモスを見つけ、宝を、手に入れてみせます。' },
  { t: 'say', who: 'KIMORIN', text: 'それを、母に、プレゼントするのです！' },
  { t: 'say', who: 'KIMORIN', text: 'はははははは！' },
  { t: 'goto', id: 'eclipse' },
  // the payment screen's 「戻る」
  { t: 'label', id: 'back' },
  { t: 'say', who: 'MONBAN', text: '戻るか…。' },
  { t: 'goto', id: 'decide-choice' },

  // D08-S011 エクリプス
  { t: 'label', id: 'eclipse' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/sun-inside' }, // 黒い球が、遠くの大きな光の玉に重なる。光が隠れて、金色の輪だけが残る
  { t: 'bgm', track: 'eclipse' }, // 音楽が、静かに始まる
  { t: 'se', sound: 'magic' }, // 金色の輪から、光の粒が、雪のように降ってくる。{neo}の胸に、小さな光の泉
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……あたたかい光ですね。これで、{neo}も私も、Obolo Order……ということで、よろしいのですか？' },
  { t: 'caption', text: 'Obolo Orderになった' },
  { t: 'seal', n: 1, open: true }, // 札1「oboloとは」の細い線と灯りが光り、札がほどける
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: 'oboloは、、、町の名前だ。', hold: true },
  { t: 'say', who: 'OBOLON', text: 'DJの、、、町だ。宇宙にも、、、地球にも、ある。' },
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderが、増えれば、、、oboloも、増える。' },
  { t: 'caption', text: '謎1が開いた' },
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderにだけ、、、見せる、記録がある。' },
  { t: 'sprite', image: null },
  // D08-S011b 記録映像　Obolo Order以外の閲覧を禁ず（記録 II・III）
  { t: 'film', id: 'record23', parts: 16 }, // 記録 II　Obolo Order ／ 記録 III　掟（MONBANの読み上げ）→ 世界の窓に灯り → 宇宙の星
  { t: 'still', image: 's/sun-inside' }, // 白い光の中。金色の輪だけが残っている
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……今度は、少しだけ、わかりました。……少しだけ、ですが。' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null }, // 音楽が、ゆっくり消えていく。白い光の中に、金色の輪だけが残る
  { t: 'caption', text: '一周目の旅、おわり' },
  { t: 'end' },
];
