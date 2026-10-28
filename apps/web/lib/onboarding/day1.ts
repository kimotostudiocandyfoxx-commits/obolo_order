import type { Step } from './script';

/**
 * DAY 1 【地球の本部】 — the story of 2026-10-15 (review/DAY1.md, story 3b44a0b; M-R44〜M-R61).
 * From the invitation to MONBAN's 「わかった、それではまた明日会おう。」. The invitation carries the inviter's
 * own words ({inviter_message}) when they wrote some. OBOLON asks the name (no age, no "shall I talk"),
 * talks until 「oboloとは、、、」 and MONBAN stops him; MONBAN offers the ticket ［切符を受け取る／受け取らない］
 * (受け取らない stops the day at the choice). The riddles, the gem and the letter moved to day 2.
 * The client's Day-1 motions are kept where they match the story: 1–4 invitation, 5–6 HQ, 7/9 MONBAN,
 * 10 the invitation floats, 11 the gate opens, 12–13 the temple and OBOLON, 14–17/19 the universe,
 * 27–28 MONBAN steps in.
 * Saved: name, choice1 (day 7 quotes it), f_d01_ticket.
 */
export const DAY1: Step[] = [
  // D01-S000 招待信号 (M-R90/M-R93, client 2026-10-26): the luxury film — night scenes around the world, a golden
  // streak, the Earth's golden threads, the fragments, the seal; the envelope streams to the viewer as light.
  // Skippable; once seen it does not play again.
  { t: 'film', id: 'signal', parts: 10 },
  // BGM (client, 2026-10-04): opening → MONBAN's theme from MONBAN → OBOLON's theme from OBOLON.
  { t: 'bgm', track: 'opening' },
  { t: 'motes', count: 36 }, // 金色の光の粒（演出）
  { t: 'caption', text: '1日目' },
  // D01-S001 招待状 (production 2026-10-19/20: the client's motions with their painted words taken out; words set in code)
  { t: 'video', motion: '1-c' }, // 光の粒がらせんを描いて集まり、封筒になる
  { t: 'caption', text: '招待信号を受信しました' },
  { t: 'action', label: '封を開く' },
  // Seedance clips (2026-10-20): each starts and ends on the pictures around it
  { t: 'se', sound: 'magic' },
  { t: 'video', motion: 'd1-open' }, // 封印が光って回り、封筒が開いて、白紙の招待状が出てくる
  { t: 'se', sound: 'chime' }, // 文字がにじみ出る
  { t: 'invitation', fromMotion: true }, // 招待状の文字（招待者と「{inviter_message}」もカードの中）
  { t: 'action', label: '本部へ向かう' },

  // D01-S003 本部とMONBAN
  { t: 'se', sound: 'magic' }, // 文字が光って浮かび、消える
  { t: 'video', motion: 'd1-fold' }, // 白紙になった招待状が、折り鶴に折りたたまれる
  { t: 'video', motion: '5-f' }, // 鶴が星空を飛ぶ
  { t: 'se', sound: 'whoosh' },
  { t: 'video', motion: 'd1-arrive' }, // 金の雲を抜けて都へ降り、門の光に飛びこむ
  { t: 'loop', motion: 'd1-gate-loop' },
  { t: 'caption', text: '本部に到着しました' },
  { t: 'action', label: '中に入る' },
  { t: 'bgm', track: 'monban' },
  { t: 'motes', count: 0 },
  { t: 'se', sound: 'gate-close' },
  { t: 'video', motion: 'd1-monban' }, // 門へ進みながら、門が閉まる → 門の前に黒い煙が湧いて、MONBANが現れる
  { t: 'loop', motion: '9-l' }, // no camera shake here: it looked cheap (client 2026-10-22)
  { t: 'caption', text: 'MONBANが現れた' },
  { t: 'cam', move: 'in', focus: '50% 30%' }, // 喋るMONBANに寄る
  { t: 'say', who: 'MONBAN', text: '誰だお前…。\nここは秘密結社だ…。' },
  { t: 'say', who: 'MONBAN', text: 'この先はObolo Orderしか入れない…帰れ…。' },
  { t: 'cam', move: 'out' },
  { t: 'action', label: '招待状を見せる' },
  { t: 'video', motion: 10 }, // 招待状が、MONBANの両手の上に光りながら浮かぶ
  { t: 'cam', move: 'in', focus: '50% 30%' },
  { t: 'say', who: 'MONBAN', text: 'なるほど…。\n{inviter}から…招待されたのか…。' },
  { t: 'cam', move: 'out' },
  { t: 'bgvideo', motion: 11 }, // 門が開く — その間に「門をくぐり…」（client 2026-10-20）
  { t: 'say', who: 'MONBAN', text: '門をくぐり、地球の神殿に行け…。' },
  { t: 'action', label: '門をくぐり、地球の神殿に向かう' },

  // D01-S006 OBOLON
  // MONBAN's theme fades slowly while we walk in, gone before OBOLON's light falls (client 2026-10-20)
  { t: 'bgm', track: null, fade: 6 },
  { t: 'video', motion: 12, captions: [{ text: '地球の神殿に着いた', from: 8, to: 11 }] }, // 門をくぐり、神殿の中へ → 光の柱
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 },
  { t: 'caption', text: 'OBOLONが現れた' },
  { t: 'say', who: 'OBOLON', text: '俺の名前はOBOLON、双子座だ。' },
  { t: 'say', who: 'OBOLON', text: 'お前の名前は？' },
  { t: 'name', placeholder: '名前', submit: '名乗る' },
  { t: 'say', who: 'OBOLON', text: '{name}か、いいな。' },
  { t: 'say', who: 'OBOLON', text: 'ここは、宇宙秘密結社だ。' },
  { t: 'say', who: 'OBOLON', text: '{name}、\nお前は、宇宙に、行ってみたいと思うか？' },
  // answered by voice (M-R169): the voice note and the mic permission come once, here at the first 〔🎙〕
  { t: 'choice', key: 'choice1', voice: true, options: [{ label: '行きたい' }, { label: '行きたくない' }, { label: 'まだわかんない' }] },
  { t: 'say', who: 'OBOLON', text: 'そうか。' },
  { t: 'say', who: 'OBOLON', text: '実はな、お前は、、、' },
  { t: 'say', who: 'OBOLON', text: '、、、もう宇宙にいる。' },
  // the universe plays behind the words: OBOLON talks as the Earth comes up, and on through the
  // galaxy (a tap goes on while the motions keep playing — client 2026-10-20)
  { t: 'bgvideo', motion: 14, then: [15] }, // 天井が夜空になり、地球が浮かぶ
  { t: 'say', who: 'OBOLON', text: 'この星、地球は\n宇宙の中にある。' },
  { t: 'bgvideo', motion: 16 }, // 宇宙へ引いていく
  { t: 'say', who: 'OBOLON', text: '地球も、俺も、お前も。\n想像しうる全てが\n宇宙、そこで生まれる。' },
  { t: 'bgvideo', motion: 17, then: [19] },
  { t: 'say', who: 'OBOLON', text: '何かの偶然、何かの欲望、何かの閃き、\nいつだって、何かによって、何かが生まれる。' },
  { t: 'say', who: 'OBOLON', text: '“Obolo Order”\nそれは、新しい何かを、生み出す者達' },
  { t: 'say', who: 'OBOLON', text: '楽しむ心が、万物を創る。' },
  { t: 'say', who: 'OBOLON', text: '創るだけじゃない。' },
  { t: 'say', who: 'OBOLON', text: 'そう、\nobolo…とはなんなのか' },
  { t: 'say', who: 'OBOLON', text: 'わかりやすく、言う。' },
  { t: 'say', who: 'OBOLON', text: 'oboloとは、、、' },
  // 黒い球の後ろに、日食のような金の光の輪 → 暗転
  { t: 'bgm', track: 'monban' },
  { t: 'black' },
  { t: 'say', who: 'MONBAN', text: 'おい待て、そこまでだ。' },
  { t: 'video', motion: '27-c' }, // 光が戻る。金の光の輪を背負ったMONBANが、OBOLONの前に立っている
  { t: 'loop', motion: '28-l' },
  { t: 'say', who: 'MONBAN', text: 'OBOLON、それは喋りすぎだ。' },

  // D01-S012 宇宙へ行ってみるか？
  { t: 'cam', move: 'in', focus: '50% 30%' },
  // the client's lines (2026-10-20)
  { t: 'say', who: 'MONBAN', text: 'それより先はObolo Orderしか知ることができない。' },
  { t: 'say', who: 'MONBAN', text: 'ただ、お前はObolo Orderに招待されてここに来た。' },
  { t: 'say', who: 'MONBAN', text: 'だから知る権利がある。' },
  { t: 'say', who: 'MONBAN', text: 'もし宇宙やこの秘密結社に興味があるなら、' },
  { t: 'say', who: 'MONBAN', text: '明日、お前に宇宙行きの切符を送るが' },
  { t: 'say', who: 'MONBAN', text: '宇宙へ行ってみるか？' },
  { t: 'label', id: 'ticket' },
  { t: 'choice', key: 'f_d01_ticket', options: [{ label: '切符を受け取る', goto: 'take' }, { label: '受け取らない' }] },
  { t: 'say', who: 'MONBAN', text: '……そうか…。気が変わったら、また来い…。' },
  { t: 'pause', resume: 'ticket' }, // 今日はここで終わる。次に開くと、この選択から
  { t: 'label', id: 'take' },
  { t: 'say', who: 'MONBAN', text: 'わかった、それではまた明日会おう。' },
  { t: 'cam', move: 'out' },
  { t: 'se', sound: 'gate-close' }, // 大広間の光が、すっと落ちる。遠くで、門の閉まる重い音（QA 5 N19）
  { t: 'motes', count: 60 }, // 金と黒の都が、光の粒になってほどけ、真っ暗な宇宙に戻る
  { t: 'black' },
  { t: 'end' },
];
