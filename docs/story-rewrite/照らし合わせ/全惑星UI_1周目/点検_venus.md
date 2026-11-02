# 金星（VENUS DJ）プレイ画面の点検と改善案

- 対象：`origin/claude/solar-system-home-planets-ew766y`（撮影 3a6ed26）の `/venus`（`VenusView` → `VenusDj` → `DjController` → `DjConsole`）と、7日目の物語の卓（`components/venus/VenusLesson.tsx`、`lib/dj/easy.ts`）。
- 見たもの：`planet_shots/venus/`（01〜27）、`_storysheet/st_venus.jpg`、`画面設計/venus.md`（第21稿）、`wip/venus_handoff.md`、`wip/P04/c01v.md`（D07V-S002）、試作 `二人のレコード.html`・`土星の広場のサイファー.html`。
- 報告済みなので**ここでは数えない**：見出しの文が旧マーケットのまま／縦にすると「横向きにしてね」だけ／見出しがデッキにかぶる。

---

## 1. 総評

- 横長の「三つの丸」の卓（`DjConsole`）は、金属とネオンの質感がよく、この星でいちばん完成度が高い部品です。ただ、**設計（venus.md V-2・§7 R5）では、物語でもふだんでも主役は「たて持ちの正方形のかんたんDJ」**で、横長の卓は星休め以降に自分で開ける〔くわしい卓〕です。今の `/venus` はそれが逆で、入口（V-1 野外ステージ）も、縦のかんたんDJも、ステージ・夜空のステージもありません。
- 縦のかんたんDJは7日目の物語（`VenusLesson`）の中にだけあります。ですが見た目は「白っぽいパネルに灰色の丸が二つと細いスライダー」で、黒い「STAGE」の箱が画面の真ん中に空いたまま残ります。15歳が30秒で「自分はDJだ」と感じるための**手ごたえ（拍がそろう感覚・つまみの重さ・星が回る山場）が絵にも音にも出ていません**。
- 〔くわしい卓〕には、規則に反する所が三つあります。**白い全画面の FLASH**、色が反転する INVERT、**いきなり大きく鳴るエアホーン（HORN）**です。英語の略語と29px前後の小さなボタンも多く、15〜20歳の初めての人には読めません。
- 結論：**縦持ちで片手で回せるかんたんDJを金星の顔にします**。土星・二人のレコードの試作と同じ作り方（生成したステージの絵＋コードで描く楕円のターンテーブル・拍の光・奥行き順に並べたスプライト）で作り直し、横長の卓は〔くわしい卓〕として残して磨く、の二本立てがいちばん効きます。

---

## 2. 改善点（効く順）

