# 水星（曲・オーロラの海・myアイランド）プレイ画面 点検と改善案

- 見たもの：`planet_shots/mercury/01〜15`・`sheet.jpg`、`_storysheet/st_mercury.jpg`・`s3_mercury.jpg`、`画面設計/mercury.md`・`index.md`、`試作/` の土星2本、アプリ `origin/claude/solar-system-home-planets-ew766y`（`MercuryWorld.tsx`・`ShipPlayer.tsx`・`ComposeChat.tsx`・`MyIsland.tsx`）、今ある絵（`public/art/mercury-sea.jpg` 1344×768・`mercury-island.jpg` 1024×1024・`ship-*.webp`・`onboarding/s/mercury-port.jpg`・`mercury-ice.jpg`）。
- 報告ずみの不具合（土の中に曲が出ない・作曲のオウム返し・下のナビが切れる）は数えていない。

---

## 1. 総評

- 絵の素材（オーロラの海・桜の帆の船・火山の島）は良いのに、**画面の作りが「横長の絵を小さく貼った Web ページ」になっている**。海図は 1344×768 の横長の絵を縦の画面に収めているので、上下が空いた暗い紺の中に四角が浮く（`01`）。島も 4:3 に切った絵の下に、何もない紺の帯が半分以上続く（`09`）。15〜20歳が毎日開きたくなる「世界に入った感じ」がまだない。
- 中心の遊び（作る→しまう→出航→戻ってくる）の**ごほうびの瞬間がテキストのカード1枚で終わる**（`07`・`08`）。曲ができた時も、出航した時も、体で感じる動き・音・手ざわりがない。
- 設計（`mercury.md` §3・§7・§9）と食い違う表示が今も残る：「今 8人が航海中」、タブ〔みんな／フォロー／ダチ〕、★1〜3、曲が終わると勝手に次の船へ、島の〔フォロー〕。数を出さない・勝手に流さない、はこの星の芯なので先に直したい。
- 押す所が小さい：船の名札の字は 8px（`text-[clamp(8px,1.4vw,13px)]`）、再生の行は横に詰まって ★ が幅およそ28px、島の〔⛏ 土の中の曲〕は高さおよそ34px。
- 方針：**縦いっぱいの海（1152×2048 の絵）＋コードで動かす船・波・オーロラ**（土星の試作と同じ作り方）にして、「出航」を最大の見せ場にする。

---

## 2. 改善点（効いてくる順）

### 1. 海図を縦いっぱいの世界にする（今は小さな四角が暗い画面に浮いている）
- 画面/場所：M-1 海図（`01`・`03`・`12`、`MercuryWorld.tsx` の `<ArtStage name="mercury-sea" reserve={230}>`）
- 問題：横長の `mercury-sea.jpg`（1344×768）を縦 390×844 の画面に「収めて」いるので、絵は高さおよそ370pxしかなく、上に約200px・下に約150pxの何もない紺が残る。船8隻がその四角の中に押しこまれて重なり、名札も重なる。
- 改善案：
  - 縦の絵 `mercury-sea-night-full`（1152×2048）を画面いっぱいに `cover` で敷く。水平線は上から約34%。上の帯（タブ）と下のナビは、絵の上に乗る半透明のガラスにする（`backdrop-filter: blur(12px)`、上から下へ黒→透明のグラデーション）。
  - 船は絵に焼きこまず、コードで置く。海の上に**だ円の航路を3本**（奥・中・手前）引き、船は航路の上をゆっくり回る（1周およそ90秒）。奥の船ほど小さく（0.45倍）、手前ほど大きく（1.1倍）、y の順で重ねる（土星の試作と同じ、だ円の投影と奥行きの並べかえ）。
  - コードで動かすもの：オーロラの帯（12秒周期でゆらぐ・加算合成）、星のまたたき、月の光の柱がゆれる、水面の横線（遠近つきの sin 波）、船の白い引き波、船のゆれ（±3°・4〜6秒）。
  - 船8隻が重ならないように、航路ごとの間隔を決めて回す（同じ航路は最大3隻）。
- 種類：見た目／世界観／15-20ウケ

### 2. 「出航」を最大のごほうびの場面にする（今は〔島の土に埋める（デモ）〕を押すと文字が出るだけ）
- 画面/場所：M-3⑧ → M-5 出航の確認 → M-1（`07`・`08`）
- 問題：作った曲を海へ出すという水星いちばんの気持ちいい瞬間が、画面にない。今は「保存して島の土に埋めました → 島を見る」の一行と、島へ行く導線だけ。出航の確認画面（M-5）も、出航の演出もない。
- 改善案（5〜6秒の一本の演出。くわしくは 3. 試作プラン）：
  1. 〔🚢 出航させる〕→ 下からシート：レコード（ジャケット＝木星で選んだアート）、行き先 ●〔ダチへ〕（KIMORIN⭐︎・{inviter} の顔の丸が並ぶ）が選ばれた状態。〔みんなへ〕は三周目まで出さない（15歳未満はずっと出さない）。
  2. 大きな〔🚢 出航〕（高さ64px）。押すと、手前の桟橋の水面から自分の船がせり上がる（水しぶきの粒）。
  3. シートのレコードが弧を描いて飛び、帆になって広がる（帆にジャケットの絵がはまる）。へさきに自分の「船長」（{neo} の顔の丸＋小さな帽子）がひょこっと出て手をふる。
  4. やわらかい汽笛（低い音を0.6秒かけて大きくし、0.8秒で消す。急に大きな音にしない）。水面に**金色の五線の輪**が5重に広がる。
  5. 船が航路に乗って沖へ。後ろに音符の光の粒が尾を引く。オーロラが1.5秒かけて少しだけ明るくなり、ゆっくり戻る（白く光らせない）。
  6. テロップ「{neo}の最初の一隻が、ダチの海へ出た」→ 一行「88時間、ダチの海をめぐって、あなたの島の桟橋に戻ります」。水平線の上に、ダチの島へ向かう点線の金の航路が一瞬見える（数は出さない）。
