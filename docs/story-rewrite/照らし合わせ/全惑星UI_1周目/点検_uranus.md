# 天王星（わたしのアトリエ → my図書館）プレイ画面の点検と改善案

- 対象：`origin/claude/solar-system-home-planets-ew766y`（撮影 3a6ed26）の `/uranus`（`UranusView` → `Atelier`、`lib/atelier.ts`、`public/atelier/*.webp`）。同じブランチにある二周目の物語用の部品（`StoryDesk`・`PictureBook`・`LibraryBuild`・`MyLibrary`・`NeoOwl`・`drawer.ts`）も読んだ。
- 見たもの：`planet_shots/uranus/`（01〜08）、`画面設計/uranus.md`（第21稿）・`index.md` 2.1、`wip/decisions_round19.md` M-R154〜M-R158、`venus_handoff.md` §7。
- 報告済みなので**ここでは数えない**：飾る引き出しの中身が画面の外にある。

> **先に決めてほしいこと（いちばん大きな食い違い）**
> 依頼の前提は「わたしのアトリエ（作ったもので部屋を飾る）＋あとで OBOLO商店」です。ですが**第21稿の設計（uranus.md、M-R156・M-R158）では、天王星は「物語の星」**です（お話を書く→絵本にする→**my図書館**の本棚に並べる→{neo}の顔のフクロウがダチへ運ぶ）。そこには「グッズを作る機能はない」「obolo商店は火星（mars.md X-13）」「白いプラネットのアトリエは作らない」と書かれています。
> この文書のおすすめは、**飾る遊びを my図書館の中に移すこと**です。my図書館（U-4）の中を、作ったもので飾れる部屋にします（index 2.1「模様替え＝『◯◯を飾る』」に合わせて〔📚 図書館を飾る〕）。こうすると、設計（物語の星・my図書館）と、依頼（作ったもので部屋を飾る・集める楽しさ）の両方が立ちます。以下はこの前提で書きます。アトリエのままにする場合でも、2章の3〜16と試作はそのまま使えます。

---

## 1. 総評

- 今の `/uranus` は、第20稿の「アトリエ＋商店」の形のままです。画面の中身は「クリーム色の壁と木の床の、平らな長方形」が一つだけで、上には閉じた商店の札があります。**集める部屋のゲームに必要な、奥行き・置き場所の手ごたえ・置いた時の気持ちよさ・部屋の暮らしの動きがほとんどありません**。
- 飾る操作は、自由にドラッグして、記号のボタン（－＋↻⇋前へしまう）で直す形です。どこに置けば正解か分からず、置いても何も起きません。作ったもの（アート・曲・コロリン）は四角や紫の丸い文字で出るので、「自分の作品が部屋の宝物になった」と感じにくいです。
- 一方で、my図書館・絵本・フクロウの部品は同じブランチにすでにあります。`/uranus` の入口につながっていないだけです。
- 結論：天王星のトップは設計どおり U-1（雲の上の野原）にします。my図書館の中を**アイソメ（斜め上から見た2.5D）の部屋**にし、「作ったものがフィギュアや額縁や本になって並ぶ」「タップすると光る枠に吸いつく」「置くとぽんと弾んでキラッと光る」「{bati}が部屋の中を歩く」の四つをそろえます。これで、日本のスマホの部屋づくりゲームのような「集めて飾る」楽しさが出せます。

---

## 2. 改善点（効く順）

