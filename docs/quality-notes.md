# 品質を上げるための覚え書き（物語が変わっても使える）

制作チャットが試して分かったこと。新しい場面・新しい日を作るときは、まずここを読む。

## 絵（Seedream / design/story-art-queue.json）
- **見本の絵を必ず refs に入れる**。見本なしで「光る石」などと書くと、デザインが変わる（マナジェム・ブルーナで起きた）。小物の見本は design/story/refs/client・cast・props。
- **人物の絵は「参照用の一枚」を先に作る**（灰色の背景・全身・世界観の絵柄）。利用者の原画は絵柄が違うことがあるので、原画から参照画像を作ってから立ち絵を作る（フリージー・大根カイザー）。
- **顔の細部は見本の顔だけを切り出して2枚目に渡す**と直る（KIMORINの目：design/story/refs/cast/kimorin-face-eyes.jpg。「目だけ変える」編集で、細く光る青い弧に戻った）。
- **派生の絵（-o 口あき、-notail 尾なし）は、元の絵を描き直したら必ず作り直す**。同じ回で描き直すと古い元の絵から作られるので、元の絵 → 派生の絵の2回に分けて push する。
- 小さく描きたいもの（海の上のロケットなど）は「画面の幅の1/10くらい」と数で書く。
- 背景は、台本の場所の言葉（「塔の壁も橋の裏も画面」「森の木の一本が大根」）をそのまま絵の指示に入れる。古い背景は台本と食い違っていないか、日を作るたびに見比べる。
- Runware が30分止まることがある。止まったら workflow_dispatch でやり直す（redo は残っている）。

## 立ち絵の重ね（scripts/sprite-layers.py, sprite-layers-all.sh）
- 尾は「体からはっきり外れた所」だけを尾の層にする（体の縁が尾といっしょに揺れていた）。
- 口の層は、顔の下のほう・真ん中の変化を選ぶ（目が変わった編集で、目がぱくぱくしていた）。
- 絵や重ね方を直したら scripts/sprite-layers-all.sh で全員を作り直す（キャストごとの顔の位置はこのスクリプトにある）。

## 声（scripts/story-voices.ts）
- **全部の声を同じ大きさ（−18 LUFS）にそろえる**。フィルターの loudnorm だけでは、フリージーとヒポキンが17dB小さかった。生成のたびに測って合わせる level() を入れた。
- 同じ言葉を2回言っている声がある（「なんと、美しい」）。無音の区切りの数がセリフより多いものは疑う → redoLines で作り直す。

## 音楽・効果音（scripts/story-audio, design/story-audio-queue.json）
- BGM は **ACE-Step（runware:ace-step@v1.5-xl-sft）** が良い（聞き比べで 9〜10/10。MiniMax は「歌なし」でも歌った）。settings に `{"settings":{"lyrics":"[instrumental]"}}`。
- ACE-Step でも声が入ることがある。報告の「聞いた感じ」で声ありなら、プロンプトに「no voices, no choir, no humming, no scat」と足して作り直す。
- ACE-Step はいつも約60秒。短いジングル（到着・謎）は、作ったあと先頭の数秒を切って効果音にする（se-arrive, se-riddle）。
- 場面ごとに曲を変える：朝（morning）→ ロケット（space）→ 到着ジングル → 星の曲 → 遊ぶ画面（◯◯-play）→ 星の曲 → 謎のジングル → また明日（farewell）。
- 効果音は Seed Audio（bytedance:seed-audio@1.0、利用者の決定 2026-10-27）。プロンプトは「何が・どこで・どう響くか」まで書き、最後に no music, no voices。無音の取り直しは make.mjs が弾いて redo に残す。効果音も Gemini が聞いて点数を報告に出す。
- **効果音のファイルは、入れたら音の大きさを測る**（loudnorm の Input Integrated）。se-ding が無音（-inf）のまま入っていて、ピンポン♪が鳴っていなかった。-inf や -27 より小さいものは疑う。ただし0.4秒より短い音（pop など）は Integrated が -inf になるので、volumedetect の max_volume（ピーク）で見る。
- 利用者が作った音（pinpon-press.wav など）は、うしろの無音だけ切り、音そのものは変えない。長い音は「次のタップで消える」鳴らし方（StoryExtras の LONG / fadeLongSfx）。こもった音は lowpass 650Hz を2回。

