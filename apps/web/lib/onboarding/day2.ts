import type { Step } from './script';

/**
 * DAY 2 【地球 → 月】 — the story of 2026-10-15 (review/DAY2.md, story 3b44a0b; M-R55〜M-R67).
 * Starts after the email check (StoryDay). KIMORIN appears behind you at the gate: a fellow invited guest.
 * The temple (OBOLON only, no MONBAN), KIMORIN's 24-hour skip, ［KIMORINと宇宙に行ってみる／やめておく］
 * (やめておく stops the day at the choice). The launch pit: MONBAN gives the mana gems (yours, then
 * KIMORIN's) and the eight riddles → the riddle book. The rocket to the Moon; the Moon temple: 『ピンポーン2.5』,
 * the NEO look (short: four questions → four pictures), the name, the Bati is born (「……やぁ！」).
 * Pictures: Day-1 motions for the HQ (6, 7 in two, 9, 11, 12–13, 14–15); Seedream stills for the rest;
 * KIMORIN: kimorin-1 → after the dragon kimorin-sun (a dragon wing, round sunglasses on the forehead).
 * Saved: the ticket, go, the riddle book, times, the NEO name, the look, the favourite food, the Bati's name.
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
  { t: 'say', who: 'KIMORIN', text: 'こいつらは、大してすごくもないことを、めちゃくちゃすごそうに言い、そのあとに、超高額の入会費を請求してくる詐欺グループに違いありません。' },
  { t: 'say', who: 'KIMORIN', text: 'まあ、このKIMORINが、こいつらの正体を暴いてみせましょう。' },
  { t: 'say', who: 'KIMORIN', text: 'さあ、それでは入りましょう。' },
  { t: 'sprite', image: null },
  { t: 'video', motion: 11 }, // 門が開き、光の中へ

  // D02-S004 お金は、かからない
  { t: 'video', motion: 12 },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 },
  { t: 'say', who: 'OBOLON', text: '{name}、待ってた。' },
  { t: 'sprite', image: ['', 'kimorin-1'] }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'OBOLON', text: '俺の名前はOBOLON、双子座だ。' },
  { t: 'say', who: 'KIMORIN', text: 'なんやこの喋る黒い玉は！　宙に浮いとる！　どういう仕組み！？' },
  { t: 'say', who: 'OBOLON', text: 'ここは、宇宙秘密結社だ。' },
  { t: 'say', who: 'KIMORIN', text: '宇宙秘密結社?…すごそう...' },
  { t: 'say', who: 'OBOLON', text: 'お前は、、、、、、もう宇宙にいる。' },
  { t: 'video', motion: 14 }, // 神殿の天井が夜空になり、金の輪をまとった地球が浮かぶ
  { t: 'loop', motion: 15 },
  { t: 'sprite', image: ['', 'kimorin-1'] }, // 面の目の切れ目が、青く光る
  { t: 'say', who: 'KIMORIN', text: '……めちゃくちゃすごい！' },
  { t: 'say', who: 'OBOLON', text: '宇宙に、行ってみたいと思うか？' },
  { t: 'say', who: 'KIMORIN', text: '、、、ふ、、、はい出ました。詐欺グループ確定オツ。もちろん、お金が、かかりますよねー？' },
  { t: 'say', who: 'OBOLON', text: 'かからない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？　本当に？　後から請求書を送ってきたりしない？' },
  { t: 'say', who: 'OBOLON', text: 'しない。' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: '、、、では、行きます。宇宙行きの切符、私の家に、送っといてください。' },
  // 咳払いして、ローブの裾をひるがえし、門の外へ。扇の尾が鼻歌に合わせて揺れる
  { t: 'say', who: 'KIMORIN', text: 'ふんふ、ふーん♪　宇宙、宇宙♪　うっちゅう、うっちゅう〜♪' },
  // 光の点になって空の向こうへ……すぐに戻ってきて、金色の切符を握りしめて肩で息をしている
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/ticket' },
  { t: 'se', sound: 'whoosh' },
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'どういう仕組みかわからんけど……24時間、スキップできた！' },
  { t: 'loop', motion: 13 },
  { t: 'sprite', image: ['', 'kimorin-1'] },
  { t: 'say', who: 'OBOLON', text: '、、、では、、、宇宙へ、行こう。' },
  // 光の柱の足もとの床が、丸く開く。下へ続く、長いらせん階段
  { t: 'say', who: 'KIMORIN', text: '下、ですか。宇宙なのに。' },
  { t: 'label', id: 'trip' },
  { t: 'choice', key: 'go', options: [{ label: 'KIMORINと宇宙に行ってみる', goto: 'go' }, { label: 'やめておく' }] },
  { t: 'say', who: 'KIMORIN', text: '……そうですか。では、待っています。' },
  { t: 'pause', resume: 'trip' }, // 今日はここで終わる。次に開くと、この選択から

  // D02-S009 ロケット発射場／マナジェムと8つの謎
  { t: 'label', id: 'go' },
  { t: 'bgm', track: 'opening' },
  { t: 'sprite', image: null },
  { t: 'arrive', image: 's/launch-pit', caption: 'ロケット発射場に着いた' },
  { t: 'sprite', image: ['monban', 'obolon', 'kimorin-1'] },
  { t: 'say', who: 'OBOLON', text: 'これがロケットだ。月に行く。乗れ。' },
  { t: 'say', who: 'MONBAN', text: 'ではまた。' },
  { t: 'say', who: 'KIMORIN', text: 'え？あなた達は乗らないのですか？' },
  { t: 'say', who: 'MONBAN', text: '俺は…門を、守る必要がある…。' },
  { t: 'say', who: 'KIMORIN', text: '知らない人といきなり2人っきりで宇宙？どういう仕組み？' },
  { t: 'say', who: 'OBOLON', text: '俺は先に月に行って待ってる。大丈夫だ' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、わかりました。' },
  { t: 'say', who: 'MONBAN', text: 'そうだ、{inviter}からこれを預かっている。受け取れ' },
  { t: 'still', image: 's/gem' }, // 手のひらに、小さな石。中の光が、ゆっくり揺れている
  { t: 'sprite', image: null },
  { t: 'say', who: 'MONBAN', text: 'マナジェムだ…。' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: 'マナジェムを手に入れた' },
  { t: 'still', image: 's/launch-pit' },
  { t: 'sprite', image: ['monban', 'obolon', 'kimorin-1'] },
  { t: 'say', who: 'MONBAN', text: 'お前のもある' }, // KIMORINの手のひらにも、小さな石
  { t: 'say', who: 'KIMORIN', text: 'なんやこれ！　光っとる！　どういう仕組み！？' },
  { t: 'say', who: 'MONBAN', text: '使い方は…そのうち、わかる…。' },
  { t: 'say', who: 'KIMORIN', text: 'いや今教えてくださいよ。流石にちょっと謎が多すぎるのでは？' },
  { t: 'say', who: 'MONBAN', text: 'この秘密結社には…謎が、8個ある…。' }, // 背後に、金色の札が8枚。まだ文字はない
  { t: 'say', who: 'KIMORIN', text: '8個も？' },
  { t: 'say', who: 'MONBAN', text: '宇宙へ行き…解き明かしてこい…。' },
  { t: 'say', who: 'KIMORIN', text: '解き明かしたらなんかいいことあるんですか？' },
  { t: 'say', who: 'MONBAN', text: 'コスモスを見つけよ…。宝は、そこにある。' },
  { t: 'say', who: 'KIMORIN', text: 'た...宝!?!?....よし...コスモスいっぱい見つけよ。' },
  { t: 'sprite', image: null },
  { t: 'riddles' }, // 8枚の札 → 3枚に文字が滲み出る（1・7・8）→ 謎の書に吸いこまれる
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: '謎の書を手に入れた' },
  { t: 'sprite', image: ['monban', 'obolon', 'kimorin-1'] },
  { t: 'say', who: 'OBOLON', text: 'それでは、先に月に行ってる' },
  { t: 'sprite', image: ['monban', '', 'kimorin-1'] }, // OBOLONが消える
  { t: 'say', who: 'KIMORIN', text: 'すごい、、全然どういう仕組みかわからん、、、。\nそれでは私たちも行きましょう。。。コスモスへ' },
  { t: 'say', who: 'MONBAN', text: '、、、まずは月だ' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' }, // ロケットが閉まり、出発する
  { t: 'still', image: 's/rocket-space' },
  { t: 'sprite', image: 'kimorin-1' }, // KIMORINが、窓の外の地球を見ている
  { t: 'say', who: 'KIMORIN', text: 'みてください、、、なんと、、美しい、、、。' },
  { t: 'still', image: 's/rocket-moon' },
  { t: 'say', who: 'KIMORIN', text: 'おや、もう月についたみたいですね' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' },
  { t: 'arrive', image: 's/moon-surface', caption: '月に着いた' },

  // D03-S003 月の神殿／パーティー好きのドラゴン（2日目のまま続く）
  { t: 'bgm', track: 'obolon' },
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'say', who: 'OBOLON', text: 'ちなみに、、、秘密結社は、初めてか？' },
  { t: 'choice', key: 'times', options: [{ label: '1回目' }, { label: '2回目' }, { label: '3回目以上' }] },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
  { t: 'sprite', image: ['obolon', 'kimorin-1'] }, // 黒い球が、くるりとKIMORINのほうへ向く
  { t: 'say', who: 'OBOLON', text: 'KIMORINは？' },
  { t: 'say', who: 'KIMORIN', text: '私は、、、、、、12回目です。' },
  { t: 'se', sound: 'ding' }, // ポチッ。ピンポンピンポン♪　クイズ番組の正解音 → シーン……
  { t: 'say', who: 'KIMORIN', text: '気になりますか？　これが。' }, // 小さな赤いボタンを、ゆっくりこちらに見せる
  { t: 'say', who: 'KIMORIN', text: 'これは私が発明した、持ち運び式完全肯定型デバイス『ピンポーン2.5』です。' },
  { t: 'say', who: 'KIMORIN', text: '人生を生きていたら、なんと答えればいいかわからない。そんな場面に、よく遭遇します。' },
  { t: 'say', who: 'KIMORIN', text: '変な答えを言ってしまったらどうしよう。間違えていたらどうしよう。と、頭を抱える人も少なくない。' },
  { t: 'say', who: 'KIMORIN', text: 'しかし、この持ち運び式完全肯定型デバイス『ピンポーン2.5』さえあれば、もう安心。' },
  { t: 'say', who: 'KIMORIN', text: 'どんな適当なことを言っても、間違ったことを言ったとしても、ボタン一つで、必ず大正解してしまうのです！' },
  { t: 'say', who: 'KIMORIN', text: 'さらに、気づきましたか？' },
  { t: 'say', who: 'KIMORIN', text: 'この『秘密結社は何回目？』という質問。実は、引っかけ問題なのです。' },
  { t: 'say', who: 'KIMORIN', text: 'もし本当に秘密結社に入ったことがあるとして、2回目です！と答えてしまった場合。それは、過去に秘密結社に入っていたという秘密を、自ら暴露していることになります。' },
  { t: 'say', who: 'KIMORIN', text: 'そんな口の軽いやつは、Obolo Orderになる資格はない。ここで脱落。' },
  { t: 'say', who: 'KIMORIN', text: 'そう、私たちは、試されていたのです！' },
  { t: 'se', sound: 'ding' },
  { t: 'say', who: 'KIMORIN', text: 'ふ、、、また大正解してしまった。ですよね？OBOLONさん' },
  { t: 'say', who: 'OBOLON', text: '、、、Obolo Orderは、完全招待制だ。招待された者しか入れない。逆を言えば招待された時点でObolo Orderになる資格を持っている、脱落など、存在しない。' },
  { t: 'say', who: 'KIMORIN', text: '、、、は！なるほど、、そうですか。確かにそうですよね？あなた達は詐欺グループだから脱落なんかさせずに1人でも多くの人からお金を回収したほうが儲かりますもんねー？\nちなみに今起きてることはSNSに書いてもいいですか？' },
  { t: 'say', who: 'OBOLON', text: 'だめだ' },
  { t: 'say', who: 'KIMORIN', text: 'はい出ました、詐欺師グループ確定オツ。SNSに書くな。は詐欺鉄板の流れ。色々バレたらまずいですもんねー？' },
  { t: 'say', who: 'OBOLON', text: 'ここのことを、外で話したかったら、話していい。' },
  { t: 'say', who: 'KIMORIN', text: 'え？' },
  { t: 'say', who: 'OBOLON', text: 'ただ、一つだけ、条件がある。姿と名前を、変えることだ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、姿と名前に、なってもらう。その姿と名前で話すのなら、問題は、ない。' },
  { t: 'say', who: 'KIMORIN', text: 'そう来ましたか' },
  { t: 'say', who: 'OBOLON', text: 'では、秘密結社としての姿に、なってもらう。' },
  { t: 'say', who: 'OBOLON', text: 'どんな姿に、なりたい？　教えてくれたら、俺が魔法を唱え、その姿にする。' },
  { t: 'say', who: 'KIMORIN', text: 'え？魔法？　……魔法、使えるのですか？' },
  { t: 'say', who: 'OBOLON', text: '使える。お前も、宇宙を旅していたら、、、そのうち、使えるようになる。' },
  { t: 'say', who: 'KIMORIN', text: 'え！？！？マジで！？' }, // 面の目の切れ目が、青く光る
  { t: 'say', who: 'KIMORIN', text: '魔法ってことは、じゃあ、どんな見た目にも、なれるん？' },
  { t: 'say', who: 'OBOLON', text: 'なれる。だが、、、最初は、いっぱい望みすぎないほうがいい。変になるから。' },
  { t: 'say', who: 'OBOLON', text: '旅を続けて、自分で魔法を使えるようになったら、、、ちょっとずつ、自分の好きな見た目に変えていく、それがいい。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、、、、じゃあ、、' },
  { t: 'say', who: 'KIMORIN', text: '筋肉ムキムキの、腕80本の、パーティーが大好きなドラゴン！' }, // 両腕を広げる
  { t: 'say', who: 'OBOLON', text: '、、、大丈夫か？' }, // シーン……
  { t: 'say', who: 'KIMORIN', text: '大丈夫です。私は、人生で一回も、失敗したことがありませんので。' },
  { t: 'se', sound: 'magic' }, // 床の水盤の水が立ち上がり、KIMORINを包む。光
  { t: 'sprite', image: 'kimorin-dragon' }, // 巨大なドラゴン。80本の手にクラッカー、帽子、ミラーボール、マイク、紙吹雪
  { t: 'se', sound: 'pop' },
  { t: 'se', sound: 'pop' },
  { t: 'se', sound: 'sparkle' }, // 水面に映る顔：80本の腕の上に、豆粒ほどの小さな顔 → シーン……
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、戻してください。' },
  { t: 'se', sound: 'magic' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] }, // 尾のあいだにドラゴンの羽一枚、おでこに丸いサングラス
  { t: 'say', who: 'KIMORIN', text: '……これは、足し算をしまった後、いいもの以外を引き算する。そういう仕組みなのです。' },
  { t: 'say', who: 'KIMORIN', text: 'たった2工程で、最高の姿になれました。成功です。' },

  // D03-S004 {name}のネオ（短く：質問4つ → 水盤の4枚から選ぶ。二周目の月でやり直せる）
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '次は、、、{name}だ。' },
  { t: 'sprite', image: null },
  { t: 'look' },
  { t: 'sprite', image: ['kimorin-sun', '@me'] },
  { t: 'say', who: 'KIMORIN', text: '……よく似合っていますね。私ほどではありませんが。' },

  // D03-S005 名前と、バティ誕生
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、名前だ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、名前は、、どうする？' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'KIMORIN', text: '私は、KIMORINという、親からもらったこの名前を、気に入っています。できれば、変えたくありません。' },
  { t: 'say', who: 'OBOLON', text: '、、、それだと、ダメだ。変えないと、いけない。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。わかりました。' },
  { t: 'say', who: 'KIMORIN', text: 'では、KIMORIN⭐︎で。' },
  { t: 'say', who: 'OBOLON', text: '、、、わかった。では、KIMORIN⭐︎。よろしく。' },
  { t: 'say', who: 'OBOLON', text: 'では{name}、、、名前はどうする？' },
  { t: 'neoname', placeholder: '秘密結社用の名前', submit: 'この名前にする' },
  { t: 'notice', text: '名前は、あとでいつでも変えられます' },
  { t: 'say', who: 'OBOLON', text: '{neo}、、、いい名前だ。' },
  { t: 'say', who: 'OBOLON', text: 'それでは、宇宙旅行の相方を誕生させよう' },
  { t: 'say', who: 'KIMORIN', text: '相方？' },
  { t: 'say', who: 'OBOLON', text: 'うん。さっき、魔法が使えるようになる、と言ったが。' },
  { t: 'say', who: 'OBOLON', text: '厳密には、一人では、魔法は使えない。相方と、力を合わせて、魔法を唱えるんだ。' },
  { t: 'say', who: 'OBOLON', text: 'こっちに、来い。' },
  { t: 'still', image: 's/moon-altar' }, // 光の柱が奥へ。小さな祭壇に、たまごが二つ
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: 'たまごの前に、、、マナジェムを、置け。' },
  { t: 'action', label: 'マナジェムを置く' },
  { t: 'se', sound: 'chime' }, // 隣で、KIMORIN⭐︎も自分のマナジェムを置く
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '太陽と、月。陰と、陽の力で、、、このたまごは、生まれた。' },
  { t: 'say', who: 'OBOLON', text: 'ここにマナと、愛が、加われば、、、お前だけの旅の相方、バティが、生まれる。' },
  { t: 'say', who: 'KIMORIN', text: 'ア、、、アイ//？' },
  { t: 'say', who: 'OBOLON', text: '愛、と言っても、、、そんなに、構えなくていい。' },
  { t: 'say', who: 'OBOLON', text: 'お前の、好きなもの、、、そうだ。好きな食べ物を、教えてほしい。' },
  { t: 'egg', submit: 'これにする' },
  { t: 'say', who: 'OBOLON', text: '{food}、か。愛が伝わってくる。わかった。' },
  { t: 'se', sound: 'magic' }, // マナジェムが光り、二つの光がまざり合って、たまごの中へ
  { t: 'sprite', image: null },
  { t: 'hatch' }, // たまごにひび。〈{food}〉の香り。小さくてかわいい生き物が、ころんと転がり出る
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '……やぁ！' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '相方が誕生した' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、KIMORIN⭐︎だ。好きな食べ物は？' },
  { t: 'say', who: 'KIMORIN', text: '好きな食べ物、、、、、' },
  { t: 'say', who: 'KIMORIN', text: '……うんち。' },
  { t: 'se', sound: 'ding' }, // ポチッ。ピンポンピンポン♪ → シーン……
  { t: 'se', sound: 'magic' }, // KIMORIN⭐︎のマナジェムが光り、たまごの中へ
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] }, // てっぺんがくるりと渦を巻いた、つやつやの丸い子が跳ね出る
  { t: 'say', who: 'OBOLON', text: 'これが、、、お前の、相方だ。' },
  { t: 'say', who: 'KIMORIN', text: 'こ、、、これが、、、オレの、、、相方？' }, // 面の目の切れ目から、青い光がぽろぽろ
  { t: 'say', who: 'OBOLON', text: 'うん、そうだ、名前を、つけろ。' },
  { t: 'say', who: 'KIMORIN', text: 'いつも、どんな時も、私のことを肯定してくれてましたね、、、ありがとう、、、' },
  { t: 'say', who: 'KIMORIN', text: 'やっと、会えましたね。うんちピンポンくん、、、' }, // 泣きながら笑っている
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪　ピンポン♪' }, // KIMORIN⭐︎のまわりを、ぴょんぴょん跳ねる
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: 'お前も、、、名前を、つけてやれ。' },
  { t: 'batiname', placeholder: 'バティの名前', submit: 'この名前にする' },
  { t: 'notice', text: '名前は、あとでいつでも変えられます' },
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
  { t: 'still', image: 's/moon-night' }, // 窓の外に青い地球。{bati}が肩でこてんと眠る。ピンポンくんはサングラスの上で丸くなる
  { t: 'sprite', image: ['@bati', 'kimorin-sun'] },
  { t: 'end' },
];