| # | 画面/場所 | 問題 | 改善案（具体） | 種類 |
|---|---|---|---|---|
| 1 | `/uranus` の中身 | 第20稿の「わたしのアトリエ＋OBOLO商店」のまま。第21稿の U-1〜U-6（野原・〔✒️ 書く〕・my図書館・フクロウ・本の空・机の引き出し）が入口にない。`StoryDesk`・`PictureBook`・`LibraryBuild`・`MyLibrary`・`NeoOwl` は物語（`lap2/L2Step.tsx`）でしか使われていない | `/uranus` を U-1 にする：雲の上の野原の一枚絵に、真ん中の本の台（〔✒️ 書く〕）、野原のはしの自分の my図書館、下の三つのボタン〔🦉 本の空〕〔✒️ 書く〕〔📚 my図書館〕。my図書館を押すと外観（`MyLibrary`）から中へ入り、〔📚 図書館を飾る〕で飾る（下の3〜16）。**飾る遊びを図書館の中に残すかは利用者に確認** | 機能/世界観 |
| 2 | 上の「OBOLO商店（シャッター・三周目の旅から）」の札 | 第21稿で obolo商店は火星へ移った。まだ使えない機能の予告にもなっている（金星の設計の「薄い色の予告は置かない」と同じ考え方） | 天王星から外す。三周目に自分の本の注文が開いた時だけ、my図書館のすみに札『実物の本にする（任意・火星のobolo商店）』（U-4どおり） | 世界観 |
| 3 | 見出しの説明「アトリエの星」 | 中身（物語の星）と合わない（金星と同じ種類のずれ。天王星は未報告） | 「物語の星」にそろえる（`packages/shared/src/planets.ts`・`lib/i18n/ja.ts`） | 分かりやすさ |
| 4 | 部屋の形 | 縦長の四角を壁70%・床30%に塗り分けただけ（01〜07）。奥行きがなく、置いたものが紙に貼ったように見える | **アイソメの部屋**にする（床6×6マス、左右二面の壁、2:1の斜め投影）。右の壁に大きな丸窓、窓の外は青緑の空と横倒しの輪、ページのようにめくれる雲。床の奥から手前へ、足もとの位置で並べかえて描く（奥行き順） | 見た目/15-20ウケ |
| 5 | 置き方 | 自由ドラッグで、正解の場所がない。指で隠れて見えない。index 2.1 の「指で引きずらない」とも合いにくい | **タップで選ぶ→置ける場所が光る→光った所をタップ**、を基本にする。置ける場所は三種類：壁の掛け場所（ポスター・時計・棚）、本棚の段（本・絵本・小さなフィギュア）、床のマス（家具・ぽんのクッション）。ドラッグもできるが、離すと必ず近くの光る枠へ吸いつく | 使いやすさ/分かりやすさ |
| 6 | 置いた時の手ごたえ | 何も起きない | 置いた瞬間に：上から少し落ちて着地（easeOutBack・0.32秒）→少しつぶれて戻る→床にほこりの小さな輪→キラ粒が6〜10個（1秒）→やわらかい「ぽこん」という音（曲より小さく）。本を棚に入れた時だけ、ページがぱらっとめくれる音 | 15-20ウケ |
| 7 | 選んでいる物の見え方 | 点線の枠だけ | 選んだ物は12px持ち上がり、影が小さくなる（宙に浮いた感じ）。置ける枠は呼吸する水色の光（1.6秒周期）、置けない所は光らない（エラーの言葉は出さない） | 分かりやすさ |
| 8 | 作ったものの見え方 | シール＝四角い絵、コロリン＝紫の丸に文字、曲＝レコードの丸、MV＝黒い枠 | **作品をその部屋の「物」にする**：お話＝背表紙の本（題の頭の字が背に）、絵本＝表紙を見せて立つ本、アート＝木の額縁ポスター（ガラスの映りこみ）、曲＝レコードスタンドにジャケット、MV＝小さな丸いテレビで流れる、コロリン＝棚の上のぷにぷにのフィギュア（タップで歌う）、{neo}の姿＝写真立て、{bati}＝クッションの上で眠る。これが「集める」楽しさの中心（くじやごほうびではなく、自分の作品が増えるほど部屋が埋まる） | 15-20ウケ/世界観 |
| 9 | 下の引き出し（トレイ）の作り | 白い大きなカードが部屋の下に積まれ、部屋と同時に見えない | 飾る時は部屋が上に縮み（高さ約440px）、下に**固定の棚トレイ**（高さ約220px）が出る。上にタブ〔作ったもの〕〔かざり〕〔へや〕、中は横に送るカード（1枚64×80px、物の絵が立体で出る）。どの機種でも部屋とトレイが同時に見える | 使いやすさ |
| 10 | 記号のボタン（－＋↻⇋前へしまう） | 意味が分かりにくい。アイソメでは「回す・左右反転」はいらない | 選んだ物の上に小さな吹き出しで三つだけ：〔向きを変える〕（家具は4方向）〔しまう〕〔大きさ〕（ポスターだけ大・中・小）。「前へ」はなくす（奥行きは位置で決まる） | 分かりやすさ |
| 11 | 空の部屋 | 「まだ何もない、ミナトのアトリエ。〔🎨 かざる〕で…」の白い札が真ん中に（01・07） | 最初から温かい部屋にしておく（本棚一つ・ランプ・丸窓・{bati}のクッション）。{bati}が光る枠を指さして、ぽんと跳ねる。言葉は一行だけ：「作ったものを、図書館に飾れます」 | 世界観/分かりやすさ |
| 12 | かべがみ・ゆか | CSS のグラデーション（クリーム・さくら・しばふ・くも…）で、部屋の質感がない | 絵のタイルにする（ページ柄の紙の壁・紺の星柄・ミントのしま・木の床・雲のじゅうたん・青緑のタイル）。アイソメの面に斜めに貼る。選ぶと、部屋の端からページがめくれるように張りかわる（0.6秒） | 見た目 |
| 13 | かざりの品ぞろえ | ソファ・ねこ・ロケット・うえき…の汎用の14点で、天王星らしさがない | 物語の星らしい品を中心に：羽ペンのランプ・本の塔・フクロウの止まり木・浮かぶページのモビール・インク瓶の植木・横倒しの輪の地球儀（天王星）・書き物机・木のはしご・紙の星の電飾・雲のソファ・天窓。いまの14点も残す | 世界観 |
| 14 | 「かざる」と「できた」 | モードの切りかえが二つのボタンで、今どちらか分かりにくい | ふだんは「見る」。右下に大きな〔🎨 図書館を飾る〕の丸いボタン。飾る間は床に方眼の光がうっすら出て、上の帯が「飾っています」に変わる。終わる時は〔できた〕（置くたびに自動で保存） | 分かりやすさ |
| 15 | 保存の知らせ | 文字のトースト「アトリエを保存しました」「保存できなかった…」 | 置くたびに右上の小さな✓がふわっと出るだけ。保存できなかった時だけ一行で知らせる | 使いやすさ |
| 16 | 置ける数の上限 | 上限に来ると「これ以上は置けない。どれかをしまってね」のトースト | 上限は見せない。光る枠が残っていない時は、トレイのカードが少し薄くなり、{bati}がしまう場所（棚の引き出し）を指す。数は出さない | 分かりやすさ |
| 17 | 見るモードの楽しさ | 曲をタップすると鳴る、それ以外は大きく出すだけ | タップで物ごとの反応：レコードが回って曲が流れる（音は0から上げる）、テレビがMVを流す、コロリンが歌う、本が開いて最初のページ、ランプを押すと部屋の灯りが暖かい色に変わる、{bati}をなでるとあくび | 15-20ウケ |
| 18 | 部屋の暮らし | 部屋は止まっている | {bati}が空いた床のマスを6〜10秒ごとにぴょこぴょこ歩き、クッションで眠る。窓の外の雲がページのようにゆっくりめくれる。ほこりの粒が光の中を漂う。夜（端末の時刻18時以降）は窓が星空に、ランプの光が強くなる | 15-20ウケ/世界観 |
| 19 | フクロウとのつながり | 図書館に本を置いても何も起きない | 本棚に本を入れると、丸窓の外を{neo}の顔のフクロウが一度横切る。本をタップ→〔🦉 届ける〕→行き先〔ダチへ〕→〔🦉 飛ばす〕で、天窓からフクロウが本を抱えて飛ぶ（U-5。今の `NeoOwl` を部屋の中の演出にする） | 世界観/機能 |
| 20 | 写真に残す | 部屋を残す方法がない | 〔📷 部屋を撮る〕：見出しとボタンを消したアイソメの部屋だけを画像にして、端末に保存する。どこにも送らない（送るのは〔🦉 届ける〕だけ） | 15-20ウケ |
| 21 | ダチの図書館 | 設計の問い2（入口はUIチームが決める）が未定 | 届いた本・名札の〔⋯〕から〔📚 この人の図書館へ〕。来られるのはダチだけ。中は見るだけ（触って反応はする・動かせない）。足あと・来た数は出さない | 機能 |
| 22 | 一つ戻す | 間違えて置いたり、しまったりすると戻せない | 飾る間だけ、左下に〔ひとつ戻す〕 | 使いやすさ |
| 23 | 住人の案内 | 天王星の住人（たこ焼きブラザー）が出てこない | 初めて飾る時だけ、バイカで部屋の前まで来て一言。「棚は、書いた分だけ、埋まるZE。」（台本 U-4 の台詞）。住人はふざけない | 世界観 |
| 24 | 15歳未満 | 飾る画面には特別な扱いはいらないが、ダチの図書館の訪問と写真の扱いは確認がいる | 15歳未満は、ダチの図書館へ行ける・自分の図書館はダチだけが見られる、を既定のままにする。〔📷 部屋を撮る〕は端末に保存するだけ | 安全 |
| 25 | 住人（エクリプス前）のロック画面 | 「🔒 天王星は、まだひらいていない」と二つのボタンだけ（08）。暗い背景に字だけ | ロック画面の背景に、霧の向こうにぼんやり見える天王星の野原と輪の絵（扉だけ見える星）。文とボタンはそのまま | 見た目 |
| 26 | 動きを減らす設定 | 対応がない | 着地の弾み・キラ粒・雲のめくれを止め、置いた位置の小さな光だけ残す | 安全 |