| # | 画面/場所 | 問題 | 改善案（具体） | 種類 |
|---|---|---|---|---|
| 1 | `/venus` の入口全体 | 〔はじめる〕から横長の卓に直行する。V-1（野外ステージの目次）、V-2（縦のかんたんDJ）、V-5（ステージ）、V-7（夜空のステージ）がない。設計 R5 の「縦の正方形のかんたんDJが本体、横長は物語の外の〔くわしい卓〕」と逆になっている | **縦を標準にする**。`/venus` は V-1 の一枚絵（回るレコードの星・針の腕の根もとの野外ステージ・ゴリラ三人）を出し、絵の中の三か所をタップできるようにする：〔🎧 ブース〕〔🎤 ステージ〕〔🌠 夜空のステージ〕（浮かぶ光の札）。ブースは縦のかんたんDJ。横長の卓はブースの〔⋯〕→〔くわしい卓〕から開く（星休め以降）。スマホを横にした時は「くわしい卓で回す？」の小さな札を出すだけにし、勝手に切りかえない | 機能/分かりやすさ |
| 2 | 縦のかんたんDJ（`VenusLesson` の卓） | 平らなパネル、灰色の丸二つ、`input type=range`。台が「機材」に見えない。ジャケットも中央に小さく出るだけ | 試作の方式で作り直す。**ブースの台の絵（生成）の上に、楕円に投影したターンテーブル二台をコードで描く**（傾き0.5前後）。ジャケットがレーベル面で回り、溝のハイライトが回転に合わせて流れる。外周に拍のLEDの点が32個、真鍮の針の腕がレコードに降りる。台の奥は**ステージの大画面を絵の一部にして**、MVや〔あかり〕をそこに描く | 見た目/15-20ウケ |
| 3 | 卓の真ん中の黒い「STAGE」の箱 | 曲をのせる前は真っ黒で字だけ（24〜27）。画面の約4分の1が死んでいる | 箱をなくし、ステージの大画面を背景の絵に組みこむ。のせる前は金星の夕景と照明の待機光をゆっくり映す。④でつないだ瞬間に自分のMVへ**0.8秒のワイプ**で切りかえる（明るさは上げない） | 見た目/世界観 |
| 4 | 〔SYNC〕 | 押すと黄色くなるだけ。「そろった」ことが分からない | 二つの台の外周を、拍の光の点がそれぞれ回る。ずれている時は点の位置がちがう。〔SYNC〕で右の点がすうっと追いつき、**二つの光の輪が一瞬重なって「ロック」**（輪が一本に溶ける＋小さな「カチッ」＋`navigator.vibrate(12)`）。そのあと二台が同じ呼吸で光る。数字は出さない（§5） | 15-20ウケ/分かりやすさ |
| 5 | 真ん中のつまみ（クロスフェーダー） | 細い range で、iOS ではつまみが小さく取りにくい。④で止まる人が出る（自動操作でもここで止まった：27） | 幅いっぱいの太いレール（高さ56px）と**大きな金属のつまみ（56×44px）**。左端・真ん中・右端で軽く吸いつく（小さなクリック）。動かしている間は、二台の光の強さと、上の画面のMVが一緒に入れかわる。④の案内中は、レールの上を半透明の指が左から右へゆっくりなぞる（2.4秒周期・ループ） | 使いやすさ |
| 6 | ④でつないだ瞬間（山場） | 画面が少し光るだけ（`shadow` 40px）。台本の「星ぜんたいが曲の速さで回る／{neo}の大きな姿／テロップ」が弱い | 山場を一つの演出にまとめる：(a) 背景のレコードの星の溝が曲の拍で回る（楕円投影の回転）(b) 照明のビームが拍に合わせて左右へゆっくり振れる（1往復＝2拍）(c) ゴリラ三人が拍でうなずき、ロングGの髪が低音でゆれる (d) {neo}の背景なしの大きな姿が卓の前にせり上がる（ヘッドホンを片耳）(e) テロップ「{neo}が、回している」。**点滅・急な明るさの変化・音量の上昇はしない** | 15-20ウケ/世界観 |
| 7 | 〔コロリン〕 | 平らなボタン。押しても上の画面に文字の帯が出るだけ（`🪐 …`） | ボタンを**自分のコロリンの顔のパッド**にする。つなぎ目では拍に合わせて弱く呼吸する光の輪。押すとパッドのコロリンのサングラスが「シャキーン」と目に落ち（M-R153）、ステージの上にコロリンが飛び出して本人の声のまま一節歌い、終わるとサングラスが額に戻る | 15-20ウケ/世界観 |
| 8 | 光の案内（次に押す所） | 黄色い枠が出るだけで、ほかのボタンとの差が小さい | 次に押す所だけ「呼吸する光の輪（1.6秒周期）＋小さな指のアイコン」。それ以外の部品は明るさを70%に落とす（押せなくはしない。触っても何も起きないだけ：設計どおり） | 分かりやすさ |
| 9 | 練習用のリズムのレコード | ジャケットが肌色の無地（25・27の左の台）。準備中に見える | 練習用のリズムに専用のレーベル絵を用意する（金星の紋章風・字なし・金と黒）。曲の名前は台の下に「練習用のリズム」とだけ出す | 見た目 |
| 10 | レコードを選ぶ（V-3）／〔くわしい卓〕の LOAD | 文字の一覧と「📁 端末の音声ファイル…」。設計 §5 では端末の音声ファイルは出さない（他人の曲の持ちこみになる） | ジャケットを8枚の格子で並べる（V-3どおり。〔新しい順〕〔ランダム〕〔つぎの8枚〕）。選んだジャケットが台まで飛んで、レコードになって落ちる（0.5秒）。**端末ファイルの読みこみは〔くわしい卓〕でも外す**（自分の曲と練習用のリズムだけ） | 機能/世界観 |
| 11 | 〔くわしい卓〕の VISUAL サンプラー | `visuals.ts` の `flash` は白い全画面フラッシュ、`invert` は全体の色反転。規則（急に光らせない）に反する | `flash` と `invert` は削除する。かわりに「あかりの色が0.6秒かけて満ちて、1.2秒で引く」（`wash`）と「星の粒がゆっくり上る」（`stars`）を既定にする。点滅は1秒に2回まで（設計の共通の決まり）を `visuals.ts` 全体の上限にする | 世界観/安全 |
| 12 | 〔くわしい卓〕の SOUND サンプラー（HORN） | 合成エアホーンが `gain 0.9` で鳴り始めから最大音量。急な音量の上昇にあたる | 既定のパッドを HORN から〔コロリン〕に替える。サンプラー全体の音量を −12dB にし、どの音も80msかけて鳴り始める。HORN は「やわらかい金管の一音」に作り直すか外す。RISER・IMPACT も最大音量を曲より下に抑える | 安全 |
| 13 | 〔くわしい卓〕の文字 | LOAD・CUE・SYNC・KEY・JUMP 4・LOOP 4・½・×2・FILTER がすべて英語の略語。15歳は意味が分からない | 英語は小さく残し、下に日本語の小さな字を添える（LOAD＝のせる／CUE＝印／LOOP＝くり返す／FILTER＝こもらせる）。長押しで一行の説明。KEY・JUMP は〔⋯〕の中へしまう | 分かりやすさ |
| 14 | 〔くわしい卓〕の押せる大きさ | ホットキュー1〜4・½・×2・JUMP は直径およそ29px（`b = 26 * k`）。指で押し分けにくい | 押せる範囲は見た目より広く（44px以上）取る。外周に並べる数を減らす（ホットキューは2つにし、3・4は〔⋯〕へ）。押した時は0.94倍に縮んで光の輪が広がる | 使いやすさ |
| 15 | 〔くわしい卓〕の曲がない時 | 波形の帯は「— --.- BPM」の空欄、台は黒い円。何をすればいいか分からない | 曲がない台には「のせる」が光り、波形の帯に「左右の台に、自分の曲をのせる」と一行出す。BPM・％の数字は、曲をのせるまで出さない | 分かりやすさ |
| 16 | 〔おまかせ〕 | 入口はすみの小さなボタン。押したあとは「卓が、棚の全部から、セットを組んでいます…」の点滅する字だけ | 二回目からはブースの右上に、金色の丸い〔おまかせ〕（ゴリラの手がレコードを持つ絵）を置く。押すと、旅で作ったもの（ジャケット・コロリン・MVの小さな札）が棚から台へ次々に飛んで、1.5秒でセットができる。そのあと〔つなぐ〕が大きく光る | 15-20ウケ/使いやすさ |
| 17 | 住人の台詞の出し方（物語の卓） | 白い吹き出しのカードが画面上部の空を隠す（24・st_venus）。夕景の絵が生きない | 台詞は卓のすぐ上の半透明の帯にし、話す住人の立ち絵が左から半身で入る（MONBANなどほかの星の物語と同じ考え方）。上の空とステージは隠さない | 見た目 |
| 18 | 〔🎤 見せる〕→行き先→〔🎤 届ける〕（V-5・V-6） | 白い `Panel`（土星・木星の昼の色）で、金星の夜の世界から浮いて見える。物語の卓の選択ボタンが〔ダチに見せる〕で、設計 V-5 の〔🎤 見せる〕〔見せない〕と文言がちがう | 夜のガラス調のパネルにし、〔🎤 届ける〕は金色の大きなマイク型のボタンにする。届けると、ステージの光が一本、夜空の星図をなぞって{inviter}とKIMORIN⭐︎の方角へのびる（2秒・明るさは一定）。ボタンの文言は設計に合わせる | 世界観/分かりやすさ |
| 19 | 音の入り方 | 左の台は、のせた瞬間に最大音量で鳴る。〔はじめる〕直後の音も同じ | 音はどれも0から1.2秒かけて上げる（`gain.linearRampToValueAtTime`）。入る時の「音が出ます」の一行は、ヘッドホンの絵のやさしいカードで出す | 安全/使いやすさ |
| 20 | V-7 夜空のステージ・V-5 ステージ・ステージの記録 | 画面がない（`/venus` は卓だけ） | V-7：夜空に光が一本ずつ降り、根もとに名札（8本まで・押した時だけ流れる・数は出さない）。V-5：夜の野外ステージの絵に小さめの卓。V-1 の一枚絵の中の場所として作る | 機能 |
| 21 | 卓の触り心地（全体） | 押しても見た目がほとんど変わらない | 共通の押した時の動き：0.94倍に縮む→光の輪が外へ広がる（0.35秒）→小さなクリック音（曲より−18dB）。つまみとジョグは指に吸いつき、離すと台がふわっと元の回転に戻る（ジョグ） | 15-20ウケ |
| 22 | 7日目の初めての卓 | 「のせる」の前の台は灰色の丸に小さく「レコードを選ぶ」。一歩目が分かりにくい | 空いた台の上に、ジャケットの形の点線の枠と、下向きの矢印がゆっくり上下する。左右とも光り、のせた台から順に消える | 分かりやすさ |
| 23 | 〔あかり〕 | 押すと上の画面に色が乗るだけ | 〔あかり〕を押すたびに、ステージのビームとブースの床の光の色が0.6秒かけて変わる（ピンク→シアン→金→紫→緑）。MVのない曲でも、ステージが「照らされている」と分かる | 見た目 |
| 24 | 確認用ページの `?world=venus` | 旧「VENUS MARKET」（★で買う・売上★0・自分の店）のまま（03・10〜12）。売上の数は「数で人をはからない」に反する | `?world=venus` を新しい V-1 に差しかえる。`VenusWorld.tsx`・`VenusTutorial.tsx`（旧マーケット）は入口から外す | 機能/世界観 |
| 25 | 横長の卓の外周 | 上の HOT CUE 4・LOAD・½ が画面の上の端で切れる高さに置かれている（05：円の上の部分がはみ出す）。見出しの問題を直しても、セーフエリアのある機種で切れる | 円の直径 `D` を `min(h*0.96, …)` から、`h - safe-area - 16px` で決める。外周の部品は角度30°〜150°の範囲に寄せる | 使いやすさ |
| 26 | 動きを減らす設定 | `prefers-reduced-motion` で止まる所がない | 星の回転・ビームの振れ・光の呼吸を止め、色の変化だけ残す（土星の試作と同じ） | 安全 |
| 27 | 曲が一つの人・二周目の奥のブース | 同じ一枚を両方の台にのせる時、見分けがつかない | 右の台のジャケットに小さな〔印〕の光の位置（出だし／サビの頭／静かな所）を三つの小さな札で出し、「別の顔でつながります」の一行。二周目の深い使い方（つまみの速さ）は、つまみの軌跡を光の尾で残して見せる | 分かりやすさ |