## 確認のしかた
- 画面は /kakunin-…/play?day=N&demo=1（&i=手順の番号、&at=遊ぶ画面）。手順の番号は scratchpad の idx.ts で探せる。
- ヘッドレスのChromiumはH.264が再生できない。動画の場面は mp4 を webm に変えて差しこむ（watch.mjs・walk.mjs）。mp4 を作り直したら、古い webm を消す（古い絵の動画で見間違える）。
- 一枚絵にもう描かれている人は STILL_CAST（lib/onboarding/media.ts）に書く。書かないと、その人の立ち絵が絵の上に重なる。
- 「1日目」のような日の題は、タップ待ちにしない（オープニングのあと、タップしていいか分からなかった）。
- ループ映像の音は消す（短い音が繰り返されて気になる）。

## 台本が大きく変わった時（第21稿で学んだこと）
- まず `scripts/story/import.sh` で取り込み、scratchpad の `linediff21.ts`（場面IDごとに、台本のセリフがアプリの日の台本・遊ぶ画面のどこかにあるか）で抜けを洗い出す。抜けが「記録映像の中で読まれる」など意図どおりかを一つずつ確かめる。
- 遊ぶ画面（Lesson）の「あとの流れ」は、行・画面・選択を並べた配列（After / TreeBeat）にして、選んだ枝を `insert` で差しこむ形にすると、台本の（send）／（keep）がそのまま写せる。
- 「まだ使えない」の行（二周目から・空き地・錠）は、台本が消したら画面からも探して消す（grep「二周目」「次の旅」）。
- 新しい場面の絵（スタジオ・島・木）は、まず絵の注文を push して生成を走らせ、その間にコードを書く。自分の場所（木・島）はコードで描くと、その場で育つ・せり上がる動きが作れる。
- 日の数が変わる時は、shared の JOURNEY_* とサーバーの「払わないと終われない」所、テスト用リンクの最後の日、謎の札の開く日、切符の欄を一緒に直す。既存の利用者は drizzle の移行で日を動かす。
- 予告のような短い映像は、新しく生成せず、ある映像（記録I）から切り出して作れる（ffmpeg の xfade と色を抜く hue）。
- ヘッドレスの確認で、画面が古い部品のまま（金星のマーケット）になっていたら、同じ手順の種類（t: 'venus'）を描く所が二つないか探す。
- 取り込みが拾うファイル名を確かめる：`c01v.md` のような枝のファイルが読み飛ばされ、金星のセリフに声がなかった（story-import.ts の正規表現）。照らし合わせで「場面ごと抜けている」時は、まず取り込みを疑う。
- 歩いて確かめる道具（scratchpad の lw.mjs）は、押すボタンの順番が大事。同じ画面で先に押せるボタン（曲の感じ）を後ろに、進むボタン（歌詞の下書きを見る）を前に並べる。

## 2026-10-27 マナジェム（M-R132）
- 招待で入った人のジェムは40から。作るたびに MAKE_COST（姿3・コロリン3・ジャケット絵3・曲2・MV8）。一周目を全部1回ずつ作り直しても38で足りる。
- 生成が全部失敗したら、取ったマナを返す（refund は idempotencyKey `:refund` 付きなので二重に返らない）。
- 会員は毎月88。注文時と invoice.paid の両方で付与するが、キーが `monthly:user:YYYY-MM` なので同じ月は一度だけ。invoice は period_end ではなく created で月を決める（period_end だと翌月扱いになり初月に二重付与される）。
- 足りないときは 402 NO_MANA → 画面全体に一つの知らせ。住人はエクリプス案内、会員はバティ「今月の泉は、からっぽ」＋買い足しの案内（会員のマナはジェムでなく胸の泉から湧く設定、台本チャット指摘）。数字は見せない。