---

## 3. 試作プラン：「my図書館を飾る」（縦 390×844・1枚のHTML＋canvas）

### ねらい

「作ったものが、部屋の宝物になる」を30秒で感じさせる。タップ二回で置けて、置くたびに気持ちいい。数・ごほうび・くじは出さない。

### 画面の割り付け（上から）

| y | 部品 | 作り方 |
|---|---|---|
| 0–60 | 見出し：〔‹〕、小さな字 `URANUS LIBRARY`、大きな字「{neo}の図書館」、右に〔📷〕 | HTML |
| 60–520 | アイソメの部屋（床6×6マス・左右の壁・丸窓・天窓）。飾る時は 60–440 に縮む | canvas。部屋の殻は絵（`uranus-library-room-shell`）、物はスプライト（data-URI webp）を床のマスの (x+y) の順で描く |
| 520–620 | 見るモード：右下に〔🎨 図書館を飾る〕の大きな丸いボタン。左下に〔🦉 届ける〕の説明は出さない（本をタップした時だけ） | HTML |
| 440–844 | 飾るモード：棚トレイ（タブ〔作ったもの〕〔かざり〕〔へや〕、横に送るカード）、左下〔ひとつ戻す〕、右下〔できた〕 | HTML |

### 置き場所（スナップ枠）