- 種類：15-20ウケ／世界観／分かりやすさ

### 3. 数とタブを設計どおりに（「今 8人が航海中」・〔みんな／フォロー／ダチ〕）
- 画面/場所：M-1 上の帯（`01`、`MercuryWorld.tsx` 152行・`Tabs`）
- 問題：人数の札は「数を出さない」決まり（`mercury.md` §3・§7）に反する。タブも〔推し〕にまとめる決まり（M-R109）と違う。フォローの言葉は使わない（知らない人は〔推す〕だけ）。
- 改善案：人数の札は消す。タブは一周目・二周目は〔推し〕の一つだけ（タブの形にせず、左上に小さな見出し「推しの海」）。三周目から〔みんな〕〔推し〕の二つ。15歳未満は〔推し〕（ダチだけ）のまま、〔みんな〕は出さない。空いた上の場所は、オーロラと月にゆずる。
- 種類：機能／世界観

### 4. 曲が終わっても勝手に次の船へ行かない
- 画面/場所：M-2 船の曲（`ShipPlayer.tsx` 60〜90行：`setTimeout(() => next.current(), 0)`、`if (!s.playing && s.progress >= 1) next.current()`）
- 問題：一曲終わると次の人の船が自動で入ってきて鳴る。「船は押した時だけ鳴る・勝手に流さない」（§3）に反する。左右の船（ぼかしたのぞき見）も別の人の船に飛ぶ。
- 改善案：終わったら止まり、レコードの回転がゆっくり止まる（1.2秒）。ボタンは〔▶ もう一回〕〔‹ 前の曲〕〔次の曲 ›〕（同じ人の88時間以内の曲だけ）。横スワイプも同じ人の中だけ。のぞき見の船はなくし、閉じると海図に戻ってその船が少し光る（聴いた印。数は出さない）。
- 種類：機能／世界観

### 5. 再生の行が詰まって押せない（★が幅およそ28px）
- 画面/場所：M-2（`02`。★1・★2・❚❚・★3・💬・〔この人の島へ〕を一行に並べている）
- 問題：6個を390pxに並べるので、★は48px指定が縮んで幅およそ28px、一時停止もつぶれただ円になる。押し間違えやすい。★1〜3 は設計にない（三周目からの〔★ しおり〕1段だけ）。
- 改善案：
  - 一周目・二周目：まん中に〔▶／❚❚〕直径72px、その左右に〔‹〕〔›〕各56px。2段目に〔🏝️ この人の島へ〕（二周目から・ダチだけ）と〔⋯〕（通報・ブロック・推しから外す）。
  - 三周目：〔★ しおり〕を1つ足す（押すとレコードに金の星のシールがぽんと貼られる。数は出さない）。
  - 💬 は M-2 の設計にない。残すなら〔⋯〕の中へ。
  - どのボタンも44×44px以上、間を8px以上。
- 種類：使いやすさ／機能

### 6. 船の名札を読めて押せる大きさに（字が8px・名前と曲名がつながって切れる）
- 画面/場所：M-1 船の上の札（`01`「@kaba_boss『MI…」「@wani_queen『女王の…」）
- 問題：`clamp(8px,1.4vw,13px)` なのでスマホでは8px。名前と曲名を一つの札に入れるので、どちらも「…」で切れる。自分の船の「N時間前」も出ている。
- 改善案：札は**曲名だけ**（設計どおり）、12px・太字・最大10文字（あふれたら2行まで）。名前は船を押した後の画面で出す。ダチの船には小さな名札の印（金の小さな錨）。手前の船だけ札を出し、奥の船は札を隠す（重なりを防ぐ）。押せる範囲は船の絵より上下左右12px広く取る（最低56×56px）。
- 種類：分かりやすさ／使いやすさ

### 7. はじめの30秒：着いた時に「どこを押せばいいか」を絵で見せる
- 画面/場所：水星に入った時の M-1（`01`）
- 問題：入ると、何も動かない四角の絵と、人数の札とタブだけ。音もない。何をする星かが一目で分からない。
- 改善案：
  - 入った瞬間、カメラがオーロラの上から海へ1.2秒でゆっくり下りてくる（やわらかい動き。初回だけ。動きを減らす設定の人は無し）。
  - 一番近いダチの船の上に、{bati} の小さな吹き出し「タップすると、聴けるよ」（初回だけ・3秒で消える）。
  - 下の〔♫+ 作曲〕が2秒周期でゆっくり光る（まだ曲を作っていない人だけ）。
  - 波の音とオーロラの小さな音の環境音を、0.8秒かけて小さく流す（音量はしぼって始める。消すボタンは右上）。
- 種類：分かりやすさ／15-20ウケ

### 8. 〔推し〕の海が空の時の画面を作る
- 画面/場所：M-1（ダチの船が1隻もない時。一周目の5日目より前、ダチがいない人、住人）
- 問題：今はサンプルの船で埋まっているので、本番で空になった時の画面がない。真っ暗な海だけになるおそれ。
- 改善案：空の時専用の絵 `mercury-sea-empty-buoy`（静かな海に灯りのついたブイが一つ、手前に自分の桟橋）。一行「ダチの船は、まだ来ていない。」その下に〔♫+ 一曲つくって、出航させる〕（高さ56px）。ダチがいない人には〔🤝 ダチの招待状〕へのリンク（地球）。KIMORIN⭐︎の船は一周目の5日目から必ず来るので、それ以降は空にならないことも確かめる。
- 種類：分かりやすさ／見た目