---

## 3. 試作プラン：「金星のブース ― 30秒で、自分の曲を回す」（**縦 390×844**）

**縦にする理由**：設計 R5（物語もふだんも縦の正方形のかんたんDJ）、片手（親指）で〔印〕〔SYNC〕〔つまみ〕〔コロリン〕が届くこと、7日目の物語とそのまま同じ画面にできること。横長は〔くわしい卓〕として今の `DjConsole` を磨く（2章の11〜15・25）。

### 画面の割り付け（390×844、上から）

| y | 部品 | 作り方 |
|---|---|---|
| 0–64 | ガラスの見出し：〔‹〕・小さな字 `VENUS BOOTH`・大きな字「金星のブース」・右に〔おまかせ〕の金色の丸 | HTML（土星の試作と同じ書体：Dela Gothic One／Zen Maru Gothic） |
| 0–360 | ステージ（背景の絵 `venus-booth-stage-dusk`）。奥の大画面にMV・あかり・待機の夕景を描く（画面の四隅の座標は絵に合わせて決める）。両わきにゴリラ三人、手前の床にぽん（{bati}） | canvas。人物は data-URI の webp を足もとの y で並べかえて描く（奥行き順） |
| 0–844 | 足もとのレコードの星の溝 | `venus-floor-grooves` を楕円に投影して、曲の拍で回す |
| 360–600 | ターンテーブル二台（左＝練習用のリズム、右＝自分の曲）。直径は約150px・傾き0.52の楕円。レーベル面にジャケット、外周にLEDの点32個、真鍮の針の腕、〔印〕の光の点 | canvas（`ctx.ellipse` と回転行列で投影。二人のレコードの試作の `spiralAt`・`rot` と同じ考え方） |
| 600–660 | 〔印〕〔SYNC〕：大きな丸角のボタン2つ（高さ52px） | HTML |
| 668–736 | 真ん中のつまみ：幅いっぱいの太いレールと金属のつまみ（左右と真ん中で吸いつく） | canvas＋pointer |
| 744–828 | 〔コロリン〕（顔のパッド・直径72px）を真ん中に、左右に小さめの〔あかり〕〔映像を選ぶ〕 | HTML |
| 上部の帯 | 住人の一言と画面の一行（帯）。話す住人の顔を左に | HTML |