- 床：6×6マス（家具は1×1か2×1、向き4方向）。
- 左の壁：掛け場所4つ（ポスター・時計・壁の棚・紙の星の電飾）。
- 右の壁：丸窓の左右に掛け場所2つ。
- 本棚（置くと増える）：一台に3段×4枠（本・絵本・コロリンのフィギュア・レコード）。

### 試作に入れる「作ったもの」（仮の作品）

お話2冊・絵本1冊・アート2枚（額縁ポスター）・曲1枚（レコードスタンド）・MV1本（丸いテレビ）・コロリン2体（フィギュア）・{neo}の写真立て・{bati}（試作ではぽん）。

### 操作と手ごたえ

1. カードをタップ→カードが少し浮いて、部屋の中の置ける枠が水色に呼吸する（置けない所は光らない）。
2. 枠をタップ→物が上から落ちて着地（easeOutBack 0.32秒・少しつぶれて戻る）→ほこりの輪→キラ粒→「ぽこん」。
3. 置いた物をタップ→吹き出し〔向きを変える〕〔しまう〕（ポスターは〔大きさ〕も）。長押しで持ち上げ→ほかの枠へ。
4. 見るモードでタップ：本は開く（3ページだけの見本）、レコードは回って短いメロディ、テレビは動く絵、コロリンは跳ねて「♪」、ランプは部屋の灯りを暖色に、ぽんはあくび。
5. 本を棚に入れると、丸窓の外をフクロウが一度横切る（2秒）。
6. 〔へや〕で壁紙・床を替えると、端からページがめくれるように張りかわる。
7. ぽんは空いたマスを歩き（経路は隣のマスへ一歩ずつ）、クッションがあれば眠る。

### 技術メモ

- アイソメの投影：`sx = ox + (gx - gy) * TW/2`、`sy = oy + (gx + gy) * TH/2`（TW=56, TH=28）。壁の掛け場所は壁の面の座標で持つ。
- 奥行き順：毎フレーム `gy + gx` と層（床→家具→壁掛け）で並べる（土星の試作の `items.sort` と同じ）。
- 保存：`localStorage`（試作だけ。try/catch で包む）。
- 夜：端末の時刻で窓とランプを切りかえる。`prefers-reduced-motion` で弾み・粒を止める。
- 音：WebAudio の短い合成音（ぽこん・ページ・メロディ）。どれも小さく、0から上げる。
- 絵は合わせて2MB以内、devicePixelRatio は2まで。

### 確かめたいこと

- 説明なしで、最初の一つを置くまでの時間（目標10秒以内）。
- 「自分の作品が部屋の物になった」と感じるか（額縁・フィギュアの見え方）。
- タップで置く形が、ドラッグに慣れた人にも物足りなくないか。