### 9. 作曲の画面を「声が主役」に（今は文字の入力欄と〔送る〕が主役）
- 画面/場所：M-3 作曲（`04`〜`07`、`ComposeChat.tsx`）
- 問題：設計（M-R130・M-R142）は「まん中に大きな〔🎙 話してみよう〕、すみに小さな⌨」「曲の感じは例のチップと〔おまかせ〕」。今は横長の入力欄＋〔送る〕＋小さなマイク、ジャンルの6ボタンが選択肢として並ぶ。①アートを選ぶ手順、③'スペルの札、④歌詞の下書き、⑤マナの確認もない。
- 改善案：
  - 下に直径96pxの〔🎙 話してみよう〕（押している間、まわりに音の波の輪が広がる。話した字がリアルタイムで吹き出しに入る）。その下に小さく〔パス〕。右下すみに⌨（32px見た目・押せる範囲44px）。
  - {bati} の問いの下に「迷ったら、例から」のチップ（ポップ／ロック／ヒップホップ／バラード／EDM・押すと言葉になる）と〔おまかせ〕。
  - スペルの札は、紙の札がトランプのように1枚ずつ配られる動き（0.12秒ずつ）。
  - ヘッダーの「（仮の画面）」「伴奏と歌も入れられるよ」は消す。
- 種類：機能／使いやすさ／世界観

### 10. 〔♫+〕の丸ボタンが入力欄に重なる
- 画面/場所：M-3（`07`：入力欄「今日あったことを話してみよう」の真ん中に、下のナビの〔♫+〕の丸が上から重なる）
- 問題：下のナビの真ん中の丸は `-mt-8` で上に32px飛び出しているので、作曲の入力欄（ナビのすぐ上）を隠す。押すつもりで入力欄を押すと作曲ボタンが反応する。
- 改善案：作曲中は下のナビをしまう（作曲は全画面のモードにして、左上の〔×〕で戻る）。ナビを残すなら、入力の段をナビの丸より40px上に置く。
- 種類：使いやすさ／見た目

### 11. 曲ができた瞬間をごほうびにする（今はカード1枚）
- 画面/場所：M-3⑥〜⑦（`07`）
- 問題：「できたよ！聴いてみて。」の吹き出しと、レコードの丸＋歌詞の箱。レコードの上の▶が絵と重なり、押す場所が分かりにくい。〔島の土に埋める（デモ）〕の言葉も設計（〔🔒 土の中にしまう〕）と違う。
- 改善案：
  - ⑥作曲中：スペルの札が光の音符になって渦を巻き、まん中で**レコードが一枚プレスされる**（溝の線が外から内へ刻まれていく）。「♪ 作曲中…」と〔閉じる〕（閉じても続く）。
  - ⑦できた時：ジャケット（選んだアート）の袋からレコードがすっと出てきて、虹色のつや（ホロ）が斜めに一度走る（ゆっくり。白く光らせない）。針が落ちる小さな音のあと、0.8秒かけて曲が大きくなる。歌詞はカラオケのように今の行が光る。
  - ボタンは〔▶〕（大きく）と〔🔒 土の中にしまう〕（オレンジの大きなボタン）。小さく〔作り直す（1回だけ）〕。
  - しまう時：レコードが砂に沈み、土の粒がきらっと舞い、下のナビの〔🏝️ myアイランド〕に小さな光る点がつく。一行「曲を、あなただけの〔⛏ 土の中の曲〕にしまいました。誰にも送られていません」→〔🚢 出航させる〕〔閉じる〕（2. の出航へ）。
- 種類：15-20ウケ／分かりやすさ／機能

### 12. 物語の中の白い説明パネルを、夜の海に合う色に
- 画面/場所：5日目の作曲の練習（`13`〜`15`、`st_mercury.jpg`：アートを選ぶ・マイク・歌詞の下書き）
- 問題：氷の大陸と夜の海の絵の上に、真っ白なパネルが画面の半分以上をおおう。絵の世界から急に事務の書類になる。白い面が大きいので夜は目にまぶしい。
- 改善案：パネルは濃い紺のすりガラス（`rgba(10,20,48,.82)`＋`blur(14px)`）、ふちに細い金の線、角は大きく丸く。マイクのボタンは金の真ちゅうの丸（今の絵の方向でよい）。アートの2枚は、大きな正方形のカードを少しななめに重ねて並べ、選んだ方がふわっと前に出る。
- 種類：見た目／世界観

### 13. myアイランドを縦いっぱいの島に（今は絵の下に何もない紺が半分）
- 画面/場所：M-6（`09`〜`11`、`MyIsland` 397行 `aspect-[4/3]`）
- 問題：島の絵を4:3で切っているので、画面の下半分（約450px）が空っぽ。説明の字が桟橋の絵の上に重なって読みにくい。浜のレコードが見えない。
- 改善案：
  - 縦の絵（`mercury-island-backdrop-night` 1152×2048：海と空だけ）の上に、島を部品の絵で重ねる（M-7 の札どおり：形3種・浜4種・灯り3種）。
  - 島は画面の上から40〜70%に大きく。浜にはレコード立て（コードでジャケットをはめる）を半円に並べる。手前（下から20%）に桟橋。88時間たって戻った船がつく「船着き場」の杭が並ぶ。
  - 砂の中に、光がもれる木の扉＝〔⛏ 土の中の曲〕の入口（押せる範囲72×72px）。曲がしまってあると、すき間から金の光がゆれる。
  - 説明の一行は、桟橋の上ではなく、画面下のナビの上に小さなガラスの札で（初回だけ）。
- 種類：見た目／世界観／使いやすさ

