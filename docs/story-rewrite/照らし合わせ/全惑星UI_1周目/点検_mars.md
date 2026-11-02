# 火星（MV・UFO・myスタジオ）プレイ画面 点検と改善案

- 見たもの：`planet_shots/mars/01〜15`・`sheet.jpg`、`_storysheet/st_mars.jpg`・`s3_mars.jpg`、`画面設計/mars.md`・`index.md`、`試作/` の土星2本、物語（`wip/P04/c01.md` 6日目・`decisions_round19.md`）、アプリ `origin/claude/solar-system-home-planets-ew766y`（`MarsWorld.tsx`・`UfoPlayer.tsx`・`LiveMars.tsx`・`ShootChat.tsx`・`MyStudio.tsx`・`Backstage.tsx`）、今ある絵（`public/art/mars-sky-city.jpg`・`mars-sky-canyon.jpg` 1344×768、`mars-studio.jpg`、`onboarding/mars-studio-city.jpg`・`mars-studio-canyon.jpg`、`onboarding/s/mars-screens.jpg`・`mars-studio-ship.jpg`、`ufo-*.webp`）。
- 報告ずみの不具合（曲がない時の撮影の行き止まり・サムネイルの長さ表示が切れる・下のナビが切れる）は数えていない。

---

## 1. 総評

- 火星の物語の芯は「外の画面は勝手に流れてくる。ここの画面は、自分で押したものしか映らない」（ヒポキン・6日目）。なのに今の UI は、**押さなくても次の UFO が来て流れ続け、「今 3人がライブ中」「【LIVE】配信中」が出る**。世界観といちばんぶつかっている所から直したい。
- 星図は 1344×768 の横長の絵を縦の画面に入れているので、紫の何もない画面に小さな四角が浮く（`01`）。名札の字は 7px（`clamp(7px,1.2vw,12px)`）で読めない。myスタジオ・ほかの人のスタジオも、絵の下に何もない紫が半分続く（`06`・`07`）。
- **絵のタッチが2つに割れている**：星図・myスタジオ・UFO は平たいレトロのポスター調、街・スタジオの見本・物語は光の濃い映画のようなアニメ調。同じ星に見えない。さらに〔スタジオを飾る〕の見本の絵には「フォロワー 3.2万・作品24・総再生 210万回」「12万回」や英語の「FOXX STUDIO」が絵の中に描きこまれている（`09`）。
- 中心の遊び（撮る→しまう→スタジオに置く→とばす）の**ごほうびの瞬間（MVができた・スタジオが建った・UFOが飛んだ）に演出がない**。カチンコも上映もない。
- 方針：絵のタッチを「レトロな宇宙時代のポスターの色（くすんだ紫・テラコッタ・ティール・クリーム）を、光の濃いアニメの絵で描く」に一本化し、**縦いっぱいの星図と、カチンコで建つスタジオ→大画面に自分の MV→UFO が飛び立つ**を見せ場にする。

---

## 2. 改善点（効いてくる順）

### 1. 「押した時だけ映る」を UI の決まりにする（今は勝手に次の UFO が流れる）
- 画面/場所：X-2 映像を見る（`UfoPlayer.tsx` 15〜21行・61〜75行：見本は16秒たつと `next.current()` で次の人の UFO が来る）
- 問題：映像が終わると次の人の UFO が自動で入ってきて流れる。設計（§3「勝手に流さない」、§7「勝手な連続再生」）と、物語の「ここの画面は、自分で押したものしか映らない」に正面から反する。
- 改善案：
  - 終わったら止まり、画面がゆっくり暗くなって「待機」の小さな光の点になる（1.2秒）。ボタンは〔▶ もう一回〕〔‹ 前の映像〕〔次の映像 ›〕（同じ人の88時間以内だけ）。
  - 星図の UFO の下の画面は、ふだんは**消えている（暗い待機画面）**。押すと古いテレビのように、まん中の横線から上下に広がって映る（0.5秒・明るさは上げすぎない）。これを火星の「触った手ごたえ」にする。
  - 横スワイプも同じ人の中だけ。左右ののぞき見の UFO はなくす。
- 種類：機能／世界観

### 2. 星図を縦いっぱいの空に（今は小さな四角が紫の画面に浮く）
- 画面/場所：X-1 星図（`01`・`04`・`11`、`MarsWorld.tsx` の `<ArtStage name={'mars-sky-' + theme} reserve={210}>`）
- 問題：横長の絵の高さはおよそ370pxで、上下に合わせて約350pxの空きがある。UFO 6機とカードが四角の中で重なる。
- 改善案：
  - 縦の絵 `mars-starmap-city-full`（1152×2048）を全面に。上に大きなテラコッタの惑星と月、ティールとクリームの軌道の線、下の25%に画面のついた塔の街のシルエット（画面は暗い）。
  - UFO はコードで。空に**だ円の軌道を3本**引き、UFO はふわふわ浮きながらゆっくり回る（奥0.5倍〜手前1.1倍、y の順に重ねる）。UFO の下からトラクタービーム（加算の光）が伸び、その先に小さな待機画面がぶら下がる。
  - コードで動かすもの：星のまたたき、軌道の線の上を流れる光の粒、遠くの街の窓の灯り、UFO の窓の灯り、ビームのゆらぎ。
  - myスタジオの見た目（赤い峡谷・画面の街など）を変えると、星図の絵も同じ見た目に変わる（設計 X-7）。
- 種類：見た目／世界観／15-20ウケ

