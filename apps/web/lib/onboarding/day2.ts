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
  { t: 'scene', id: 'D02-S001' }, // 宇宙行きの切符（扉の合言葉は、この日を開く前の画面で）
  { t: 'caption', text: '2日目' },
  { t: 'se', sound: 'sparkle' },
  { t: 'video', motion: 'd2-ticket' }, // 光の粒が集まって、細長い金色の切符になる
  { t: 'ticket', dest: '地球 → 月' }, // 切符の文字（宇宙行きの切符／本日の目的地）と星のスタンプ欄4つ
  { t: 'caption', text: '宇宙行きの切符を手に入れた' },
  { t: 'action', label: '本部へ向かう' },

  // the ticket folds into a crane and flies to the HQ gate; MONBAN comes out of black smoke, takes the ticket, the
  // gate opens; on the way in KIMORIN calls from behind — the rest is seen looking back out through the gate
  // (simple version M-R198: no 〔中に入る〕 and no closing gate before MONBAN)
  { t: 'scene', id: 'D02-S002' }, // お待ちなさい
  { t: 'se', sound: 'paper' }, // 切符が折り鶴に折れる（M-R169：紙飛行機ではなく折り鶴。1日目の鶴の映像を使う）
  { t: 'video', motion: '5-f' }, // 鶴が空を飛んでいく
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd1-arrive' }, // 本部の門の前に、すっと降りる
  { t: 'loop', motion: 'd1-gate-loop' },
  { t: 'bgm', track: 'city' }, // 金と黒の都へ（2026-10-25）。鶴が着いてから、曲を重ねて切り替える（QA 5 U1）
  // city plays on through the gate; MONBAN's music comes with MONBAN (QA 7 U1: city turned into monban after 3.5 s)
  { t: 'video', motion: 'd1-monban', bgmAt: { track: 'monban', at: 6.5 } }, // 門へ進みながら、門が閉まる → 黒い煙からMONBANが現れる
  { t: 'loop', motion: '9-l' },
  { t: 'say', who: 'MONBAN', text: '来たか…切符は持ってきたか？' },
  { t: 'action', label: '切符を見せる' },
  { t: 'se', sound: 'chime' },
  { t: 'video', motion: 'd2-ticket-give' }, // MONBANが切符を受け取り、金色のロケットの絵を確かめて、こちらに返す
  // the line comes while the gate opens and MONBAN steps aside (client 2026-10-29), as on day 1
  { t: 'bgvideo', motion: 11 }, // 門の光の幕がほどけ、MONBANが横へ動く（M-R180）
  { t: 'say', who: 'MONBAN', text: '地球の神殿に行け…地下にロケット場がある' },
  { t: 'action', label: '地球の神殿に向かう' },
  { t: 'bgm', track: null, fade: 2 },
  { t: 'video', motion: '12-a' }, // 門をくぐる
  { t: 'wait', s: 1 }, // a beat before the voice behind (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 後ろから
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-look-back' }, // ふり返る：門の内側から入口のほうを見た景色
  { t: 'se', sound: 'footsteps' },
  { t: 'video', motion: 'd2-kimorin-walkup' }, // 奥の通路から、KIMORINがゆっくり門まで歩いてくる → 顔のドアップ（劇場版アニメのように）
  // the clips' own made-up sound is gone (client 2026-10-29: an odd sound at his entrance); a gust as his coat flares
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-reveal' }, // 豪華映像 #2 KIMORINの登場（M-R90）：白衣がひるがえり、扇の尾が一気に開き、ゴーグルが夕日を反射（目は光らない）
  { t: 'still', image: 's/d2-reveal-end' }, // the film's last frame with a mouth layer (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: 'なんですか、この怪しい建物は。' }, // 門ごしに、本部の建物を、下から上まで、じろじろと見上げる（M-R170）
  { t: 'bgm', track: 'monban' },
  { t: 'se', sound: 'smoke' },
  // the clip d2-monban-smoke showed KIMORIN already in the order's robe (client 2026-10-28: on day 2 he wears the white
  // coat and goggles until he changes on the Moon) — a still until the new cut is made (art/review)
  { t: 'still', image: 's/d2-gate-two-inside' }, // 黒い煙が湧き、MONBANが現れる。MONBANが左、白衣のKIMORINが右（話す人は胸から上で）
  { t: 'say', who: 'MONBAN', text: '誰だお前…。' },
  { t: 'say', who: 'KIMORIN', text: '私ですか？私は、なんでもすぐに発明してしまう、天才発明家、KIMORINです。' },
  { t: 'say', who: 'MONBAN', text: 'この先はObolo Orderしか入れない…帰れ…。' },
  { t: 'say', who: 'KIMORIN', text: 'おやおや、帰れは失礼なのでは？　なぜなら、私は！招待客なんですよー？' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/d2-invite-hand' }, // KIMORINが白衣のポケットから招待状を出して、MONBANに渡す（client 2026-10-26: この場面が消えていた）
  { t: 'se', sound: 'pop' },
  { t: 'say', who: 'MONBAN', text: '……なんだ、招待か。門をくぐり、地球の神殿に行け…。' },
  { t: 'bgm', track: 'comedy' }, // KIMORINの「詐欺グループに違いありません」
  { t: 'video', motion: 'd2-kimorin-face' }, // KIMORINが門をくぐろうとして、止まる。こちらに向き直る
  // the film's last frame with a mouth layer, so he talks with a moving mouth (client 2026-10-29)
  { t: 'still', image: 's/d2-gate-kimorin-face' },
  { t: 'say', who: 'KIMORIN', text: 'おや、そこのあなた、もしかして、あなたも招待客？' },
  { t: 'say', who: 'KIMORIN', text: 'こいつらは、大してすごくもないことを、めちゃくちゃすごそうに言い、そのあとに、超高額の入会費を請求してくる詐欺グループに違いありません。' },
  // M-R201: his mother gave him the invitation; he came to expose them (her name and face are never shown)
  { t: 'say', who: 'KIMORIN', text: '実は、私の母が、この結社に、すっかり入れこんでおりましてね。' },
  { t: 'say', who: 'KIMORIN', text: 'ある朝、私にまで、この招待状を渡してきたのです。『あんたも、来なさい』と。' },
  { t: 'still', image: 's/d2-gate-two-inside', fade: 0.5 }, // MONBANの金色の目が、少しだけ細くなる（ミキエを知っている匂わせ）
  { t: 'cam', move: 'in', focus: '30% 40%' },
  { t: 'wait', s: 1.2 },
  { t: 'cam', move: 'out' },
  { t: 'still', image: 's/d2-gate-kimorin-face' },
  { t: 'say', who: 'KIMORIN', text: '母が悪徳商法に引っかかっているなら、この天才発明家KIMORINが、こいつらの正体を暴いてみせましょう。' },

  { t: 'scene', id: 'D02-S004' }, // お金は、かからない
  { t: 'bgm', track: null, fade: 5 },
  // d2-walk-in walked toward the gate and then swapped to the temple (client 2026-10-28) — a still of KIMORIN in the
  // dark hall until the new cut (walking into the temple) is made
  { t: 'still', image: 's/d2-hall-dark-kimorin' }, // KIMORINが前を歩き、地球の神殿の中へ → 暗い天球儀の大広間
  { t: 'wait', s: 1.2 }, // the dark hall is seen before the light comes down (QA 12 R41)
  { t: 'bgm', track: 'obolon' },
  { t: 'se', sound: 'portal' },
  { t: 'video', motion: 'd2-obolon-appear' }, // 光の柱が降り、黒い球のOBOLONが現れる
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
  { t: 'say', who: 'OBOLON', text: '実はな、お前は、、、もう宇宙にいる。' },
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-sky' }, // 2日目用（client 2026-10-25）：大広間の天井が夜空に溶け、金の輪をまとった地球が浮かぶ。KIMORINは手前で見上げる
  { t: 'wait', s: 6.5 }, // 地球が出てから（client 2026-10-22; two more seconds, 2026-10-29; one more, 2026-10-29）
  { t: 'bgm', track: null, fade: 0.8 }, // the music goes quiet for his wonder (client 2026-10-29)
  { t: 'say', who: 'KIMORIN', text: '……めちゃくちゃすごい！' }, // 面の目の切れ目が、青く光る
  { t: 'bgm', track: 'obolon' },
  { t: 'bgvideo', motion: 'd2-monban-walkin' }, // 星空の下、MONBANが入り口から歩いてきて、KIMORINの横に立つ
  { t: 'say', who: 'MONBAN', text: 'どうだ、宇宙へ行ってみるか？' }, // MONBANが入り口から歩いてきて
  { t: 'still', image: 's/d2-hall-sky-monban' }, // 星空の大広間。MONBANが左、OBOLONが真ん中、KIMORINが右（QA 5 N8）
  // ピンとくる → 咳払い: the 'it clicked' cut-in before the cough (client 2026-10-29), the one voice cut at its pause
  { t: 'say', who: 'KIMORIN', text: 'はい！ぜひ！' },
  { t: 'spark', image: 's/d2-kimorin-pin-a', sound: 'pin' },
  { t: 'say', who: 'KIMORIN', text: '、、、は！、、ゴホンゴホン！' },
  { t: 'bgm', track: 'comedy' }, // お金の話から、KIMORINの調子が戻る
  { t: 'say', who: 'KIMORIN', text: 'もちろんそれには、、お金が、かかりますよねー？' },
  { t: 'say', who: 'MONBAN', text: 'かからない。' },
  { t: 'say', who: 'KIMORIN', text: '後から請求書を送ってきたりしない？' },
  { t: 'say', who: 'OBOLON', text: 'しない。' },
  { t: 'bgm', track: null, fade: 0.8 }, // the silence is the joke (client 2026-10-29: the pop music ran too long)
  { t: 'say', who: 'KIMORIN', text: '…………。' },
  { t: 'say', who: 'KIMORIN', text: '、、、そうですか！それではめちゃくちゃ宇宙に行かせていただきます！' },
  { t: 'say', who: 'KIMORIN', text: '宇宙行きの切符、私の家に、送っといてください。' }, // 長いセリフを分けた（client 2026-10-26）
  { t: 'sprite', image: null },
  { t: 'bgvideo', motion: 'd2-kimorin-leave' }, // 咳払いして、白衣の裾をひるがえし、門の外へ。扇の尾をぱたぱた、光の点になって空へ（鼻歌はM-R200で削除）
  { t: 'wait', s: 3 },
  { t: 'caption', text: '24時間後' }, // 待った24時間（M-R199：スキップではない）
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-kimorin-back' }, // 光の点が戻って門の前で急停止 → 切符を握りしめ、ダッシュで神殿に戻る
  { t: 'still', image: 's/d2-hall-run' }, // 肩で息をしている
  { t: 'say', who: 'KIMORIN', text: '……24時間、長かったー！　ちゃんと、待ちましたよ！' },
  { t: 'say', who: 'OBOLON', text: '、、、では、、、宇宙へ、行こう。' },
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-floor-open' }, // 光の柱の足もとの床が丸く開き、長いらせん階段

  { t: 'scene', id: 'D02-S009' }, // ロケット発射場／マナジェム（八つの謎はシンプル版で削除）
  { t: 'bgm', track: 'launch' },
  { t: 'video', motion: 'd2-descend' }, // らせん階段を降りると、発射場とロケット
  { t: 'still', image: 's/d2-launch-pit' },
  { t: 'caption', text: 'ロケット発射場に着いた' },
  { t: 'still', image: 's/d2-monban-pit' }, // ロケットの前のMONBAN（話し手はチャットのアイコンで）
  { t: 'sprite', image: ['', '', 'obolon-pit'] }, // 光の柱の中のOBOLONも、発射場にいる（QA 5 N9）、MONBANの光の輪から離して（QA 7 R3）
  { t: 'say', who: 'OBOLON', text: 'これがロケットだ。月に行く。乗れ。' },
  { t: 'say', who: 'MONBAN', text: 'では、いってこい。' },
  { t: 'say', who: 'KIMORIN', text: 'え？あなた達は乗らないのですか？' },
  { t: 'say', who: 'OBOLON', text: '俺は先に月に行って待ってる。大丈夫だ' },
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
  { t: 'sprite', image: ['', '', 'obolon-pit'] },
  { t: 'se', sound: 'sparkle' }, // OBOLONが消える
  { t: 'vanish', s: 2.2 }, // 神秘的に、光の粒になって薄れていく（client 2026-10-29）
  { t: 'say', who: 'KIMORIN', text: 'それでは私たちも行きましょう。。。宇宙へ！' },
  { t: 'say', who: 'MONBAN', text: '月だ' },
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  { t: 'film', id: 'launch', parts: 4 }, // the second clip lifted off again after the first (client 2026-10-29: the launch played twice) — 豪華映像 #3 ロケットの発射（M-R90）：扉が閉まる → 炎と白い煙 → 雲を突き抜け、空が青から黒へ → 窓の外に丸い青い地球
  { t: 'bgm', track: 'space' },
  { t: 'bgvideo', motion: 'd2-rocket-in' }, // ロケットの中。KIMORINが、窓の外の地球を見ている
  { t: 'say', who: 'KIMORIN', text: 'ロケット広すぎませんか？2人で乗るのもったいないですよ。' },
  { t: 'say', who: 'KIMORIN', text: 'おや、もう月についたみたいですね' },
  { t: 'video', motion: 'd2-landing' }, // 月が近づき、神殿の横に着陸する
  { t: 'caption', text: '月に着いた' },

  { t: 'scene', id: 'D03-S003' }, // 月の神殿／パーティー好きのドラゴン（2日目のまま続く）
  { t: 'bgm', track: 'moon' },
  { t: 'video', motion: 'd2-moon-enter' }, // 神殿の中へ。床の水盤、光の柱の中のOBOLON
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'say', who: 'OBOLON', text: '、、、来たか。' },
  { t: 'say', who: 'OBOLON', text: 'ちなみに、、、秘密結社は、初めてか？' },
  { t: 'choice', key: 'times', voice: true, options: [{ label: '1回目' }, { label: '2回目' }, { label: '3回目以上' }] }, // answered by voice (client 2026-10-29)
  { t: 'say', who: 'OBOLON', text: '、、、そうか。' },
  { t: 'still', image: 's/d2-moon-kimorin' }, // 黒い球が、くるりとKIMORINのほうへ向く。光の柱のOBOLONの前に、白衣のKIMORIN
  { t: 'say', who: 'OBOLON', text: 'KIMORINは？' },
  // 「12回目です。」 after a tap, as the next line (client 2026-10-29): the one voice cut at its pause
  { t: 'say', who: 'KIMORIN', text: '私は、、、、、、' },
  { t: 'say', who: 'KIMORIN', text: '12回目です。' },
  { t: 'se', sound: 'pinpon' }, // ポチッ。白衣にゴーグルのKIMORINが押しボタンを押す。ピンポンピンポン♪　頭の上の本体に◎が光る
  { t: 'bgm', track: null, fade: 0.3 },
  // the music only 5 s after the pinpon has rung out (7 s), a little quieter (client 2026-10-29)
  { t: 'bgm', track: 'comedy', after: 12 }, // ピンポン2.5の発表
  { t: 'still', image: 's/d2-moon-kimorin' }, // 長い説明は、話す人の胸から上の絵で（QA 5 N10）
  // while KIMORIN explains, his own picture comes up big with the face of each line (client 2026-10-29)
  { t: 'sprite', image: 'kimorin-iu' },
  { t: 'say', who: 'KIMORIN', text: 'これは私が発明した、持ち運び式完全肯定型デバイス『ピンポン2.5』です。' },
  { t: 'say', who: 'KIMORIN', text: 'どんな適当なことを言っても、間違ったことを言ったとしても、ボタン一つで、必ず大正解してしまうのです！' },
  { t: 'bgm', track: null, fade: 1.5 }, // シーン……
  { t: 'sprite', image: null }, // OBOLON's eyes narrowing are on the still
  // シーン……。OBOLONの白い三日月の目が、細くなる — in two steps, half then narrow (QA 10 R30)
  { t: 'cam', move: 'in', focus: '50% 41%' },
  { t: 'still', image: 's/d2-moon-kimorin-half', fade: 0.9 },
  { t: 'wait', s: 0.9 },
  { t: 'still', image: 's/d2-moon-kimorin-squint', fade: 0.9 },
  { t: 'wait', s: 0.9 },
  { t: 'cam', move: 'out' },
  { t: 'sprite', image: 'kimorin-iu' },
  { t: 'say', who: 'KIMORIN', text: 'それでは一つお聞きしてもいいですか？\nここのことをSNSに書いてもいいですか？' },
  { t: 'sprite', image: null },
  { t: 'say', who: 'OBOLON', text: 'だめだ' },
  { t: 'say', who: 'KIMORIN', text: 'はい出ました、詐欺グループ確定オツ。' },
  { t: 'bgm', track: 'moon' },
  { t: 'say', who: 'OBOLON', text: 'そのままでは、だめだ。ただ条件を守れば、ここのことを、自由に話していい。' },
  { t: 'say', who: 'KIMORIN', text: 'え？条件？' },
  { t: 'say', who: 'OBOLON', text: '姿と名前を、変えることだ。' },
  { t: 'say', who: 'OBOLON', text: 'どんな姿になりたいか、伝えてくれたら、俺が魔法を唱え、その姿にする。' },
  { t: 'say', who: 'KIMORIN', text: 'では魔法ってことは、じゃあ、どんな見た目にも、なれるんですか？' }, // 興奮気味（はぁはぁしてる感じ）
  { t: 'say', who: 'OBOLON', text: 'なれる。だが、、、最初は、いっぱい望みすぎないほうがいい。変になるから。' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか、、、、じゃあ、、' },
  // one tap each (client 2026-10-29), the one voice cut at its pauses; no music under them (client 2026-10-29)
  { t: 'bgm', track: null, fade: 0.6 },
  { t: 'say', who: 'KIMORIN', text: '筋肉ムキムキの、' },
  { t: 'say', who: 'KIMORIN', text: '腕80本の、' },
  { t: 'say', who: 'KIMORIN', text: 'パーティーが大好きなドラゴン！' }, // 両腕を広げる
  { t: 'say', who: 'OBOLON', text: '、、、大丈夫か？' }, // シーン……
  { t: 'say', who: 'KIMORIN', text: '大丈夫です。私は、人生で一回も、失敗したことがありませんので。' }, // still no music: it comes with the dragon (client 2026-10-29)
  { t: 'say', who: 'OBOLON', text: 'わかった。マナジェムを出せ。' },
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd2-transform' }, // マナジェムから光が水盤へ。水が立ち上がってKIMORINを包む
  { t: 'caption', text: 'KIMORINのマナジェム　−3マナ' }, // ⭐︎は、まだ付かない（M-R169）
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

  // the look: OBOLON's questions (photo → animal → colour → mood), KIMORIN's 「腕は80本？」, −3マナ, the four looks,
  // one redraw, then the chosen look big on the screen — all inside LookMaker
  { t: 'scene', id: 'D03-S004' }, // {name}のネオ
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'say', who: 'OBOLON', text: '次は、、、{name}だ。' },
  { t: 'look' },
  { t: 'sprite', image: ['kimorin-sun', '@me'] },
  { t: 'say', who: 'KIMORIN', text: 'あなたも、よく似合っていますね。私ほどではありませんが。' },

  { t: 'scene', id: 'D03-S005' }, // 名前と、バティのたまご（{bati}が生まれるのは3日目の朝：D04-S002）
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、名前だ。' },
  { t: 'say', who: 'OBOLON', text: '秘密結社用の、名前は、、どうする？' }, // 黒い球が、KIMORINのほうへ向く
  { t: 'say', who: 'KIMORIN', text: '私は、KIMORINという、親からもらったこの名前を、気に入っています。' },
  { t: 'say', who: 'OBOLON', text: '、、、それだと、ダメだ。変えないとこの先にいけない。' },
  { t: 'say', who: 'KIMORIN', text: 'では、KIMORIN⭐︎で。' },
  { t: 'say', who: 'OBOLON', text: 'では{name}、、、名前はどうする？' },
  { t: 'neoname', placeholder: '秘密結社用の名前', submit: 'この名前にする' },
  { t: 'notice', text: '名前は、あとでいつでも変えられます' },
  { t: 'say', who: 'OBOLON', text: '{neo}、、、いい名前だ。' },
  { t: 'say', who: 'OBOLON', text: 'それでは、宇宙旅行の相方を誕生させよう' },
  { t: 'say', who: 'KIMORIN', text: '相方？' },
  { t: 'say', who: 'OBOLON', text: 'こっちに、来い。' },
  { t: 'sprite', image: null },
  { t: 'video', motion: 'd2-altar' }, // 光の柱が神殿の奥へ。小さな祭壇に、たまごが二つ（太陽と月／地球と月）
  { t: 'still', image: 's/d2-altar' },
  // the egg is chosen first, then the mana gem is set before it (client 2026-10-26: the natural order)
  { t: 'say', who: 'OBOLON', text: '太陽と月と地球。陰と陽の力で、、、このたまごは、生まれた。' },
  { t: 'say', who: 'OBOLON', text: 'どちらか好きな方を選べ' },
  // the egg itself is tapped (client 2026-10-29)
  { t: 'choice', key: 'egg', pics: ['/onboarding/egg-pick-sun.webp', '/onboarding/egg-pick-earth.webp'], options: [{ label: '太陽と月のたまご', goto: 'egg-sun' }, { label: '地球と月のたまご', goto: 'egg-earth' }] },
  // KIMORIN names the one left (client 2026-10-29)
  { t: 'label', id: 'egg-sun' },
  { t: 'still', image: 's/d2-egg-sun' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。私は地球の卵がいいので、ちょうどいいですね。' },
  { t: 'goto', id: 'egg-chosen' },
  { t: 'label', id: 'egg-earth' },
  { t: 'still', image: 's/d2-egg-earth' },
  { t: 'say', who: 'KIMORIN', text: 'そうですか。私は太陽の卵がいいので、ちょうどいいですね。' },
  { t: 'label', id: 'egg-chosen' },
  { t: 'say', who: 'OBOLON', text: 'たまごの前に、、、マナジェムを、置け。' },
  { t: 'action', label: 'マナジェムを置く' },
  { t: 'se', sound: 'chime' }, // たまごの前にマナジェムを置く。隣で、KIMORIN⭐︎も自分のマナジェムを置く
  { t: 'branch', key: 'egg', cases: { 太陽と月のたまご: 'gem-sun' }, otherwise: 'gem-earth' },
  { t: 'label', id: 'gem-sun' },
  { t: 'still', image: 's/d2-egg-sun-gem' },
  { t: 'goto', id: 'egg-gem' },
  { t: 'label', id: 'gem-earth' },
  { t: 'still', image: 's/d2-egg-earth-gem' },
  { t: 'label', id: 'egg-gem' },
  { t: 'say', who: 'OBOLON', text: 'この卵にマナと、愛が、加われば、、、お前だけの旅の相方、バティが、生まれる。' },
  { t: 'say', who: 'KIMORIN', text: 'ア、、、アイ//？' }, // 動揺して照れる
  { t: 'say', who: 'OBOLON', text: '愛、と言っても、、、そんなに、構えなくていい。' },
  { t: 'say', who: 'OBOLON', text: 'お前の、好きなもの、、、そうだ。好きな食べ物を、教えてほしい。' },
  { t: 'egg', submit: 'これにする' }, // saves the food and the egg on the account; the Bati hatches on day 3 (D04-S002)
  { t: 'say', who: 'OBOLON', text: '{food}、か。愛が伝わってくる。わかった。' },
  // {neo}のマナジェムが光る。こちらの体からも、あたたかい光。二つの光がまざり合って、たまごの中へ。陰陽の模様が、ゆっくり回りだす
  { t: 'se', sound: 'magic' },
  { t: 'bgm', track: 'tender' },
  { t: 'wait', s: 1.5 },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '次は、、、KIMORIN⭐︎だ。好きな食べ物は？' },
  { t: 'say', who: 'KIMORIN', text: '私の好きな食べ物は、、、、、' },
  { t: 'say', who: 'KIMORIN', text: '……うんち。' },
  // KIMORINの手が、押しボタンを探して空をつかむ。何もない → 曲が止まり、KIMORIN⭐︎のたまごの中から、はっきりと：ピンポンピンポン♪
  { t: 'bgm', track: null, fade: 0.3 },
  { t: 'sprite', image: null },
  { t: 'branch', key: 'egg', cases: { 太陽と月のたまご: 'pinpon-earth' }, otherwise: 'pinpon-sun' },
  { t: 'label', id: 'pinpon-earth' },
  { t: 'still', image: 's/d2-egg-earth-gem' }, // KIMORIN⭐︎のたまご（残った地球と月）
  { t: 'goto', id: 'pinpon' },
  { t: 'label', id: 'pinpon-sun' },
  { t: 'still', image: 's/d2-egg-sun-gem' },
  { t: 'label', id: 'pinpon' },
  { t: 'se', sound: 'pinpon' },
  { t: 'wait', s: 7.1, keepChat: true },
  { t: 'bgm', track: 'tender' },
  { t: 'se', sound: 'magic' }, // KIMORIN⭐︎のマナジェムが光る。KIMORIN⭐︎の体からも光がにじみ出て、たまごの中へ
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: 'たまごは、、、ひと晩、眠る。生まれるのは、、、明日の朝だ。' },

  { t: 'scene', id: 'D03-S009' }, // Bluena／月で眠る（Bluenaと月の工房は、3日目の朝からここへ移った）
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、もうひとつ、渡したいものが、ある。' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/bluena' }, // 光の柱から、白くて低い円柱のデバイスが二つ、ふわりと降りてくる
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: 'Bluenaを手に入れた' },
  { t: 'say', who: 'OBOLON', text: 'Bluena（ブルーナ）だ。' },
  { t: 'say', who: 'OBOLON', text: '星を越えても、、、これで繋がれる。' },
  { t: 'say', who: 'OBOLON', text: 'Bluenaの中には、、、月への、門がある。' },
  { t: 'say', who: 'OBOLON', text: '作る時は、、、門が開いて、この神殿の奥の、月の工房に、つながる。' },
  // 光の柱が、祭壇のさらに奥へ。白い石の丸い小部屋（月の工房）— no picture of it yet: the temple with the Earth in the window
  { t: 'still', image: 's/moon-temple', fade: 0.8 },
  { t: 'cam', move: 'in', focus: '50% 40%' },
  { t: 'say', who: 'OBOLON', text: 'ここが、、、月の工房だ。明日生まれる、お前たちの相方の、家で、、、仕事場だ。' },
  { t: 'cam', move: 'out' },
  { t: 'say', who: 'OBOLON', text: '作ったものは、、、Bluenaに、しまわれる。見せる時は、、、Bluenaから、星へ、投影する。' },
  { t: 'say', who: 'OBOLON', text: '作るのは、月。しまうのは、Bluena。見せるのは、、、星だ。', hold: true },
  { t: 'action', label: 'Bluenaで投影する' },
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: true }, // 神殿の白い壁に、正方形のスクリーン。門の前のMONBAN
  { t: 'sprite', image: ['', 'kimorin-sun'] },
  { t: 'say', who: 'MONBAN', text: '……聞こえるか…。' },
  { t: 'say', who: 'KIMORIN', text: '……これは....すごい発明品ですね。まぁ私の発明の方がすごいですけど。' },
  { t: 'say', who: 'MONBAN', text: 'ただし…星への門が開くのは…一日、88分だ…。' },
  { t: 'say', who: 'MONBAN', text: 'それを過ぎたら…門を閉める…。そしたら、バティ達は月に…お前たちは地球に、帰ってこい…。' },
  { t: 'say', who: 'KIMORIN', text: 'じゃあ88分過ぎたら、めちゃくちゃ地球に帰ります。' },
  { t: 'screen', open: false },
  { t: 'sprite', image: null },
  { t: 'notice', text: '星への門が開くのは、一日88分。過ぎると地球に帰り、次の日に、その続きから。月の工房とBluenaは、いつでも使えます' },
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '明日は、、、たまごが、かえる。そして、、、土星へ、旅立つ。' },
  { t: 'say', who: 'OBOLON', text: '今日は、、、月で、眠れ。' },
  { t: 'say', who: 'KIMORIN', text: 'え！？全然まだこのままいけますよ。' },
  { t: 'say', who: 'OBOLON', text: '急がない。焦らない。目の前を味わう。今を感じる。大事なことだ。' },
  { t: 'sprite', image: null },
  { t: 'bgm', track: null, fade: 4 },
  { t: 'black', fade: 0.8 }, // 暗くフェード（0.8秒で暗く：QA 12 R39）
  // 月の神殿のベッドのKIMORINと、枕もとのたまご → {neo}の枕もとで、たまごの陰陽の模様がゆっくり光りながら回る。窓の外に青い地球
  // (s/d2-moon-bed has うんちピンポンくん in it, not born yet: the moonlit hall with the Earth in the window until a new still)
  { t: 'still', image: 's/moon-night' },
  { t: 'cam', move: 'in', focus: '50% 45%' },
  { t: 'wait', s: 3 },
  { t: 'black', fade: 0.8 }, // 暗くフェード
  { t: 'end' }, // 〔完了画面：3日目まで24時間のカウントダウン〕
];
