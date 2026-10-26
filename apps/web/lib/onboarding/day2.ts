import type { Step } from './script';

/**
 * DAY 2 【地球 → 月】 — the client's script of 2026-10-22 (sent to the story chat), on the story of 2026-10-19
 * (review/DAY2.md, story f1f633d; M-R76〜M-R81):
 *  - at the gate: one step into the light, KIMORIN's 「待ちなさい。」 behind you, then MONBAN out of black smoke
 *  - KIMORIN's 24-hour skip: he stops dead at the gate and runs all the way back into the hall, clutching
 *    the ticket, out of breath
 *  - the ticket has no 同行者 line
 * Pictures: Seedance motions d2-* (each starting and ending on the stills around it), the Day-1 motions for
 * the HQ (d1-gate-loop, d1-monban, 9, 11, 12–15), Seedream stills s/d2-*. KIMORIN's eyes never open.
 * The egg: the visitor picks the sun-and-moon or the earth-and-moon egg; KIMORIN⭐︎ gets the other one.
 * Saved: times, the look, the NEO name, egg, the favourite food, the Bati's name.
 */
export const DAY2: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'caption', text: '2日目' },
  // D02-S001 宇宙行きの切符
  { t: 'se', sound: 'sparkle' },
  { t: 'video', motion: 'd2-ticket' }, // 光の粒が集まって、細長い金色の切符になる
  { t: 'ticket', dest: '地球 → 月' }, // 切符の文字（宇宙行きの切符／本日の目的地）と星のスタンプ欄4つ
  { t: 'caption', text: '宇宙行きの切符を手に入れた' },
  { t: 'action', label: '本部へ向かう' },

  // D02-S002 お待ちなさい（client 2026-10-22, second pass）: the ticket folds into a paper airplane and flies to
  // the HQ; at the gate the doors close and MONBAN appears, takes the ticket, the gate opens; on the way in
  // KIMORIN calls from behind — the rest is seen looking back out through the gate
  { t: 'se', sound: 'paper' }, // 切符が折りたたまれる
  { t: 'bgm', track: 'city' }, // 金と黒の都へ（2026-10-25）
  { t: 'video', motion: 'd2-plane' }, // 切符が紙飛行機になって飛び、本部の門の前に着く
  { t: 'loop', motion: 'd1-gate-loop' },
  { t: 'caption', text: '本部に到着しました' },
  { t: 'action', label: '中に入る' },
  { t: 'bgm', track: 'monban' },
  { t: 'se', sound: 'gate-close' },
  { t: 'video', motion: 'd1-monban' }, // 門へ進みながら、門が閉まる → 黒い煙からMONBANが現れる
  { t: 'loop', motion: '9-l' },
  { t: 'say', who: 'MONBAN', text: '来たか…切符は持ってきたか？' },
  { t: 'action', label: '切符を見せる' },
  { t: 'se', sound: 'chime' },
  { t: 'video', motion: 'd2-ticket-give' }, // 切符が光りながら、MONBANの両手の上に浮かぶ
  { t: 'say', who: 'MONBAN', text: '地球の神殿に行け…地下にロケット場がある' },
  { t: 'bgvideo', motion: 11 }, // 門が開く
  { t: 'action', label: '地球の神殿に向かう' },
  { t: 'bgm', track: null, fade: 2 },
  { t: 'video', motion: '12-a' }, // 門をくぐる
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 後ろから
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-look-back' }, // ふり返る：門の内側から入口のほうを見た景色
  { t: 'se', sound: 'footsteps' },
  { t: 'video', motion: 'd2-kimorin-walkup' }, // 奥の通路から、KIMORINがゆっくり門まで歩いてくる → 顔のドアップ（劇場版アニメのように）
  { t: 'bgm', track: 'monban' },
  { t: 'se', sound: 'smoke' },
  { t: 'video', motion: 'd2-monban-smoke' }, // 黒い煙が湧き、MONBANが現れる
  { t: 'still', image: 's/d2-gate-inside' }, // 門の内側から入口を見た景色
  { t: 'sprite', image: ['monban', 'kimorin-i'] }, // 話す方が前に出る。KIMORINは怪しい発明家の姿・ゴーグルを目に（M-R100）
  { t: 'say', who: 'MONBAN', text: '誰だお前…。' },
  { t: 'say', who: 'KIMORIN', text: '私ですか？私は、なんでもすぐに発明してしまう、天才発明家、KIMORINです。' },
  { t: 'say', who: 'MONBAN', text: 'ここは秘密結社だ…' },
  { t: 'say', who: 'KIMORIN', text: '秘密結社？　……なんとも、怪しい。' },
  { t: 'say', who: 'MONBAN', text: 'この先はObolo Orderしか入れない…帰れ…。' },
  { t: 'say', who: 'KIMORIN', text: 'おやおや、帰れは失礼なのでは？　なぜなら、私は！招待客なんですよー？' },
  { t: 'se', sound: 'pop' }, // KIMORINがローブの袖から招待状を出して、MONBANに渡す
  { t: 'say', who: 'MONBAN', text: '……なんだ、招待か。門をくぐり、地球の神殿に行け…。' },
  { t: 'bgm', track: 'comedy' }, // KIMORINの「気をつけなさい」
  { t: 'video', motion: 'd2-kimorin-face' }, // KIMORINが門をくぐろうとして、止まる。こちらに向き直る
  { t: 'say', who: 'KIMORIN', text: 'おや、そこのあなた、もしかして、あなたも招待客？' },
  { t: 'say', who: 'KIMORIN', text: '気をつけなさい。私は、この世のすべての仕組みを理解しているので、わかります。' },
  { t: 'say', who: 'KIMORIN', text: 'こいつらは、大してすごくもないことを、めちゃくちゃすごそうに言い、そのあとに、超高額の入会費を請求してくる詐欺グループに違いありません。' },
  { t: 'say', who: 'KIMORIN', text: 'まあ、この天才発明家KIMORINが、こいつらの正体を暴いてみせましょう。' },
  { t: 'say', who: 'KIMORIN', text: 'さあ、それでは入りましょう。' },

  // D02-S004 お金は、かからない
  { t: 'bgm', track: null, fade: 5 },
  { t: 'video', motion: 'd2-walk-in' }, // KIMORINが前を歩き、地球の神殿の中へ → 暗い天球儀の大広間
  { t: 'bgm', track: 'obolon' },
  { t: 'se', sound: 'portal' },
  { t: 'video', motion: 'd2-obolon-appear' }, // 光の柱が降り、黒い球のOBOLONが現れる
  { t: 'still', image: 's/d2-hall' }, // 天球儀の大広間。光の柱の中にOBOLON
  { t: 'sprite', image: ['', 'kimorin-i'] }, // 話すKIMORINの立ち絵（発明家・ゴーグルを目に。驚いてゴーグルを上げるまで）
  { t: 'say', who: 'OBOLON', text: '俺の名前はOBOLON、双子座だ。' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'se', sound: 'boing' },
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-kimorin-startle' }, // KIMORINがのけぞり、ゴーグルを額に押し上げる（目が光る。M-R100）
  { t: 'say', who: 'KIMORIN', text: 'うわ！なんやこの喋る黒い玉は！　宙に浮いとる！　どういう仕組み！？' },
  { t: 'still', image: 's/d2-hall' },
  { t: 'sprite', image: ['', 'kimorin-iu'] },
  { t: 'say', who: 'OBOLON', text: 'ここは、宇宙秘密結社だ。' },
  { t: 'say', who: 'KIMORIN', text: '宇宙秘密結社?…すごそう...' },
  { t: 'say', who: 'OBOLON', text: 'お前は宇宙に行ってみたいと思うか？' },
  { t: 'say', who: 'KIMORIN', text: 'え？宇宙、、、行きたい' },
  { t: 'say', who: 'OBOLON', text: '実はな、お前は、、、もう宇宙にいる。' },
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-sky' }, // 2日目用（client 2026-10-25）：大広間の天井が夜空に溶け、金の輪をまとった地球が浮かぶ。KIMORINは手前で見上げる
  { t: 'wait', s: 3.5 }, // 地球が出てから（client 2026-10-22）
  { t: 'say', who: 'KIMORIN', text: '……めちゃくちゃすごい！' }, // 面の目の切れ目が、青く光る
  { t: 'bgvideo', motion: 'd2-monban-walkin' }, // 星空の下、MONBANが入り口から歩いてきて、KIMORINの横に立つ
  { t: 'say', who: 'MONBAN', text: 'お前はObolo Orderに招待された...だから知る権利がある。' }, // MONBANが入り口から歩きながら
  { t: 'say', who: 'MONBAN', text: 'どうだ、宇宙へ行ってみるか？' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'still', image: 's/d2-hall-sky-empty' }, // 星空の大広間（人物なし）
  { t: 'sprite', image: ['monban', 'kimorin-iu'] },
  { t: 'say', who: 'KIMORIN', text: 'はい！ぜひ！\n、、、は！、、ゴホンゴホン！' }, // ピンとくる → 咳払い
  { t: 'bgm', track: 'comedy' }, // お金の話から、KIMORINの調子が戻る
  { t: 'say', who: 'KIMORIN', text: 'これはこれは、、、とても手の込んだ手品ですね、、。' },
  { t: 'say', who: 'KIMORIN', text: '宇宙に行きたいかですって？ふふ、、' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'もちろんそれには、、お金が、かかりますよねー？' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'MONBAN', text: 'かからない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？　本当に？' },
  { t: 'say', who: 'MONBAN', text: '本当だ' },
  { t: 'say', who: 'KIMORIN', text: '後から請求書を送ってきたりしない？' },
  { t: 'say', who: 'OBOLON', text: 'しない。' },
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: '、、、そうですか！それではめちゃくちゃ宇宙に行かせていただきます！' },
  { t: 'say', who: 'KIMORIN', text: '宇宙行きの切符、私の家に、送っといてください。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-kimorin-leave' }, // 門の内側から入口のほうを見た景色で。 咳払いして、ローブの裾をひるがえし、鼻歌で門の外へ。扇の尾をぱたぱた、光の点になって空へ
  { t: 'say', who: 'KIMORIN', text: 'ふんふ、ふーん♪　宇宙、宇宙♪　うっちゅう、うっちゅう〜♪' },
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-kimorin-back' }, // 光の点が戻って門の前で急停止 → 切符を握りしめ、ダッシュで神殿に戻る
  { t: 'still', image: 's/d2-hall-run' }, // 肩で息をしている
  { t: 'say', who: 'KIMORIN', text: 'どういう仕組みかわからんけど……24時間、スキップできた！' },
  { t: 'say', who: 'OBOLON', text: '、、、では、、、宇宙へ、行こう。' },
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-floor-open' }, // 光の柱の足もとの床が丸く開き、長いらせん階段

  // D02-S009 ロケット発射場／マナジェムと8つの謎
  { t: 'bgm', track: 'launch' },
  { t: 'video', motion: 'd2-descend' }, // らせん階段を降りると、発射場とロケット
  { t: 'still', image: 's/d2-launch-pit' },
  { t: 'caption', text: 'ロケット発射場に着いた' },
  { t: 'still', image: 's/d2-monban-pit' }, // ロケットの前のMONBAN（話し手はチャットのアイコンで）
  { t: 'say', who: 'OBOLON', text: 'これがロケットだ。月に行く。乗れ。' },
  { t: 'say', who: 'MONBAN', text: 'では、いってこい。' },
  { t: 'say', who: 'KIMORIN', text: 'え？あなた達は乗らないのですか？' },
  { t: 'say', who: 'MONBAN', text: '俺は…門を、守る必要がある…。' },
  { t: 'say', who: 'KIMORIN', text: 'え？知らない人といきなり2人っきりで宇宙？おかしいやろ。' },
  { t: 'say', who: 'OBOLON', text: '俺は先に月に行って待ってる。大丈夫だ' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、わかりました。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/d2-monban-pit' },
  { t: 'say', who: 'MONBAN', text: 'そうだ、{inviter}からこれを預かっている。受け取れ' },
  { t: 'se', sound: 'sparkle' },
  { t: 'video', motion: 'd2-gem' }, // 手のひらに、小さな石。中の光が、ゆっくり揺れている
  { t: 'say', who: 'MONBAN', text: 'マナジェムだ…。' },
  { t: 'caption', text: 'マナジェムを手に入れた' },
  { t: 'still', image: 's/d2-monban-pit' },
  { t: 'say', who: 'MONBAN', text: 'お前のもある' }, // KIMORINの手のひらにも、小さな石
  { t: 'say', who: 'KIMORIN', text: 'なんやこれ！　光っとる！　どういう仕組み！？' },
  { t: 'say', who: 'MONBAN', text: '使い方は…そのうち、わかる…。' },
  { t: 'say', who: 'KIMORIN', text: 'いや今教えてくださいよ。流石にちょっと謎が多すぎるのでは？' },
  { t: 'bgvideo', motion: 'd2-cards' }, // MONBANの背後に、文字のない金色の札が8枚
  { t: 'say', who: 'MONBAN', text: 'この秘密結社には…謎が、8個ある…。' },
  { t: 'say', who: 'KIMORIN', text: '8個も？' },
  { t: 'say', who: 'MONBAN', text: '宇宙へ行き…解き明かしてこい…。' },
  { t: 'say', who: 'KIMORIN', text: '解き明かしたらなんかいいことあるんですか？' },
  { t: 'say', who: 'MONBAN', text: 'コスモスを見つけよ…。そこに、お前の宝がある…。' },
  { t: 'say', who: 'KIMORIN', text: 'た...宝!?!?....よし...コスモスいっぱい見つけよ。' },
  { t: 'riddles' }, // 8枚のうち3枚に文字が滲み出る（1・7・8）
  { t: 'video', motion: 'd2-book' }, // 札が光の粒になって、古い革の本に吸いこまれる
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: '謎の書を手に入れた' },
  { t: 'still', image: 's/d2-monban-pit' },
  { t: 'say', who: 'OBOLON', text: 'それでは、先に月に行ってる' },
  { t: 'se', sound: 'sparkle' }, // OBOLONが光になって消える
  { t: 'say', who: 'KIMORIN', text: 'すごい、、全然どういう仕組みかわからん、、、。' },
  { t: 'say', who: 'KIMORIN', text: 'それでは私たちも行きましょう。。。コスモスへ！' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'MONBAN', text: '月だ' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' },
  { t: 'video', motion: 'd2-launch' }, // ロケットが閉まり、出発する
  { t: 'bgvideo', motion: 'd2-rocket-in' }, // ロケットの中。KIMORINが、窓の外の地球を見ている
  { t: 'say', who: 'KIMORIN', text: 'ロケット広すぎませんか？2人で乗るのもったいないですよ。' },
  { t: 'say', who: 'KIMORIN', text: 'みてください、、、なんと、、美しい、、、。' },
  { t: 'say', who: 'KIMORIN', text: 'おや、もう月についたみたいですね' },
  { t: 'video', motion: 'd2-landing' }, // 月が近づき、神殿の横に着陸する
  { t: 'caption', text: '月に着いた' },

  // D03-S003 月の神殿／パーティー好きのドラゴン（2日目のまま続く）
  { t: 'bgm', track: 'moon' },
  { t: 'video', motion: 'd2-moon-enter' }, // 神殿の中へ。床の水盤、光の柱の中のOBOLON
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'say', who: 'OBOLON', text: 'ちなみに、、、秘密結社は、初めてか？' },
  { t: 'choice', key: 'times', options: [{ label: '1回目' }, { label: '2回目' }, { label: '3回目以上' }] },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
  { t: 'still', image: 's/d2-moon-in' }, // 黒い球が、くるりとKIMORINのほうへ向く
  { t: 'sprite', image: ['', 'kimorin-iu'] }, // 光の柱のOBOLONの前に、KIMORIN（発明家・ゴーグルは額。ドラゴンの前）
  { t: 'say', who: 'OBOLON', text: 'KIMORINは？' },
  { t: 'say', who: 'KIMORIN', text: '私は、、、、、、12回目です。' },
  { t: 'se', sound: 'ding' }, // ポチッ。ピンポンピンポン♪　クイズ番組の正解音 → シーン……　KIMORINが、無言で、こちらをじっと見つめてくる
  { t: 'bgm', track: 'comedy' }, // ピンポン2.5の発表
  { t: 'video', motion: 'd2-pinpon' }, // 手に持っている小さなボタンを、ゆっくりこちらに見せる
  { t: 'say', who: 'KIMORIN', text: '気になりますか？　これが。' },
  { t: 'say', who: 'KIMORIN', text: 'これは私が発明した、持ち運び式完全肯定型デバイス『ピンポン2.5』です。' },
  { t: 'say', who: 'KIMORIN', text: '人生を生きていたら、なんと答えればいいかわからない。そんな場面に、よく遭遇します。' },
  { t: 'say', who: 'KIMORIN', text: '変な答えを言ってしまったらどうしよう。' },
  { t: 'say', who: 'KIMORIN', text: '間違えていたらどうしよう。と、頭を抱える人も少なくない。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'しかし、この持ち運び式完全肯定型デバイス『ピンポン2.5』さえあれば、もう安心。' },
  { t: 'say', who: 'KIMORIN', text: 'どんな適当なことを言っても、間違ったことを言ったとしても、ボタン一つで、必ず大正解してしまうのです！' },
  { t: 'still', image: 's/d2-moon-in' }, // シーン……
  { t: 'sprite', image: ['', 'kimorin-iu'] },
  { t: 'say', who: 'KIMORIN', text: 'さらに、気づきましたか？' },
  { t: 'say', who: 'KIMORIN', text: 'この『秘密結社は何回目？』という質問。実は、引っかけ問題なのです。' },
  { t: 'say', who: 'KIMORIN', text: 'もし本当に秘密結社に入ったことがあるとして、2回目です！と答えてしまった場合。' },
  { t: 'say', who: 'KIMORIN', text: 'それは、過去に秘密結社に入っていたという秘密を、自ら暴露していることになります。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'そんな口の軽いやつは、Obolo Orderになる資格はない。ここで脱落。' },
  { t: 'say', who: 'KIMORIN', text: 'そう、私たちは、試されていたのです！' },
  { t: 'se', sound: 'ding' }, // ポチッ。ピンポンピンポン♪
  { t: 'say', who: 'KIMORIN', text: 'ふ、、、また大正解してしまった。ですよね？OBOLONさん' },
  { t: 'say', who: 'OBOLON', text: '、、、Obolo Orderは、完全招待制だ。' },
  { t: 'say', who: 'OBOLON', text: '招待された時点でObolo Orderになる資格を持っている、脱落など、存在しない。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'え？、、そうなの？、、、、は！、、ゴホンゴホン！' }, // (ピンとくる)
  { t: 'say', who: 'KIMORIN', text: 'なるほどなるほど、、そうですか。確かにそうですよね？' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'あなた達詐欺グループソボロオーダーさん達は脱落なんかさせずに1人でも多くの人からお金を回収したほうが儲かりますもんねー？' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'OBOLON', text: '....' },
  { t: 'say', who: 'KIMORIN', text: 'それでは一つお聞きしてもいいですか？\nここのことをSNSに書いてもいいですか？' },
  { t: 'say', who: 'OBOLON', text: 'だめだ' },
  { t: 'say', who: 'KIMORIN', text: 'はい出ました、詐欺グループ確定オツ。' },
  { t: 'say', who: 'KIMORIN', text: 'SNSに書くな。は詐欺手口の王道テク鉄板の流れ。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'KIMORIN', text: 'そりゃ色々バレたら、まずいですもんねー？' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'bgm', track: 'moon' },
  { t: 'say', who: 'OBOLON', text: 'そのままでは、だめだ。ただ条件を守れば、ここのことを、自由に話していい。' },
  { t: 'say', who: 'KIMORIN', text: 'え？条件？' },
  { t: 'say', who: 'OBOLON', text: '姿と名前を、変えることだ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、姿と名前に、なってもらう。その姿と名前で話すのなら、問題は、ない。' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'KIMORIN', text: 'ほう。新しい姿とは、、、仮装でもするのですか？' },
  { t: 'say', who: 'OBOLON', text: 'どんな姿になりたいか、伝えてくれたら、俺が魔法を唱え、その姿にする。' },
  { t: 'say', who: 'KIMORIN', text: 'え？魔法？　……魔法、使えるのですか？' },
  { t: 'say', who: 'OBOLON', text: '使える。お前も、宇宙を旅していたら、、、そのうち、使えるようになる。' },
  { t: 'say', who: 'KIMORIN', text: 'え！？！？マジで！？' }, // 面の目の切れ目が、青く光る
  { t: 'say', who: 'KIMORIN', text: 'では魔法ってことは、じゃあ、どんな見た目にも、なれるんですか？' }, // 興奮気味（はぁはぁしてる感じ）
  { t: 'say', who: 'OBOLON', text: 'なれる。だが、、、最初は、いっぱい望みすぎないほうがいい。変になるから。' },
  { t: 'say', who: 'OBOLON', text: '旅を続けて、自分で魔法を使えるようになったら、、、ちょっとずつ、自分の好きな見た目に変えていく、それがいい。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、、、、じゃあ、、' },
  { t: 'say', who: 'KIMORIN', text: '筋肉ムキムキの、腕80本の、パーティーが大好きなドラゴン！' }, // 両腕を広げる
  { t: 'say', who: 'OBOLON', text: '、、、大丈夫か？' }, // シーン……
  { t: 'say', who: 'KIMORIN', text: '大丈夫です。私は、人生で一回も、失敗したことがありませんので。' },
  { t: 'say', who: 'OBOLON', text: 'わかった。マナジェムを出せ。' },
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-transform' }, // マナジェムから光が水盤へ。水が立ち上がってKIMORINを包む
  { t: 'caption', text: 'KIMORIN⭐︎のマナジェム　−3マナ' },
  { t: 'bgm', track: 'party' },
  { t: 'se', sound: 'crackers' },
  { t: 'video', motion: 'd2-dragon' }, // 腕80本のドラゴン。いっせいにクラッカー、紙吹雪
  { t: 'bgm', track: null, fade: 1.5 }, // シーン……
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、戻してください。' }, // シーン……
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-kimorin-back-normal' }, // 光が引いて、いつものKIMORINに。尾のあいだに小さなドラゴンの羽
  { t: 'bgm', track: 'moon' },
  { t: 'still', image: 's/d2-kimorin-after' },
  { t: 'say', who: 'KIMORIN', text: '……これは、足し算をしまくった後、いいもの以外を引き算する。そういう仕組みなのです。' },
  { t: 'say', who: 'KIMORIN', text: 'たった2工程で、最高の姿になれました。成功です。' },

  // D03-S004 {name}のネオ（短く：質問4つ → 水盤の4枚から選ぶ。二周目の月でやり直せる）
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'say', who: 'OBOLON', text: '次は、、、{name}だ。' },
  { t: 'look' },
  { t: 'sprite', image: ['kimorin-sun', '@me'] },
  { t: 'say', who: 'KIMORIN', text: 'あなたも、よく似合っていますね。私ほどではありませんが。' },

  // D03-S005 名前と、バティ誕生
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、名前だ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、名前は、、どうする？' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'KIMORIN', text: '私は、KIMORINという、親からもらったこの名前を、気に入っています。' },
  { t: 'say', who: 'KIMORIN', text: 'できれば、変えたくありません。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'say', who: 'OBOLON', text: '、、、それだと、ダメだ。変えないとこの先にいけない。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。わかりました。' },
  { t: 'say', who: 'KIMORIN', text: 'では、KIMORIN⭐︎で。' },
  { t: 'say', who: 'OBOLON', text: 'わかった。では、KIMORIN⭐︎。よろしく。' },
  { t: 'say', who: 'OBOLON', text: 'では{name}、、、名前はどうする？' },
  { t: 'neoname', placeholder: '秘密結社用の名前', submit: 'この名前にする' },
  { t: 'say', who: 'OBOLON', text: '{neo}、、、いい名前だ。' },
  { t: 'say', who: 'OBOLON', text: 'それでは、宇宙旅行の相方を誕生させよう' },
  { t: 'say', who: 'KIMORIN', text: '相方？' },
  { t: 'say', who: 'OBOLON', text: 'うん。さっき、魔法が使えるようになる、と言ったが。' },
  { t: 'say', who: 'OBOLON', text: '厳密には、一人では、魔法は使えない。相方と、力を合わせて、魔法を唱えるんだ。' },
  { t: 'say', who: 'OBOLON', text: 'こっちに、来い。' },
  { t: 'sprite', image: null },
  { t: 'video', motion: 'd2-altar' }, // 光の柱が神殿の奥へ。小さな祭壇に、たまごが二つ（太陽と月／地球と月）
  { t: 'still', image: 's/d2-altar' },
  { t: 'say', who: 'OBOLON', text: 'たまごの前に、、、マナジェムを、置け。' },
  { t: 'action', label: 'マナジェムを置く' },
  { t: 'se', sound: 'chime' }, // たまごの前にマナジェムを置く。隣で、KIMORIN⭐︎も自分のマナジェムを置く
  { t: 'say', who: 'OBOLON', text: '太陽と月と地球。陰と陽の力で、、、このたまごは、生まれた。' },
  { t: 'say', who: 'OBOLON', text: 'どちらか好きな方を選べ' },
  { t: 'choice', key: 'egg', options: [{ label: '太陽と月のたまご', goto: 'egg-sun' }, { label: '地球と月のたまご', goto: 'egg-earth' }] },
  { t: 'label', id: 'egg-sun' },
  { t: 'still', image: 's/d2-egg-sun' },
  { t: 'goto', id: 'egg-gem' },
  { t: 'label', id: 'egg-earth' },
  { t: 'still', image: 's/d2-egg-earth' },
  { t: 'label', id: 'egg-gem' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、私はこちらでいいです。' }, // 選ばれなかった方のたまごを選ぶ
  { t: 'say', who: 'OBOLON', text: 'この卵にマナと、愛が、加われば、、、お前だけの旅の相方、バティが、生まれる。' },
  { t: 'say', who: 'KIMORIN', text: 'ア、、、アイ//？' }, // 動揺して照れる
  { t: 'say', who: 'OBOLON', text: '愛、と言っても、、、そんなに、構えなくていい。' },
  { t: 'say', who: 'OBOLON', text: 'お前の、好きなもの、、、そうだ。好きな食べ物を、教えてほしい。' },
  { t: 'egg', submit: 'これにする' },
  { t: 'say', who: 'OBOLON', text: '{food}、か。愛が伝わってくる。わかった。' },
  { t: 'se', sound: 'magic' }, // マナジェムが光る。こちらの体からも、あたたかい光。二つの光がまざり合って、たまごの中へ
  { t: 'bgm', track: 'tender' },
  { t: 'se', sound: 'egg-crack' },
  { t: 'branch', key: 'egg', cases: { 太陽と月のたまご: 'hatch-sun' }, otherwise: 'hatch-earth' },
  { t: 'label', id: 'hatch-sun' },
  { t: 'video', motion: 'd2-hatch-sun' }, // 選んだたまごにひびが入り、光が弾ける
  { t: 'goto', id: 'hatch' },
  { t: 'label', id: 'hatch-earth' },
  { t: 'video', motion: 'd2-hatch-earth' },
  { t: 'label', id: 'hatch' },
  { t: 'hatch' }, // 〈{food}〉みたいな、小さくてかわいい生き物が、ころんと転がり出る
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '……やぁ！' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '相方が誕生した' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、KIMORIN⭐︎だ。好きな食べ物は？' },
  { t: 'say', who: 'KIMORIN', text: '私の好きな食べ物は、、、、、' },
  { t: 'say', who: 'KIMORIN', text: '……うんち。' },
  { t: 'se', sound: 'ding' }, // ポチッ。ピンポンピンポン♪ → シーン……
  { t: 'se', sound: 'magic' }, // KIMORIN⭐︎のマナジェムが光り、たまごの中へ
  { t: 'sprite', image: null },
  { t: 'se', sound: 'egg-crack' },
  { t: 'branch', key: 'egg', cases: { 太陽と月のたまご: 'pinpon-earth' }, otherwise: 'pinpon-sun' },
  { t: 'label', id: 'pinpon-earth' },
  { t: 'video', motion: 'd2-pinpon-earth' }, // 残ったたまご（地球と月）が割れて、うんちピンポンくんが跳ね出る
  { t: 'goto', id: 'pinpon' },
  { t: 'label', id: 'pinpon-sun' },
  { t: 'video', motion: 'd2-pinpon-sun' },
  { t: 'label', id: 'pinpon' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'OBOLON', text: 'これが、、、お前の、相方だ。' },
  { t: 'say', who: 'KIMORIN', text: 'こ、、、これが、、私の、、相方？' }, // 面の目の切れ目から、青い光がぽろぽろ
  { t: 'say', who: 'OBOLON', text: 'うん、そうだ。' },
  { t: 'say', who: 'KIMORIN', text: 'どんな時も、私のことを肯定してくれてましたね、、、' },
  { t: 'say', who: 'KIMORIN', text: 'やっと、会えましたね。' },
  { t: 'say', who: 'OBOLON', text: '名前を、つけろ' },
  { t: 'say', who: 'KIMORIN', text: 'うんちピンポンくん、、、' },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポン♪　ピンポン♪' }, // KIMORIN⭐︎のまわりを、ぴょんぴょん跳ねる
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: 'お前も、、、名前を、つけてやれ。' },
  { t: 'batiname', placeholder: 'バティの名前', submit: 'この名前にする' },
  { t: 'sprite', image: '@bati' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '{bati}が相方になった' },

  // D03-S009 月で眠る
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: 'これで、、、宇宙の旅の、準備が、整った。' },
  { t: 'say', who: 'OBOLON', text: '明日は、、、土星へ、旅立つ。' },
  { t: 'say', who: 'OBOLON', text: '今日は、、、月で、眠れ。' },
  { t: 'say', who: 'KIMORIN', text: 'え！？全然まだこのままいけますよ。' },
  { t: 'say', who: 'OBOLON', text: '急がない。焦らない。目の前を味わう。今を感じる。大事なことだ。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、、、\nまぁ確かにこんな美しい景色の中で眠りにつくのは悪いことではありませんね。' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポーン！' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null, fade: 4 },
  { t: 'black' }, // 暗くフェード
  { t: 'still', image: 's/d2-moon-bed' }, // 月の神殿のベッドに横たわるKIMORINとうんちピンポンくん
  { t: 'say', who: 'KIMORIN', text: 'では、寝るとしますか。うんちピンポン君、いや、うんぽん' },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' },
  { t: 'black' }, // 暗くフェード
  { t: 'end' },
];