---

## 4. 絵の依頼リスト（Seedream）

共通の決まり：日本のアニメ寄りのセミリアルで、かわいく温かい。スプライトは**全部同じアイソメの角度**（30°見下ろし・右前45°）で、1024×1024、平らな背景に一つだけ。背景は縦 1152×2048。既存の `public/atelier/*.webp`（ソファなどのやわらかい水彩寄りの絵）より少しだけ立体感を足し、色は青緑・クリーム・木の茶色・金を基調にする。

共通の後ろにつける文：
`Japanese anime semi-realistic cute style, warm soft lighting, rich color, high detail, no text, no letters, no numbers, no logos, no watermark, no UI elements.`
スプライトにはさらに：`isometric 3/4 view from 30 degrees above, front-right 45 degrees, single object centered, isolated on a plain flat light gray background, soft contact shadow only.`

| # | ファイル名 | サイズ | 用途 | プロンプト（英語） |
|---|---|---|---|---|
| 1 | uranus-top-paper-field.jpg | 1152×2048 | U-1 天王星のトップ | Vertical view of a meadow above the clouds on planet Uranus, teal-green sky with a huge tilted ring arching like the spine of an open book, a white paper-like path winding through the grass, small storybook libraries of different shapes along the path, in the center a giant open book on a stand with a single quill standing in its pages, an empty plot with a small wooden sign post at the meadow edge, clouds peeling like pages, gentle daylight. |
| 2 | uranus-library-room-shell.jpg | 1152×2048 | 試作の部屋の殻（アイソメ・空っぽ） | Isometric cutaway of an empty cozy library room seen from 30 degrees above, two walls meeting at the back corner and a square wooden floor of 6 by 6 planks, the right wall has a large round window showing a teal sky with a tilted planetary ring and page-like clouds, a small skylight in the ceiling edge, cream paper-textured walls, warm afternoon light beams, the room floats in soft teal clouds, upper two thirds of the image, empty space below. |
| 3 | uranus-library-room-shell-night.jpg | 1152×2048 | 夜の部屋の殻 | Same isometric empty cozy library room as before at night, round window shows a deep navy starry sky with a glowing tilted ring, soft moonlight on the floor, walls in cool shadow, ready for warm lamp light, upper two thirds of the image. |
| 4 | uranus-library-exterior.jpg | 1152×2048 | my図書館の外観（入る前） | A small whimsical brick-and-paper library on a cloud meadow of Uranus, round skylight, tall narrow windows glowing warm, a wooden sign board above the door left blank, white paper path leading to the door, teal sky with tilted ring. |
| 5 | uranus-locked-mist.jpg | 1152×2048 | 住人のロック画面の背景 | Planet Uranus meadow and tilted ring barely visible through thick soft mist, a closed ornate door frame standing alone in the clouds, quiet teal and silver palette, mysterious and calm. |
| 6 | iso-bookcase-tall.png | 1024×1024 | 本棚（3段×4枠・空） | A tall wooden bookcase with three empty shelves and carved cloud motifs on top, warm honey wood. |
| 7 | iso-bookcase-low.png | 1024×1024 | 低い本棚 | A low wide wooden bookshelf with two empty shelves and small brass corner fittings. |
| 8 | iso-writing-desk.png | 1024×1024 | 書き物机 | An antique writing desk with an open blank notebook, an ink bottle and a quill, small drawer with brass handle. |
| 9 | iso-quill-lamp.png | 1024×1024 | 羽ペンのランプ | A standing floor lamp shaped like a giant white quill feather with a warm glowing bulb at the tip. |
| 10 | iso-book-tower.png | 1024×1024 | 本の塔 | A whimsical stack of colorful old books piled into a leaning tower, a tiny lantern on top. |
| 11 | iso-owl-perch.png | 1024×1024 | フクロウの止まり木 | A wooden owl perch stand with a little round platform and a hanging brass bell, empty perch. |
| 12 | iso-page-mobile.png | 1024×1024 | 浮かぶページのモビール | A hanging mobile of floating paper pages and tiny paper stars on thin threads, gently turning. |
| 13 | iso-ink-plant.png | 1024×1024 | インク瓶の植木 | A small leafy plant growing out of a large glass ink bottle with teal ink, cork lid beside it. |
| 14 | iso-uranus-globe.png | 1024×1024 | 天王星の地球儀 | A desk globe of a teal planet with a tilted golden ring on a brass stand, softly glowing. |
| 15 | iso-cloud-sofa.png | 1024×1024 | 雲のソファ | A plush sofa shaped like a puffy white cloud with two cushions shaped like small books. |
| 16 | iso-ladder.png | 1024×1024 | 本棚のはしご | A rolling wooden library ladder leaning slightly, brass wheels. |
| 17 | iso-round-rug.png | 1024×1024 | 丸いラグ（床に敷く） | A round woven rug with a pattern of an open book and stars, cream and teal, lying flat. |
| 18 | iso-bati-cushion.png | 1024×1024 | {bati}のクッション | A round fluffy pet cushion with a small crescent moon embroidered on it, pastel lavender. |
| 19 | iso-record-stand.png | 1024×1024 | 曲を飾るレコードスタンド | A small wooden record display stand holding an empty square album sleeve frame (blank) and a vinyl record peeking out. |
| 20 | iso-round-tv.png | 1024×1024 | MVを流す丸いテレビ | A retro round-screen television on short legs with a blank dark screen, pastel mint casing. |
| 21 | iso-poster-frame.png | 1024×1024 | アートの額縁（壁掛け・中は空） | A square wooden picture frame hanging on a wall, empty with a light cream backing, glass reflection highlight, seen from the isometric left-wall angle. |
| 22 | iso-photo-stand.png | 1024×1024 | {neo}の写真立て | A small standing photo frame with an empty cream center, gold edge, on a tiny easel back. |
| 23 | iso-kororin-pedestal.png | 1024×1024 | コロリンのフィギュアの台座 | A small round display pedestal with a glass dome lifted off beside it, empty, soft spotlight. |
| 24 | iso-wall-clock.png | 1024×1024 | 壁の時計 | A round wall clock shaped like an open book with no numbers on the face, hands only, seen from the isometric left-wall angle. |
| 25 | iso-paper-star-lights.png | 1024×1024 | 紙の星の電飾（壁掛け） | A string of warm fairy lights with folded paper stars draped in a gentle curve, seen from the isometric left-wall angle. |
| 26 | pon-walk.png | 1024×1024 | ぽん（歩く） | A small cream-colored fluffy bunny-like plush creature with long floppy ears, big amber eyes and a tiny silver crescent moon mark on the forehead, walking mid-step, isometric 3/4 view, full body. |
| 27 | pon-sleep.png | 1024×1024 | ぽん（眠る） | The same small cream-colored fluffy bunny-like creature curled up asleep, ears draped over its body, peaceful, isometric 3/4 view. |
| 28 | pon-point.png | 1024×1024 | ぽん（ここだよ） | The same small cream-colored fluffy bunny-like creature hopping and pointing one paw to the side with a happy face, isometric 3/4 view. |
| 29 | neo-owl-book-fly.png | 1024×1024 | 届ける時のフクロウ（仮の顔） | A small round fluffy owl with a cute chibi human-like face wearing round sunglasses on its forehead, flying with wings spread and hugging a small closed book with both feet, side view. |
| 30 | tile-wall-paper-pages.png | 1024×1024 | 壁紙：ページ柄 | Seamless tileable wallpaper texture of faint old book pages with soft cream tones and tiny pressed flowers, no letters, flat. |
| 31 | tile-wall-navy-stars.png | 1024×1024 | 壁紙：紺の星 | Seamless tileable wallpaper texture of deep navy with small gold stars and thin ring motifs, flat. |
| 32 | tile-wall-mint-stripe.png | 1024×1024 | 壁紙：ミント | Seamless tileable wallpaper texture of soft mint and white vertical stripes with a subtle paper grain, flat. |
| 33 | tile-floor-honey-wood.png | 1024×1024 | 床：木 | Seamless tileable texture of warm honey wood floor planks seen straight from above, flat. |
| 34 | tile-floor-cloud-carpet.png | 1024×1024 | 床：雲のじゅうたん | Seamless tileable texture of a soft white and pale blue cloud-pattern carpet seen straight from above, flat. |
| 35 | tile-floor-teal-tile.png | 1024×1024 | 床：青緑のタイル | Seamless tileable texture of glossy teal and cream checker tiles seen straight from above, flat. |

※ 6〜25 は同じ角度・同じ光の向き（左上から）でそろえる。21・24・25 は左の壁の面に合わせた角度、右の壁用は試作で左右反転して使う。26〜28 の「ぽん」は試作だけの{bati}で、本番はその人のバティの絵を使う。
