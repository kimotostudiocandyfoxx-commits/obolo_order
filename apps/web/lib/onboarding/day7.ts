import type { Step } from './script';

/**
 * DAY 7 【火星 → 地球 → 太陽】 the Eclipse day — the story of 2026-10-14 (docs/story-rewrite/
 * 太陽まで_UI引き継ぎ.md §8, D08-S001〜S006; the Sun temple D08-S007〜S012 from wip/P04, review/DAY7.md 8cd8a5d).
 * Back on Earth OBOLON and MONBAN explain: no joining fee — ¥88 a month is the mana that wells up in you
 * after the Eclipse, never raised, stop any time (M-R20). 「今はやめておく」 really stops here (resume at the
 * choice, {bati} comes back from the Moon). 「エクリプスを始める」 → the final confirmation and payment by the
 * visitor's own hand (EclipsePay) → KIMORIN⭐︎ jumps in → the rocket flies into the Sun (story 2026-10-15:
 * no MONBAN, OBOLON only, background sun-inside): riddle 2 「表現者」, the Eclipse, riddle 1 「OBOLOは、街の名前」,
 * the film of the seven days (UI, client 2026-10-14), the letter → 一周目の旅、おわり. Invitations are the
 * second journey's Saturn now.
 * The day ends as an ORDER with no 24-hour wait (StoryDay advances at once).
 * The 88 minutes run in the rocket from Mars; the temples of Earth don't count ('clock' off, M-R22).
 */