## 2026-10-27 二周目（L2）のしくみ
- 章 = shared LAP2（地球+月／土星／木星／水星／火星／金星／天王星／海王星／帰還／その夜／次の朝）。進み具合は Me.story['l2.done']（onboardingJson、マイグレーションなし）。章で決めたことは `l2.<章>.<key>`。
- 章の終わりは必ず〔次の星へ向かう〕〔今日はここまで〕。どちらでも章は保存。次に開くと、同じ選択から（resumeSteps）。章の途中で閉じたら、その場所から（localStorage obolo.lap2.*）。
- ホームを開くと一回だけ二周目が出る（sessionStorage obolo.lap2.later）。地図の〔🚀 旅の続き〕で、いつでも戻れる。
- 一周目の結果（d4.f_d05_send / d5.f_d06_sail / d7.f_d07v_mode）は、章の分岐用に l1_* として持ちこむ。
- 星の機能（L2Screen）はまだ一段目（台本の〔画面〕とボタン）。本物の作る画面に順に置きかえる。
- 歌を流す画面は <audio> ではなく、物語ですでに鳴らせる状態の AudioContext で鳴らす（タップの外で始まる <audio> は iOS で止められる）。〔スキップ〕は右上のミュートと重ならない右下。
- MIKIE⭐︎の絵（M-R135）：3案とも右腕（画面の左）がフック、左腕がガトリング。立ち絵は2案目（フックを軽く上げる）を切り抜き → onboarding/mikie.webp、猫のみーちゃん → mii.webp。プロンプトでは「HER RIGHT ARM (on the viewer's LEFT side)」と左右を画面の向きで書くと、取り違えない。
- 物語の画面は「話している人」だけを大きく映す。MIKIE⭐︎のように話さない人物は、その人だけの sprite ＋ caption の場面を作らないと映らない。
- 二周目の本物の画面（components/lap2）：BatiAsk（buddy chat）、Relook（今の姿を refine。mediaId なし＝今の姿）、PlazaMaker（access 'me'）、DaydreamJacket、VenusLesson booth、SongShow、Theater（marsBackstage＋MV＋oshi('mv')）、PlaceSong（savedSongs＋KIMORINの『2』）、GoodsPress（見本だけ、注文しない）、HomewardGame、RoundCards。L2Step が what で振り分け、残りは L2Screen の台本パネル。
- まだパネルのまま：招待状（マナジェムの購入の手続きが未実装）、木・島を飾る、テーマの島、連絡室の交換台、商店の札。
- 台本の決まり：ナレーション調のテロップは出さない（「〇〇が現れた」「〇〇が開いた」の形だけ）。ト書きは立ち絵の動き・間で見せる。
- 歩かせて確かめる道具：scratchpad/l2w.mjs <終わった章の数> <出力> [止める文字]（PICK は「押す順」に並べる。いつも出ているボタンを先に置くと、そこで回り続ける）。

## 2026-10-28 本番での作る機能の確認（Smoke makers）
- .github/workflows/smoke.yml：本番 API に、新しい招待アカウントで「姿4枚→描き直し→決める→たまご→誕生→名前→コロリンのデザイン4枚→決める→お財布」を通す。Cloud Run の一回きりのジョブ（API と同じサービスアカウント）で動かすので、管理トークンは Google Cloud から出ない。絵は docs/smoke/latest.jpg に一覧、ログは latest.txt。
- 1回目の結果：全部成功。姿 84.7秒（4枚中2枚だけ）、描き直し 50秒（4枚）、誕生 108.6秒、コロリン 17秒（4枚）。マナ 40→31（姿3＋描き直し3＋コロリン3）。
- このセッションからは vercel.app / b-cdn.net / GitHub の成果物置き場に直接つながらない（プロキシで拒否）。絵はブランチに入れて見る。
- 2回目以降：姿は4枚そろう（失敗した1枚だけ描き直す）。表情6種類 約60秒・6/6、バティの答え 1.2秒、ブラックホールの絵（NASA）3.3秒・はじめては無料。パンダはコモンズで見つからず→言葉を減らして探し直すように。バティの答えが長かった（前置き＋3行）→「前置きなし・2文・80字くらい・絵文字1つまで」。
- M-R147：〔🖼 絵で見る〕はマナなし（だれでも、何枚目でも）。1マナ案と「はじめては無料」の画面は外した。

## 2026-10-28 コロリンが歌う (M-R152)
- lib/saturn/sing.ts: pitch (autocorrelation on an 11 kHz copy) + loudness every 10 ms → syllables at loudness dips → minor pentatonic around the speaker's own pitch, 126 BPM (16ths when over 24 syllables) → pitch-synchronous overlap-add (grains cut around sample peaks, placed at the note's period; formants stay) → room + dotted echo, offline → WAV.
- Headless check: a 21 s take sings in ~0.9 s, KIMORIN's 12.6 s line in ~0.4 s. The output pitch sits on the notes (A minor pentatonic 55/57/62/64/67/69).
- Samples: docs/smoke/kororin-before.m4a / kororin-sing.m4a. Not yet heard by a person: listen on the phone before calling it done.
- If singing throws, the kororin falls back to the old two-semitones-up take.