### 14. 〔🏝️ 島を飾る〕が何もしない
- 画面/場所：M-6 右上（`11`。`MercuryWorld.tsx` 418行：`say('島を飾るのは準備中です')`）
- 問題：押すとトーストが1.8秒出るだけで、見た目は変わらない（`11` は `09` と同じ）。`MyIsland.tsx` には形・浜・灯りの札の仕組みがあるのに、つながっていない。島の絵も、札と関係のない固定の火山の島1枚。
- 改善案：〔🏝️ 島を飾る〕→ M-7（{bati}「どんな島にしたい？　ざっくりでいいよ！」・〔🎙〕・〔おまかせ〕・部品の札）につなぐ。札を変えると、島の部品がその場でぽんと入れかわる（0.9→1.05→1倍の小さな弾み、砂の粒）。決めると、汽笛→海の底から五線の輪→島がせり上がる（設計 M-7④）。
- 種類：機能／15-20ウケ

### 15. 島を作る前・土の中が空の時の画面
- 画面/場所：M-6（作る前）、M-4（`10`「土の中は空っぽです（作曲すると、ここにデモが埋まります）」）
- 問題：作る前の状態（港の前の何もない海と〔⛏〕の入口だけ：§3）の絵がない。土の中が空の時は、茶色い箱に小さな字が一行だけ。「デモ」という言葉も設計にない。
- 改善案：
  - 作る前：`mercury-island-before`（静かな海、小さな桟橋、波の上にぽつんと光る木の扉）。一行「ここに、あなたの島ができる。」〔🏝️ 島をつくる〕（高さ56px）。
  - 土の中が空：`mercury-underground-empty`（土の断面、根っこ、まん中に小さな光の芽が一つ）。一行「まだ、何も眠っていない。」〔♫+ 一曲つくる〕。
  - 土の中に曲がある時：`mercury-underground-cutaway` の上に、琥珀色のカプセルに入ったレコードが新しい順に並ぶ。押すとカプセルが開いて鳴る。
- 種類：見た目／分かりやすさ

### 16. 島と土の中の言葉を設計にそろえる（「みんなの海」「デモ」「フォロー」）
- 画面/場所：M-4 の説明（`10`）、ダチの島（`MercuryWorld.tsx` 549〜567行）
- 問題：土の中の説明「出航させると、88時間**みんなの海**を渡ります」は、一周目・二周目は〔ダチへ〕なので間違い。見出し「土の中の**デモ**曲」。ほかの人の島に〔フォロー〕ボタンがある（ダチの島は見るだけ。知らない人は三周目から〔推す〕だけ。ダチの申しこみボタンは出さない）。
- 改善案：「⛏ 土の中の曲」「🔒 あなただけ」「〔🚢 出航させる〕を押すと、88時間ダチの海をめぐって、この島の桟橋に戻ります」。ダチの島の〔フォロー〕は消す。三周目の〔みんな〕から来た知らない人の島だけ〔⋯〕の中に〔推す〕。
- 種類：機能／世界観

### 17. 自分の島の「戻ってきた曲」を集めたくなる見た目に
- 画面/場所：M-6 浜のレコード（今は横スクロールの小さなレコードと8〜14pxの字）
- 問題：戻ってきた曲が横に流れる帯にあり、モノとして集まっていく感じがない。
- 改善案：浜にレコード立てが1枚ずつ増えていく（増えた日に、船が桟橋につく小さな演出：船からレコードが手渡されて浜に立つ）。ジャケットに旅の印（金の小さな錨のスタンプ）。押すとレコードが立ち上がって回る。数は出さない（「◯枚」も出さない）。ごほうびではなく、自分の作品がモノとして島に残ることが集める楽しさになる。
- 種類：15-20ウケ／世界観

### 18. 曲を鳴らし始める時の音量を、いつも小さく始める
- 画面/場所：M-2・M-3・島のレコード（`toggleAudio`、合成音の `synth.play`）
- 問題：船を押すといきなり本番の音量で鳴る。音が読めない時は合成音に切りかわって、急に別の音が鳴る。
- 改善案：どの再生も0.8秒で0→目標の音量へ。合成音への切りかえはせず、読めない時は「この曲は、今は聴けません」と静かに出す。前の曲は0.3秒で小さくしてから止める。
- 種類：使いやすさ／機能

### 19. 上の帯（星の名前・マナ・EN）を薄くして、絵に場所をゆずる
- 画面/場所：全画面の PlanetShell の見出し（`01` など）
- 問題：見出しが高さおよそ56pxの黒い帯で、星の丸・「水星／音楽を見つける・つくる」・「✦ 880 MANA」・EN が並ぶ。世界の上にいつも事務の帯が乗る。マナは設計では「マナ」と書く。
- 改善案：絵の上に乗る透明な帯（高さ48px）。左に〔←〕（44px）、まん中に「水星」だけ、右に小さなマナのしずく（数字は今の財布の量なのでそのままでよい。字は「マナ」）。EN は設定の中へ。説明の「音楽を見つける・つくる」は初回に1回だけ。
- 種類：見た目／分かりやすさ

### 20. 下のナビの絵文字を、この星の絵のアイコンに
- 画面/場所：下のナビ（🗺️ 海図・♫+ 作曲・🏝️ myアイランド）
- 問題：OS の絵文字は端末で見た目が変わり、描きこんだ絵のタッチと合わない。
- 改善案：海図＝巻いた古い海図、作曲＝金の音符の入った貝、myアイランド＝ヤシの小島、の描いたアイコン（`nav-icon-*`）。選ばれているものは少し大きく（1.12倍）、下に金の小さな光の線。
- 種類：見た目／15-20ウケ

### 21. 島の左上の名札・右上のボタンが絵（月）にかぶる
- 画面/場所：M-6 上（`09`〔🏝️ 島を飾る〕が月に重なる）
- 問題：ボタンを絵の上に置くので、大事な絵（月・オーロラ）を隠す。
- 改善案：島の名前は島のすぐ上に木の看板として描く（コードで字を入れる）。〔🏝️ 島を飾る〕は下のナビの上の段に、〔⛏ 土の中の曲〕と並べる（各高さ48px以上）。
- 種類：見た目／使いやすさ