export const DAY7: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: '7日目' },
  // D08-S001 地球へ帰る
  { t: 'still', image: 'mars-city' },
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
  { t: 'say', who: 'MONBAN', text: '太陽の神殿で、『エクリプス』をする…。太陽と、お前の魂をつなぐ儀式だ…。\n成功すれば、お前は、ORDERになる…。' },
  { t: 'say', who: 'MONBAN', text: 'ORDERになれば、ほかの星にも行ける…。切符の裏の、錠の星だ…。' },
  { t: 'say', who: 'MONBAN', text: 'それに、エクリプスを受ければ…お前の体から、マナが湧くようになる…。ジェムがなくても、魔法が唱えられる…。' },
  { t: 'say', who: 'MONBAN', text: '……ここには、勝手に流れてくる広告もない…。知らない誰かの『おすすめ』も、流れてこない…。あるのは、誰かが自分の言葉で作ったものだけだ…。灯りは、みんなの88円で、ともしている…。' },
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……ほら、来ました。入会費です。' },
  { t: 'say', who: 'KIMORIN', text: 'ついに、化けの皮が、剥がれましたね。' },
  { t: 'say', who: 'OBOLON', text: '、、、入会費は、ない。' },
  { t: 'say', who: 'KIMORIN', text: '……は？' },
  { t: 'say', who: 'OBOLON', text: 'エクリプスを受けると、、、毎月、体から、マナが湧く。' },
  { t: 'say', who: 'OBOLON', text: 'その分が、、、月に、88円だ。' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: '……つまり、入会費は、タダ、ということですね？' },
  { t: 'say', who: 'OBOLON', text: '、、、そうだ。' },
  { t: 'say', who: 'KIMORIN', text: '……うまい言い方を、しますね。' },
  { t: 'say', who: 'KIMORIN', text: 'では、いくつか、お伺いしましょうか。' },
  { t: 'say', who: 'KIMORIN', text: '月に88円、と言って、あとから、値上がりしていくのでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、値上げは、しない。' },
  { t: 'say', who: 'KIMORIN', text: 'やめたくなったら？　どうせ、やめさせてくれない仕組みでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、いつでも、やめられる。やめ方は、支払いの画面に、書いてある。' },
  { t: 'say', who: 'KIMORIN', text: 'マナは？　足りなくなったら、どうせ、買わせるのでしょう？' },
  { t: 'say', who: 'OBOLON', text: '、、、買い足すことも、できる。でも、毎月湧く分で、十分、遊べる。' },
  { t: 'say', who: 'KIMORIN', text: '……ORDERにならなかったら？　{bati}も、ピンポンくんも、消える？' },
  { t: 'say', who: 'OBOLON', text: '、、、消えない。月で、待っている。作ったものも、見に来られる。' },
  { t: 'say', who: 'うんちピンポンくん', text: '……ピンポン♪' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: 'バカバカしい。私は、帰ります。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、お母さんに、言ってやります。' },
  { t: 'say', who: 'KIMORIN', text: 'さようなら。' },
  { t: 'sprite', image: null }, // ローブの裾をひるがえして、門の外へ。扇の尾が、ぴん、と立っている
  { t: 'say', who: 'MONBAN', text: '……行ったな…。' },
  { t: 'notice', text: '月額88円（毎月のマナの代金）。値上げはしません。いつでもやめられます。やめ方は、支払いの画面に書いてあります' },

  // D08-S003 選べる一手
  { t: 'label', id: 'decide' },
  { t: 'ticket', flip: true }, // 金色の切符の裏の星図。土星〜火星までつながって止まり、錠の金星・天王星・海王星、いちばん奥に太陽
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。決めるのは、お前だ。' },
  { t: 'say', who: 'MONBAN', text: 'ORDERにならなければ、ネオのまま、ここで止まる…。それも、道だ…。' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'ボクは、どっちでもいいよ。{neo}が決めたほうで、待ってる。' },
  { t: 'sprite', image: null },
  { t: 'say', who: 'MONBAN', text: '払えるなら、今からエクリプスを始める…。' },
  { t: 'label', id: 'decide-choice' },
  { t: 'choice', key: 'f_d08_decide', options: [{ label: 'エクリプスを始める', goto: 'pay' }, { label: '今はやめておく' }] },
  { t: 'say', who: 'MONBAN', text: '……そうか。' },

  // D08-S005 今はやめておく（ここで止まる）
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'じゃあ、ボク、月で待ってるね。' }, // 手を振って、光につつまれて月のほうへ
  { t: 'sprite', image: null },
  { t: 'say', who: 'MONBAN', text: '{bati}は、月で待っている…。\nいつでも、会いにこい…。' },
  { t: 'notice', text: 'いつ戻っても、今日のこの場面から続きを遊べます。作ったものと手紙は、いつでも見られます' },
  { t: 'pause', resume: 'resume' }, // 〔ボタン：月の{bati}に会いに行く〕
  // 再開した人：光につつまれて、{bati}が月から戻ってくる → 星図のあとの二択へ
  { t: 'label', id: 'resume' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'おかえり、{neo}！' },
  { t: 'sprite', image: null },
  { t: 'say', who: 'MONBAN', text: '……来たか。決まったか…？' },
  { t: 'goto', id: 'decide-choice' },

  // D08-S006 エクリプスを始める（支払いは本人の手で）
  { t: 'label', id: 'pay' },
  { t: 'say', who: 'MONBAN', text: '……分かった。' },
  { t: 'say', who: 'MONBAN', text: 'この先は、お前の手で、押せ…。' },
  { t: 'order', cancel: 'back' },
  { t: 'say', who: 'MONBAN', text: 'よし、分かった。' },
  { t: 'say', who: 'MONBAN', text: 'それでは、エクリプス用のロケットに案内する。' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'still', image: 's/launch-pit' }, // ロケットの扉が、ゆっくり閉まっていく
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 外から
  { t: 'sprite', image: 'kimorin-sun' }, // 閉まりかけた扉のすき間に、白い面がぬっと差しこまれる
  { t: 'say', who: 'KIMORIN', text: 'そのロケットに、私も、乗ります。' },
  { t: 'say', who: 'KIMORIN', text: '……お待たせいたしました。私も、ORDERになることにしました。' }, // 扉がもう一度開く。裾を整えて乗りこんでくる
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'バティ', text: 'KIMORIN⭐︎！' },
  { t: 'say', who: 'KIMORIN', text: '……母に、言ってやりました。そうしたら、『88円なら、なっておきなさい』と。' },
  { t: 'say', who: 'KIMORIN', text: '私は、発明家です。新しい発明は、新しい体験に、こそ、あります。' },
  { t: 'say', who: 'KIMORIN', text: 'そして、私は、全ての謎を解き明かし、コスモスを見つけ、宝を、手に入れてみせます。' },
  { t: 'say', who: 'KIMORIN', text: 'それを、母に、プレゼントするのです！' },
  { t: 'say', who: 'KIMORIN', text: 'はははははは！' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' }, // 扉が閉まる。ロケットが、太陽へ飛び立つ
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

  // D08-S009 「わかりやすく、言う。」
  { t: 'branch', key: 'd1.choice1', cases: { 行きたい: 'easy-talk', 行きたくない: 'easy-talk', まだわかんない: 'easy-talk' }, otherwise: 'easy-quiet' },
  { t: 'label', id: 'easy-talk' },
  { t: 'say', who: 'OBOLON', text: '{neo}、1日目に、\n言いかけたこと、覚えてるか。' },
  { t: 'goto', id: 'easy' },
  { t: 'label', id: 'easy-quiet' },
  { t: 'say', who: 'OBOLON', text: '{neo}、旅で何度も、\n聞きかけた言葉が、あるな。' },
  { t: 'label', id: 'easy' },
  { t: 'say', who: 'OBOLON', text: 'わかりやすく、言う。' },
  { t: 'say', who: 'OBOLON', text: '旅で、もう、うすうす、気づいているかもしれないが、、、' },
  { t: 'say', who: 'OBOLON', text: 'OBOLO ORDERは、全員、、、表現者、なんだ。' },
  { t: 'say', who: 'OBOLON', text: '土星の輪、木星の蝶、\n水星の船、火星の光。' }, // 光の玉に、四つの景色が順に映る

  // D08-S010 全員、表現者／札2が開く
  { t: 'say', who: 'KIMORIN', text: '土星も木星も水星も火星も、ぜんぶ、そのための旅だったのですね。' },
  { t: 'se', sound: 'chime' },
  { t: 'seal', n: 2, open: true }, // 札2のひびが割れ、「OBOLO ORDERは全員……」の続きに「表現者」の字
  { t: 'caption', text: '謎2が開いた' },
  { t: 'say', who: 'OBOLON', text: '謎は、8つ。、、、今日、1つ開いた。' },
  { t: 'say', who: 'OBOLON', text: '残りの7つは、、、ORDERとして、確かめに行け。' },
  { t: 'sprite', image: ['obolon', '@bati'] }, // 札7「コスモスは」の字が、かすかに光る
  { t: 'say', who: 'バティ', text: 'コスモス……{food}の仲間かな。' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '食べ物では、ないと思いますよ。' },
  { t: 'say', who: 'OBOLON', text: '、、、ORDERに、なってから、考えろ。' },
  { t: 'sprite', image: null },
  { t: 'whiteout' },

  // D08-S011 エクリプス
  { t: 'still', image: 's/sun-inside' }, // 黒い球が、遠くの大きな光の玉に重なる。光が隠れて、金色の輪だけが残る
  { t: 'bgm', track: 'obolon' }, // 音楽が、静かに始まる
  { t: 'se', sound: 'magic' }, // 金色の輪から、光の粒が、雪のように降ってくる。{neo}の胸に、小さな光の泉
  { t: 'sprite', image: ['kimorin-sun', '@bati'] },
  { t: 'say', who: 'バティ', text: '……{neo}？\nからだが、あったかい！' },
  { t: 'say', who: 'KIMORIN', text: '……あたたかい光ですね。これで、{neo}も私も、ORDER……ということで、よろしいのですか？' },
  { t: 'caption', text: 'ORDERになった' },
  { t: 'seal', n: 1, open: true }, // 札1「OBOLOとは」の細い線と灯りが光り、札がほどける
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: 'OBOLOは、、、街の名前だ。' },
  { t: 'caption', text: '謎1が開いた' },
  { t: 'sprite', image: null },
  { t: 'made', what: 'film' }, // 上映「{neo}の7日間」（UI、クライアント 2026-10-14）
  { t: 'letter', text: '{neo}へ\nようこそ、宇宙へ✌️\nby {inviter}' }, // 光の中に、小さな封筒が一つ、ふわりと浮かぶ
  { t: 'choice', key: 'f_d08_letter', options: [{ label: '大事にしまう' }, { label: 'あとで' }] },
  { t: 'bgm', track: null }, // 音楽が、ゆっくり消えていく。白い光の中に、金色の輪だけが残る
  { t: 'caption', text: '一周目の旅、おわり' },
  { t: 'end' },
];