### 3. 数・ライブ・タブを設計どおりに（「今 3人がライブ中」・〔みんな／フォロー／ダチ〕・【LIVE】配信中）
- 画面/場所：X-1 上の帯（`MarsWorld.tsx` 145〜157行）、`03-live-open`
- 問題：人数の札は数を出さない決まり（§7）に反する。ライブ配信は火星の設計にない（「ネオのライブステージ」は三周目の劇場の名前で、配信ではない）。「2:15:0」の長い配信も出る。タブは〔推し〕にまとめる決まり（M-R109）。
- 改善案：人数の札と【LIVE】の UFO を消す。タブは一周目・二周目は〔推し〕だけ（左上に「推しの星図」の小さな見出し）、三周目から〔みんな〕〔推し〕。15歳未満はいつまでも〔推し〕（ダチだけ）。映像の種類の札は〔MV〕〔映画〕〔番組〕だけにする。
- 種類：機能／世界観

### 4. カチンコで建つスタジオを作る（今は2択の写真を押すだけ）
- 画面/場所：X-7 スタジオを建てる・飾る（`09`、`MarsWorld.tsx` 447行「星図とスタジオの見た目を選べます」）
- 問題：設計は「{bati}との会話＋部品の札→ヒポキン『鳴らせ。』→カチンコを鳴らすと建つ」。今は〔郊外〕〔街中〕の2枚から選ぶだけで、その2枚の絵も他人のスタジオの見本（下の5.）。`MyStudio.tsx` には札の仕組みがあるのに、〔飾る〕からはつながっていない。
- 改善案（くわしくは 3. 試作プラン）：
  1. 赤い丘の空き地（白い線の四角・名前の札・〔🔒 裏スタジオ〕の扉だけ）。{bati}「どんなスタジオにしたい？　ざっくりでいいよ！」・〔🎙 話してみよう〕（直径96px）・〔おまかせ〕。
  2. 札（〈夜〉〈赤い峡谷〉〈ネオン：ピンクと青〉〈丸い屋根〉〈屋上にアンテナ〉）。札が変わると空き地の上の「下書きの線」がその形に変わる。
  3. ヒポキン「鳴らせ。」→ 画面下に大きなカチンコ。上の棒を指で下へ引く（またはタップ）→「カチン」（短く、中くらいの音）→ 赤い砂が渦を巻き、建物・屋根・ネオン・アンテナが順にせり上がる→テロップ「myスタジオができた」。
  4. 裏スタジオの MV が、正面の大画面に自動ですっと入る（〔ここに置く〕は押させない）。
- 種類：機能／15-20ウケ／世界観

### 5. 絵の中に描きこまれた数字・英語・他人のキャラを消す
- 画面/場所：X-7 の見本の絵（`09`、`onboarding/mars-studio-city.jpg`・`mars-studio-canyon.jpg`）、ほかの人のスタジオ（`07`、`art/mars-studio.jpg` 系）
- 問題：絵そのものに「フォロワー 3.2万・作品24・総再生 210万回」「▶12万回」「8.4万回」「〔フォロー〕〔スタジオを飾る〕」「FOXX STUDIO」「DREAM. FILM. INSPIRE.」が描かれている。数を出さない決まり（§7：フォロワー数・作品数・見られた数）に反し、人気を比べる SNS の見た目になる。UI と絵の文字も二重になる。おにぎり丸のスタジオなのに、狐のキャラが立っている。
- 改善案：文字なし・数字なし・キャラなしで描き直す（4. の `mars-studio-*` の部品）。スタジオの主役は、持ち主の{neo}の顔（スタジオの看板・窓の操縦士の丸にはめる）。看板の名前「〈名前〉 STUDIO」はコードで重ねる。
- 種類：世界観／機能／見た目

### 6. 星図の名札とカードを読めて押せる大きさに（字が7px）
- 画面/場所：X-1（`01`：「ゴリラ スプレー…」「カバ 深夜のマ…」）
- 問題：`clamp(7px,1.2vw,12px)`。名前と題が2行とも「…」で切れ、UFO とカードで押せる範囲がばらばら。大きな ▶ の三角がサムネイルの絵を隠す。
- 改善案：ぶら下がる待機画面は最小72×72px、その下に題だけ12px太字（最大10文字・2行まで）。名前は押した後の画面で。ダチの UFO には小さな名札の印（金の小さなフィルムの穴の印）。▶ は描かない（画面に触ること自体が「つける」）。押せる範囲は UFO＋ビーム＋画面をまとめて最低64×96px。奥の UFO は名札を隠す。
- 種類：分かりやすさ／使いやすさ

### 7. 映像を見る画面のレイアウト（▶ が絵を隠す・名前が「おにぎ…」）
- 画面/場所：X-2（`02`・`03`）
- 問題：正方形の画面のまん中の大きな三角と、絵の中に重ねた題が、映像そのものを隠す。持ち主の札は「おにぎ…」で切れ、💬 と〔この人のスタジオへ〕が一行に詰まる。
- 改善案：
  - 映像は UFO のビームの先の「ホロの画面」として、幅350pxで大きく。触ると再生・もう一度で一時停止。▶ は再生していない時だけ右下に直径56pxで。
  - 映像の下に、題（20px）と持ち主（顔の丸＋名前、名前は最大12文字で折り返し）。
  - 下の段：〔‹〕〔▶／❚❚〕〔›〕（56・72・56px）。2段目に〔🎬 この人のスタジオへ〕（ダチだけ）と〔⋯〕（通報・ブロック・推しから外す）。💬 は設計にないので〔⋯〕の中か、なくす。
  - 始まる時は音を0.8秒かけて大きくする。
- 種類：見た目／使いやすさ