### 22. 船を押してから曲の画面へ移る時の「つながり」を作る
- 画面/場所：M-1 → M-2
- 問題：押すと画面がぱっと切りかわり、どの船の曲か体でつながらない。
- 改善案：押した船がその場で一回大きくゆれ、カメラがその船へ0.6秒で寄り、そのまま M-2 の大きな船になる（同じ絵の拡大）。閉じる時は逆に、海図のその場所へ戻る。
- 種類：分かりやすさ／15-20ウケ

### 23. 作曲の待ち時間と技術の言葉
- 画面/場所：M-3（`ComposeChat.tsx` 269行「音楽スタジオ（GPU）を起動中…。準備できたら自動で伴奏を作り直すよ。」、273行「手直し中…（歌い直し・2番や大サビの追加は1〜2分）」）
- 問題：「GPU」など作る側の言葉がそのまま出る。待ち時間の見た目がない。
- 改善案：「♪ スペルを唱えています…」「♪ 作曲中…」だけにする。待つ間はレコードのプレスの動き（11.）と、{bati} が小さく体をゆらす動き。閉じても続くことを一行「閉じても、作曲は続きます。できたら、次に開いた時に光ります」。
- 種類：世界観／分かりやすさ

### 24. 15歳未満（子ども仕様）の水星
- 画面/場所：M-1・M-2・M-5・M-6
- 問題：今は年齢で出し分けがない。
- 改善案：〔みんな〕のタブ、〔みんなへ〕の行き先、〔推す〕、知らない人の島への入口を、いつまでも出さない。海はダチの船だけ。ダチの島は見るだけ。出航の確認でも〔ダチへ〕だけを見せる（〔みんなへ〕を薄く見せることもしない）。
- 種類：機能

### 25. 動きを減らす設定と、暗い所での読みやすさ
- 画面/場所：全体
- 問題：船のゆれ・オーロラ・回るレコードが、動きを減らす設定でも止まらない。紺の上の灰色の小さな字（`text-white/50`・11px）が読みにくい。
- 改善案：`prefers-reduced-motion` で、カメラの移動・粒・回転を止め、切りかえはフェードだけ。本文は14px以上、補足は12px以上・白の75%以上の濃さ。
- 種類：使いやすさ

### 26. 船の種類を「自分の船」として選べるように（集める楽しさ）
- 画面/場所：M-5 出航の確認
- 問題：船の形はキーから自動で決まる（`pickShip(r.key)`）。自分の船を持っている感じが弱い。
- 改善案：はじめの一隻はみんな小さな木の船（`ship-starter-dinghy`）。〔🏝️ 島を飾る〕の札と同じように、{bati} との会話で船の形（帆の形・船体の色・灯り）を部品の札で選べる（マナなし・生成なし）。数や珍しさの段階はつけない。
- 種類：15-20ウケ／世界観

---

## 3. 試作プラン（1本）：「出航の海」（M-1 海図＋M-5 出航を一画面で）

**ねらい**：水星を開いた瞬間に「海に来た」と感じ、自分の曲が船になって海へ出るまでを、指一本で気持ちよく体験する。390×844 の HTML 1枚（canvas）。土星の試作と同じ作り方：生成した舞台の絵を canvas に敷き、動く部品はコードで描く。船はだ円の投影で奥行きを出し、y の順で重ねる。絵はすべて data URI（webp）で埋めこむ。

### 画面の作り（上から）
- 上の帯（高さ48px・透明→紺のグラデ）：〔‹〕・「水星」（Zen Maru Gothic 900、金→白のグラデの字）・右に小さな「推しの海」の札（タブにはしない）。
- 舞台（全面 canvas）：
  - 敷く絵：`mercury-sea-night-full`（1152×2048、水平線は上から34%）。
  - コードの層（下から）：①星のまたたき（120個）②オーロラの帯3本（ベジェの帯を加算合成、色は #3fe0c8・#ff6fb5、12秒周期で波打つ）③月の光の柱（水面に横縞のゆらぎ）④水面の横線（遠近つき）⑤船と引き波（奥→手前の順）⑥手前の桟橋（`mercury-pier-foreground`）⑦音符と光の粒。
  - 船：ダチの船6隻＋KIMORIN⭐︎の船。航路はだ円3本：中心 (195, 520)、半径 x=210/170/120、y=70/50/32。角度 t を毎フレーム進め、`depth = (sin t + 1)/2` で 0.45〜1.1倍。帆にジャケットの絵を斜めの四角に切り抜いて貼る（`setTransform` で傾ける）。名札は手前の船だけ、曲名12px。
- 下（高さおよそ150px・紺のグラデ）：〔🚢 出航させる〕（幅310px・高さ56px、金のグラデ、ふちに回る虹色の線＝土星の試作のマイクボタンと同じ作り）。その下に3つの描いたアイコンのナビ。

