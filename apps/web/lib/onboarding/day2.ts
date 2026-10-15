import type { Step } from './script';

/**
 * DAY 2 【地球 → 月】 — the story of 2026-10-14 (docs/story-rewrite/土星まで_UI引き継ぎ.md §9,
 * D02-S001〜D03-S009). Starts after the email check (StoryDay).
 * KIMORIN is no longer a guide: a fellow invited guest, "天才発明家", who appears behind you at the gate
 * and travels with you as a NEO. Then the rocket to the Moon, the NEO look and name, and the Bati is
 * born — all on day 2 (the old day 3 moved here, so every later day came one day earlier).
 * Pictures: Day-1 motions for the HQ (6, 7/9, 11, 12–13, 14–15, 27–28); Seedream stills for the rest
 * (public/onboarding/s, design/story-art-queue.json); KIMORIN: kimorin-1 → after the Moon kimorin-sun
 * (a dragon wing, round sunglasses on the forehead).
 * Saved: the ticket; f_d03_neo_mode / card / redraw happen inside the look; the NEO name, the look,
 * the favourite food and the Bati's name. 「やめておく」 at D02-S004 ends the day (resume at the choice).
 */
export const DAY2: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: '2日目' },
  // D02-S001 宇宙行きの切符
  { t: 'ticket' }, // 細長い金色の切符。下に、星の形のスタンプ欄が4つ（土星・木星・水星・火星）
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '宇宙行きの切符を手に入れた' },
  { t: 'action', label: '本部へ向かう' },

  // D02-S002 お待ちなさい
  { t: 'video', motion: '2-3' }, // 雲を抜けて本部へ
  { t: 'loop', motion: 6 },
  { t: 'action', label: '中に入る' },
  // 門の光の中へ一歩 — 扉が閉まって、それからMONBANが現れる（クライアント 2026-10-15：動画7を二つに分けた）
  { t: 'video', motion: '7-a' }, // 門に寄っていき、扉が閉まる
  { t: 'bgm', track: null },
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' },
  { t: 'sprite', image: 'kimorin-1' }, // ふり返ると、深い赤のローブ、狐の耳の白い面
  { t: 'bgm', track: 'monban' },
  { t: 'video', motion: '7-b' }, // 黒い煙が湧き、MONBANが現れる
  { t: 'loop', motion: 9 },
  { t: 'sprite', image: ['', 'kimorin-1'] },
  { t: 'say', who: 'MONBAN', text: '誰だお前…。' },
  { t: 'say', who: 'KIMORIN', text: '私ですか？　私は、天才発明家、KIMORINです。' },
  { t: 'say', who: 'MONBAN', text: 'ここは秘密結社だ…帰れ…。' },
  { t: 'say', who: 'KIMORIN', text: '秘密結社？　……なんとも、怪しい。' },
  { t: 'say', who: 'KIMORIN', text: 'でも、帰れば失礼なのでは？　なぜなら私は、招待客なのですよ？' },
  { t: 'say', who: 'MONBAN', text: '……なんだ、招待客か…。入っていいぞ…。' },
  { t: 'sprite', image: 'kimorin-1' }, // こちらに向き直る
  { t: 'say', who: 'KIMORIN', text: '何ですか、あなたは。もしかして、あなたも招待客？' },
  { t: 'say', who: 'KIMORIN', text: '気をつけなさい。私は、この世のすべての仕組みを理解しているので、わかります。' },
  { t: 'say', who: 'KIMORIN', text: 'こいつらは、大してすごくもないことを、めちゃくちゃすごそうに言い、そのあとに、超高額の入会費を請求してくるに違いありません。' },
  { t: 'say', who: 'KIMORIN', text: 'まあ、このKIMORINが、こいつらの正体を暴いてみせましょう。' },
  { t: 'say', who: 'KIMORIN', text: 'さあ、それでは入りましょう。' },
  { t: 'sprite', image: null },
  { t: 'video', motion: 11 }, // 門が開き、光の中へ

  // D02-S004 お金は、かからない
  { t: 'video', motion: 12 },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 },
  { t: 'say', who: 'OBOLON', text: '{name}、待ってた。' },
  { t: 'sprite', image: ['', 'kimorin-1'] },
  { t: 'say', who: 'OBOLON', text: '俺の名前はOBOLON、双子座だ。' },
  { t: 'say', who: 'KIMORIN', text: '……なんやこいつ。' },
  { t: 'say', who: 'OBOLON', text: 'ここは、宇宙秘密結社だ。' },
  { t: 'say', who: 'KIMORIN', text: '宇宙秘密結社……。' },
  { t: 'say', who: 'OBOLON', text: '実はな、お前は、、、' },
  { t: 'say', who: 'OBOLON', text: '、、、もう宇宙にいる。' },
  { t: 'video', motion: 14 }, // 天井が夜空、金の輪をまとった地球
  { t: 'loop', motion: 15 },
  { t: 'sprite', image: ['', 'kimorin-1'] },
  { t: 'say', who: 'KIMORIN', text: '……め、めちゃくちゃすごい……！' },
  { t: 'say', who: 'KIMORIN', text: '……いえ。まあまあ、ですね。' },
  { t: 'say', who: 'OBOLON', text: '、、、お前は、宇宙に、行ってみたいと思うか？' },
  { t: 'say', who: 'KIMORIN', text: 'う、、、宇宙？' },
  { t: 'say', who: 'KIMORIN', text: '……お金が、かかりますよね？　もちろん。' },
  { t: 'say', who: 'OBOLON', text: '、、、かからない。' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: 'では、行きます。宇宙行きの切符、私の家に、送っといてください。' },
  { t: 'bgm', track: 'monban' },
  { t: 'video', motion: 27 }, // 黒い煙が湧き、MONBANが現れる。手に、小さな石と、古い革の本
  { t: 'loop', motion: 28 },
  { t: 'sprite', image: ['', 'kimorin-1'] },
  { t: 'say', who: 'MONBAN', text: '……これを、持っていけ…。マナジェムと…謎の書だ…。' },
  { t: 'say', who: 'MONBAN', text: 'この結社には…謎が、8個ある…。' },
  { t: 'say', who: 'KIMORIN', text: 'なんやこれ！　光っとる！　どういう仕組みや！' },
  { t: 'say', who: 'KIMORIN', text: 'ふんふ、ふーん♪　宇宙、宇宙♪　うっちゅう、うっちゅう〜♪' }, // 鼻歌。門の外へ歩いていく
  // KIMORIN becomes a point of light in the sky … and is back at once with the golden ticket
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/ticket' },
  { t: 'se', sound: 'whoosh' },
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'どういう仕組みかわからんけど……24時間、スキップできた！' },
  { t: 'loop', motion: 13 },
  { t: 'bgm', track: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。二人、そろったな。' },
  { t: 'say', who: 'OBOLON', text: '、、、では、、、宇宙へ、行こう。' },
  { t: 'sprite', image: ['', 'kimorin-1'] },
  { t: 'say', who: 'KIMORIN', text: '下、ですか。宇宙なのに。' },
  { t: 'label', id: 'trip' },
  { t: 'choice', key: 'go', options: [{ label: 'KIMORINと宇宙に行ってみる', goto: 'go' }, { label: 'やめておく' }] },
  { t: 'say', who: 'KIMORIN', text: '……そうですか。では、待っています。' },
  { t: 'pause', resume: 'trip' }, // 今日はここで終わる。次に開くと、この選択から

  // D02-S009 ロケットで、月へ
  { t: 'label', id: 'go' },
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 's/launch-pit' },
  { t: 'sprite', image: null },
  { t: 'caption', text: 'ロケット発射場に着いた' },
  { t: 'sprite', image: ['monban', 'kimorin-1'] },
  { t: 'sprite', image: ['monban', 'obolon', 'kimorin-1'] },
  { t: 'say', who: 'KIMORIN', text: 'MONBAN、あなたは、乗らないのですか？' },
  { t: 'say', who: 'MONBAN', text: '俺は…門を、守る必要がある…。' },
  { t: 'say', who: 'OBOLON', text: '俺が、、、月に、先に行って、待ってる。だから、、、大丈夫だ。' },
  { t: 'sprite', image: ['monban', '', 'kimorin-1'] }, // 光の柱が、縦穴を上へ抜けていく
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/rocket-space' },
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: '……浮いています。私の尾が、扇のまま、浮いています。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/rocket-moon' },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/moon-surface' },
  { t: 'caption', text: '月に着いた' },

  // D03-S003 月の神殿／パーティー好きのドラゴン（2日目のまま続く）
  { t: 'bgm', track: 'obolon' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'say', who: 'OBOLON', text: 'ちなみに、、、秘密結社は、初めてか？' },
  { t: 'choice', key: 'times', options: [{ label: '1回目' }, { label: '2回目' }, { label: '3回目以上' }] },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
  { t: 'sprite', image: ['obolon', 'kimorin-1'] },
  { t: 'say', who: 'OBOLON', text: 'KIMORINは？' },
  { t: 'say', who: 'KIMORIN', text: '私は、、、、、、12回目です。' },
  { t: 'se', sound: 'ding' }, // ポチッ。ピンポンピンポン♪
  { t: 'say', who: 'KIMORIN', text: '気になりますか？　これが。' },
  { t: 'say', who: 'KIMORIN', text: 'これは私が発明した、持ち運び式完全肯定型デバイス『ピンポーン』です。' },
  { t: 'say', who: 'KIMORIN', text: '人生を生きていたら、なんと答えればいいかわからない。そんな場面に、よく遭遇します。' },
  { t: 'say', who: 'KIMORIN', text: '変な答えを言ってしまったらどうしよう。間違えていたらどうしよう。と、頭を抱える人も少なくない。' },
  { t: 'say', who: 'KIMORIN', text: 'しかし、このピンポーンさえあれば、もう安心。' },
  { t: 'say', who: 'KIMORIN', text: 'どんな適当なことを言っても、間違ったことを言ったとしても、ボタン一つで、必ず正解してしまうのです！' },
  { t: 'say', who: 'KIMORIN', text: 'さらに、気づきましたか？' },
  { t: 'say', who: 'KIMORIN', text: 'この『秘密結社は何回目？』という質問。実は、引っかけ問題なのです。' },
  { t: 'say', who: 'KIMORIN', text: 'もし本当に秘密結社に入ったことがあるとして、2回目、3回目と答えてしまった場合。それは、過去に秘密結社に入っていたという秘密を、自ら暴露していることになります。' },
  { t: 'say', who: 'KIMORIN', text: 'そんな口の軽いやつは、OBOLO ORDERになる資格はない。ここで脱落。' },
  { t: 'say', who: 'KIMORIN', text: 'そう、私たちは、試されていたのです！' },
  { t: 'se', sound: 'ding' },
  { t: 'say', who: 'KIMORIN', text: 'ふ、、、また正解してしまった。' },
  { t: 'say', who: 'OBOLON', text: '、、、いや。ORDERになる資格を試したり、脱落など、存在しない。' },
  { t: 'say', who: 'OBOLON', text: 'そもそも、OBOLO ORDERは、完全招待制だ。招待された者しか、来られない。それだけで、十分だ。' },
  { t: 'say', who: 'OBOLON', text: 'それに、ここのことを、外で話したかったら、話していい。' },
  { t: 'say', who: 'OBOLON', text: 'ただ、一つだけ、条件がある。姿と名前を、変えることだ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、姿と名前に、なってもらう。その姿と名前で話すのなら、問題は、ない。' },
  { t: 'say', who: 'OBOLON', text: 'それでは、、、秘密結社としての姿に、なってもらう。' },
  { t: 'say', who: 'OBOLON', text: 'どんな見た目に、なりたい？　教えてくれたら、俺が魔法を唱えて、その姿にする。' },
  { t: 'say', who: 'KIMORIN', text: '魔法？　……魔法、使えるのですか？' },
  { t: 'say', who: 'OBOLON', text: '使える。お前も、宇宙を旅していたら、、、そのうち、使えるようになる。' },
  { t: 'say', who: 'KIMORIN', text: 'え、マジで？' },
  { t: 'say', who: 'KIMORIN', text: 'じゃあ、どんな見た目にも、なれるん？' },
  { t: 'say', who: 'OBOLON', text: 'なれる。だが、、、最初は、いっぱいを望みすぎないほうがいい。変になるから。' },
  { t: 'say', who: 'OBOLON', text: '旅を続けて、自分で魔法を使えるようになったら、、、ちょっとずつ、好きな見た目に変わっていくのが、いい。' },
  { t: 'say', who: 'KIMORIN', text: 'そうか、、、、じゃあ、、' },
  { t: 'say', who: 'KIMORIN', text: '筋肉ムキムキの、腕80本の、パーティーが大好きなドラゴン！' },
  { t: 'say', who: 'OBOLON', text: '、、、本当に、大丈夫か？' },
  { t: 'say', who: 'KIMORIN', text: '大丈夫です。私は、人生で一回も、失敗したことがありませんので。' },
  { t: 'se', sound: 'magic' }, // 水盤の水が立ち上がり、KIMORINを包む
  { t: 'sprite', image: 'kimorin-dragon' },
  { t: 'se', sound: 'pop' }, // 80本の腕が、いっせいにクラッカー
  { t: 'se', sound: 'pop' },
  { t: 'se', sound: 'sparkle' },
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、戻してください。' },
  { t: 'se', sound: 'magic' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] }, // 尾のあいだにドラゴンの羽一枚、おでこに丸いサングラス
  { t: 'say', who: 'KIMORIN', text: '……これは、足し算しまくり、いいものを見つけ、それ以外を引き算する。そういう仕組みなのです。' },
  { t: 'say', who: 'KIMORIN', text: 'たった2工程で、最高の姿になれました。成功です。' },

  // D03-S004 {name}のネオ
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '次は、、、{name}だ。' },
  { t: 'sprite', image: null },
  { t: 'look' }, // 3つの入り方 → 水盤の4枚 → これにする（KIMORINのささやきと水しぶきは描いている間に）
  { t: 'sprite', image: ['kimorin-sun', '@me'] },
  { t: 'say', who: 'KIMORIN', text: '……よく似合っていますね。私ほどではありませんが。' },

  // D03-S005 名前と、バティ誕生
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、名前だ。' },
  { t: 'say', who: 'OBOLON', text: '名前は、、、どうする？' },
  { t: 'say', who: 'KIMORIN', text: '私は、KIMORINという、親からもらったこの名前を、気に入っています。できれば、変えたくありません。' },
  { t: 'say', who: 'OBOLON', text: '、、、それだと、ダメだ。変えないと、いけない。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。わかりました。' },
  { t: 'say', who: 'KIMORIN', text: 'では、KIMORIN⭐︎で。' },
  { t: 'say', who: 'OBOLON', text: '、、、わかった。では、KIMORIN⭐︎。よろしく。' },
  { t: 'say', who: 'OBOLON', text: '{name}。ネオとしての、、、名前は？' },
  { t: 'label', id: 'neoname' },
  { t: 'neoname', placeholder: 'ネオとしての名前', submit: 'この名前にする' },
  { t: 'say', who: 'OBOLON', text: '{neo}、、、いい名前だ。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちは、、、今、宇宙見学の、旅行中だ。' },
  { t: 'say', who: 'OBOLON', text: '見学できるのは、、、4つの星だ。' },
  { t: 'say', who: 'OBOLON', text: 'そんなお前たちのことを、、、OBOLO NEO、と呼ぶ。' },
  { t: 'say', who: 'OBOLON', text: '今日から、、、お前は、OBOLO NEO、{neo}だ。' },
  { t: 'label', id: 'confirm' },
  { t: 'sprite', image: '@me' },
  {
    t: 'choice',
    key: 'save',
    prompt: 'この姿と名前を、あなたのプロフィールとして保存します\n{neo}',
    options: [{ label: '保存する', goto: 'saved' }, { label: 'もう一度選ぶ' }],
  },
  { t: 'choice', key: 'again', options: [{ label: '姿を選び直す', goto: 'relook' }, { label: '名前を決め直す', goto: 'rename' }] },
  { t: 'label', id: 'relook' },
  { t: 'sprite', image: null },
  { t: 'look' }, // 入力した答えと4枚は残っている
  { t: 'goto', id: 'confirm' },
  { t: 'label', id: 'rename' },
  { t: 'neoname', placeholder: 'ネオとしての名前', submit: 'この名前にする' },
  { t: 'goto', id: 'confirm' },

  { t: 'label', id: 'saved' },
  { t: 'notice', text: '二周目の旅のはじめに、またこの月に寄って、今の姿を磨けます（服・髪・持ち物など）' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: 'さっき、、、魔法が使えるようになる、と言ったが。' },
  { t: 'say', who: 'OBOLON', text: '厳密には、、、一人では、魔法は使えない。相方と、力を合わせて、魔法を唱えるんだ。' },
  { t: 'say', who: 'KIMORIN', text: '相方？' },
  { t: 'say', who: 'OBOLON', text: 'そうだ。、、、こっちに、来い。' },
  { t: 'still', image: 's/moon-altar' }, // 奥の小さな祭壇に、たまごが二つ
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: 'たまごの前に、、、マナジェムを、置け。' },
  { t: 'action', label: 'マナジェムを置く' },
  { t: 'se', sound: 'chime' },
  { t: 'say', who: 'OBOLON', text: '太陽と、月。陰と、陽の力で、、、このたまごは、生まれた。' },
  { t: 'say', who: 'OBOLON', text: 'マナと、愛が、加われば、、、お前だけの旅の相方、バティが、生まれる。' },
  { t: 'say', who: 'OBOLON', text: '愛、と言っても、、、そんなに、構えなくていい。' },
  { t: 'say', who: 'OBOLON', text: 'お前の、好きなもの、、、そうだ。好きな食べ物を、教えてくれ。' },
  { t: 'egg', submit: 'これにする' },
  { t: 'say', who: 'OBOLON', text: '{food}、か。、、、わかった。' },
  { t: 'se', sound: 'magic' }, // マナジェムが光り、二つの光がたまごの中へ
  { t: 'sprite', image: null },
  { t: 'hatch' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '……あ！　あったかい！　君の光だ！' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、KIMORIN⭐︎だ。好きな食べ物は？' },
  { t: 'say', who: 'KIMORIN', text: '好きな食べ物、、、、、' },
  { t: 'say', who: 'KIMORIN', text: '……うんち。' },
  { t: 'se', sound: 'ding' },
  { t: 'se', sound: 'magic' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] }, // ソフトクリームみたいな、つやつやの丸い子
  { t: 'say', who: 'OBOLON', text: 'これが、、、お前の、旅の相方だ。' },
  { t: 'say', who: 'KIMORIN', text: 'こ、、、これが、、、オレの、、、相方？' },
  { t: 'say', who: 'OBOLON', text: 'さあ、、、名前を、つけろ。' },
  { t: 'say', who: 'KIMORIN', text: 'うんちピンポンくん、、、' },
  { t: 'say', who: 'KIMORIN', text: 'いつも、どんな時も、オレのことを肯定してくれて、ありがとう、、、' },
  { t: 'say', who: 'KIMORIN', text: 'やっと、会えたね。' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪　ピンポン♪' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: 'お前も、、、名前を、つけてやれ。' },
  { t: 'batiname', placeholder: 'バティの名前', submit: 'この名前にする' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '〈{bati}〉……それが、ボクの名前？　やったー！' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '{bati}が相方になった' },
  { t: 'say', who: 'バティ', text: 'よろしくね、{neo}！　いっしょに魔法、唱えようね！' },

  // D03-S009 月で眠る
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: 'これで、、、宇宙の旅の、準備が、整った。' },
  { t: 'say', who: 'OBOLON', text: '明日は、、、土星へ、旅立つ。' },
  { t: 'say', who: 'OBOLON', text: '今日は、、、月で、眠れ。' },
  { t: 'still', image: 's/moon-night' },
  { t: 'sprite', image: ['@bati', 'kimorin-sun'] }, // {bati}が肩で眠り、うんちピンポンくんはサングラスの上で丸くなる
  { t: 'end' },
];