### 流れ（台本 D07V-S002 の self どおり。光るのは次の一つだけ）

1. 入る：「音が出ます。音を出せる場所か、イヤホンで遊んでください。回すのに、マナは使いません」（ヘッドホンの絵のカード）→〔はじめる〕（iOS の音の許可）。
2. ①台にのせる：空いた台に点線のジャケットの枠と矢印。タップすると、ジャケットが棚から飛んで、レコードになって落ちる。左はすぐ鳴る（音は1.2秒かけて上がる）。
3. ②右の台のふちをタップ→光の点（〔印〕の位置）→〔印〕。右の台が印の所から無音で回りだす。
4. ③〔SYNC〕：二台の外周の拍の光が重なって「ロック」（光の輪が一本になる・カチッ・軽い振動）。
5. ④つまみ：指がなぞる案内。動かすと二台の音（等パワーで入れかえる）と光とMVが入れかわる。右端まで行くと山場（星の溝が回る・ビームが振れる・ゴリラがうなずく・{neo}の大きな姿・テロップ「{neo}が、回している」）。ここでは何も光らせず、4小節聴かせる。
6. ⑤〔コロリン〕が拍で呼吸する→押すとサングラスが落ちて一節歌い、ステージの上へ飛ぶ。
7. 終わり：〔🎤 見せる〕〔もう一曲〕〔おわる〕（試作では〔🎤 見せる〕→行き先〔ダチへ〕→〔🎤 届ける〕→夜空へ光が一本のびるまで）。
8. 〔おまかせ〕を押すと：棚から札が飛んで1.5秒でセットができ、左が鳴り、〔つなぐ〕が光る→押すとつまみが4小節かけて右へすべる→5へ合流。