### 8. はじめの30秒：火星に来た感じと、押す所を見せる
- 画面/場所：火星に入った時の X-1（`01`）
- 問題：入ると、紫の画面に小さな四角と、人数の札。何をする星か伝わらない。
- 改善案：
  - 入った瞬間、塔の街の上空からカメラが1.2秒で星図の高さへ上がる（初回だけ・動きを減らす設定では無し）。
  - 一番近いダチの UFO の暗い画面に、{bati} の吹き出し「押すと、映るよ」（初回だけ・3秒）。
  - 下の〔🎥 撮影〕が2秒周期でゆっくり光る（まだ撮っていない人だけ）。
  - 遠くの街のざわめきの環境音を小さく始める（右上で消せる）。
- 種類：分かりやすさ／15-20ウケ

### 9. MV ができた瞬間を「試写」にする（今は吹き出しとカード）
- 画面/場所：X-3⑥〜⑦（`LiveMars.tsx`・`ShootChat.tsx`）、物語の MV 確認（`13`：オレンジのグラデの四角に点線の枠だけ）
- 問題：撮影中は文字の吹き出しが変わるだけ、できた時もカード1枚。物語の確認画面は仮の四角のまま。
- 改善案：
  - ⑥撮影中：画面の上半分に、3つのシーンの写真が「現像」されていく（白い紙→ゆっくり色が出る。シーン1→2→3）。下にフィルムの帯が横に流れる。`LiveMars.tsx` の今の段階の言葉（「絵コンテを考えてるよ」「シーンを1枚ずつ描いてるよ」）はそのまま使える。〔閉じる〕（閉じても続く）。
  - ⑦できた時：赤いビロードの幕が左右にゆっくり開く（1.2秒）→小さな上映室の画面に自分の MV。ヒポキンの一言「最初に見るのは、作った者だ」。〔▶〕は直径80pxでいちばん大きく、その下に〔🔒 裏スタジオにしまう〕、小さく〔もう一回つくる（1回だけ）〕。
  - しまう時：映像がフィルム缶に巻き取られて、ふたが閉まり、〔🎬 myスタジオ〕に小さな光る点。一行「🔒 裏スタジオにしまいました。あなただけが見られます」。
- 種類：15-20ウケ／分かりやすさ

### 10. 撮影の画面を「声が主役」と設計の順に（今は文字の入力と〔送る〕）
- 画面/場所：X-3 撮影（`05`、`ShootChat.tsx`・`LiveMars.tsx`）
- 問題：設計の順（話す→種類→曲→シーン3つ→確認）のうち、種類（一周目は〔MV〕だけが光る）、シーン1を自分で選ぶ手順、マナの確認がない。入力は文字の欄＋〔送る〕。物語の中のマイクのパネルは白い（`st_mars.jpg`）。
- 改善案：
  - まん中に直径96pxの〔🎙 話してみよう〕、小さく〔パス〕、すみに⌨。話したすぐあとに毎回一行「本当にいる人の顔や名前、ほかの人の作品のキャラクターは、映像にしません」。
  - 種類はフィルムのラベルのような札3枚〔MV〕〔映画〕〔番組〕（一周目は〔MV〕だけ光る。ほかは薄く押せない）。
  - 曲は、レコードを小さく並べて選ぶ（水星のジャケットが見える）。
  - シーン3つは絵コンテの3コマ。シーン1だけ白く、押すと候補3つ〔曲の景色から〕〔自分が歩いてくる〕〔真っ暗から〕。
  - パネルは白ではなく、濃い紫のすりガラス＋細いテラコッタの線。
- 種類：機能／使いやすさ／世界観

### 11. 外への通知の約束・「みんな」「フォロワー」の言葉を直す
- 画面/場所：`LiveMars.tsx` 94行「受けつけたよ！アプリを閉じても、できたら通知するね。」、156行・`MarsWorld.tsx` 200・222・245行「公開！ 88時間、みんなの星図をとびます」、481行「ダチやフォロワーの星図をとびます」、`ShootChat.tsx`「ムービー」
- 問題：アプリの外への通知は出さない決まり（§3）。一周目・二周目の行き先は〔ダチへ〕だけで「みんなの星図」ではない。「フォロワー」は使わない言葉。「ムービー」「映像」「MV」がまざる。
- 改善案：「閉じても、撮影は続くよ。できたら、次に開いた時にスタジオが光るよ」。「🛸 とばした。88時間、ダチの星図をとんで、あなたのスタジオに戻ります」。「公開すると、UFOになって88時間、ダチの星図をとびます」。呼び方は「映像」（種類の名前としてだけ MV・映画・番組）。
- 種類：機能／世界観

### 12. myスタジオを縦いっぱいの部屋に（今は絵の下が半分空き・黒い空の枠が並ぶ）
- 画面/場所：X-6（`06`）
- 問題：スタジオの絵は上の約390pxだけで、下は紫の空き。大画面と小さな枠3つが真っ黒で「まだ作品はありません」が3回並ぶ。まん中の UFO の丸い絵が何のボタンか分からない。タッチが平たいポスター調で、ほかの人のスタジオ（`07`）と別の世界に見える。
- 改善案：
  - 縦の絵 `mars-studio-interior-full`（1152×2048）：上に大きな正面のスクリーン（画面は暗い）、左右の壁に小さなモニター6つ、手前に操作卓と丸い窓。画面の部分はコードで映像をはめる。
  - 空の枠は黒い四角ではなく「上映待ち」の小さな赤い幕の絵（`slot-curtain-closed`）。一行は大画面の下に一度だけ「公開した映像は、88時間とんだあと、ここに並びます」。
  - 壁に、置いた MV の**ポスター**が額に入って増えていく（MV の最初の1コマからコードで作る）。棚にフィルム缶が増えていく。数は出さない。ごほうびではなく、作ったものが部屋に残るのが集める楽しさ。
  - まん中の丸い UFO の絵は、屋上の発着台に UFO が止まっている絵にして、押すと〔🛸 公開する〕（映像を選ぶ）へ。
