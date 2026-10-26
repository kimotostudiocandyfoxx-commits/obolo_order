import type { Step } from './script';

/**
 * DAY 7 【火星 → 地球 → 太陽】 the Eclipse day — the story of 2026-10-14 (docs/story-rewrite/
 * 太陽まで_UI引き継ぎ.md §8, D08-S001〜S006; the Sun temple D08-S007〜S012 from wip/P04, review/DAY7.md 8cd8a5d).
 * Back on Earth OBOLON and MONBAN explain: no joining fee — ¥88 a month is the mana that wells up in you
 * after the Eclipse, never raised, stop any time (M-R20). 「今はやめておく」 really stops here (resume at the
 * choice, {bati} comes back from the Moon). 「エクリプスを始める」 → the final confirmation and payment by the
 * visitor's own hand (EclipsePay) → KIMORIN⭐︎ jumps in → the rocket flies into the Sun (story 2026-10-15:
 * no MONBAN, OBOLON only, background sun-inside): riddle 2 「DJ」 (M-R86), the Eclipse, riddle 1 「oboloは、町の名前」,
 * the archive films (M-R90), riddle 4 「ナガレ」 → 一周目の旅、おわり (the film of the seven days was taken out, client 2026-10-26). Invitations are the
 * second journey's Saturn now.
 * The day ends as an ORDER with no 24-hour wait (StoryDay advances at once).
 * The 88 minutes run in the rocket from Mars; the temples of Earth don't count ('clock' off, M-R22).
 */