### 音（ファイルなしで作る）

- 練習用のリズム：WebAudio で合成（キック・ハイハット・ベース、126BPM、`OfflineAudioContext` で8小節を作ってループ）。
- 「自分の曲」：試作用に、和音のパッドとメロディの短いループを 118BPM で合成（〔SYNC〕で `playbackRate` を 126/118 に寄せる。`easy.ts` と同じ考え方）。
- コロリン：試作では短いメロディの「♪」（`speechSynthesis` は使わない。本番は本人の声のコロリン）。
- 全体の音量は0から上げる。どの音も曲より大きくしない。クリック音は −18dB。

### 演出の決まり

- 光の周期は1秒に2回まで。全画面の白・色の反転・急な明るさの変化はなし。
- 拍に合わせて動くもの：LEDの点、ビームの振れ（2拍で1往復）、ゴリラのうなずき（8px）、ぽんの跳ね（6px）。
- 数字は出さない（BPM・％・点数・「うまい」の判定なし）。
- `prefers-reduced-motion`：回転と振れを止め、色の変化だけ。
- 描画：devicePixelRatio は2まで、60fps。絵は data-URI の webp（1枚200KB以下を目安）、全体で2MB以内。

### 確かめたいこと（試作で見る点）

- 初めて触る15〜18歳の人が、説明を読まずに④の山場まで何秒で着くか（目標30秒以内）。
- 〔SYNC〕の「ロック」が、音を消した状態でも分かるか。
- つまみを途中で止めた人が迷わないか（指の案内が戻ってくるまでの時間）。

---

## 4. 絵の依頼リスト（Seedream）

共通の決まり：日本のアニメ寄りのセミリアル、映画のような光、文字・ロゴ・UIなし。背景は縦 1152×2048。スプライトは 1024×1024 で、何もない平らな背景に一つだけ。既存の立ち絵（`onboarding/bossg.webp`・`hatg.webp`・`longg.webp`・`kimorin-sun.webp`）があるものは、それを参照画像として渡して姿をそろえる。

共通の後ろにつける文（各プロンプトの最後に入れる）：
`Japanese anime semi-realistic style, cinematic rich lighting, high detail, painterly depth, no text, no letters, no numbers, no logos, no watermark, no UI elements.`