- 種類：見た目／世界観／15-20ウケ

### 13. 〔🔒 裏スタジオ 0〕〔🎨 飾る〕が小さく、数が出ている
- 画面/場所：X-6（`06`：高さおよそ18px の札2つ）
- 問題：押す所が小さすぎる（44px未満）。「0」は作品の数（§7 出さない）。
- 改善案：〔🔒 裏スタジオ〕〔🎬 スタジオを飾る〕を、ナビの上の段に高さ48px・幅160pxで並べる。数は消す。裏スタジオに映像がある時は、扉の鍵が金色に小さく光るだけ。
- 種類：使いやすさ／機能

### 14. ほかの人のスタジオ：〔フォロー〕・重なり・赤い四角・空の枠6つ
- 画面/場所：`07-other-studio`（`MarsWorld.tsx` 402〜405行）
- 問題：〔フォロー〕と〔🎨 スタジオ〕の札が重なって押しにくい（高さおよそ16px）。ダチのスタジオに〔フォロー〕は不要（ダチだけが来られる。知らない人は三周目から〔推す〕のみ。ダチの申しこみは出さない）。作品の見本が赤い四角（🟥）だけ。空の枠が6つ「まだ作品はありません」。
- 改善案：〔フォロー〕を消す（三周目の〔みんな〕から来た知らない人のスタジオだけ〔⋯〕の中に〔推す〕）。空の枠は出さず、置いてある映像だけを並べる（1本なら大画面だけ）。見本の作品にはちゃんとした絵（`mv-sample-*`）を使う。見るだけなので、下に〔‹ 星図へ戻る〕（48px）。
- 種類：機能／使いやすさ／見た目

### 15. 絵のタッチを一本にそろえる
- 画面/場所：星図（平たいポスター調）、myスタジオ（平たいポスター調）、街・スタジオの見本・物語（光の濃いアニメ調）、UFO（平たい）
- 問題：同じ星の中で、2つのまったく違う絵の世界を行き来する。15〜20歳が「ちゃんと作られたゲーム」と感じる一貫性が崩れる。
- 改善案：「レトロな宇宙時代のポスターの色（くすんだ紫 #2b2146・テラコッタ #e0703f・ティール #3fb7b0・クリーム #f3e3c3）を、光と影の濃いアニメの絵で描く」に統一。UFO もその描き方で描き直す（4. の `ufo-*`）。
- 種類：見た目／世界観

### 16. 星図に UFO が1機もない時の画面
- 画面/場所：X-1（ダチの UFO がない時。一周目の6日目のはじめ・ダチがいない人・住人）
- 問題：今はサンプルで埋まっていて、空の時の画面がない。
- 改善案：`mars-starmap-empty`（静かな空、屋上の小さなアンテナ皿が空を向いて待っている）。一行「ダチの UFO は、まだ来ていない。」〔🎥 一本撮って、とばす〕（56px）。ダチがいない人には〔🤝 ダチの招待状〕（地球）。
- 種類：分かりやすさ／見た目

### 17. 裏スタジオ：カメラロールから入れる〔＋ 動画を入れる〕
- 画面/場所：X-4（`08`、`Backstage.tsx`「撮った動画は、ぜんぶここにしまわれます（60秒まで）」）
- 問題：設計は「撮影はカメラを使わない」「端末の写真も使わない」（X-3）。カメラロールの動画を入れる入口は X-Q1 で未決。一周目から出ていると、言葉から作る星だということがぼやける。空の時は茶色い箱に小さな字。
- 改善案：決まるまで隠す（少なくとも一周目と物語の中は出さない）。裏スタジオは「秘密のフィルム倉庫」の絵（`mars-backstage-vault`）にして、しまった映像はフィルム缶として棚に並ぶ。空の時は `mars-backstage-empty`（空の棚に缶が一つ・ランプ）と一行「まだ、何もしまっていない。」〔🎥 撮影へ〕。上に「🔒 あなただけ」。
- 種類：機能／世界観／見た目

### 18. 公開（とばす）の瞬間を作る（今はトースト「🛸 公開！」だけ）
- 画面/場所：X-5 公開の確認
- 問題：確認画面（行き先〔ダチへ〕が選ばれた状態→〔とばす〕）も、飛ぶ演出もない。
- 改善案：〔🛸 公開する〕（すぐ下に「届くのはダチだけ」）→ シート：映像の小さな画面、行き先 ●〔ダチへ〕（KIMORIN⭐︎・{inviter} の顔の丸）、〔とばす〕（64px）。押すと、スタジオの屋根が開いて UFO が上がる→窓に{neo}の顔（操縦士）→ビームが大画面から映像を小さく吸い上げる→UFO がくるっと回って空へ→カメラが上に流れて星図へ、ダチの UFO と同じ軌道に入る。テロップ「88時間、ダチの星図をとんで、あなたのスタジオに戻ります」。白く光らせない。
- 種類：15-20ウケ／分かりやすさ／機能

### 19. 物語のスタジオのテレビ・確認画面の仮の絵
- 画面/場所：6日目（`13`：オレンジの四角に点線、`14`：ピンクのふちの黒いテレビ、`s3_mars.jpg` a030・a040）
- 問題：豪華な街の絵の上に、平たい仮の図（四角いテレビ・クリーム色の床）が乗っている。スタジオを建てた直後の大事な場面なのに、いちばん安っぽく見える。
- 改善案：仮の図をやめ、4. と同じ空き地→カチンコ→建つスタジオの絵と動きを物語でも使う。テレビの黒い画面は、MV がない（デモ）時でも、待機の光（暗い画面の中に小さく回るフィルムの印）を出す。
- 種類：見た目／世界観