### 触れること
1. **船をタップ**：船が一度大きくゆれ、カメラが0.6秒でその船へ寄る（canvas 全体を拡大・平行移動）。下からシート：回るレコード（ジャケット）、曲名、@名前、〔▶〕72px、〔‹〕〔›〕56px。音は WebAudio で短いメロディを合成し、0.8秒で音量を上げる。帆の提灯が拍に合わせてゆっくり明るくなり、音符が帆から上へ浮かぶ。曲が終わると止まる（次へは行かない）。シートを下げると海図へ戻る。
2. **はじめての案内**：最初の5秒だけ、一番近い船の上に {bati} の吹き出し「タップすると、聴けるよ」。
3. **出航（見せ場）**：
   - 〔🚢 出航させる〕→ シート：自分のレコード（ジャケット）、行き先 ●〔ダチへ〕（KIMORIN⭐︎・ハルの顔の丸）、一行「88時間、ダチの海をめぐって、あなたの島の桟橋に戻ります」、〔🚢 出航〕（高さ64px）、すみに〔やめる〕。
   - 〔🚢 出航〕を押す → シートが下がる → 手前の桟橋の横の水面に波紋 → 自分の船（`ship-starter-dinghy`）が下からせり上がる（水しぶきの粒40個）。
   - レコードが画面下から弧を描いて飛び、帆の位置で横に広がって帆になる（幅0→1を0.5秒、ジャケットの絵がはまる）。
   - へさきに船長（`captain-bow-frame` の丸に自分の顔）がひょこっと出て2回手をふる。
   - 汽笛（合成の低い音、0.6秒で大きく→0.8秒で消える）。水面に金の五線の輪（5本の細いだ円）が広がって消える（1.4秒）。
   - 船が一番手前の航路に乗り、ゆっくり加速して沖へ。後ろに音符の光の粒。オーロラの明るさが1.5秒で+20%→2秒で戻る。
   - テロップ（中央、字が一文字ずつ浮く）「ミナトの最初の一隻が、ダチの海へ出た」。水平線の上に、ダチの島2つへの点線の金の航路が描かれて消える。
   - 自分の船は航路に残り、手前に来た時だけ札「あなた」。
4. **右上の音の切りかえ**（44px）：環境音（波）のオン・オフ。最初はオフで、出航や再生の時だけ鳴る。

### 「わあ」の瞬間
レコードが空中で帆に変わり、自分の顔の船長が手をふって、五線の輪の上を船が出ていくところ。音・動き・光がそろう一点。

### 守ること
- 数・人数・残り時間は出さない。白く光らせない（明るさの変化はすべて1秒以上かける）。音は小さく始める。
- 〔みんなへ〕は出さない（一周目の体験）。
- `prefers-reduced-motion`：カメラの寄りと粒を止め、フェードだけ。
- 全ボタン44px以上。

### 必要な絵（4. のうち）
`mercury-sea-night-full`、`mercury-pier-foreground`、`ship-blank-sail-a〜c`、`ship-kimorin-ballad`、`ship-starter-dinghy`、`captain-bow-frame`、`vinyl-record-blank`、`record-sleeve-blank`、`staff-ring-water`、`aurora-ribbon-overlay`、`nav-icon-sea-chart`・`nav-icon-compose-shell`・`nav-icon-island`、ジャケット見本 `jacket-sample-*`。

---

## 4. 絵の依頼リスト（Seedream）

共通の決まり
- 背景：縦 1152×2048。部品：1024×1024、**無地の平らな灰色（#808080）の背景**（影を背景に落とさない。あとで切り抜く）。加算で重ねるものは無地の黒。
- タッチ：今の水星の絵（`mercury-sea.jpg`・`mercury-island.jpg`・`ship-sakura.webp`）に合わせる＝日本のアニメ調、少しリアルでかわいい、絵本のような筆のタッチ、深い紺の夜、ティールとマゼンタのオーロラ、大きな暖かい金色の満月、提灯の暖かい光。
- どの絵にも「文字・記号・ロゴ・UI なし」。

各プロンプトの末尾に必ず付ける共通の一文（下では「＋共通」と書く）：
`Japanese anime illustration, semi-realistic yet cute, painterly storybook brush texture, deep navy night, swirling teal and magenta aurora, warm golden moonlight and lantern glow, rich cinematic lighting, soft bloom, highly detailed, no text, no letters, no numbers, no logos, no UI, no watermark.`

### 舞台（背景 1152×2048）

1. `mercury-sea-night-full`｜1152×2048｜海図の全面の舞台（試作）
   `Vertical portrait composition of an endless calm ocean at night on a magical planet. Horizon line at about one third from the top. Huge warm golden full moon upper right, its reflection forming a shimmering light column on the water. Wide swirling ribbons of teal and magenta aurora across the sky with scattered stars. Two tiny distant castle islands silhouetted on the horizon left and right. The lower two thirds is open gently rippling dark-teal water with sparkles, completely empty, leaving room for boats. Subtle vignette at the bottom.` ＋共通

2. `mercury-sea-empty-buoy`｜1152×2048｜〔推し〕の海が空の時
   `Vertical portrait of a quiet empty ocean at night, horizon at one third from top, soft teal aurora and a golden full moon. In the middle distance a single small round buoy with a warm glowing lantern on top, its light reflecting on calm water. In the bottom foreground the end of a small wooden pier with two hanging lanterns. Peaceful, a little lonely but hopeful mood, lots of open water.` ＋共通

3. `mercury-launch-harbor`｜1152×2048｜出航の場面（桟橋が手前に大きい版）
   `Vertical portrait view from a wooden harbor pier looking out to a night ocean. The pier planks run from the bottom center toward the sea, lined with glowing paper lanterns on posts. Gentle waves, moon reflection, teal and magenta aurora above. On the right of the pier a calm patch of open water where a boat could rise. Festive but calm atmosphere, warm lantern light versus cool sea.` ＋共通

4. `mercury-pier-foreground`｜1024×1024（灰色背景）｜試作の手前に重ねる桟橋
   `Close foreground element: the end of a weathered wooden pier seen from slightly above, with two wooden posts holding warm glowing round paper lanterns, rope coils and a small brass bell, isolated on a plain flat medium gray (#808080) background, no shadow on background.` ＋共通

5. `mercury-player-water`｜1152×2048｜船の曲（M-2）の背景
   `Vertical portrait close view of a night ocean surface at boat level, horizon at 45 percent height, aurora ribbons reflected on the glossy water, golden moon glow on the right edge, soft bokeh sparkles in the air, empty center space for a large boat, darker gradient at the bottom.` ＋共通

