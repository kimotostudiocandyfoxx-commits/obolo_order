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
- 効果音は Mirelo（今の音）と Seed Audio（v2）を聞き比べ中。
- **効果音のファイルは、入れたら音の大きさを測る**（loudnorm の Input Integrated）。se-ding が無音（-inf）のまま入っていて、ピンポン♪が鳴っていなかった。-inf や -27 より小さいものは作り直す。
- 利用者が作った音（pinpon-press.wav など）は、うしろの無音だけ切り、音そのものは変えない。長い音は「次のタップで消える」鳴らし方（StoryExtras の LONG / fadeLongSfx）。こもった音は lowpass 650Hz を2回。

## 確認のしかた
- 画面は /kakunin-…/play?day=N&demo=1（&i=手順の番号、&at=遊ぶ画面）。手順の番号は scratchpad の idx.ts で探せる。
- ヘッドレスのChromiumはH.264が再生できない。動画の場面は mp4 を webm に変えて差しこむ（watch.mjs・walk.mjs）。mp4 を作り直したら、古い webm を消す（古い絵の動画で見間違える）。
- 一枚絵にもう描かれている人は STILL_CAST（lib/onboarding/media.ts）に書く。書かないと、その人の立ち絵が絵の上に重なる。
- 「1日目」のような日の題は、タップ待ちにしない（オープニングのあと、タップしていいか分からなかった）。
- ループ映像の音は消す（短い音が繰り返されて気になる）。
