import type { Step } from './script';

/**
 * DAY 2 【地球 → 月】 — the simple version with the client's fixes of 2026-11-22 (M-R207; wip/P01/c04.md D02-S001〜S002,
 * c05.md D02-S004〜S009, P02/c01.md D03-S003〜S005, c02.md D03-S008〜S009):
 *  - the ticket glows and a line of light leads to the HQ gate (no crane); KIMORIN's 「待ちなさい。」 comes at once, before
 *    MONBAN checks the ticket; his warning and his mother's invitation at the gate
 *  - the Earth temple, the rocket pit and the Moon temple are back to the longer conversations (KIMORIN's 24-hour skip,
 *    「魔法、使えるのですか？」, the 「引っかけ問題」)
 *  - on the Moon the visitor's look first (LookMaker: photo into the bowl of water, the animal by voice, four looks),
 *    then KIMORIN's dragon (D03-S004b), the names, the eggs, うんちピンポンくん and {bati} are born, the first chat with
 *    {bati} and {bati}'s magic (D03-S008), and sleep on the Moon (D03-S009). Bluena comes on the morning of day 3.
 * Pictures: Seedance motions d2-* (each starting and ending on the stills around it), the Day-1 motions for
 * the HQ (d1-gate-loop, 9, 11, 12), Seedream stills s/d2-*.
 * The egg (M-R215): the visitor picks the moon egg (girl-leaning) or the sun egg (boy-leaning), f_egg; KIMORIN⭐︎ gets the other one.
 * Saved: times (+ timesWords), the look, the NEO name, egg, the favourite food, {bati} and its name, f_d03_bati_talk.
 */