6. `mercury-island-backdrop-night`｜1152×2048｜myアイランドの空と海（島は部品で重ねる）
   `Vertical portrait seascape at night with no island: horizon at 40 percent height, teal and magenta aurora, golden full moon upper left, two tiny distant castle silhouettes on the horizon, calm glossy water filling the lower half with gentle ripples, a soft warm glow on the water in the center where an island will be placed.` ＋共通

7. `mercury-island-before`｜1152×2048｜島を作る前
   `Vertical portrait of an empty night sea in front of a small harbor: a tiny wooden pier in the lower foreground, and floating on the calm water in the middle a small wooden trapdoor-like hatch on a little sandbar, warm golden light leaking from its edges. Aurora and moon above. Calm, expectant mood, lots of empty space.` ＋共通

8. `mercury-underground-cutaway`｜1152×2048｜土の中の曲（曲がある時）
   `Vertical cross-section cutaway of the soil beneath a tropical island at night: a thin strip of beach and palm roots at the very top, then layers of dark rich earth with glowing tree roots, tiny crystals and fireflies. Several empty round niches carved in the soil, each softly glowing amber like a nest, arranged in a gentle zigzag going down. Cozy, secret, treasure-like mood.` ＋共通

9. `mercury-underground-empty`｜1152×2048｜土の中が空の時
   `Vertical cross-section cutaway of quiet dark soil beneath an island: roots, small pebbles, faint fireflies, and in the center a single tiny sprout made of soft golden light, waiting to grow. Calm, hopeful, simple composition with lots of dark space.` ＋共通

10. `mercury-compose-ice-night`｜1152×2048｜作曲（M-3）の背景
   `Vertical portrait of a frozen harbor on a sea planet at night: thick white ice shelves with blue glowing cracks in the foreground, calm black-teal water, gentle teal and magenta aurora overhead, a warm amber glow coming from a small cozy shelter at the left edge. Soft snow sparkles drifting. Upper half mostly sky for chat bubbles, lower part darker for controls.` ＋共通

11. `mercury-route-chart`｜1152×2048｜出航後の「88時間の航路」の一枚絵
   `Vertical illustrated antique sea chart of a magical ocean, drawn on deep navy parchment with gold ink lines: several small round islands scattered, dotted golden route lines curving between them, a compass rose without letters, little wave strokes and tiny star marks. Elegant, collectible map feeling, no writing at all.` ＋共通

12. `mercury-friend-island-visit`｜1152×2048｜ダチの島を訪ねた時の舞台
   `Vertical portrait of a different small island at night seen from the sea: crescent-shaped beach of white shells, a few palm trees with string lights, a small wooden record stand display area on the beach with empty easels, a short pier in the foreground, aurora and moon above. Welcoming, cozy atmosphere.` ＋共通

### 船（部品 1024×1024・灰色背景）

13. `ship-starter-dinghy`｜はじめの一隻（試作）
   `A small cute wooden sailboat for a beginner, round chubby hull painted cream and teal, one plain blank square cream-colored sail with no pattern, a round empty porthole window at the bow with a brass rim, tiny lantern on the mast, side view three-quarter angle, sticker-like clean white outline, isolated on a plain flat medium gray (#808080) background, no shadow on background.` ＋共通

14. `ship-blank-sail-a`｜帆にジャケットを貼る船（帆は無地）
   `A charming Japanese-style wooden ship with pagoda cabin and paper lanterns, the main sail is a plain blank flat cream square with no pattern so an image can be applied later, a round empty porthole with brass rim on the hull, three-quarter side view, small splash of foam at the waterline, white sticker outline, isolated on a plain flat medium gray (#808080) background.` ＋共通

15. `ship-blank-sail-b`
   `A sleek neon-trimmed modern sailboat with glowing teal and pink edge lights, one large blank flat white square sail without any pattern, round empty porthole with chrome rim, three-quarter side view, foam at waterline, white sticker outline, isolated on a plain flat medium gray (#808080) background.` ＋共通

16. `ship-blank-sail-c`
   `A cozy pastel candy-colored paddle boat with a heart-shaped balloon canopy, a blank flat square banner sail with no pattern, a round empty porthole with gold rim, three-quarter side view, foam at waterline, white sticker outline, isolated on a plain flat medium gray (#808080) background.` ＋共通

17. `ship-kimorin-ballad`｜KIMORIN⭐︎の船（〔推し〕に来る船）
   `An elegant small ship themed after a white fox in a crimson hooded cloak: deep red velvet-like sails with white fur trim, round dark sunglasses-shaped twin portholes, a small golden spiral slide on the deck, warm lanterns, three-quarter side view, foam at the waterline, white sticker outline, isolated on a plain flat medium gray (#808080) background.` ＋共通

18. `captain-bow-frame`｜へさきの船長（自分の顔の丸をはめる枠）
   `A tiny chibi sea captain figure frame for a ship's bow: a little navy captain hat with gold anchor emblem floating above an empty round face window with a brass porthole rim, two small white-gloved waving hands at the sides, cute, isolated on a plain flat medium gray (#808080) background.` ＋共通

### 島の部品（1024×1024・灰色背景）

19. `island-base-round-hill`｜島の形・丸い丘
   `A small round tropical island with a single gentle grassy hill in the center, sandy shore ring, seen from a slightly elevated three-quarter view, no buildings, soft night lighting with aurora rim light, isolated on a plain flat medium gray (#808080) background.` ＋共通

20. `island-base-crescent`｜島の形・三日月
   `A small crescent-moon-shaped tropical island embracing a tiny lagoon, sandy shore, low grass, three-quarter elevated view, no buildings, night lighting with teal rim light, isolated on a plain flat medium gray (#808080) background.` ＋共通