### 20. 上の帯の説明が切れる（「映像（動画はぜんぶ裏ス…」）
- 画面/場所：全画面の見出し（`01` など）
- 問題：火星の説明が長くて「…」で切れる。見出しの黒い帯が世界の上にいつも乗る。
- 改善案：透明な帯（48px）に〔←〕「火星」だけ。説明は初回だけ「話した言葉から、映像を撮る星」。マナの札の字は「マナ」。EN は設定へ。
- 種類：分かりやすさ／見た目

### 21. 下のナビの絵文字（✨ 🎥 🎬）を描いたアイコンに
- 画面/場所：下のナビ
- 問題：OS の絵文字。端末で見た目が変わり、絵と合わない。
- 改善案：星図＝星座の線の入った丸い望遠鏡のレンズ、撮影＝レトロな映画カメラ、myスタジオ＝カチンコ（字なし）、の描いたアイコン（`nav-icon-*`）。
- 種類：見た目／15-20ウケ

### 22. 映像の音量・始まり方
- 画面/場所：X-2・X-3⑦・myスタジオの大画面
- 問題：押すといきなり本番の音量。見本は合成音が鳴る。
- 改善案：0.8秒で0→目標の音量。画面が映る動き（1.）と音の立ち上がりを合わせる。前の映像は0.3秒で小さくしてから止める。
- 種類：使いやすさ／機能

### 23. 15歳未満（子ども仕様）の火星
- 画面/場所：X-1・X-2・X-5・X-6
- 問題：年齢での出し分けがない。
- 改善案：〔みんな〕・〔みんなへ〕・〔推す〕・知らない人のスタジオへの入口をいつまでも出さない。公開の確認では〔ダチへ〕だけを見せる。スタジオの公開範囲の選択も〔自分だけ〕〔ダチまで〕だけ。
- 種類：機能

### 24. 撮影ボタン（〔🎥〕）の丸と、撮影中のナビ
- 画面/場所：下のナビの真ん中の丸（`-mt-8` で上に飛び出す形。水星と同じ作り）
- 問題：撮影の入力やシートの上に丸が重なりやすい（水星の作曲画面で実際に入力欄を隠している）。
- 改善案：撮影・建てる・公開のシートの間は、下のナビをしまう（全画面のモード、左上〔×〕）。
- 種類：使いやすさ

### 25. 動きを減らす設定・暗い所での読みやすさ
- 画面/場所：全体
- 問題：UFO の浮遊・回転・ネオンのまたたきが止められない。紫の上の灰色の小さな字（`text-white/50`・11px）が読みにくい。
- 改善案：`prefers-reduced-motion` で浮遊・粒・カメラ移動を止め、フェードだけ。ネオンの点滅はしない（ゆっくり明るさが変わるだけ・周期2秒以上）。本文14px以上、補足12px以上・白75%以上。
- 種類：使いやすさ

### 26. UFO を「自分の UFO」に（集める楽しさ）
- 画面/場所：X-5・X-7
- 問題：UFO の形はキーで自動（`pickUfo(r.key)`）。
- 改善案：はじめはみんな小さな丸い UFO（`ufo-first-flight`）。スタジオの札と同じく、{bati} との会話で UFO の形・色・ビームの色を部品の札で選べる（マナなし・生成なし・珍しさの段階なし）。
- 種類：15-20ウケ／世界観

---

## 3. 試作プラン（1本）：「カチンコ・プレミア」（X-7 建てる → X-6 大画面 → X-5 とばす → X-1 星図）

**ねらい**：火星いちばんの見せ場「自分のスタジオが建って、自分の MV が大画面に映り、UFO になって飛んでいく」を、指で鳴らすカチンコ一つから体験する。390×844 の HTML 1枚（canvas）。生成した舞台の絵を canvas に敷き、建物の部品は部品の絵を奥行きの順に重ね、砂・光・UFO の動きはコードで。だ円の投影（砂の渦・UFO の軌道）を使う。絵は data URI（webp）で埋めこむ。

### 画面の作り
- 上の帯（48px・透明→紫のグラデ）：〔‹〕・「火星」・右に「myスタジオ」の小さな札。
- 舞台（全面 canvas）：
  - 敷く絵：`mars-studio-plot-dusk`（1152×2048）。夕暮れの赤い丘、空き地に白い線の四角（画面の y=470〜640 あたり）、名前の札の杭、丘の横腹に〔🔒 裏スタジオ〕の扉。
  - 建物の部品（1024×1024 から切り抜き）：土台 `studio-building-box`／`studio-building-dome`／`studio-building-ship` のどれか、屋根の飾り `studio-roof-antenna`・`studio-mirror-ball`、正面の電球の枠 `studio-marquee-frame`、ネオンの形 `studio-neon-reel`（字なし）。四角の中心 (195, 560) に、奥→手前の順で重ねる。
  - コードの層：星（夕→夜で増える）、遠くの塔の画面のまたたき、砂の粒（だ円の渦）、ネオンの明るさのゆるい変化、電球が順に光る動き、UFO・ビーム。
- 下（約170px・紫のグラデ）：場面ごとに入れかわる操作の段。

