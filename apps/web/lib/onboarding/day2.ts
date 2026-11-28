import { formatMana, MAKE_COST } from '@obolo/shared';
import type { Step } from './script';

/**
 * DAY 2 【地球 → 月】 — the simple version with the client's fixes of 2026-11-22 (M-R207; wip/P01/c04.md D02-S001〜S002,
 * c05.md D02-S004〜S009, P02/c01.md D03-S003〜S005, c02.md D03-S008〜S009):
 *  - the ticket glows and a line of light leads to the HQ gate (no crane); KIMORIN's 「待ちなさい。」 comes at once, before
 *    MONBAN checks the ticket; his warning and his mother's invitation at the gate
 *  - the Earth temple, the rocket pit and the Moon temple are back to the longer conversations (KIMORIN's 24-hour skip,
 *    「魔法、使えるのですか？」, the 「引っかけ問題」)
 *  - on the Moon (M-R334, client 2026-11-27): the eggs (moon = ♀, sun = ♂, shown only as a small mark once {bati} is
 *    born), the favourite food right after 「愛、と言っても…」, うんちピンポンくん, {bati} born from the food's name (the
 *    food itself as a 2D anime character, no frame) and named, THEN the voice ({bati} copies {name}'s voice), the bowl of
 *    water, {bati}'s evolution (D03-S005b: up to 8 steps, each from the look it has now), the visitor's own look
 *    (D03-S004: photo → four pictures → up to 8 transformations → confirmed), KIMORIN's dragon (D03-S004b), the names,
 *    {bati}'s chat (D03-S008) and sleep on the Moon (D03-S009). Bluena comes on the morning of day 3.
 *  - mana: every picture is taken from the gem as it is made — the birth picture, each step ({mana_step}), the four
 *    first pictures ({mana_pick4}) and the confirmed look ({mana_fix}); the numbers are the live prices (MAKE_COST is
 *    their fallback).
 * Pictures: Seedance motions d2-* (each starting and ending on the stills around it), the Day-1 motions for
 * the HQ (d1-gate-loop, 9, 11, 12), Seedream stills s/d2-*.
 * The egg (M-R215 / M-R334): the visitor picks the moon egg (♀) or the sun egg (♂), f_egg; KIMORIN⭐︎ gets the other one.
 * Saved: times (+ timesWords), egg, the favourite food (its name only), {bati} and its name, f_d03_voice, f_bati_evolve, the look
 * (f_d03_photo, f_d03_card, f_d03_change), the NEO name, f_d03_bati_look, f_d03_bati_talk.
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
  // to the HQ gate. M-R334 (client 2026-11-27): the order — MONBAN comes out of black smoke and checks the ticket, the
  // gate opens, and only as the visitor goes through KIMORIN calls from behind; his entrance is one short still (the
  // walk-up and the long reveal film are cut), he talks at once
  { t: 'scene', id: 'D02-S002' }, // お待ちなさい
  { t: 'se', sound: 'sparkle' }, // 手の中の切符が、金色に光る。光が一本の細い線になって、本部の門の前まで続いていく
  { t: 'bgm', track: 'city' }, // 金と黒の都へ（2026-10-25）
  { t: 'still', image: 's/d2-gate-near' }, // 光の線をたどって、本部の門の前へ（床の光の筋が門まで続く絵）
  { t: 'cam', move: 'in', focus: '50% 60%' },
  { t: 'wait', s: 1.6 },
  { t: 'cam', move: 'out' },
  { t: 'se', sound: 'smoke' },
  // 黒い煙が湧き、MONBANが現れる。金色の目が、こちらへ向く (the day-1 film of his arrival; his music comes with him)
  { t: 'video', motion: 'd1-monban', bgmAt: { track: 'monban', at: 6.5 } },
  { t: 'loop', motion: '9-l' },
  { t: 'say', who: 'MONBAN', text: '来たか…切符は持ってきたか？' },
  { t: 'action', label: '切符を見せる' },
  { t: 'se', sound: 'chime' },
  { t: 'video', motion: 'd2-ticket-give' }, // MONBANが切符を受け取り、金色のロケットの絵を確かめて、こちらに返す
  // the line comes while the gate opens and MONBAN steps aside (client 2026-10-29), as on day 1
  { t: 'bgvideo', motion: 11 }, // 門が開き、MONBANが、横へ動く（M-R180）
  { t: 'say', who: 'MONBAN', text: '地球の神殿に行け…地下にロケット場がある' },
  // 門をくぐろうとした、その時
  { t: 'say', who: 'KIMORIN', text: '待ちなさい。' }, // 後ろから
  { t: 'bgm', track: null, fade: 1.5 },
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd2-look-back' }, // ふり返る：来た道のほうを見た景色
  // 止め絵：来た道の逆光の中の人影（立っているだけの間は短く、すぐ話しはじめる） — the still with a mouth layer
  { t: 'still', image: 's/d2-reveal-end' },
  { t: 'wait', s: 0.6 },
  { t: 'say', who: 'KIMORIN', text: 'なんですか、この怪しい建物は。' }, // こちらの横まで歩いてきて、本部の建物を、下から上まで、じろじろと見上げる
  { t: 'bgm', track: 'monban' },
  // the clip d2-monban-smoke showed KIMORIN already in the order's robe (client 2026-10-28: on day 2 he wears the white
  // coat and goggles until he changes on the Moon) — a still until the new cut is made (art/review)
  { t: 'still', image: 's/d2-gate-two-inside' }, // MONBANが左、白衣のKIMORINが右
  { t: 'say', who: 'MONBAN', text: '誰だお前…。' },
  { t: 'say', who: 'KIMORIN', text: '私ですか？私は、なんでもすぐに発明してしまう、天才発明家、KIMORINです。' },
  { t: 'say', who: 'MONBAN', text: 'この先はObolo Orderしか入れない…帰れ…。' },
  { t: 'say', who: 'KIMORIN', text: 'おやおや、帰れは失礼なのでは？　なぜなら、私は！招待客なんですよー？' },
  { t: 'sprite', image: null },
  { t: 'still', image: 's/d2-invite-hand' }, // KIMORINが白衣のポケットから招待状を出して、MONBANに渡す
  { t: 'se', sound: 'pop' },
  { t: 'say', who: 'MONBAN', text: '……なんだ、招待か。' },
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
  { t: 'say', who: 'MONBAN', text: 'キモリンのもある' }, // MONBANが、KIMORINの手のひらにも、小さな石をのせる（M-R334）
  { t: 'say', who: 'KIMORIN', text: 'なんやこれ！　光っとる！　どういう仕組み！？' },
  { t: 'say', who: 'MONBAN', text: '使い方は…そのうち、わかる…。' },
  { t: 'say', who: 'KIMORIN', text: 'いや今教えてくださいよ。' },
  { t: 'sprite', image: ['', '', 'obolon-pit'] },
  { t: 'say', who: 'OBOLON', text: 'それでは、先に月に行ってる' },
  { t: 'se', sound: 'sparkle' }, // OBOLONが消える
  { t: 'vanish', s: 2.2 }, // 神秘的に、光の粒になって薄れていく（client 2026-10-29）
  { t: 'say', who: 'KIMORIN', text: 'すごい、、全然どういう仕組みかわからん、、、。' },
  { t: 'say', who: 'KIMORIN', text: 'それでは私たちも行きましょう。。。月へ！' }, // M-R334 (MONBAN's 「月だ」 is gone)
  { t: 'action', label: 'ロケットに乗る' },
  { t: 'sprite', image: null },
  // SLOT (M-R345, D02-S009 — not brought in yet): from here to 〔月に着いた〕 becomes ONE film of about 73 s that KIMORIN
  // sings (script a2bbf47b+: 18 sung lines 「♪待て　秘密結社？♪」…「♪ほんとは宝物♪」 in place of the three spoken lines
  // below). The song and the sung voice are not delivered yet (the story session hands them over encrypted), so the
  // steps and public/story/P01.json stay as they were imported before; when the audio arrives: import P01, replace the
  // steps between this comment and the caption with the film + its sung lines, and story-sync must read 0 again.
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
  // M-R334: the magic talk, shortened
  { t: 'say', who: 'OBOLON', text: 'この月の神殿なら、、、魔法を、唱えられる。' },
  { t: 'say', who: 'OBOLON', text: 'それでは、、、魔法の相方を、誕生させよう。' },
  { t: 'say', who: 'KIMORIN', text: '相方？' },
  { t: 'say', who: 'OBOLON', text: 'うん。魔法を唱えられる、と言ったが。' },
  { t: 'say', who: 'OBOLON', text: '厳密には、一人では、魔法は使えない。相方と、力を合わせて、魔法を唱えるんだ。' },
  { t: 'say', who: 'OBOLON', text: 'お前たちの新しい姿も、、、相方が、魔法で、作る。' },
  { t: 'say', who: 'OBOLON', text: 'こっちに、来い。' },
  // M-R209: {bati} is born first — the egg, the mana gem, KIMORIN's food (うんちピンポンくん), then {name}'s food and {bati}
  { t: 'scene', id: 'D03-S005' }, // 相方の誕生
  { t: 'sprite', image: null },
  // M-R215 / M-R334: the moon egg (♀) and the sun egg (♂) — never told before the birth. PROVISIONAL (docs/placeholders.md P-BATI-EGGS):
  // the moon egg's pictures and films are the old earth-and-moon egg's ('earth' in the file names) until the new ones come
  { t: 'video', motion: 'd2-altar' }, // 光の柱が神殿の奥へ。小さな祭壇に、たまごが二つ（白く静かに光る月のたまご／金色に燃える太陽のたまご）
  { t: 'still', image: 's/d2-altar' },
  { t: 'say', who: 'OBOLON', text: '月と、太陽。、、、陰と陽の力で、このたまごは、生まれた。' },
  { t: 'say', who: 'OBOLON', text: 'どちらか好きな方を選べ' },
  { t: 'notice', text: 'どちらのたまごからも、旅の相方が生まれます。生まれたあとの姿は、魔法で自由に変えられます' },
  // the egg itself is tapped (client 2026-10-29); f_egg = moon / sun (the script's ids)
  { t: 'choice', key: 'egg', pics: ['/onboarding/egg-pick-earth.webp', '/onboarding/egg-pick-sun.webp'], options: [{ label: '月のたまご', goto: 'egg-moon' }, { label: '太陽のたまご', goto: 'egg-sun' }] },
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
  // M-R334: the favourite food at once (the voice comes after {bati} is born and named; KIMORIN's 「何と話しかければ」 is gone)
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
  // M-R334: the voice now. M-R342 (client 2026-11-27): {bati} LEARNS {name}'s voice (to hear them when spoken to) — it
  // does not copy it: {bati} speaks in its egg's fixed voice, and {name}'s voice model is for their own ダチ voice
  // messages (M-R246). M-R250: under 13 the scene is the same but nothing is recorded
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: '{bati}は、、、お前の声を、覚える。' },
  { t: 'say', who: 'OBOLON', text: 'だから、、、お前の声を、聞かせてやれ。' },
  {
    t: 'eggvoice', // a tap starts, a tap ends; the ring fills (~10 s); ⓘ only (M-R247); the words heard as {name}'s bubble
    example: 'よろしくね。いっしょに、いろんな星に行こう。',
    short: { t: 'say', who: 'OBOLON', text: '、、、もう少し、聞かせてやれ。' },
  },
  { t: 'se', sound: 'magic' }, // 光の輪が満ちると、{bati}の体が、ぽうっと光る
  { t: 'sprite', image: '@bati' },
  { t: 'face', who: '@bati', expr: 'sparkle' },
  { t: 'say', who: 'バティ', text: '{name}の声、おぼえたよ！' }, // M-R342: in {bati}'s own (fixed) voice
  // 黒い球が、床の真ん中の、水を張った大きな丸い器のほうへ向く
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: '{name}、{bati}。、、、こっちへ来い。' }, // {name}と{bati}が、器の前へ。器の水に、二人の姿が映る
  { t: 'say', who: 'OBOLON', text: '魔法を唱える時は、、、この器の前に、来るんだ。' },
  { t: 'say', who: 'OBOLON', text: 'まず、、、{bati}の姿と、お前の姿を、魔法で、変えるんだ。' },

  // M-R334: {bati}'s evolution — one rule: say how to change it from the look it has now; up to 8 steps, each
  // {mana_step} from the gem; 〔{bati}の姿はこれだ〕／〔進化させる〕 after every step
  { t: 'scene', id: 'D03-S005b' }, // {bati}の進化
  { t: 'sprite', image: ['obolon', '@bati'] }, // {bati}が、器のふちに、ぴょんと跳びのる
  { t: 'say', who: 'OBOLON', text: 'まずは、、、{bati}の姿からだ。' },
  { t: 'say', who: 'OBOLON', text: '決まりは、ひとつだけ。、、、今の姿から、どう変えるか、を伝えろ。' },
  { t: 'say', who: 'OBOLON', text: 'それさえ守れば、、、どんな姿にも、なれる。' },
  { t: 'say', who: 'OBOLON', text: '魔法は、、、8回まで、唱えられる。変えたい所を、、、1か所ずつ、変えていくのがいい。' }, // M-R338
  { t: 'sprite', image: null },
  {
    t: 'evolve',
    who: 'bati',
    counter: '進化',
    ok: '{bati}の姿はこれだ',
    more: '進化させる',
    example: '翼を生やして',
    spell: { t: 'say', who: 'バティ', text: 'いくよ！' },
    limit: { t: 'say', who: 'OBOLON', text: '、、、今日の魔法は、ここまでだ。' },
  },
  { t: 'sprite', image: '@bati' },
  { t: 'face', who: '@bati', expr: 'smile' },
  { t: 'se', sound: 'sparkle' },
  { t: 'say', who: 'バティ', text: 'これが、ぼくの姿だね！' }, // 器のふちで、くるりと回る。♀／♂ のマークが、そばで小さく光る
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: '、、、いい相方だ。' },
  { t: 'sprite', image: ['kimorin-iu', '@bati'] },
  { t: 'say', who: 'KIMORIN', text: 'ほう。なかなか、やりますね。' },

  // M-R334: the visitor's own look — photo → four pictures (anime touches, 2 / 3 / 5 / 7 heads; {mana_pick4}) → one is
  // the base → up to 8 transformations ({mana_step} each) → 〔この姿にする〕 confirms it ({mana_fix}: the expressions,
  // the back view, the figures on every planet). No animal question and no redraw any more.
  { t: 'scene', id: 'D03-S004' }, // {name}のネオ
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'sprite', image: ['obolon', '@bati'] }, // {bati}が、ころころと、こちらの足もとへ戻ってくる
  { t: 'say', who: 'OBOLON', text: '、、、次は、お前の番だ。' }, // KIMORINが、両腕を大きく広げて、息を吸いこむ。黒い球は、こちらを向いたまま
  // M-R250: under 13 (or 13〜15 without the guardian's consent) no photo — the wished look is said by voice
  { t: 'branch', key: 'f_media', cases: { no: 'look-wish' }, otherwise: 'look-photo' },
  { t: 'label', id: 'look-photo' },
  { t: 'say', who: 'OBOLON', text: 'まず、、、お前の姿を、器の水に映せ。' },
  { t: 'goto', id: 'look-make' },
  { t: 'label', id: 'look-wish' },
  { t: 'say', who: 'OBOLON', text: '、、、器の水に、なりたい姿を、思い浮かべろ。' },
  { t: 'label', id: 'look-make' },
  { t: 'sprite', image: null },
  { t: 'pick4', spell: { t: 'say', who: 'バティ', text: 'いくよ、{name}！' } },
  // a preset form (the four could not be drawn): nothing to transform, nothing taken
  { t: 'branch', key: 'look', cases: { '': 'look-done' }, otherwise: 'look-change' },
  { t: 'label', id: 'look-change' },
  { t: 'sprite', image: ['obolon', '@me'] },
  { t: 'say', who: 'OBOLON', text: 'ここからは、、、{bati}の時と、同じだ。今の姿から、どう変えるか、を伝えろ。' },
  { t: 'say', who: 'OBOLON', text: '8回まで、、、変身できる。変えたい所を、、、1か所ずつ、変えていくのがいい。' }, // M-R338
  { t: 'sprite', image: null },
  {
    t: 'evolve',
    who: 'self',
    counter: '変身',
    ok: 'この姿にする',
    more: '変身させる',
    example: '髪を銀色にして',
    limit: { t: 'say', who: 'OBOLON', text: '、、、今日の魔法は、ここまでだ。' },
  },
  // 〔画面〕 after the film and the look shown big (inside the step): it is the profile now, and what it took (M-R338's words)
  { t: 'notice', text: `この姿が、あなたのプロフィールになった｜マナジェム −${formatMana(MAKE_COST.profileLook)}（表情・後ろ姿・星ごとの姿を作る分）` },
  { t: 'label', id: 'look-done' },

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
  // M-R338: the looks are decided already; OBOLON says {bati} looks things up, and {neo} asks freely (1〜2 rounds)
  { t: 'scene', id: 'D03-S008' }, // 調べるのが得意な{bati}
  { t: 'still', image: 's/moon-temple' },
  { t: 'sprite', image: '@bati' },
  { t: 'face', who: '@bati', expr: 'sparkle' },
  // M-R338: {bati}'s look was decided at the bowl of water (D03-S005b) — the free four-card restyle is gone
  { t: 'say', who: 'バティ', text: 'ねえ、{neo}！　ボクたち、新しい姿になったね！' },
  { t: 'set', key: 'f_d03_bati_look', value: 'true' },
  { t: 'notice', text: '{neo}と{bati}の姿は、しばらくこのまま。Obolo Orderになったら、マナを使って、今の姿から変えられます' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。もう一つ、教えておく。' },
  { t: 'say', who: 'OBOLON', text: '{bati}は、、、マナの力で、調べるのが、得意だ。' },
  { t: 'say', who: 'OBOLON', text: 'たいていのことは、、、分かる。聞きたいこと、知りたいことは、いつでも、{bati}に、聞いてみろ。' },
  { t: 'sprite', image: '@bati' },
  { t: 'face', who: '@bati', expr: 'sparkle' },
  { t: 'say', who: 'バティ', text: 'なんでも聞いて！　ボク、調べてみる！' },
  // {neo} asks freely; {bati} looks it up and answers (photos, maps, pictures) — 1〜2 rounds (saves f_d03_bati_talk)
  { t: 'batitalk', first: true },
  { t: 'se', sound: 'boing' },
  { t: 'face', who: '@bati', expr: 'smile' },
  { t: 'sprite', image: ['kimorin-sun', 'unchi-pinpon'] }, // となりで、KIMORINが、うんちピンポンくんに顔を近づける
  { t: 'say', who: 'KIMORIN', text: 'では、私も。……宇宙一の発明家は、誰ですか？' },
  { t: 'say', who: 'うんちピンポンくん', text: 'うんポーン！' },
  { t: 'say', who: 'KIMORIN', text: '……さすが、よく調べていますね。' },
  // M-R222: {bati} keeps only what the member asks it to (「覚えといて」), five at most; shown on its card
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'ねえ、{neo}。覚えておいてほしいことがあったら、『覚えといて』って言ってね！' },

  // M-R207: Bluena and the Moon atelier moved to the morning of day 3 (D04-S002); the 24 hours until then are {bati}'s
  { t: 'scene', id: 'D03-S009' }, // 月で眠る／{bati}と話す24時間
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/d2-moon-in' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '今日は、、、月で、好きに過ごせ。{bati}と、いくらでも、話していい。' },
  { t: 'say', who: 'OBOLON', text: '明日、、、星へ、遊びに行く。' },
  { t: 'say', who: 'OBOLON', text: '夜になったら、、、月で、眠れ。' },
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
  // M-R334: the profile look is confirmed and its mana taken at the bowl of water (D03-S004); a look of the preset forms is
  // confirmed without mana when the day is finished (POST /me/journey/complete → LookService.confirmFirstLook)
  { t: 'sprite', image: null },
  { t: 'black', fade: 0.8 }, // 暗くフェード
  // 〔完了画面：3日目まで24時間のカウントダウン。その下に、{bati}とのチャット〕〔0になったら、3日目が始まる〕（M-R269: no
  // 〔明日まで待てない〕 here — only after day 1） — the countdown screen
  // (TomorrowScreen: 〔{bati}と話す〕 opens the Moon chat during the wait, with the script's note — stories.ts waitNote)
  { t: 'end' },
];