21. `island-base-twin-hills`｜島の形・ふたこぶ
   `A small tropical island with two rounded grassy hills side by side, sandy shore, three-quarter elevated view, no buildings, night lighting with teal and pink rim light, isolated on a plain flat medium gray (#808080) background.` ＋共通

22. `island-beach-decals`｜浜の部品（白い砂・貝がら・黒い石・さんご の4つを1枚に）
   `Four separate small beach decoration clusters arranged in a 2x2 grid with space between them: white sand with tiny sparkles, scattered pastel seashells, smooth glossy black stones, pink and coral-red corals, each cluster seen from a slightly elevated view, isolated on a plain flat medium gray (#808080) background.` ＋共通

23. `island-lights-set`｜灯りの部品（灯台・ランタンの木・光る岩 の3つを1枚に）
   `Three separate island light objects in a row with space between them: a small white and red lighthouse with warm beam glow, a palm tree hung with round paper lanterns, a cluster of softly glowing teal crystal rocks, night lighting, isolated on a plain flat medium gray (#808080) background.` ＋共通

24. `island-soil-hatch`｜〔⛏ 土の中の曲〕の入口
   `A small wooden trapdoor set into beach sand, slightly ajar, warm golden light and tiny sparkles leaking from the gap, a little pickaxe leaning beside it, cute and inviting, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

25. `beach-record-stand`｜浜のレコード立て（ジャケットはコードではめる）
   `A small wooden easel stand on sand holding a glossy black vinyl record with a blank plain cream center label, a tiny rope and shell decoration on the stand, three-quarter view, isolated on a plain flat medium gray (#808080) background.` ＋共通

26. `pier-mooring-post`｜船が戻る桟橋の杭（空き）
   `A short wooden mooring post at the end of a pier with a coiled rope and a small hanging lantern, empty berth beside it, isolated on a plain flat medium gray (#808080) background.` ＋共通

### レコード・ごほうびの瞬間（1024×1024）

27. `vinyl-record-blank`｜できた曲のレコード
   `A single glossy black vinyl record seen straight from the front, fine concentric grooves catching a soft rainbow holographic sheen diagonally, a plain blank cream center label with no text, isolated on a plain flat medium gray (#808080) background.` ＋共通

28. `record-sleeve-blank`｜ジャケットの袋（絵はコードで貼る）
   `A square record sleeve seen straight from the front with a plain blank flat square front area for artwork, slightly worn cardboard edges with a thin gold foil border, a vinyl record peeking out from the top edge, isolated on a plain flat medium gray (#808080) background.` ＋共通

29. `record-press-light`｜作曲中のプレスの動きの元絵
   `A magical record press made of light: glowing golden musical notes and small paper charm cards spiraling into the center where a vinyl disc is forming, swirls of teal and pink light, centered composition, isolated on a plain flat black background for additive blending.` ＋共通

30. `buried-record-capsule`｜土の中で眠るレコード
   `A round amber glass capsule containing a small vinyl record, softly glowing from inside, tiny roots wrapping around its bottom, cozy treasure feeling, isolated on a plain flat medium gray (#808080) background.` ＋共通

31. `staff-ring-water`｜出航の五線の輪（加算）
   `A top-down perspective ellipse ring of five thin parallel golden lines like a musical staff, floating on water as glowing light, tiny note-shaped sparkles along the lines, isolated on a plain flat black background for additive blending.` ＋共通

32. `aurora-ribbon-overlay`｜オーロラの帯（加算で重ねる）
   `Several flowing ribbons of aurora light in teal and magenta, soft vertical rays, transparent-looking glow, horizontal composition across the frame, isolated on a plain flat black background for additive blending.` ＋共通

33. `note-sparkle-set`｜音符と光の粒（粒の元絵）
   `A sprite sheet of small glowing particles arranged in a 4x4 grid with space between them: golden musical notes, tiny stars, soft round bokeh dots, little sparkles, isolated on a plain flat black background.` ＋共通

34. `ship-horn-brass`｜〔🚢 出航〕ボタンの飾り（汽笛）
   `A shiny brass ship horn with a small pull cord and a tiny anchor charm, cute rounded proportions, three-quarter view, warm highlights, isolated on a plain flat medium gray (#808080) background.` ＋共通

35. `treasure-chest-star`｜★の宝箱（三周目）
   `A small round-topped wooden treasure chest with brass star-shaped clasp, slightly open with warm golden light and a few vinyl records visible inside, cute, isolated on a plain flat medium gray (#808080) background.` ＋共通

### アイコン（1024×1024・灰色背景）

36. `nav-icon-sea-chart`｜下のナビ・海図
   `A cute game icon of a rolled antique sea chart scroll tied with a red ribbon, a tiny compass on top, glossy painted style, centered, isolated on a plain flat medium gray (#808080) background.` ＋共通

37. `nav-icon-compose-shell`｜下のナビ・作曲
   `A cute game icon of a pearly pink seashell opening with a glowing golden musical note floating out, sparkles, glossy painted style, centered, isolated on a plain flat medium gray (#808080) background.` ＋共通

38. `nav-icon-island`｜下のナビ・myアイランド
   `A cute game icon of a tiny round tropical island with one palm tree and a small lantern, a little wooden pier, glossy painted style, centered, isolated on a plain flat medium gray (#808080) background.` ＋共通

### ジャケットの見本（試作用・1024×1024）

39. `jacket-sample-sky`｜試作のジャケット見本1
   `Square album cover illustration: a wide bright blue sky with fluffy clouds over a small town rooftop, a paper airplane flying, warm nostalgic afternoon light, full bleed square artwork.` ＋共通（夜の指定は無視して昼の空でよい）

40. `jacket-sample-ramen`｜試作のジャケット見本2
   `Square album cover illustration: a steaming bowl of ramen on a wooden counter at night with warm lantern light and gentle steam swirling into the shape of musical notes, cozy, full bleed square artwork.` ＋共通