export const DAY7: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: '7日目' },
  // D08-S001 地球へ帰る
  { t: 'still', image: 's/mars-screens' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'ヒポキン', text: 'おはよう。……見学は、終わりだな。地球へ帰れ。' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。……では、問いただしに参りましょう。この結社の、本当の狙いを。' },
  { t: 'action', label: 'ロケットで地球に帰る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'clock', on: true },
  { t: 'still', image: 's/rocket-earth' },

  // D08-S002 OBOLONの「おかえり」と、KIMORINの質問
  { t: 'clock', on: false },
  { t: 'video', motion: 12 },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 },
  { t: 'caption', text: '地球の神殿に戻った' },
  { t: 'say', who: 'OBOLON', text: '、、、おかえり。' },
  { t: 'say', who: 'OBOLON', text: '4つの星は、、、どうだった？' },
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
  { t: 'say', who: 'MONBAN', text: '……見学は、終わりだ…。ここで、決めていい…。急がなくていい…。' },
  { t: 'say', who: 'MONBAN', text: '太陽の神殿で、『エクリプス』をする…。太陽と、お前の魂をつなぐ儀式だ…。\n成功すれば、お前は、Obolo Orderになる…。' },
  { t: 'say', who: 'MONBAN', text: 'Obolo Orderになれば、ほかの星にも行ける…。切符の裏の、錠の星だ…。' },
  { t: 'say', who: 'MONBAN', text: 'それに、エクリプスを受ければ…お前の体から、マナが湧くようになる…。ジェムがなくても、魔法が唱えられる…。' },
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
  { t: 'say', who: 'OBOLON', text: '、、、消えない。月で、待っている。作ったものも、見に来られる。' },
  { t: 'say', who: 'うんちピンポンくん', text: '……ピンポン♪' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: 'バカバカしい。私は、帰ります。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、お母さんに、言ってやります。' },
  { t: 'say', who: 'KIMORIN', text: 'さようなら。' },
  { t: 'sprite', image: null }, // ローブの裾をひるがえして、門の外へ。扇の尾が、ぴん、と立っている
  { t: 'say', who: 'MONBAN', text: '……行ったな…。' },
  { t: 'notice', text: '月額88円（毎月88マナの代金）。値上げはしません。いつでもやめられます。やめ方は、支払いの画面に書いてあります' },
  { t: 'notice', text: '旅で使ったマナのめやす｜姿を変える 3マナ／コロリン 1マナ／ジャケットの絵（{bati}が描く時） 3マナ／曲 2マナ／MV 8マナ。写真や字だけのジャケットは、マナを使いません' },

  // D08-S003 選べる一手
  { t: 'label', id: 'decide' },
  { t: 'ticket', flip: true }, // 金色の切符の裏の星図。土星〜火星までつながって止まり、錠の金星・天王星・海王星、いちばん奥に太陽
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。決めるのは、お前だ。' },
  { t: 'say', who: 'MONBAN', text: 'Obolo Orderにならなければ、ネオのまま、ここで止まる…。それも、道だ…。' },
  { t: 'say', who: 'MONBAN', text: '払えるなら、今からエクリプスを始める…。' },
  { t: 'label', id: 'decide-choice' },
  { t: 'choice', key: 'f_d08_decide', options: [{ label: 'エクリプスを始める', goto: 'pay' }, { label: '今はやめておく' }] },
  { t: 'say', who: 'MONBAN', text: '……そうか…。' },

  // D08-S005 今はやめておく（ここで止まる）
  // {bati}が手を振って、光につつまれて月のほうへ
  { t: 'say', who: 'MONBAN', text: '{bati}は、月で待っている…。\nいつでも、会いにこい…。' },
  { t: 'notice', text: 'いつ戻っても、今日のこの場面から続きを遊べます。作ったものと招待状は、いつでも見られます' },
  { t: 'pause', resume: 'resume' }, // 〔ボタン：月の{bati}に会いに行く〕
  // 再開した人：光につつまれて、{bati}が月から戻ってくる → 星図のあとの二択へ
  { t: 'label', id: 'resume' },
  // 光につつまれて、{bati}が月から戻ってくる
  { t: 'say', who: 'MONBAN', text: '……来たか。決まったか…？' },
  { t: 'goto', id: 'decide-choice' },

  // D08-S006 エクリプスを始める（支払いは本人の手で）
  { t: 'label', id: 'pay' },
  { t: 'say', who: 'MONBAN', text: '……分かった…。' },
  { t: 'say', who: 'MONBAN', text: 'この先は、お前の手で、押せ…。' },
  { t: 'order', cancel: 'back' },
  { t: 'say', who: 'MONBAN', text: '……よし、分かった…。' },
  { t: 'say', who: 'MONBAN', text: '……エクリプス用のロケットに、案内する…。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'still', image: 's/launch-pit' }, // ロケットの扉が、ゆっくり閉まっていく
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 外から
  { t: 'sprite', image: 'kimorin-sun' }, // 閉まりかけた扉のすき間に、白い顔がぬっと差しこまれる
  { t: 'say', who: 'KIMORIN', text: 'そのロケットに、私も、乗ります。' },
  { t: 'say', who: 'KIMORIN', text: '……お待たせいたしました。私も、Obolo Orderになることにしました。' }, // 扉がもう一度開く。裾を整えて乗りこんでくる
  { t: 'say', who: 'KIMORIN', text: '……母に、言ってやりました。そうしたら、『88円なら、なっておきなさい』と。' },
  { t: 'say', who: 'KIMORIN', text: '私は、発明家です。新しい発明は、新しい体験に、こそ、あります。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、私は、全ての謎を解き明かし、コスモスを見つけ、宝を、手に入れてみせます。' },
  { t: 'say', who: 'KIMORIN', text: 'それを、母に、プレゼントするのです！' },
  { t: 'say', who: 'KIMORIN', text: 'はははははは！' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'rocket' }, // 扉が閉まる。ロケットが、太陽へ飛び立つ
  { t: 'goto', id: 'sun' },
  // the payment screen's 「戻る」
  { t: 'label', id: 'back' },
  { t: 'say', who: 'MONBAN', text: '戻るか…。' },
  { t: 'goto', id: 'decide' },

  // D08-S007 太陽の中へ
  { t: 'label', id: 'sun' },
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
  { t: 'say', who: 'OBOLON', text: '、、、お前は、もう、ネオじゃない。' },
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
  { t: 'say', who: 'OBOLON', text: '土星の輪、木星の蝶、\n水星の船、火星の光。' }, // 光の玉に、四つの景色が順に映る。KIMORINのコロリンが「ぷりぷりぷりり！」
  { t: 'say', who: 'KIMORIN', text: '……私の声。……録って、高さを変えて、鳴らす。……コロリンも、DJの技、でしたか。' },
  { t: 'say', who: 'OBOLON', text: 'ぜんぶ、、、DJの、材料だ。' },
  { t: 'say', who: 'OBOLON', text: '浴びる、だけの側から、、、混ぜて、届ける、側へ。', hold: true },

  // D08-S010 全員、DJ／札2が開く
  { t: 'say', who: 'KIMORIN', text: '……七日かけて、レコード箱に、材料を詰めていたのですね。' },
  { t: 'say', who: 'KIMORIN', text: '……台所にあるもの、では、なかったのですね。' },
  { t: 'se', sound: 'chime' },
  { t: 'seal', n: 2, open: true }, // 札2のひびが割れ、「Obolo Orderは全員……」の続きに「DJ」の字。札1に星図の線と灯り（閉じたまま）
  { t: 'caption', text: '謎2が開いた' },
  { t: 'say', who: 'OBOLON', text: '謎は、8つ。' },
  { t: 'say', who: 'OBOLON', text: '残りは、、、Obolo Orderとして、確かめに行け。' },
  // 札7「コスモスは」の字が、かすかに光る
  { t: 'say', who: 'KIMORIN', text: '……コスモス。宝のありかの、あれですね。' },
  { t: 'say', who: 'OBOLON', text: '、、、Obolo Orderに、なってから、考えろ。' },
  { t: 'sprite', image: null },
  { t: 'whiteout' },

  // D08-S011 エクリプス
  { t: 'still', image: 's/sun-inside' }, // 黒い球が、遠くの大きな光の玉に重なる。光が隠れて、金色の輪だけが残る
  { t: 'bgm', track: 'eclipse' }, // 音楽が、静かに始まる（エクリプスの曲、2026-10-25）
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
  // D08-S011b 記録映像 (M-R90/M-R104): MONBAN on the Bluena screen, then the archive film (Record I so far)
  { t: 'say', who: 'OBOLON', text: 'Obolo Orderにだけ、、、見せる、記録がある。' },
  { t: 'sprite', image: null },
  { t: 'screen', open: true }, // Bluenaのスクリーンに、門の前のMONBAN
  { t: 'say', who: 'MONBAN', text: '……よく見ておけ…。これが…ナガレだ…。' },
  { t: 'screen', open: false },
  { t: 'film', id: 'record1', parts: 9 }, // 記録 I　ナガレ
  { t: 'film', id: 'record23', parts: 16 }, // 記録 II　Obolo Order ／ 記録 III　掟（MONBANの読み上げ）→ 世界の窓に灯り → 宇宙の星
  // 白い光の中。金色の輪だけが残っている
  { t: 'se', sound: 'chime' },
  { t: 'seal', n: 4, open: true }, // 札4の続きに「ナガレ」の字
  { t: 'caption', text: '謎4が開いた' },
  { t: 'sprite', image: ['kimorin-sun', 'obolon'] },
  { t: 'say', who: 'OBOLON', text: '、、、敵は、人では、ない。', hold: true },
  { t: 'say', who: 'KIMORIN', text: '……なるほど……全然わからん。' },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null }, // 音楽が、ゆっくり消えていく。白い光の中に、金色の輪だけが残る
  { t: 'caption', text: '一周目の旅、おわり' },
  { t: 'end' },
];