### 流れと触れること
1. **聞く**：{bati} の吹き出し「どんなスタジオにしたい？　ざっくりでいいよ！」。〔🎙 話してみよう〕（直径96px。押すと音の波の輪。試作では押すと例の言葉「夜の峡谷で、ネオンぎらぎら」が字になって出る）と〔おまかせ〕。
2. **札**：{bati}「じゃあ、こんな感じかな！」→ 札が1枚ずつ配られる（0.12秒ずつ）〈夜〉〈赤い峡谷〉〈ネオン：ピンクと青〉〈丸い屋根〉〈屋上にアンテナ〉。試作では札を押すと候補が順に変わり（例〈丸い屋根〉→〈四角い建物〉→〈宇宙船の形〉）、空き地の上に白い光の線で「下書き」の形がその場で変わる（0.9→1.05→1倍の弾み）。一行「話すと、札が変わります。マナは使いません。あとで変えられます。星図の景色も、同じ見た目になります」。
3. **鳴らせ**：ヒポキンの顔の丸と吹き出し「鳴らせ。」。下の段いっぱいに大きなカチンコ（`clapperboard-open`。字なし）。上の棒を指で下へ引く（引いた量に合わせて棒が回る）、またはタップ → 棒が閉じる（`clapperboard-closed` に切りかえ）→「カチン」（短い乾いた音・音量は中くらい）。
4. **建つ（わあ①）**：空き地のまわりに赤い砂がだ円の渦で巻き上がる（粒300個、1.6秒）→ 渦の中から土台がせり上がる（下からマスクで出す・0.8秒・小さな揺れ）→ 屋根→ネオン→アンテナ／ミラーボールが0.25秒ずつ順にぽんと乗る → 砂が落ちつき、電球の枠が左から順に灯る → 空が夜に変わり星が増える（2秒）。テロップ「myスタジオができた」。
5. **上映（わあ②）**：正面の大画面（`studio-marquee-frame` の中）が、まん中の横線から上下に広がって映る（0.5秒・明るさは控えめ）。自分の MV（`mv-scene-1〜3` をゆっくり寄りながら切りかえ、下に歌詞の一行）。音は0.8秒で大きく。一行「スタジオに置いた映像は、ダチがスタジオに来た時に見られます。〔🔒 裏スタジオ〕の中は、ミナトだけ」。
6. **とばす（わあ③）**：〔🛸 公開する〕（幅310px・高さ56px）、すぐ下に小さく「届くのはダチだけ」。→ シート：映像の小さな画面、行き先 ●〔ダチへ〕（KIMORIN⭐︎・ハルの顔の丸）、〔とばす〕（64px）、すみに〔やめる〕。→ 屋根の上の発着台から UFO（`ufo-first-flight`）が上がる、窓に自分の顔（操縦士 `ufo-pilot-window`）→ トラクタービーム（`ufo-tractor-beam`・加算）が大画面に伸び、映像が小さなカードになって吸い上げられる → UFO が一回転して空へ → canvas 全体が上へ流れて、星図（`mars-starmap-city-full`）につながる。ダチの UFO 2機がだ円の軌道に浮かび、自分の UFO が同じ軌道に入る。テロップ「88時間、ダチの星図をとんで、あなたのスタジオに戻ります」。
7. **星図で触る**：ダチの UFO の暗い待機画面をタップ → 横線から広がって映る（「押した時だけ映る」）。終わると止まって暗くなる。次へは行かない。

### 「わあ」の瞬間
カチンコを自分の指で鳴らした瞬間に赤い砂が渦を巻いて建物が組み上がり、そのまま大画面に自分の MV が灯るところ。続けて、その画面を UFO が吸い上げて空へ持っていくところ。

### 守ること
- 数・人数・残り時間・再生回数・フォロワーは出さない。絵にも文字・数字を描かない。
- 白く光らせない（明るさの変化は0.5秒以上、上げすぎない）。音は小さく始め、「カチン」以外に強い音を出さない。
- 〔みんなへ〕は出さない（一周目の体験）。
- `prefers-reduced-motion`：砂の渦・カメラの流れを止め、フェードで切りかえ。
- 全ボタン44px以上。

### 必要な絵（4. のうち）
`mars-studio-plot-dusk`、`mars-starmap-city-full`、`studio-building-box`・`studio-building-dome`・`studio-building-ship`、`studio-roof-antenna`、`studio-mirror-ball`、`studio-marquee-frame`、`studio-neon-reel`、`clapperboard-open`・`clapperboard-closed`、`ufo-first-flight`、`ufo-pilot-window`、`ufo-tractor-beam`、`dust-vortex-sprite`、`mv-scene-1〜3`、`nav-icon-*`。

---

## 4. 絵の依頼リスト（Seedream）

共通の決まり
- 背景：縦 1152×2048。部品：1024×1024、**無地の平らな灰色（#808080）の背景**（影を背景に落とさない。あとで切り抜く）。加算で重ねるものは無地の黒。
- タッチ：火星を一本にそろえる＝**レトロな宇宙時代（1960年代）のポスターの色を、光と影の濃い日本のアニメの絵で描く**。今の `mars-sky-city.jpg`（色・軌道の線・塔）と `mars-screens.jpg`・`mars-studio-ship.jpg`（光の濃さ・塔の画面の街）のあいだ。
- どの絵にも「文字・数字・ロゴ・UI なし」。画面の中は暗い（あとでコードで映像をはめる）。

各プロンプトの末尾に必ず付ける共通の一文（下では「＋共通」と書く）：
`Japanese anime illustration, semi-realistic yet cute, retro-futuristic 1960s space-age poster color palette of dusty violet, terracotta orange, teal and cream, rendered with rich cinematic lighting, volumetric light, soft film grain, highly detailed, no text, no letters, no numbers, no logos, no UI, no watermark.`

### 舞台（背景 1152×2048）

1. `mars-starmap-city-full`｜1152×2048｜星図の全面の舞台（試作）
   `Vertical portrait night sky above a futuristic Mars city: a huge terracotta-red planet with soft cloud bands filling the upper left, a small crescent moon beside it, sweeping thin teal and cream orbit lines arcing across the sky, many stars. The bottom quarter is a skyline silhouette of slender towers and bridges whose walls are covered with dark switched-off screens and small warm windows. The large middle area is open sky, empty, leaving room for flying saucers.` ＋共通