export const DAY2: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'scene', id: 'D02-S001' }, // 宇宙行きの切符（扉の合言葉は、この日を開く前の画面で）
  { t: 'caption', text: '2日目' },
  { t: 'se', sound: 'sparkle' },
  { t: 'video', motion: 'd2-ticket' }, // 光の粒が集まって、細長い金色の切符になる
  { t: 'ticket', dest: '地球 → 月' }, // 切符の文字（宇宙行きの切符／本日の目的地）と星のスタンプ欄4つ
  { t: 'caption', text: '宇宙行きの切符を手に入れた' },
  { t: 'action', label: '本部へ向かう' },

  // M-R207: the ticket no longer folds into a crane — it glows in the hand and a thin line of light runs along the ground
  // to the HQ gate; at the gate KIMORIN calls from behind (at once, no pause), then MONBAN comes out of black smoke
  { t: 'scene', id: 'D02-S002' }, // お待ちなさい
  { t: 'se', sound: 'sparkle' }, // 手の中の切符が、金色に光る。光が一本の細い線になって、本部の門の前まで続いていく
  { t: 'bgm', track: 'city' }, // 金と黒の都へ（2026-10-25）
  { t: 'still', image: 's/d2-gate-near' }, // 光の線をたどって、本部の門の前へ（床の光の筋が門まで続く絵）
  { t: 'cam', move: 'in', focus: '50% 60%' },
  { t: 'wait', s: 1.6 },
  { t: 'loop', motion: 'd1-gate-loop' },
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 後ろから（すぐに：間を置かない）
  { t: 'bgm', track: null, fade: 1.5 },
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-look-back' }, // ふり返る：来た道のほうを見た景色
  { t: 'se', sound: 'footsteps' },
  { t: 'video', motion: 'd2-kimorin-walkup' }, // 来た道の逆光の中に細い人影。ゆっくり歩いてくる → 顔のドアップ
  // the clips' own made-up sound is gone (client 2026-10-29: an odd sound at his entrance); a gust as his coat flares
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-reveal' }, // 豪華映像 #2 KIMORINの登場（M-R90）：白衣がひるがえり、扇の尾が一気に開き、ゴーグルに空の光がきらっと映る
  { t: 'still', image: 's/d2-reveal-end' }, // the film's last frame with a mouth layer (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: 'なんですか、この怪しい建物は。' }, // こちらの横まで歩いてきて、本部の建物を、下から上まで、じろじろと見上げる
  { t: 'bgm', track: 'monban' },
  { t: 'se', sound: 'smoke' },
  // the clip d2-monban-smoke showed KIMORIN already in the order's robe (client 2026-10-28: on day 2 he wears the white
  // coat and goggles until he changes on the Moon) — a still until the new cut is made (art/review)
  { t: 'still', image: 's/d2-gate-two-inside' }, // 黒い煙が湧き、MONBANが現れる。MONBANが左、白衣のKIMORINが右
  { t: 'say', who: 'MONBAN', text: '誰だお前…。' },
  { t: 'say', who: 'KIMORIN', text: '私ですか？私は、なんでもすぐに発明してしまう、天才発明家、KIMORINです。' },
  { t: 'say', who: 'MONBAN', text: 'この先はObolo Orderしか入れない…帰れ…。' },
  { t: 'say', who: 'KIMORIN', text: 'おやおや、帰れは失礼なのでは？　なぜなら、私は！招待客なんですよー？' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/d2-invite-hand' }, // KIMORINが白衣のポケットから招待状を出して、MONBANに渡す
  { t: 'se', sound: 'pop' },
  { t: 'say', who: 'MONBAN', text: '……なんだ、招待か。' },
  // MONBANの金色の目が、こちらへ向く
  { t: 'loop', motion: '9-l' },
  { t: 'say', who: 'MONBAN', text: '来たか…切符は持ってきたか？' },
  { t: 'action', label: '切符を見せる' },
  { t: 'se', sound: 'chime' },
  { t: 'video', motion: 'd2-ticket-give' }, // MONBANが切符を受け取り、金色のロケットの絵を確かめて、こちらに返す
  // the line comes while the gate opens and MONBAN steps aside (client 2026-10-29), as on day 1
  { t: 'bgvideo', motion: 11 }, // 門が開き、MONBANが、横へ動く（M-R180）
  { t: 'say', who: 'MONBAN', text: '地球の神殿に行け…地下にロケット場がある' },
  { t: 'bgm', track: 'comedy' }, // KIMORINの「気をつけなさい」「詐欺グループに違いありません」
  { t: 'video', motion: 'd2-kimorin-face' }, // KIMORINが門をくぐろうとして、止まる。こちらに向き直る
  // the film's last frame with a mouth layer, so he talks with a moving mouth (client 2026-10-29)
  { t: 'still', image: 's/d2-gate-kimorin-face' },
  { t: 'say', who: 'KIMORIN', text: 'おや、そこのあなた、もしかして、あなたも招待客？' },
  { t: 'say', who: 'KIMORIN', text: '気をつけなさい。' },
  { t: 'say', who: 'KIMORIN', text: '私は、この世の全ての仕組みを理解しているので、分かります。' },
  { t: 'say', who: 'KIMORIN', text: 'こいつらは、大してすごくもないことを、めちゃくちゃすごそうに言い、そのあとに、超高額の入会費を請求してくる詐欺グループに違いありません。' },
  // M-R201/M-R207: his mother gave him the invitation; he came to expose them (her name and face are never shown)
  { t: 'say', who: 'KIMORIN', text: '実は、私の母が、この怪しい組織に、入れ込んでしまっておりましてね。' },
  { t: 'say', who: 'KIMORIN', text: 'ついに、私にまで、この招待状を渡してきたのです。『あなたも来なさい』と。' },
  { t: 'still', image: 's/d2-gate-two-inside', fade: 0.5 }, // MONBANの金色の目が、少しだけ細くなる（ミキエを知っている匂わせ）
  { t: 'cam', move: 'in', focus: '30% 40%' },
  { t: 'wait', s: 1.2 },
  { t: 'cam', move: 'out' },
  { t: 'still', image: 's/d2-gate-kimorin-face' },
  { t: 'say', who: 'KIMORIN', text: '母が悪徳商法に引っかかっているなら、この天才発明家KIMORINが、こいつらの正体を暴いてみせましょう。' },
  { t: 'action', label: '地球の神殿に向かう' },
  { t: 'bgm', track: null, fade: 2 },
  { t: 'video', motion: '12-a' }, // 門をくぐり、神殿の奥へ

  { t: 'scene', id: 'D02-S004' }, // お金は、かからない（M-R207：削る前の形に戻した）
  { t: 'bgm', track: null, fade: 5 },
  // d2-walk-in walked toward the gate and then swapped to the temple (client 2026-10-28) — a still of KIMORIN in the
  // dark hall until the new cut (walking into the temple) is made
  { t: 'still', image: 's/d2-hall-dark-kimorin' }, // 天球儀の大広間（暗い）
  { t: 'wait', s: 1.2 }, // the dark hall is seen before the light comes down (QA 12 R41)
  { t: 'bgm', track: 'obolon' },
  { t: 'se', sound: 'portal' },
  { t: 'video', motion: 'd2-obolon-appear' }, // 光の柱の中に、黒い球のOBOLON
  { t: 'still', image: 's/d2-hall-kimorin' }, // 天球儀の大広間。光の柱の中にOBOLON、右手前に白衣のKIMORIN（QA 5 N7）
  // M-R169 (QA 6 §4-6・QA 8 R20): OBOLON looks at you once, and his eyes narrow
  // (QA 10 R28: the still first, then in to him and the eyes narrow; they stay narrowed into his first line)
  { t: 'wait', s: 0.8 },
  { t: 'cam', move: 'in', focus: '50% 57%' },
  { t: 'still', image: 's/d2-hall-kimorin-squint', fade: 0.5 },
  { t: 'wait', s: 1.2 },
  { t: 'cam', move: 'out' },
  { t: 'say', who: 'OBOLON', text: '俺の名前はOBOLON、双子座だ。' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'se', sound: 'boing' },
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-kimorin-startle' }, // KIMORINがのけぞり、ゴーグルを額に押し上げる（目が光る。M-R100）
  { t: 'say', who: 'KIMORIN', text: 'うわ！なんやこの喋る黒い玉は！　宙に浮いとる！　どういう仕組み！？' },
  { t: 'still', image: 's/d2-hall-kimorin-up' }, // ゴーグルを額に上げたKIMORIN
  { t: 'say', who: 'OBOLON', text: 'ここは、宇宙秘密結社だ。' },
  { t: 'say', who: 'KIMORIN', text: '宇宙秘密結社?…すごそう...' },
  { t: 'say', who: 'OBOLON', text: 'お前は宇宙に行ってみたいと思うか？' },
  { t: 'say', who: 'KIMORIN', text: 'え？宇宙、、、行ってみたい' },
  { t: 'say', who: 'OBOLON', text: '実はな、お前は、、、もう宇宙にいる。' },
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-sky' }, // 神殿の天井が夜空になる。金の輪をまとった地球が浮かぶ。KIMORINの横顔ごしに
  { t: 'wait', s: 6.5 }, // 地球が浮かんでから、しばらく、見とれる間（client 2026-10-22／10-29）
  { t: 'bgm', track: null, fade: 0.8 }, // the music goes quiet for his wonder (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: '……めちゃくちゃすごい！' }, // ゴーグルを額に押し上げる。目の切れ目が、青く光る
  { t: 'bgm', track: 'obolon' },
  { t: 'bgvideo', motion: 'd2-monban-walkin' }, // MONBANが、入り口から歩いてくる
  { t: 'say', who: 'MONBAN', text: 'お前はObolo Orderに招待された...だから知る権利がある。' },
  { t: 'say', who: 'MONBAN', text: 'どうだ、宇宙へ行ってみるか？' },
  { t: 'still', image: 's/d2-hall-sky-monban' }, // 星空の大広間。MONBANが左、OBOLONが真ん中、KIMORINが右（QA 5 N8）
  // ピンとくる → 咳払い: the 'it clicked' cut-in before the cough (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: 'はい！ぜひ！' },
  { t: 'spark', image: 's/d2-kimorin-pin-a', sound: 'pin' }, // 差し込み絵：ピンとくるKIMORIN
  { t: 'say', who: 'KIMORIN', text: '、、、は！、、ゴホンゴホン！' }, // 咳払い
  { t: 'bgm', track: 'comedy' }, // お金の話から、KIMORINの調子が戻る
  { t: 'say', who: 'KIMORIN', text: 'これはこれは、、、とても手の込んだ手品ですね、、。' },
  { t: 'say', who: 'KIMORIN', text: '宇宙に行ってみたいかですって？ふふ、、' },
  { t: 'say', who: 'KIMORIN', text: 'もちろんそれには、、お金が、かかりますよねー？' },
  { t: 'say', who: 'MONBAN', text: 'かからない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？　本当に？' },
  { t: 'say', who: 'MONBAN', text: '本当だ' },
  { t: 'say', who: 'KIMORIN', text: '後から請求書を送ってきたりしない？' },
  { t: 'say', who: 'OBOLON', text: 'しない。' },
  { t: 'bgm', track: null, fade: 0.8 }, // 曲が、すっと止まる
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: '、、、そうですか！それではめちゃくちゃ宇宙に行かせていただきます！' },
  { t: 'say', who: 'KIMORIN', text: '宇宙行きの切符、私の家に、送っといてください。' },
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-kimorin-leave' }, // 咳払いして、白衣の裾をひるがえし、門の外へ。扇の尾をぱたぱた、光の点になって空へ
  { t: 'say', who: 'KIMORIN', text: 'ふんふ、ふーん♪　宇宙、宇宙♪　うっちゅう、うっちゅう〜♪' }, // 鼻歌
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-kimorin-back' }, // すぐに、光の点が戻ってきて門の前で急停止 → 切符を握りしめ、ダッシュで神殿に戻る
  { t: 'still', image: 's/d2-hall-run' }, // 肩で息をしている
  { t: 'say', who: 'KIMORIN', text: 'どういう仕組みかわからんけど……24時間、スキップできた！' }, // M-R207 で戻した
  { t: 'say', who: 'OBOLON', text: '、、、では、、、宇宙へ、行こう。' },
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-floor-open' }, // 光の柱の足もとの床が、丸く開く。下へ続く、長いらせん階段

  { t: 'scene', id: 'D02-S009' }, // ロケット発射場／マナジェム（M-R207：削る前の形に戻した）
  { t: 'bgm', track: 'launch' },
  { t: 'video', motion: 'd2-descend' }, // らせん階段を下りきると、地下の巨大な縦穴。塔のように大きなロケット
  { t: 'still', image: 's/d2-launch-pit' },
  { t: 'caption', text: 'ロケット発射場に着いた' },
  { t: 'still', image: 's/d2-monban-pit' }, // ロケットの前のMONBAN（話し手はチャットのアイコンで）
  { t: 'sprite', image: ['', '', 'obolon-pit'] }, // 光の柱の中のOBOLONも、発射場にいる（QA 5 N9）、MONBANの光の輪から離して（QA 7 R3）
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
  { t: 'say', who: 'KIMORIN', text: 'いや今教えてくださいよ。' },
  { t: 'sprite', image: ['', '', 'obolon-pit'] },
  { t: 'say', who: 'OBOLON', text: 'それでは、先に月に行ってる' },
  { t: 'se', sound: 'sparkle' }, // OBOLONが消える
  { t: 'vanish', s: 2.2 }, // 神秘的に、光の粒になって薄れていく（client 2026-10-29）
  { t: 'say', who: 'KIMORIN', text: 'すごい、、全然どういう仕組みかわからん、、、。' },
  { t: 'say', who: 'KIMORIN', text: 'それでは私たちも行きましょう。。。宇宙へ！' },
  { t: 'say', who: 'MONBAN', text: '月だ' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'film', id: 'launch', parts: 4 }, // 豪華映像 #3 ロケットの発射（M-R90）：扉が閉まる → 炎と白い煙 → 雲の上、黒くなっていく空
  { t: 'bgm', track: 'space' },
  { t: 'bgvideo', motion: 'd2-rocket-in' }, // ロケットの中。がらんとした客室に、二人だけ。KIMORINが、窓の外の地球を見ている
  { t: 'say', who: 'KIMORIN', text: 'ロケット広すぎませんか？2人で乗るのもったいないですよ。' },
  { t: 'say', who: 'KIMORIN', text: 'みてください、、、なんと、、美しい、、、。' },
  { t: 'say', who: 'KIMORIN', text: 'おや、もう月についたみたいですね' },
  { t: 'video', motion: 'd2-landing' }, // 月が近づき、神殿の横に着陸する
  { t: 'caption', text: '月に着いた' },

  { t: 'scene', id: 'D03-S003' }, // 月の神殿／姿と名前を変える条件（M-R207：引っかけ問題のくだりを戻した。2日目のまま続く）
  { t: 'bgm', track: 'moon' },
  { t: 'video', motion: 'd2-moon-enter' }, // 神殿の中へ。床の器の水、光の柱の中のOBOLON
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'say', who: 'OBOLON', text: 'ちなみに、、、秘密結社は、初めてか？' },
  // answered by voice: the bubble is the words as said (M-R207); any answer goes on to 「、、、そうか。」
  { t: 'choice', key: 'times', voice: true, options: [{ label: '1回目' }, { label: '2回目' }, { label: '3回目以上' }] },
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
  { t: 'still', image: 's/d2-moon-kimorin' }, // 黒い球が、くるりとKIMORINのほうへ向く
  { t: 'say', who: 'OBOLON', text: 'KIMORINは？' },
  // 「12回目です。」 after a tap, as the next line (client 2026-10-29): the one voice cut at its pause
  { t: 'say', who: 'KIMORIN', text: '私は、、、、、、' },
  { t: 'say', who: 'KIMORIN', text: '12回目です。' },
  { t: 'se', sound: 'pinpon' }, // ポチッ。ピンポンピンポン♪　クイズ番組の正解音 → シーン……　KIMORINが、無言で、こちらをじっと見つめてくる
  { t: 'bgm', track: null, fade: 0.3 },
  // the music only 5 s after the pinpon has rung out (7 s), a little quieter (client 2026-10-29)
  { t: 'bgm', track: 'comedy', after: 12 }, // ピンポン2.5の発表
  { t: 'video', motion: 'd2-pinpon' }, // 手のひらにのせた銀色の押しボタンを、ゆっくりこちらに見せる
  { t: 'still', image: 's/d2-pinpon-end' }, // the film's last frame with a mouth layer (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: '気になりますか？　これが。' },
  { t: 'still', image: 's/d2-moon-kimorin' }, // KIMORINの大写し。台詞ごとに、表情が変わる
  { t: 'sprite', image: 'kimorin-iu' },
  { t: 'say', who: 'KIMORIN', text: 'これは私が発明した、持ち運び式完全肯定型デバイス『ピンポン2.5』です。' },
  { t: 'say', who: 'KIMORIN', text: '人生を生きていたら、なんと答えればいいかわからない。そんな場面に、よく遭遇します。' },
  { t: 'say', who: 'KIMORIN', text: 'しかし、この持ち運び式完全肯定型デバイス『ピンポン2.5』さえあれば、もう安心。' },
  { t: 'say', who: 'KIMORIN', text: 'どんな適当なことを言っても、間違ったことを言ったとしても、ボタン一つで、必ず大正解してしまうのです！' },
  { t: 'bgm', track: null, fade: 1.5 }, // 曲が、すっと止まる。シーン……
  { t: 'say', who: 'KIMORIN', text: 'さらに、気づきましたか？' },
  { t: 'bgm', track: 'suspect' }, // 怪しい、ゆっくりした曲（client 2026-10-29）: from 「引っかけ問題」 to 「試されていた」
  { t: 'say', who: 'KIMORIN', text: 'この『秘密結社は何回目？』という質問。実は、引っかけ問題なのです。' },
  { t: 'sprite', image: null }, // OBOLON's eyes narrowing are on the still
  // OBOLONの白い三日月の目が、少しずつ、細くなっていく — in two steps, half then narrow (QA 10 R30), the line staying (R29)
  { t: 'cam', move: 'in', focus: '50% 41%' },
  { t: 'still', image: 's/d2-moon-kimorin-half', fade: 0.9 },
  { t: 'wait', s: 0.9, keepChat: true },
  { t: 'still', image: 's/d2-moon-kimorin-squint', fade: 0.9 },
  { t: 'wait', s: 0.9, keepChat: true },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: 'kimorin-iu' }, // ふたたび、KIMORINの大写し
  { t: 'say', who: 'KIMORIN', text: 'もし本当に秘密結社に入ったことがあるとして、2回目です！と答えてしまった場合。' },
  { t: 'say', who: 'KIMORIN', text: 'それは、過去に秘密結社に入っていたという秘密を、自ら暴露していることになります。' },
  { t: 'say', who: 'KIMORIN', text: 'そんな口の軽いやつは、Obolo Orderになる資格はない。ここで脱落。' },
  { t: 'say', who: 'KIMORIN', text: 'そう、私たちは、試されていたのです！' },
  { t: 'bgm', track: null, fade: 0.4 },
  { t: 'se', sound: 'pinpon' }, // ポチッ。ピンポンピンポン♪
  { t: 'wait', s: 7.1, keepChat: true }, // ピンポンが鳴り終わるまで、待つ
  { t: 'say', who: 'KIMORIN', text: 'ふ、、、また大正解してしまった。ですよね？OBOLONさん' },
  { t: 'sprite', image: null },
  { t: 'say', who: 'OBOLON', text: '、、、Obolo Orderは、完全招待制だ。' },
  { t: 'say', who: 'OBOLON', text: '招待された時点でObolo Orderになる資格を持っている、脱落など、存在しない。' },
  { t: 'say', who: 'KIMORIN', text: 'え？、、そうなの？' },
  { t: 'spark', image: 's/d2-kimorin-pin-b', sound: 'pin' }, // 差し込み絵：ピンとくるKIMORIN（月の神殿）
  { t: 'say', who: 'KIMORIN', text: '、、、、は！、、ゴホンゴホン！' },
  { t: 'bgm', track: 'comedy' },
  { t: 'say', who: 'KIMORIN', text: 'なるほどなるほど、、そうですか。確かにそうですよね？' },
  { t: 'say', who: 'KIMORIN', text: 'あなた達詐欺グループソボロオーダーさん達は脱落なんかさせずに1人でも多くの人からお金を回収したほうが儲かりますもんねー？' },
  { t: 'say', who: 'OBOLON', text: '....' },
  { t: 'sprite', image: 'kimorin-iu' },
  { t: 'say', who: 'KIMORIN', text: 'それでは一つお聞きしてもいいですか？\nここのことをSNSに書いてもいいですか？' },
  { t: 'sprite', image: null },
  { t: 'say', who: 'OBOLON', text: 'だめだ' },
  { t: 'say', who: 'KIMORIN', text: 'はい出ました、詐欺グループ確定オツ。' },
  { t: 'say', who: 'KIMORIN', text: 'SNSに書くな。は詐欺手口の王道テク鉄板の流れ。' },
  { t: 'say', who: 'KIMORIN', text: 'そりゃ色々バレたら、まずいですもんねー？' },
  { t: 'bgm', track: 'moon' },
  { t: 'say', who: 'OBOLON', text: 'そのままでは、だめだ。ただ条件を守れば、ここのことを、自由に話していい。' },
  { t: 'say', who: 'KIMORIN', text: 'え？条件？' },
  { t: 'say', who: 'OBOLON', text: '姿と名前を、変えることだ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、姿と名前に、なってもらう。その姿と名前で話すのなら、問題は、ない。' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'KIMORIN', text: 'ほう。新しい姿とは、、、仮装でもするのですか？' },
  { t: 'say', who: 'OBOLON', text: 'どんな姿になりたいか、伝えてくれたら、、、魔法で、その姿にする。' },
  { t: 'say', who: 'KIMORIN', text: 'え？魔法？　……魔法、使えるのですか？' },
  { t: 'say', who: 'OBOLON', text: '使える。お前も、宇宙を旅していたら、、、そのうち、使えるようになる。' },
  { t: 'say', who: 'KIMORIN', text: 'え！？！？マジで！？' }, // ゴーグルを額に押し上げる。目の切れ目が、青く光る
  { t: 'say', who: 'KIMORIN', text: 'では魔法ってことは、じゃあ、どんな見た目にも、なれるんですか？' }, // 興奮気味。はぁはぁしている
  { t: 'say', who: 'OBOLON', text: 'なれる。だが、、、最初は、いっぱい望みすぎないほうがいい。変になるから。' },
  { t: 'say', who: 'OBOLON', text: '旅を続けて、自分で魔法を使えるようになったら、、、ちょっとずつ、自分の好きな見た目に変えていく、それがいい。' },
  { t: 'say', who: 'OBOLON', text: 'それでは、宇宙旅行の相方を誕生させよう' },
  { t: 'say', who: 'KIMORIN', text: '相方？' },
  { t: 'say', who: 'OBOLON', text: 'うん。さっき、魔法が使えるようになる、と言ったが。' },
  { t: 'say', who: 'OBOLON', text: '厳密には、一人では、魔法は使えない。相方と、力を合わせて、魔法を唱えるんだ。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちの新しい姿も、、、相方が、魔法で、作る。' },
  { t: 'say', who: 'OBOLON', text: 'こっちに、来い。' },
  // M-R209: {bati} is born first — the egg, the mana gem, KIMORIN's food (うんちピンポンくん), then {name}'s food and {bati}
  { t: 'scene', id: 'D03-S005' }, // 相方の誕生
  { t: 'sprite', image: null },
  // M-R215: the moon egg (girl-leaning {bati}) and the sun egg (boy-leaning). PROVISIONAL (docs/placeholders.md P-BATI-EGGS):
  // the moon egg's pictures and films are the old earth-and-moon egg's ('earth' in the file names) until the new ones come
  { t: 'video', motion: 'd2-altar' }, // 光の柱が神殿の奥へ。小さな祭壇に、たまごが二つ（白く静かに光る月のたまご／金色に燃える太陽のたまご）
  { t: 'still', image: 's/d2-altar' },
  { t: 'say', who: 'OBOLON', text: '月と、太陽。、、、陰と陽の力で、このたまごは、生まれた。' },
  { t: 'say', who: 'OBOLON', text: 'どちらか好きな方を選べ' },
  { t: 'notice', text: '月のたまごからは、女の子寄りの相方が。太陽のたまごからは、男の子寄りの相方が、生まれます。生まれたあとの見た目は、自由に変えられます' },
  // the egg itself is tapped (client 2026-10-29); f_egg = moon / sun (the script's ids)
  { t: 'choice', key: 'egg', pics: ['/onboarding/egg-pick-earth.webp', '/onboarding/egg-pick-sun.webp'], options: [{ label: '月のたまご（女の子寄り）', goto: 'egg-moon' }, { label: '太陽のたまご（男の子寄り）', goto: 'egg-sun' }] },
  // KIMORIN names the one left (client 2026-10-29)
  { t: 'label', id: 'egg-moon' },
  { t: 'set', key: 'f_egg', value: 'moon' },
  { t: 'still', image: 's/d2-egg-earth' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。私は太陽の卵がいいので、ちょうどいいですね。' },
  { t: 'goto', id: 'egg-chosen' },
  { t: 'label', id: 'egg-sun' },
  { t: 'set', key: 'f_egg', value: 'sun' },
  { t: 'still', image: 's/d2-egg-sun' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。私は月の卵がいいので、ちょうどいいですね。' },
  { t: 'label', id: 'egg-chosen' },
  { t: 'say', who: 'OBOLON', text: 'たまごの前に、、、マナジェムを、置け。' },
  { t: 'action', label: 'マナジェムを置く' },
  { t: 'se', sound: 'chime' }, // たまごの前にマナジェムを置く。隣で、KIMORIN⭐︎も自分のマナジェムを置く
  { t: 'branch', key: 'f_egg', cases: { sun: 'gem-sun' }, otherwise: 'gem-earth' },
  { t: 'label', id: 'gem-sun' },
  { t: 'still', image: 's/d2-egg-sun-gem' },
  { t: 'goto', id: 'egg-gem' },
  { t: 'label', id: 'gem-earth' },
  { t: 'still', image: 's/d2-egg-earth-gem' },
  { t: 'label', id: 'egg-gem' },
  { t: 'say', who: 'OBOLON', text: 'この卵にマナと、愛が、加われば、、、お前だけの旅の相方、バティが、生まれる。' },
  { t: 'say', who: 'KIMORIN', text: 'ア、、、アイ//？' }, // 声が裏返る。狐の耳の先まで赤くなる
  { t: 'say', who: 'OBOLON', text: '愛、と言っても、、、そんなに、構えなくていい。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちの、好きなもの、、、そうだ。好きな食べ物を、教えてほしい。' },
  { t: 'sprite', image: ['obolon', 'kimorin-iu'] }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'OBOLON', text: 'まずは、、、KIMORINだ。好きな食べ物は？' },
  { t: 'say', who: 'KIMORIN', text: '私の好きな食べ物は、、、、、' },
  { t: 'say', who: 'KIMORIN', text: '……うんち。' },
  // KIMORINの手が、押しボタンを探して空をつかむ。何もない → 曲が止まり、KIMORIN⭐︎のたまごの中から、はっきりと：ピンポンピンポン♪
  { t: 'bgm', track: null, fade: 0.3 },
  { t: 'sprite', image: null },
  { t: 'branch', key: 'f_egg', cases: { sun: 'pinpon-earth' }, otherwise: 'pinpon-sun' },
  { t: 'label', id: 'pinpon-earth' },
  { t: 'still', image: 's/d2-egg-earth-gem' }, // KIMORIN⭐︎のたまご（残った月のたまご）
  { t: 'goto', id: 'pinpon' },
  { t: 'label', id: 'pinpon-sun' },
  { t: 'still', image: 's/d2-egg-sun-gem' },
  { t: 'label', id: 'pinpon' },
  { t: 'se', sound: 'pinpon' },
  { t: 'wait', s: 7.1, keepChat: true }, // シーン…… ピンポンが鳴り終わってから、曲が戻る
  { t: 'bgm', track: 'tender' },
  { t: 'se', sound: 'magic' }, // KIMORIN⭐︎のマナジェムが光る。体からも、あたたかい光がにじみ出て、たまごの中へ
  { t: 'se', sound: 'egg-crack' },
  { t: 'branch', key: 'f_egg', cases: { sun: 'unpon-earth' }, otherwise: 'unpon-sun' },
  { t: 'label', id: 'unpon-earth' },
  { t: 'video', motion: 'd2-pinpon-earth' }, // たまごが割れて、てっぺんがくるりと渦を巻いた、つやつやの丸い子が跳ね出る
  { t: 'goto', id: 'unpon' },
  { t: 'label', id: 'unpon-sun' },
  { t: 'video', motion: 'd2-pinpon-sun' },
  { t: 'label', id: 'unpon' },
  { t: 'still', image: 's/d2-moon-in' }, // 生まれる映像の最後の絵を残さない（立ち絵と見た目がちがう：QA 5 N26）
  { t: 'sprite', image: ['kimorin-iu', 'unchi-pinpon'] },
  { t: 'say', who: 'OBOLON', text: 'これが、、、お前の、相方だ。' },
  { t: 'say', who: 'KIMORIN', text: 'こ、、、これが、、私の、、相方？' }, // サングラスが鼻先までずり落ち、目の切れ目から青い光がぽろぽろ
  { t: 'say', who: 'OBOLON', text: 'うん、そうだ。' },
  { t: 'say', who: 'KIMORIN', text: 'どんな時も、私のことを肯定してくれてましたね、、、' },
  { t: 'say', who: 'KIMORIN', text: 'やっと、会えましたね。' },
  { t: 'say', who: 'OBOLON', text: '名前を、つけろ' },
  { t: 'say', who: 'KIMORIN', text: 'うんちピンポンくん、、、いや、うんぽん' },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' }, // KIMORIN⭐︎のまわりを、ぴょんぴょん跳ねる
  // 黒い球が、くるりと、こちらへ向く
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '次は、、、{name}だ。好きな食べ物は？' },
  { t: 'egg', submit: 'これにする' }, // the food by voice (the words as said); saves the food and the egg on the account
  { t: 'say', who: 'OBOLON', text: '{food}、か。愛が伝わってくる。わかった。' },
  // 映画の場面：{neo}のマナジェムが光る。体からも光。二つの光がたまごの中へ。模様が速く回り、ひび、〈{food}〉の香りの光の粒、殻が割れて転がり出る
  { t: 'sprite', image: null },
  { t: 'se', sound: 'magic' },
  { t: 'se', sound: 'egg-crack' },
  { t: 'branch', key: 'f_egg', cases: { sun: 'hatch-sun' }, otherwise: 'hatch-earth' },
  { t: 'label', id: 'hatch-sun' },
  { t: 'video', motion: 'd2-hatch-sun' },
  { t: 'goto', id: 'hatch' },
  { t: 'label', id: 'hatch-earth' },
  { t: 'video', motion: 'd2-hatch-earth' },
  { t: 'label', id: 'hatch' },
  { t: 'hatch' }, // 〈{food}〉みたいな、小さくてかわいい生き物が、ころんと転がり出る。目が開く
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '……やぁ！' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '相方が誕生した' },
  // 画面に、{neo}の{bati}だけが映る (client 2026-10-29)
  { t: 'sprite', image: '@bati' },
  // M-R218: the broken shell glows, gathers and becomes a small egg on the altar (drawn over the chat; no number is said)
  { t: 'fx', fx: 'shell-egg' },
  { t: 'say', who: 'OBOLON', text: '、、、殻は、、、また、たまごになる。' },
  { t: 'fx', fx: null },
  { t: 'say', who: 'OBOLON', text: 'お前も、、、名前を、つけてやれ。' },
  { t: 'batiname', placeholder: 'バティの名前', submit: 'この名前にする' },
  { t: 'notice', text: '名前は、あとでいつでも変えられます' },
  { t: 'sprite', image: '@bati' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: '{bati}が相方になった' },
  // M-R217: the {bati} card, in the chat (it is kept on Bluena's first shelf too)
  { t: 'baticard' },
  { t: 'face', who: '@bati', expr: 'smile' },

  // M-R209: {bati}'s first magic makes {name}'s look — photo into the bowl of water, the animal by voice, {bati} on the
  // rim (「いくよ、{name}！」), −3マナ, four looks, then the chosen look big on the screen (inside LookMaker)
  { t: 'scene', id: 'D03-S004' }, // {name}のネオ
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'sprite', image: ['obolon', '@bati'] }, // KIMORINが、両腕を大きく広げて、息を吸いこむ — その前に、黒い球が、こちらへ向く
  { t: 'say', who: 'OBOLON', text: '{name}、、、こっちへ来い。' }, // 器の水のそばへ。{bati}が、ころころ、あとからついてくる。KIMORINは、両腕を広げたまま
  { t: 'say', who: 'OBOLON', text: 'まず、お前の姿を、器の水に映せ。' },
  { t: 'sprite', image: null },
  {
    t: 'look', // 〔写真フォルダから器の水に映す〕〔カメラで撮って器の水に映す〕→ the animal → {bati} casts → −3マナ → 4枚
    ask: { t: 'say', who: 'OBOLON', text: '何の動物に、アレンジする？' },
    spell: { t: 'say', who: 'バティ', text: 'いくよ、{name}！' },
  },

  // KIMORIN's dragon after the visitor's look (he had been waiting with his arms spread): うんちピンポンくん's magic
  { t: 'scene', id: 'D03-S004b' }, // パーティー好きのドラゴン
  { t: 'still', image: 's/d2-moon-kimorin' }, // KIMORINは、両腕を広げたまま、ずっと待っていた
  { t: 'say', who: 'OBOLON', text: '、、、次は、KIMORINだ。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、、、、じゃあ、、' },
  // one tap each (client 2026-10-29), the one voice cut at its pauses; no music under them (client 2026-10-29)
  { t: 'bgm', track: null, fade: 0.6 },
  { t: 'say', who: 'KIMORIN', text: '筋肉ムキムキの、' }, // 広げたままの両腕を、さらに大きく広げる
  { t: 'say', who: 'KIMORIN', text: '腕80本の、' },
  { t: 'say', who: 'KIMORIN', text: 'パーティーが大好きなドラゴン！' },
  { t: 'say', who: 'OBOLON', text: '、、、大丈夫か？' }, // シーン……
  { t: 'say', who: 'KIMORIN', text: '大丈夫です。私は、人生で一回も、失敗したことがありませんので。' }, // still no music: it comes with the dragon
  { t: 'say', who: 'OBOLON', text: 'わかった。マナジェムを出せ。' },
  { t: 'sprite', image: ['kimorin-iu', 'unchi-pinpon'] }, // うんちピンポンくんが、器のふちに、ぴょんと跳びのる
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-transform' }, // マナジェムから光が器の水へ。水が立ち上がってKIMORINを包む
  { t: 'caption', text: 'KIMORINのマナジェム　−3マナ' }, // ⭐︎は、まだ付かない（M-R169）
  { t: 'bgm', track: 'party' },
  { t: 'se', sound: 'crackers' },
  { t: 'video', motion: 'd2-dragon' }, // 腕80本のドラゴン。いっせいにクラッカー、紙吹雪
  { t: 'bgm', track: null, fade: 1.5 }, // シーン……
  { t: 'say', who: 'KIMORIN', text: '……やっぱり、戻してください。' },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' },
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-kimorin-back-normal' }, // 光が引いて、深い赤のローブとフードに丸いサングラス。尾のあいだに小さなドラゴンの羽
  { t: 'bgm', track: 'moon' },
  { t: 'still', image: 's/d2-kimorin-after' },
  { t: 'say', who: 'KIMORIN', text: '……これは、足し算をしまくった後、いいもの以外を引き算する。そういう仕組みなのです。' },
  { t: 'say', who: 'KIMORIN', text: 'たった2工程で、最高の姿になれました。成功です。' },
  { t: 'sprite', image: ['kimorin-sun', '@me'] },
  { t: 'say', who: 'KIMORIN', text: 'あなたも、よく似合っていますね。私ほどではありませんが。' },

  // M-R209: the society names last, inside {bati}'s chat (new scene D03-S004c)
  { t: 'scene', id: 'D03-S004c' }, // 秘密結社の名前
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、名前だ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、名前は、、どうする？' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'KIMORIN', text: '私は、KIMORINという、親からもらったこの名前を、気に入っています。' },
  { t: 'say', who: 'KIMORIN', text: 'できれば、変えたくありません。' },
  { t: 'say', who: 'OBOLON', text: '、、、それだと、ダメだ。変えないとこの先にいけない。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。わかりました。' },
  { t: 'say', who: 'KIMORIN', text: 'では、KIMORIN⭐︎で。' },
  { t: 'say', who: 'OBOLON', text: 'わかった。では、KIMORIN⭐︎。よろしく。' },
  { t: 'say', who: 'OBOLON', text: 'では{name}、、、名前はどうする？' },
  { t: 'neoname', placeholder: '秘密結社用の名前', submit: 'この名前にする' },
  { t: 'notice', text: '名前は、あとでいつでも変えられます' },
  { t: 'say', who: 'OBOLON', text: '{neo}、、、いい名前だ。' },
  // the first chat with {bati} (about three rounds; the words as said, {bati}'s answers in words and voice), then
  // {bati}'s magic: change your own look, dress {bati} up
  { t: 'scene', id: 'D03-S008' }, // {bati}とおしゃべり／{bati}の魔法
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: '、、、{bati}と、話してみろ。' },
  { t: 'say', who: 'OBOLON', text: '生まれたばかりの{bati}は、まだ、何も知らない。だが、、、知らないことは、魔法で、調べて、答える。' },
  { t: 'sprite', image: '@bati' },
  { t: 'face', who: '@bati', expr: 'sparkle' },
  { t: 'say', who: 'バティ', text: 'ねえ、{neo}。なんでも、話して！　ボク、調べてみる！' },
  { t: 'batitalk', first: true }, // {bati}とのチャットの画面（saves f_d03_bati_talk）
  { t: 'se', sound: 'boing' }, // 3往復くらい話すと、{bati}が、ぴょんと跳ねる
  { t: 'face', who: '@bati', expr: 'smile' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: '、、、これからは、{bati}に頼めば、、、いつでも、お前の姿を、変えられる。' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'うん！　さっきみたいに、ボクが魔法を唱えるよ！' },
  { t: 'say', who: 'バティ', text: '{neo}の姿、もっとかっこよくも、かわいくも、できるよ！' },
  { t: 'say', who: 'バティ', text: 'ボクのことも、好きに着せかえて！　ちょっとだけなら、変身もできるよ！' },
  // D03-S008 〔{bati}の魔法で、自分の姿を変える〕〔{bati}を着せかえる〕 — the Moon room's sheets, then on (also later, on the Moon)
  { t: 'magic' },
  // M-R222: {bati} keeps only what the member asks it to (「覚えといて」), five at most; shown on its card
  { t: 'say', who: 'バティ', text: 'ねえ、{neo}。覚えておいてほしいことがあったら、『覚えといて』って言ってね！' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] }, // となりで、KIMORINが、うんちピンポンくんに顔を近づける
  { t: 'say', who: 'KIMORIN', text: 'では、私も。……宇宙一の発明家は、誰ですか？' },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' },
  { t: 'say', who: 'KIMORIN', text: '……さすが、よく調べていますね。' },

  // M-R207: Bluena and the Moon atelier moved to the morning of day 3 (D04-S002); the 24 hours until then are {bati}'s
  { t: 'scene', id: 'D03-S009' }, // 月で眠る／{bati}と話す24時間
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '明日は、、、土星へ、旅立つ。' },
  { t: 'say', who: 'OBOLON', text: '今日は、、、月で、眠れ。' },
  { t: 'say', who: 'KIMORIN', text: 'え！？全然まだこのままいけますよ。' },
  { t: 'say', who: 'OBOLON', text: '急がない。焦らない。目の前を味わう。今を感じる。大事なことだ。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、、、\nまぁ確かにこんな美しい景色の中で眠りにつくのは悪いことではありませんね。' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null, fade: 4 },
  { t: 'black', fade: 0.8 }, // 暗くフェード（0.8秒で暗く：QA 12 R39）
  { t: 'still', image: 's/d2-moon-bed' }, // 月の神殿のベッドに、KIMORINとうんちピンポンくん。KIMORINは、もう、すやすや
  { t: 'wait', s: 2 },
  // カメラが、となりのベッドへ流れる。{neo}の枕もとで、{bati}が、目をぱっちり開けている。窓の外に、青い地球
  { t: 'still', image: 's/moon-night', fade: 0.8 },
  { t: 'cam', move: 'in', focus: '50% 45%' },
  { t: 'sprite', image: '@bati' },
  { t: 'face', who: '@bati', expr: 'sparkle' },
  { t: 'say', who: 'バティ', text: 'ねえ、{neo}。ボク、まだ、ぜんぜん眠くない。' },
  { t: 'say', who: 'バティ', text: '明日まで、いっぱい、おしゃべりしよ！' },
  { t: 'sprite', image: null },
  { t: 'black', fade: 0.8 }, // 暗くフェード
  // 〔完了画面：3日目まで24時間のカウントダウン。その下に、{bati}とのチャット〕〔明日まで待てない〕 — the countdown screen
  { t: 'end' },
];