| # | ファイル名 | サイズ | 用途 | プロンプト（英語） |
|---|---|---|---|---|
| 1 | venus-booth-stage-dusk.jpg | 1152×2048 | 試作の背景（ブース・夕方） | Vertical view of an open-air DJ stage built at the base of a giant brass tonearm on a planet that is a colossal spinning vinyl record, golden sunset sky with layered orange and violet clouds, a large blank dark LED screen at the back of the stage (empty, pure dark glass, clearly rectangular), warm spotlights on trusses, a wide polished black DJ table across the lower third seen from slightly above with an empty surface, record grooves shimmering gold to the horizon, atmospheric haze. |
| 2 | venus-booth-stage-night.jpg | 1152×2048 | 夜のブース・V-5 ステージ | Same open-air DJ stage at the base of a giant brass tonearm on a vinyl-record planet, now at night, deep navy sky full of stars, soft neon violet and amber rim lights on the trusses, a large blank dark LED screen at the back, empty black DJ table in the lower third seen from slightly above, gentle light beams resting upward, gold reflections in the record grooves. |
| 3 | venus-top-openair.jpg | 1152×2048 | V-1 金星のトップ（一枚の目次） | Vertical wide establishing shot of planet Venus as a giant vinyl record turning in space, a brass tonearm arching over it, at the base of the arm a small glowing open-air stage with a DJ booth, a column of soft starlight rising into the night sky to the right, warm sunset glow on the horizon, three distinct readable areas (booth, stage, sky) with empty space around each for floating labels. |
| 4 | venus-night-sky-stage.jpg | 1152×2048 | V-7 夜空のステージ | Vertical night sky over a vinyl-record planet seen from the stage floor, eight thin vertical pillars of soft colored light descending from the stars to the record surface at different distances, each pillar ending in a small glowing pool, dreamy violet and gold palette, calm and quiet, plenty of empty sky. |
| 5 | venus-floor-grooves.png | 1024×1024 | 足もとの星の溝（楕円投影で回す） | Seamless top-down texture of glossy black vinyl record grooves, fine concentric circles centered in the image, warm gold light sheen sweeping across one side, subtle dust sparkles, perfectly centered and circular, edge to edge. |
| 6 | turntable-platter-top.png | 1024×1024 | ターンテーブルの台（真上から） | Top-down view of a premium DJ turntable platter, brushed chrome outer ring with tiny strobe dots around the edge, black slip mat, an empty circular center area for a label, perfectly circular and centered, isolated on a plain flat light gray background. |
| 7 | turntable-tonearm.png | 1024×1024 | 針の腕 | A polished brass and black DJ turntable tonearm with counterweight and headshell, elegant S-shape, seen from above at a slight angle, isolated on a plain flat light gray background. |
| 8 | record-label-practice.png | 1024×1024 | 練習用のリズムのレーベル | Circular vinyl record center label design, matte black with an embossed gold abstract emblem of a planet with a tonearm forming a crescent, fine guilloche pattern ring, no letters, perfectly centered circle on a plain flat light gray background. |
| 9 | crossfader-knob.png | 1024×1024 | つまみ | A chunky metallic crossfader knob for a DJ mixer, brushed silver top with a thin glowing violet center line, rounded edges, seen from slightly above, isolated on a plain flat light gray background. |
| 10 | booth-front-panel.png | 1024×1024 | 卓の手前の板（台の下に敷く） | Front edge panel of a sleek black DJ table, horizontal, brushed dark metal with a thin neon edge glowing from blue on the left through violet to orange on the right, soft reflections, seen from slightly above, isolated on a plain flat light gray background. |
| 11 | bossg-booth.png | 1024×1024 | ボスG（ステージ右・腕組み） | Full body of a huge muscular black gorilla DJ master standing with arms crossed, round dark sunglasses, heavy gold chains with a round gold medallion (plain, no numbers), chrome cybernetic forearms with cyan glowing seams, black leather pants, calm serious expression, three-quarter view, isolated on a plain flat light gray background. |
| 12 | hatg-lightdesk.png | 1024×1024 | ハットG（照明卓で） | Full body of a plump black gorilla wearing a sparkly yellow sequin bucket hat and round yellow sunglasses, gold chain medallion (plain), standing behind a small lighting desk with glowing faders, one hand raised on a fader, dry serious face, three-quarter view, isolated on a plain flat light gray background. |
| 13 | longg-sound.png | 1024×1024 | ロングG（音響） | Full body of a tall lean black gorilla with very long flowing blond hair to the floor, round dark sunglasses, headphones around the neck, colorful psychedelic swirl robe over black trousers, holding a tall ornate staff, quiet calm pose, three-quarter view, isolated on a plain flat light gray background. |
| 14 | pon-dance.png | 1024×1024 | ぽん（床で拍にのる） | A small cream-colored fluffy bunny-like plush creature with long floppy ears, big shiny amber eyes and a tiny silver crescent moon mark on the forehead, happily swaying with both little paws up, holding a tiny glowing light stick, full body, isolated on a plain flat light gray background. |
| 15 | pon-sit.png | 1024×1024 | ぽん（待機） | The same small cream-colored fluffy bunny-like plush creature with long floppy ears, amber eyes and a silver crescent moon mark on the forehead, sitting calmly and looking up, full body, isolated on a plain flat light gray background. |
| 16 | kimorin-at-decks.png | 1024×1024 | KIMORIN のお手本 | A white fox-faced character with blue inner ears and blue face markings, round black sunglasses, a deep red hooded robe with silver trim, many white tails with red tips fanning behind, standing at a DJ turntable and proudly pushing a crossfader with one paw, solemn face, three-quarter view, isolated on a plain flat light gray background. |
| 17 | neo-dj-standee-placeholder.png | 1024×1024 | {neo}の大きな姿の仮（試作だけ） | Waist-up of a stylish young anime-style person in a dark bomber jacket holding one side of over-ear headphones to one ear, round sunglasses pushed up on the head, confident gentle smile, warm stage backlight rim, isolated on a plain flat light gray background. |
| 18 | mirror-ball.png | 1024×1024 | ステージ上のミラーボール | A vintage mirror ball with small square mirror tiles catching warm gold and violet light, gentle sparkles, hanging from a short chain, isolated on a plain flat light gray background. |
| 19 | stage-light-head.png | 1024×1024 | 照明の器具（ビームは コードで描く） | A modern moving-head stage light fixture, black body with a round glowing lens, mounted upside down, three-quarter view, isolated on a plain flat light gray background. |
| 20 | omakase-hand.png | 1024×1024 | 〔おまかせ〕のボタンの絵 | A large gorilla hand in a gold ring holding a shining vinyl record between two fingers, warm golden glow, centered, isolated on a plain flat light gray background. |
| 21 | show-mic-gold.png | 1024×1024 | 〔🎤 見せる〕〔🎤 届ける〕 | A vintage golden stage microphone on a short stand, soft warm glow and a few floating light particles, centered, isolated on a plain flat light gray background. |
| 22 | jacket-sample-1.jpg | 1024×1024 | 試作の「自分の曲」のジャケット | Square album art: a dreamy city skyline at dusk reflected in water, pastel pink and teal, soft grain, a lone figure on a rooftop, no text. |
| 23 | jacket-sample-2.jpg | 1024×1024 | 予備のジャケット | Square album art: a glowing jellyfish floating through a starry night, deep blue and violet, soft light rays, no text. |
| 24 | mv-still-1.jpg | 2048×1152 | 大画面のMVの仮（ゆっくり寄る） | Wide cinematic music-video still: a young silhouette walking along neon-lit night streets in the rain, bokeh lights in pink and cyan, reflective pavement, no readable signs. |
| 25 | mv-still-2.jpg | 2048×1152 | 大画面のMVの仮 | Wide cinematic music-video still: a field of tall grass under a giant violet moon, paper lanterns drifting upward, soft wind, dreamy. |
| 26 | venus-standby-screen.jpg | 2048×1152 | 曲をのせる前の大画面 | Wide calm abstract visual: slow golden concentric ripples on black, like sound waves on a record, faint violet glow at the edges, minimal and soothing. |
| 27 | light-gobo-soft.png | 1024×1024 | 〔あかり〕の床の光の模様 | A soft circular stage light gobo pattern on black, gentle star and petal shapes blurred, white light only (to be tinted in code), centered. |
| 28 | night-light-pillar.png | 1024×1024 | 届けた時の光の柱 | A single tall slender pillar of soft white-gold light rising from a small glowing pool, fine sparkles drifting upward, centered vertically, on a plain flat black background. |

※ 1・2 は奥の大画面の四隅の位置を、出来た絵で測って試作に書き込む（土星の `plaza-stage` と同じ）。11〜13 は既存の立ち絵を参照画像として渡す。