2. `mars-starmap-canyon-full`｜1152×2048｜星図（スタジオが「赤い峡谷」の人）
   `Vertical portrait night sky above a red rock canyon on Mars: towering layered terracotta cliffs on both sides at the bottom third, a glowing horizon between them, a ringed planet and small moons in a violet sky, thin teal orbit lines arcing across, many stars, the middle area open and empty for flying saucers.` ＋共通

3. `mars-starmap-empty`｜1152×2048｜UFO が1機もない時
   `Vertical portrait quiet violet night sky over a sleeping Mars city, few soft stars, thin orbit lines, and in the lower foreground a small rooftop with a little satellite dish antenna pointing up at the sky, a tiny warm lamp beside it, calm waiting mood, lots of empty sky.` ＋共通

4. `mars-studio-plot-dusk`｜1152×2048｜スタジオを建てる前の空き地（試作）
   `Vertical portrait of an empty building lot on a red Martian hill at dusk: a large rectangle outlined with glowing white chalk lines on flat red sand in the center, a small wooden blank signpost at its corner, and set into the hillside on the right a small round metal door with a padlock, warm lamp beside it. Distant tower city with screens on the horizon, dusky violet and orange sky with first stars. Lots of empty space above the lot.` ＋共通

5. `mars-studio-interior-full`｜1152×2048｜myスタジオの中
   `Vertical portrait interior of a cozy retro-futuristic film studio: a large blank dark projection screen with a glowing frame on the upper wall, six small dark monitors mounted on the side walls, a curved control desk with knobs and faders in the foreground, a big round porthole window showing a Martian landscape, film reels, a camera on a tripod, warm lamps and teal accent lights. All screens are dark and empty.` ＋共通

6. `mars-studio-interior-canyon`｜1152×2048｜myスタジオの中（峡谷の見た目）
   `Vertical portrait interior of a rugged film studio carved into red canyon rock: a large blank dark screen set into the stone wall, small dark monitors in rock niches, wooden director's desk, warm Edison bulbs, a wide window opening to red cliffs at sunset, all screens dark.` ＋共通

7. `mars-studio-exterior-night-ref`｜1152×2048｜建ったスタジオの見本（部品の合わせ方の参考）
   `Vertical portrait of a small charming retro-futuristic film studio building at night on red Martian ground: rounded dome roof with a rooftop antenna and a tiny landing pad, a large blank dark outdoor screen on the front framed by a row of marquee light bulbs, pink and teal neon tubes shaped like a film reel (no letters), red carpet at the entrance, distant tower city behind.` ＋共通

8. `mars-backstage-vault`｜1152×2048｜裏スタジオ（しまってある時）
   `Vertical portrait of a secret film vault room: tall wooden shelves holding round metal film canisters, a small reading lamp, a velvet chair, a heavy round vault door slightly open with warm light, a few empty shelf spaces, cozy and private mood.` ＋共通

9. `mars-backstage-empty`｜1152×2048｜裏スタジオ（空の時）
   `Vertical portrait of a small secret film vault with mostly empty wooden shelves, one single round film canister on a middle shelf lit by a warm lamp, dust motes in the light, calm and hopeful mood.` ＋共通

10. `mars-shoot-set`｜1152×2048｜撮影（X-3）の背景
   `Vertical portrait of an empty retro sound stage at night: a movie camera on a small crane, a director's chair, three blank storyboard easels in a row in the middle, a spotlight casting a soft cone of light on the floor, Martian red tones with teal fill light, upper area darker for dialogue.` ＋共通

11. `mars-premiere-theater`｜1152×2048｜MV ができた時の試写室
   `Vertical portrait of a tiny private screening room: rich red velvet curtains framing a blank dark screen, a few plush seats seen from behind in the foreground, warm golden sconces, a projector beam faintly visible from behind, intimate premiere mood.` ＋共通

12. `mars-friend-studio-visit`｜1152×2048｜ダチのスタジオを訪ねた時
   `Vertical portrait interior of a stylish small film studio with a different decor: teal walls with retro posters frames left empty, a large blank dark screen, small dark monitors, a vintage couch, plants, warm lamps, all screens and frames empty and dark.` ＋共通

13. `mars-city-screens-standby`｜1152×2048｜火星に来た時の最初の一枚（街の上空）
   `Vertical portrait aerial view gliding over a futuristic Mars city at blue hour: slender towers and arched bridges whose walls are covered with switched-off dark screens, only a few warm windows lit, red sand plains beyond, ringed planet in the sky, calm anticipation mood.` ＋共通

### UFO（部品 1024×1024・灰色背景）

14. `ufo-first-flight`｜はじめの一機（試作）
   `A small cute round flying saucer, cream and teal body with terracotta stripes, a single round empty porthole window with a brass rim on top for a pilot face, tiny landing legs, soft glow underneath, three-quarter view, isolated on a plain flat medium gray (#808080) background, no shadow on background.` ＋共通

15. `ufo-retro-classic`
   `A classic retro flying saucer with a glass dome cockpit left empty, violet and cream body with a ring of small orange lights, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

16. `ufo-rust-cruiser`
   `A sturdy rusty orange flying saucer with riveted panels and a round empty porthole window, small antenna, warm lights, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

17. `ufo-candy-pop`
   `A playful pastel pink and mint flying saucer with heart-shaped lights and a round empty porthole window, glossy, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

18. `ufo-pilot-window`｜操縦士の窓（自分の顔の丸をはめる枠）
   `A round saucer cockpit window frame seen from the front with a thick brass rim and rivets, empty inside, tiny pilot goggles resting on top of the rim, two small gloved hands holding the edge, cute, isolated on a plain flat medium gray (#808080) background.` ＋共通

19. `ufo-tractor-beam`｜トラクタービーム（加算）
   `A soft vertical tractor beam cone of teal and cream light widening downward, with floating sparkles and faint rings, isolated on a plain flat black background for additive blending.` ＋共通

20. `hanging-standby-screen`｜UFO にぶら下がる待機画面
   `A small square retro holographic screen frame with rounded corners and a thin brass bezel, hanging from two thin light threads, screen dark with a faint standby glow dot in the center, isolated on a plain flat medium gray (#808080) background.` ＋共通

### スタジオの部品（1024×1024・灰色背景）

21. `studio-building-box`｜建物・四角い建物
   `A small boxy retro-futuristic studio building, terracotta walls with cream trim, a large blank dark rectangular screen area on the front, a red carpet entrance, three-quarter front view, isolated on a plain flat medium gray (#808080) background.` ＋共通

22. `studio-building-dome`｜建物・丸い屋根
   `A small round studio building with a cream dome roof and teal bands, a large blank dark screen area on the front, round windows, red carpet entrance, three-quarter front view, isolated on a plain flat medium gray (#808080) background.` ＋共通

23. `studio-building-ship`｜建物・宇宙船の形
   `A small studio building shaped like a landed retro rocket ship lying on its side, chrome and cream with terracotta fins, an open hatch door with red carpet, a large blank dark screen panel on its side, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

24. `studio-roof-antenna`｜屋上のアンテナ
   `A retro rooftop antenna mast with a small satellite dish and a blinking red tip light, cream and teal metal, isolated on a plain flat medium gray (#808080) background.` ＋共通

25. `studio-mirror-ball`｜屋上のミラーボール
   `A shiny disco mirror ball hanging from a small rooftop crane arm, reflecting pink and teal light specks, isolated on a plain flat medium gray (#808080) background.` ＋共通

26. `studio-marquee-frame`｜大画面のまわりの電球の枠
   `A wide rectangular marquee frame lined with round warm light bulbs, brass and dark red, the inside area completely empty and plain dark, front view, isolated on a plain flat medium gray (#808080) background.` ＋共通

27. `studio-neon-reel`｜ネオンの飾り（字なし）
   `A neon sign made of glowing pink and teal glass tubes shaped like a film reel and a small flying saucer, no letters or words, mounted on a dark metal backing, isolated on a plain flat medium gray (#808080) background.` ＋共通

### 道具・ごほうびの瞬間（1024×1024）

28. `clapperboard-open`｜カチンコ（開いた状態）
   `A classic film clapperboard with its striped top stick raised open at an angle, black and white diagonal stripes with terracotta accents, the slate area completely blank with no writing, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

29. `clapperboard-closed`｜カチンコ（閉じた状態）
   `The same classic film clapperboard with the striped top stick snapped shut, a tiny burst of red sand around the hinge, slate area completely blank with no writing, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

30. `dust-vortex-sprite`｜砂の渦（加算で重ねる元絵）
   `A swirling vortex of fine red Martian sand and glowing dust particles seen from a low three-quarter angle, spiral shape, warm orange light inside, isolated on a plain flat black background for additive blending.` ＋共通

31. `film-canister`｜裏スタジオの映像（フィルム缶）
   `A round metal film canister with a plain blank cream label and a terracotta band, slightly open showing film inside, collectible feel, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

32. `mv-poster-frame`｜スタジオの壁のポスターの額
   `An ornate retro movie poster frame in brass with small corner bulbs, portrait orientation, the inside completely empty and plain dark, front view, isolated on a plain flat medium gray (#808080) background.` ＋共通

33. `scene-polaroid-blank`｜撮影中に現像されていくシーンの紙
   `A single instant photo card with a thick cream border and a blank softly glowing white image area, slightly curled, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

34. `slot-curtain-closed`｜空の枠の「上映待ち」
   `A tiny square stage with closed red velvet curtains and a small brass rail on top, warm light at the bottom edge, front view, isolated on a plain flat medium gray (#808080) background.` ＋共通

35. `curtain-velvet-pair`｜試写の幕（左右に開く）
   `A pair of tall rich red velvet theater curtains with gold tassels, drawn closed, front view, filling the frame vertically, isolated on a plain flat medium gray (#808080) background.` ＋共通

36. `projector-retro`｜上映機
   `A vintage film projector with two reels on top, cream and teal body, a soft beam of light coming from the lens, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

### MV の見本（試作の大画面用・1024×1024）

37. `mv-scene-1`｜試作の MV のシーン1
   `Square cinematic anime frame: a wide open blue sky over a small seaside town rooftop at golden hour, a paper airplane flying toward the horizon, nostalgic and bright.` ＋共通（夜・紫の指定は無視してよい）

38. `mv-scene-2`｜シーン2
   `Square cinematic anime frame: a person seen from behind (no face visible) walking along a long road under a pastel evening sky with clouds lit pink and gold, gentle wind.` ＋共通

39. `mv-scene-3`｜シーン3
   `Square cinematic anime frame: a night sky full of stars over a small hill with a single glowing tree, shooting stars streaking softly, warm hopeful ending mood.` ＋共通

### アイコン（1024×1024・灰色背景）

40. `nav-icon-starmap` / `nav-icon-camera` / `nav-icon-clapper`｜下のナビの3つ（3枚に分けて依頼）
   - `A cute game icon of a round brass telescope lens with a glowing constellation pattern inside, glossy painted style, centered, isolated on a plain flat medium gray (#808080) background.` ＋共通
   - `A cute game icon of a vintage movie camera with two film reels on top, cream and terracotta, glossy painted style, centered, isolated on a plain flat medium gray (#808080) background.` ＋共通
   - `A cute game icon of a small film clapperboard with black and white stripes, completely blank slate with no writing, glossy painted style, centered, isolated on a plain flat medium gray (#808080) background.` ＋共通
