# 木星（パタパタ／空・根っこ・アート・myアトリエ）プレイ画面 レビュー

- 見たもの：`planet_shots/jupiter/` の 01〜15 と `sheet.jpg`、`_storysheet/st_jupiter.jpg`・`s3_jupiter.jpg`、画面設計 `jupiter.md`・`index.md`、`decisions_round19.md`（M-R151・M-R154〜M-R157・M-R175）、台本 `wip/P03`（D05-S008「蝶が、パタパタ」）、アプリ `PatapataWorld.tsx`・`Butterfly.tsx`・`PostCircle.tsx`・`MyTree.tsx`（origin/claude/solar-system-home-planets-ew766y）、既存の絵（`public/art/jupiter-bg.jpg`・`apps/api/assets/butterfly-style.jpg`・`public/onboarding/s/jupiter-forest.jpg`・`jupiter-stone.jpg`・`jupiter-tree.webp`・参考 `jupiter_atelier_dome.webp`）。
- 書き方：〔 〕はボタンの文字、「 」は画面の一行。既報の不具合（下のナビが帯で切れる・フォローの空の時の文が読めない）は繰り返さず、必要な所で「既報」と書いて引くだけにする。

---

## 1. 総評

- **良い所**：紙細工の森（`jupiter-bg.jpg`）はやさしく品があり、住人の蝶の絵（動物が蝶の衣装を着たシール風）は「集めたい」と思える質。投稿→88時間飛ぶ→帰ってくる、という流れは、15〜20歳にとって数字のない、新しい気持ちよさになれる。
- **一番弱い所**：①空を埋めているのが**知らない住人の蝶＋「@名前 3h」**（一周目はダチだけ・15歳未満は知らない人なし・時間は出さない、に反する）②**核の報酬（自分のアートを蝶が抱えて飛ぶ）が一番しょぼい**：自分の蝶は絵文字の🦋に線の羽（08）、物語の「蝶が生まれる」場面は光る白い塊（`st_jupiter`）③作るものが**丸いシール**のまま（M-R151 は正方形のアート）、自分の場所が **myツリー**のまま（M-R156・M-R157 は六角形のドームの myアトリエ）④物語は暗い写真のような森、遊ぶ画面は明るい紙細工で、続けて見ると別のアプリに見える。
- **方針**：木星は「紙細工の森のジオラマ（奥行きのある何枚もの紙の層＋やわらかい光）」に絵をそろえ、蝶は「{neo}をデフォルメした蝶が、正方形のアートを両手で抱えて、羽ばたいて飛ぶ」をコードで本気で動かす。最優先は**自分のアートが飛び立って、ダチの空に加わり、88時間後に額に帰って葉が出る**までの試作（3.）。

---

## 2. 改善点（効果の大きい順）

> 種類の略：見＝見た目／分＝分かりやすさ／使＝使いやすさ／機＝機能／世＝世界観／ウ＝15-20ウケ

### 1. 最初の30秒：空が「知らない人の蝶＋時間」で埋まっている
- **画面**：`/jupiter` を開いた最初の画面（01）。
- **問題**：8匹の住人の蝶（@kitsune 3h・@kaba_boss 8h…）が並び、名前の札に時間（3h〜81h）。6時間以内の札はオレンジにして目立たせている（`PatapataWorld.tsx` 353行）。一周目の空はダチ（{inviter}・KIMORIN⭐︎）と自分だけ（設計 J-1・§8）、住人の作品は少なめで印つき・チュートリアル中は出さない、残り時間は出さない（§7）、のどれにも反する。15歳未満の人には知らない人の作品を出してはいけない。何を押せばいいか（蝶をタップ）も書かれていない。
- **改善案**：
  - 一周目の空は、KIMORIN⭐︎の蝶（丸いサングラス）が『プリプリ・ボカン』を抱えて飛び、{inviter}の蝶がいれば一緒に飛ぶ。自分のアートがあれば自分の蝶も。札は「ダチ　@名前」だけ（時間なし）。
  - はじめて開いた時だけ、KIMORIN⭐︎の蝶が画面のまん中まで下りてきて、ふわっと止まる。その上に指のマークと「蝶をタップすると、アートが見られます」（一度だけ）。
  - 住人の作品を出す時（二周目から）は、名札に小さな葉の印、数は少なめ。15歳未満には出さない。
- **種類**：分・世・機

### 2. 核の報酬：自分の蝶が「絵文字の🦋＋線の羽」で、飛び立つ瞬間もない
- **画面**：08（投稿したあとの空。左上の「@ミナト 0h」）。
- **問題**：住人の蝶は描きこんだ絵なのに、自分の蝶だけ絵文字に線の羽（`Butterfly.tsx` の絵がない時の形）。押したら空に増えるだけで、飛び立つ・ダチの空に加わる、の見せ場がない。一番うれしいはずの瞬間が、いちばん安い絵になっている。
- **改善案**（3. の試作の中心）：自分の蝶＝{neo}の姿をデフォルメした蝶（M-R155。{neo}の顔に光る羽）。〔🦋 飛ばす〕を押すと、蝶が上から舞い下りてアートを両手で受け取り（アートが手の中へ小さくなる）、羽ばたきながら紙の森の層を抜けて上がっていく（カメラが一緒に上がる。1.8秒）。空に出ると、ダチの蝶が近づいて輪を描き、一緒に飛びはじめる。一行「88時間、空を飛んで、あなたのアトリエに帰ります」。蝶の絵は月で作った{neo}の姿から作る（作れるまでは、ラベンダーの羽の「見習いの蝶」の絵を一つ用意し、絵文字は使わない）。
- **種類**：ウ・見・世

### 3. 丸いシール → 正方形のアート（作るもの自体が違う）
- **画面**：02・03（丸いシール帳）、07（丸く切った写真）、`PostCircle.tsx`（丸い投稿）。
- **問題**：設計は「アートはいつも1:1の正方形（丸いシールにはしない）」（M-R89・M-R151）。アートは水星で曲のジャケットになり、金星・火星・天王星でも使う。丸のままだと、ほかの星へ持っていけない。
- **改善案**：アートは角を 6px だけ丸めた正方形。紙のつやと、ときどき斜めに走る光の筋（2.5秒に一度、0.6秒で横切る）でレコードのジャケットのように見せる。シール帳は〔アート帳〕に（改善点12）。
- **種類**：世・機・見

### 4. 「ダチ」の空の時の文が、決まりと逆のことを言っている
- **画面**：上のタブ〔ダチ〕が空の時（`PatapataWorld.tsx` 360行）、人の木の〔フォロー〕（845行）。
- **問題**：「ダチは、おたがいにフォローしている人。木をのぞいてフォローしてみてね」。ダチは招待状でつながった、本当に知っている人だけ（M-R175）。知らない人にダチの申しこみはできず、知らない人には〔推す〕（三周目から）だけ。今の文は、知らない人とつながる道を教えてしまう。
- **改善案**：上は〔推し〕だけ（一周目の4日目から。三周目に〔みんな〕が増える。設計 §3）。〔推し〕にまだ何も飛んでいない時は「ダチのアートが、ここに飛んできます」と紙の空の絵（改善点21）。〔フォロー〕は〔推す〕にして、三周目から、ダチでない人のアート帳の〔⋯〕の中だけに置く。
- **種類**：機・世

### 5. 下のボタンが〔探す〕〔たまご〕〔myツリー〕で、名前で探せてしまう
- **画面**：下の帯（01・05・06〜09。既報のとおり帯で切れる）、05「サガス」。
- **問題**：〔探す〕は名前で人を探す画面（05）。名前で探す形は M-R175 でなくなった。15歳未満が知らない人を見つける入口にもなる。三つの星（木星・水星・火星）でボタンの位置もそろっていない。
- **改善案**：〔🦋 空〕〔🥚 たまご〕〔🎨 myアトリエ〕にする（設計 §3）。〔探す〕の画面はなくす。まん中の〔🥚 たまご〕は直径72pxの紙の卵（生成した `jupiter-nav-egg`）で、押すと殻が少しゆれて開く。左右は 64×56px 以上の紙のアイコン（`jupiter-nav-butterfly`・`jupiter-nav-atelier`）。
- **種類**：機・分・使・世

### 6. 物語の「蝶が生まれる」場面が、白い光の塊＋押しても進まない〔つぎへ〕
- **画面**：`st_jupiter.jpg` a050〜a260、`s3_jupiter.jpg` a050（D05-S008）。
- **問題**：{neo}の蝶が生まれる見せ場（台本「石が、ぼぉん、と鳴る。くぼみから、{neo}を小さくデフォルメした蝶が生まれる」）が、薄い黄色の花のような形＋ベージュの四角で描かれている。さらに、台詞の枠に〔つぎへ〕が出ているのに、押しても進まない（本当は飛んでいる蝶をタップする所。自動の操作は〔つぎへ〕を20回押して止まった）。
- **改善案**：
  - 蝶は3. と同じ絵（{neo}の蝶の体＋羽の部品）をコードで羽ばたかせる。生まれる時は、石のくぼみに光の輪→アートが立つ→紙の蝶がくぼみから折りたたまれた形で出て、羽をぱっと開く（0.4秒）→アートを抱えて石のまわりを回る。
  - 手を動かす場面では〔つぎへ〕を出さない。代わりに蝶に指のマークと光の輪、台詞の枠は少し暗くする。枠を押したら蝶を一度だけ小さく揺らす。
- **種類**：機・分・ウ

### 7. myツリー → myアトリエ（六角形のドーム）
- **画面**：09（木と枝・空の丸い枠・「0h」）、15（アトリエを作る画面の平らな絵）。
- **問題**：自分の場所が「木と枝（旅行・ごはん…）」のまま。空の丸い枠が10個並び、絵が読みこめていないように見える。設計は「六角形の木の板とガラスのドーム。壁の額に正方形のアート。窓の外に世界樹。アートが増えると部屋が増える」（M-R156・M-R157、J-6）。
- **改善案**：J-6 の画面を作る。外観（ドーム＋木のデッキ＋入口の看板＋地面の名札）を開くと、ガラスごしに中の額が見える。タップで中へ（カメラが扉へ寄って、中の絵に切り替わる）。中は、壁にアートの額が並び、窓の外に世界樹、{neo}の蝶が額のあいだを出入りする。飛んでいるアートの額は、空の額に小さな蝶の影（時間は出さない）。〔🎨 アトリエを飾る〕は右下に 44px 以上。
- **種類**：世・機・見

### 8. 88時間たって「帰ってきた」瞬間がない（葉が出る）
- **画面**：myツリー（09「88時間飛び終えた蝶が、葉っぱになってここに戻ってきます」の字だけ）。
- **問題**：設計では、帰ってきたアートは額のすみに葉が一枚出る（数なし）。ここは「続けて使いたくなる」大事なごほうびなのに、字の説明しかない。
- **改善案**：帰ったあとに初めて myアトリエを開いた時だけ：窓から{neo}の蝶が入ってきて、アートを額にそっとはめる（金のふちが一周光る）→額のすみから葉の芽が出て、0.8秒で一枚の葉に開く→花びらが3枚ふわっと落ちる。一行「アートが、帰ってきた」。音は小さな木琴を一つ。数・続けた日数・ごほうびの言葉は出さない。
- **種類**：ウ・世

### 9. 物語（暗い写真のような森）と遊ぶ画面（明るい紙細工）の落差／台詞の枠が星ごとに違う
- **画面**：12〜15（物語）と 01〜11（遊ぶ画面）。
- **問題**：物語は深い森と光の筋、遊ぶ画面は平らなパステルの紙細工。物語が終わって遊ぶ画面へ移ると、急に別の世界になる。台詞の枠も、木星は白いカードに紫の〔つぎへ〕（ウェブの入力フォームのよう）、土星は暗いガラスで、そろっていない。
- **改善案**：
  - 遊ぶ画面の紙細工を「何枚もの紙の層のジオラマ」にして、物語の森と同じ金色の光の筋を入れる（4. の背景の依頼）。夕方・夜の版も用意し、端末の時刻で変える（朝・昼＝明るい紙、夕方＝蜂蜜色、夜＝紺の紙に灯り）。
  - 物語から遊ぶ画面へは、物語の森の絵が紙の層に「折りたたまれる」ように切り替える（1秒）。
  - 台詞の枠は全部の星で一つの形にする（暗いガラス＋人物の丸い顔＋15px以上の字＋下の▼）。
- **種類**：世・見

### 10. 空の画面が読みにくい（見出し・タブ・札・🔔・マナ）
- **画面**：01・08・11。
- **問題**：「パ タ パ タ」の細い薄茶の字と、白い字のタブが、明るいベージュの背景に溶ける（タブの選ばれていない字はほぼ読めない）。名前の札が蝶に重なる（@samurai806 と @pen_lady）。🔔 は押しても「お知らせはまだありません」だけ（設計 §7 は置かない）。上の〔✦ 880 MANA〕はマナの残り（一周目は出さない）。
- **改善案**：見出しは紙を切り抜いた立体の字の絵にせず、コードの字（太い丸ゴシック、こげ茶 #5a3e2b、白いふち2px）。タブは〔推し〕一つなので、見出しの下に小さな札として置く。札は蝶の下に固定し、蝶同士は最小の間隔（中心どうし 96px）を守って飛ぶ。🔔 とマナの数はなくす。
- **種類**：見・分・世

### 11. 蝶が羽ばたかない（絵が上下にゆれるだけ）
- **画面**：01・08（`PatapataWorld.tsx` の `hover` のゆれ）。
- **問題**：住人の蝶は一枚の絵なので、羽が動かない。決まった8か所で上下にゆれるだけで、「パタパタ」の名前に合わない。
- **改善案**：蝶の絵を「体」と「羽（右の一枚）」に分けて生成し、羽を左右に鏡うつしにして、羽のつけ根を軸に横幅を cos でちぢめる（1秒に3〜4回）。飛ぶ道は、なめらかな曲線（いくつかの sin を足したもの）で空をめぐり、奥のものほど小さく・少しぼかして、奥から順に描く。タップすると、その蝶だけ画面の中へ寄ってくる。
- **種類**：見・ウ・世

### 12. シール帳 → アート帳（開き方・ボタン）
- **画面**：02・03。
- **問題**：紺のふちのリングノートが、森の色に合わない。右に紺の四角い出っぱり、左に金の輪。後ろは茶色くにごったぼかし。〔kitsune ›〕〔☆〕〔顔の重なり〕のチップは高さ28px。☆（いいね）は木星にない（「木星には、点も数もないダ」）。〔ページをめくる〕のオレンジの帯は、どの画面でも同じ色で、特別感がない。
- **改善案**：蝶が画面のまん中まで飛んできて、抱えていたアートを差し出す→アートが表へ返って（横幅を縮めて戻す、0.35秒）大きく開く→下に紙のアルバムの見開き（`jupiter-art-book-spread`）。左右の端を押すと、紙がめくれるように次のアート（同じ人の88時間以内）。下に「@名前」とひとこと、右上に〔×〕（44px）、〔⋯〕（〔推しから外す〕〔通報する〕〔ブロック〕）。☆・💬・顔の重なりはなくす。後ろは紙の森を少し暗くするだけ（茶色くにごらせない）。
- **種類**：見・世・使

### 13. 根っこ（たまご）が空っぽで暗く、土星の言葉が入っていない
- **画面**：06。
- **問題**：「まだ何も入っていません」の字だけ。説明の字（薄い茶色・13px）がベージュの背景に溶ける。設計では根っこには「土星でつぶやいた言葉（コロリンの字）」と「撮った写真」が日付つきで並ぶ。土星を遊んだ人にとっては、もう材料があるのに見えない。
- **改善案**：根っこを「木の根の中の、小さな物置」（`jupiter-root-chamber`）にする。土星の言葉は、小さなコロリンの札（コロリンの顔＋字）として根に引っかかって並び、写真はポラロイドのように根に挟まる。一つ押すと少し持ち上がって光り、下に〔アートをつくる〕が出る（押せるのは一つ選んだ時だけ）。〔📷 写真を撮る〕は下の左。本当に空の時は「土星でつぶやいた言葉や、撮った写真が、ここにしまわれます」と、芽の出た小さな鉢の絵（`jupiter-empty-root`）。
- **種類**：分・機・見

### 14. アートをつくる画面：見本の写真が壊れて見え、手順が一画面に詰まっている
- **画面**：07。
- **問題**：見本の写真（デモ）が、オレンジの輪と茶色の丸に見え、壊れた画像のよう。ひとこと・加工5つ・枝4つ・投稿が一画面に並ぶ。加工のボタンは字だけで、押すまで仕上がりが分からない。枝（旅行・ごはん…）は木の時代のもの。〔🦋 投稿する（88時間、空を飛ぶ）〕は長い。
- **改善案**：設計 J-3 のとおり、{bati}との会話で一画面に一つの手順（言葉→スペルの札→絵〔写真を添える〕〔{bati}に描いてもらう〕〔字だけ〕の同じ大きさの3つ→ひとこと→加工→できあがり）。加工は、そのアートの小さな見本5つ（64px の正方形）を横に並べ、押すと大きいアートがその色に0.3秒で変わる。枝はなくす。できあがりのボタンは〔🔒 根っこにしまう〕〔🦋 投稿する〕の二つを大きく、〔直す〕〔今はここで止める〕は小さく。デモの見本は、生成した本物のアート（`jupiter-sample-art-*`）にする。
- **種類**：分・使・見

### 15. 「字だけ」のアートが味気ない
- **画面**：14（ピンクのグラデーションに「きょうの空、ひろかった」）。
- **問題**：マナを使わない一番楽な道なのに、仕上がりが一番さびしい。15〜20歳は「映える」かどうかで続けるかを決める。
- **改善案**：字だけのアートは、生成した紙の地（和紙・リソグラフのにじみ・夜の金箔）（`jupiter-textart-paper-*`）の上に、コードで字を組む。字の組み方を3つ（縦書きの大きな一行／左寄せの小さな詩／まん中の手書き風）用意し、押すたびに切り替わる。字の色は地に合わせて自動で選ぶ。
- **種類**：ウ・見

### 16. 投稿の前の「届け先を確かめる」画面がない
- **画面**：07 → 08（押すとすぐ飛ぶ）。
- **問題**：設計 J-4 は〔🦋 投稿する〕→〔ダチへ〕が選ばれた確かめる画面→〔🦋 飛ばす〕。だれに届くのか（{inviter}・KIMORIN⭐︎）が見えないまま飛ぶ。
- **改善案**：下から紙のシートが上がる。アートの小さな見本、行き先〔ダチへ〕（選ばれた状態。ダチの蝶の顔を2つ並べる）、三周目から〔みんなへ〕、一行「88時間、空を飛んで、あなたのアトリエに帰ります」、大きな〔🦋 飛ばす〕（高さ56px）、すみに〔やめる〕。押すと3. の飛び立ちへ。
- **種類**：機・分

### 17. 〔🦋 蝶を描いてもらう〕（10）が設計と違い、画面も白い入力フォーム
- **画面**：09 の右上、10。
- **問題**：蝶の羽の絵を描いてもらう画面は、設計にない（{bati}が描くのはアートの絵。蝶は{neo}の姿から作る）。画面は紫の帯＋白い入力欄で、紙の森の世界から外れる。「画像をえらぶ」の参考の絵の欄もある。
- **改善案**：この画面はなくす。蝶は{neo}の姿から自動で作る（月で姿を変えると蝶も変わる）。{bati}に絵を描いてもらうのは、アートを作る手順の②だけ。
- **種類**：世・機

### 18. アトリエをつくる画面：平らな絵のドーム・字だけの札・切れた看板
- **画面**：15（物語の myアトリエづくり）。
- **問題**：ドームが平らなイラストで、ドームの上から木が生えている（世界樹はガラスの向こう）。部品の札が字だけ（〈六角形のドーム〉〈木の板〉…）。看板の欄に「入口の看板（8文」と、入れ方の説明が看板の字として切れて出る。マイクのボタンが暗い茶色で、押せるように見えにくい。{bati}の顔が紺の四角の中。
- **改善案**：上半分にドームの立体の見本（生成したドームの絵＋部品を重ねる）。札を変えると、その部分だけが組み替わる（板が一枚ずつ裏返る、灯りがつく）。札は小さな絵つき（`jupiter-atelier-part-tokens`）。看板は空のままなら木の看板だけ描き、説明は欄の外に小さく。〔このアトリエにする〕で、六角形の板が下から一枚ずつ組み上がる（1.2秒）→扉が開いて{neo}の蝶が入る。
- **種類**：見・ウ・分

### 19. 上の帯の下に、デモの帯の字が透けて見える
- **画面**：06〜09（上の帯の下に「保存されます」の字が薄く見える）。
- **問題**：下へ動かした画面の字が、上の帯の後ろに透けて重なり、汚れに見える。
- **改善案**：上の帯の背景を不透明にするか、帯の下の端をぼかしの面（下へ向けて透明になる帯の色）にして、後ろの字が見えないようにする。デモの帯は、上の帯の中の小さな札にまとめる。
- **種類**：見・機

### 20. デモの見本のアートが「絵文字＋グラデーション」
- **画面**：02・03（紅葉🍁・やきいも🍠の絵文字が丸の中に）。
- **問題**：作るとどんな仕上がりになるかを見せる大事な見本が、一番安い見た目。
- **改善案**：デモの見本は生成した正方形のアート（写真のような紅葉、水彩のやきいも、広い空、夜の街の灯り）にする（`jupiter-sample-art-01〜04`）。字はコードで重ねる。
- **種類**：見・ウ

### 21. 空の時の画面（推しの空・根っこ・アトリエの前）
- **画面**：04（フォローの空。既報の読めない文）、06、アトリエを作る前の右のボタン。
- **問題**：字だけ、または何もない。
- **改善案**：
  - 推しの空：紙の空に、枝で眠っている小さな紙の蝶が一匹（`jupiter-empty-sky`）。「ダチのアートが、ここに飛んできます」（字は 14px・こげ茶・白いふち）。
  - 根っこ：改善点13。
  - アトリエの前：森の切れ目の丘に、ならした土と名札『{neo}』だけ（設計 J-6）を紙のジオラマで（`jupiter-atelier-empty-lot`）。「空き地（二周目で作れます）」は出さない。
- **種類**：分・見・世

### 22. 押せる所の大きさ（44px 未満の所）
- **画面**：各所（アプリのコードで確認）。
- **問題**：アート帳のチップ 28px（`h-7`）、〔×〕約28px（`px-3 py-1`）、〔‹〕もどるは字だけで余白なし、枝の札の〔✎〕9px、根っこの〔消す〕24px（`h-6`）、タブ約32px、加工・枝のボタン約36px（07）、🔔 は字の大きさだけ。
- **改善案**：全部 44×44px 以上（見た目が小さくても押せる範囲を広げる）。飛んでいる蝶は、絵より一回り大きい範囲（最小 72px）で押せるようにし、重なる時は手前（後に描いたもの）を優先。
- **種類**：使

### 23. 音と手ごたえ
- **画面**：全体。
- **問題**：たまごが開く・アートができる・飛ぶ・帰る、のどれにも音がない。
- **改善案**：紙がこすれる「さらっ」（めくる）、羽音「ぱたた」（飛び立つ）、木琴の一音（帰ってきた）。どれも小さく（全体の上限0.6、0から0.15秒で上げる）、最初のタップまで鳴らさない。振動は対応端末だけ8msを一回（飛び立つ・帰る）。
- **種類**：ウ・使

### 24. 紙の森に奥行きと時間がない
- **画面**：01・04・06〜09 の背景。
- **問題**：背景が一枚の平らな絵で、どの画面も同じ。きれいだが、すぐ見慣れる。
- **改善案**：背景を4枚の層（遠くの空と丘・中くらいの木・手前の木・いちばん手前の草花）に分けて生成し、指で空をなでると層ごとに違う速さでずれる（最大 8px）。光の筋がゆっくり動き、紙の花びらがときどき1枚落ちる。朝・夕方・夜の3つの版（改善点9）。
- **種類**：見・ウ・世

### 25. 「0h」「88時間」の出し方
- **画面**：08・09（「@ミナト 0h」、myツリーの「0h」）、07 のボタン。
- **問題**：飛んでいる時間・残りが数字で出る（設計 §7 は出さない）。
- **改善案**：数字は出さない。88時間は飛ばす時の一行だけ。飛んでいる間は、アトリエの空の額に小さな蝶の影が出ていて、空では自分の蝶の羽が少し光っている、だけで伝える。
- **種類**：世

### 26. 子ども（15歳未満）の木星に、知らない人の入口を残さない
- **画面**：空・探す・人の木。
- **問題**：今は、知らない住人の蝶・〔探す〕・〔フォロー〕が、だれにでも出る。
- **改善案**：15歳未満の人の木星には、ダチと自分のアートだけを出す。〔推す〕・〔みんなへ〕・住人の作品は出さない（「出せません」の一行も出さず、初めからないものとして作る）。
- **種類**：機・世

### 27. 動きを減らす設定と、読み上げ
- **画面**：全体。
- **問題**：羽ばたき・飛び立ち・紙めくりに、動きを減らす設定の扱いがない。
- **改善案**：動きを減らす設定の人には、蝶は羽を開いた絵で止め、飛び立ちはふわっと消えて空に現れるだけ。蝶には「@名前の蝶：{ひとこと}」の読み上げの名前をつける。
- **種類**：使

---

## 3. 試作プラン：「蝶の空」— アートを抱えて、飛び立つ（そして帰ってくる）

**画面**：J-3 のできあがり → J-4 届け先 → 飛び立ち → J-1 空（ダチの蝶と飛ぶ）→ J-5 アート帳 → J-6 myアトリエ（帰ってきて葉が出る）。一つの HTML（canvas）、390×844。土星の試作と同じ作り（生成した舞台の絵＋コードで動く部品・奥から順に描く・絵はファイルに埋めこむ）。場面は四つで、上から順につながる。

### 3.1 画面の割りつけ（390×844、縦）

| 場所 | 中身 |
|---|---|
| 0〜56px | 紙の帯（クリーム色・下のふちがやぶいた紙の形）：左〔‹〕44px、まん中「JUPITER」（小さな金）／「パタパタ」、右は空ける |
| 56〜720px | 舞台（canvas）。背景の層4枚を重ねる（`jupiter-forest-layer-far`／`-mid`／`-near`／`-front`）。高さに合わせて表示（倍率 0.412） |
| 720〜844px | 下の帯（紙）：〔🦋 空〕〔🥚 たまご〕（直径72px、帯から20px上に出る紙の卵）〔🎨 myアトリエ〕 |

### 3.2 生成した絵／コードで動かすもの

| 生成した絵（4. の依頼） | コードで描く・動かす |
|---|---|
| 紙の森の層4枚（朝）＋夜の空の層 | 層ごとに違う速さのずれ、飛び立つ時のカメラの上昇（層を縦にずらす）、光の筋、落ちる花びら |
| {neo}の蝶の体・羽／KIMORIN⭐︎の蝶の体・羽／{inviter}の蝶の体・羽 | 羽ばたき（羽のつけ根を軸に横幅を cos でちぢめる。左右は鏡うつし）、体の上下、飛ぶ道（sin を足した曲線）、奥ほど小さく・ぼかす、奥から順に描く |
| 見本のアート4枚（正方形） | 蝶の手の中で小さく揺れる、光の筋が斜めに走る、表へ返る、大きく開く |
| できあがりの台（`jupiter-art-easel-desk`） | アートを台の上に表示、ボタン |
| アート帳の見開き | 紙がめくれる（ページの角が曲がる形を三角形で近似） |
| アトリエの中（壁と窓と世界樹）、空の額、葉 | アートを額にはめる、金のふちが一周光る、葉の芽が出て開く、花びら |
| 紙の卵・蝶・アトリエのアイコン | 押すと少し沈んでもどる（0.92→1.0） |

### 3.3 さわる所と流れ

1. **できあがり（場面A）**：紙の森の机の上に、自分のアート（試作は `jupiter-sample-art-01`）が大きく立っている。光の筋がアートを横切る。下に〔🔒 根っこにしまう〕〔🦋 投稿する〕（高さ56px）。
2. **〔🦋 投稿する〕**：下から紙のシート（J-4）。アートの小さな見本、行き先〔ダチへ〕（選ばれた状態、KIMORIN⭐︎と{inviter}の蝶の顔）、一行「88時間、空を飛んで、あなたのアトリエに帰ります」、大きな〔🦋 飛ばす〕、すみに〔やめる〕。
3. **〔🦋 飛ばす〕（場面B・飛び立ち）**：シートが下がる→画面の上から{neo}の蝶が舞い下りる（羽をゆっくり大きく）→アートを両手で受け取る（アートが0.4秒で手の中の大きさに）→羽ばたきが速くなり、上へ。カメラが一緒に上がり、手前の草花→手前の木→中の木の層が、違う速さで下へ流れる（1.8秒）。紙の花びらが舞い上がる。
4. **空（場面C・J-1）**：森の上の紙の空。KIMORIN⭐︎の蝶と{inviter}の蝶が近づいて、自分の蝶のまわりを一周し、三匹が別々の道で飛びはじめる。札は「ダチ　@名前」「{neo}」だけ。一行は3秒で消える。指で空をなでると層がずれる。
5. **蝶をタップ（J-5 アート帳）**：その蝶がまん中へ飛んできてアートを差し出す→表へ返って大きく開く→下にアルバムの見開き。左右の端を押すと紙がめくれる。〔×〕で蝶が空へ戻る。
6. **〔🎨 myアトリエ〕（場面D）**：ドームの中。壁に額が3つ。自分のアートの額は空で、小さな蝶の影だけ（時間なし）。右下に見本のための〔88時間後を見る（見本）〕。
7. **〔88時間後を見る（見本）〕**：窓から{neo}の蝶が入ってきて、アートを額にそっとはめる→金のふちが一周光る→額のすみから葉の芽→0.8秒で一枚の葉→花びら3枚。「アートが、帰ってきた」。

### 3.4 「わあ」となる瞬間

**〔🦋 飛ばす〕を押してからの2秒**：自分の姿の蝶が舞い下りてアートを抱え、羽ばたきながら紙の森の層を抜けて空へ上がる。空でダチの蝶が迎えに来て一周する。そして最後の、**帰ってきたアートが額にはまり、葉が開く**ところ。数字が一つも出ないのに「やった」と分かる。

### 3.5 作る時の決まり

- 急な点滅・急な音量の上昇はなし（光の変化は0.6秒以上、音は0から上げる）。最初のタップまで音を出さない。
- 「AI」「プロンプト」の言葉、数（時間・葉の数・アートの数・☆）を出さない。
- 試作の空に知らない人の蝶は出さない（ダチ二人と自分だけ）。
- 住人の台詞を入れるなら大根カイザー（語尾「ダ」、ふざけない）。例：「88時間、空をめぐって、帰ってくるダ。」
- 動きを減らす設定の時は、羽ばたき・カメラの上昇・紙めくりをやめ、ふわっと出て消えるだけ。

---

## 4. 絵の依頼リスト（Seedream）

**共通の書き方**：
- 背景：1152×2048（縦）。部品：1024×1024、透明にする前提で、無地の平らな背景（白・クリームのものは灰色 #808080、それ以外は白）に1つだけ描く。背景の層（手前の木・草花）は 1152×2048 で、絵のない所を無地の灰色にする。
- 木星の絵の調子（見た絵から）：紙細工の森（クリーム・あんず色・セージグリーン・くすんだばら色・蜂蜜色、紙のせんい、切ったふちのやわらかい影）。蝶は、動物やキャラが蝶の衣装を着た、手描きのシール風（ガッシュの塗り、やわらかい茶色の線、模様の入った羽、両手で何かを抱える）。
- 背景・小物のプロンプトの最後に次をつける（下では「＋紙の最後」と書く）：`Layered paper-cut diorama style (Japanese kirie shadow box): matte handmade paper with visible fibres, cleanly cut edges with soft drop shadows between layers, warm pastel palette of cream, apricot, sage green, dusty rose and honey gold, gentle volumetric light, cozy and luxurious, finest detail. No text, no letters, no numbers, no symbols that read as writing, no logos, no watermark, no signature, no UI.`
- 蝶のプロンプトの最後に次をつける（下では「＋蝶の最後」と書く）。参考に `butterfly-style.jpg` を添える：`Cute chibi character sticker art in exactly the style of the reference butterflies: hand-painted gouache texture, soft warm-brown outline, ornate patterned wings, gentle shading, big head small body. No text, no letters, no numbers, no symbols that read as writing, no logos, no watermark, no signature, no UI.`

### 背景・舞台

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 1 | `jupiter-forest-layer-far` | 1152×2048 | 空（J-1）のいちばん奥の層：空と遠くの丘 | The farthest layer of a paper forest diorama: a soft cream-to-apricot morning sky with a large pale paper sun near the top, layered paper clouds, rolling distant hills in sage and dusty rose paper at the bottom 25%, faint golden light rays. The upper 70% is open sky with plenty of empty space. No trees in the foreground, no characters, no butterflies. ＋紙の最後 |
| 2 | `jupiter-forest-layer-mid` | 1152×2048 | 中くらいの層：左右の木（まん中は空ける） | A middle layer of a paper forest diorama: tall stylised paper trees with round sage-green and apricot paper canopies standing along the left and right edges only, thin paper trunks, a few small paper butterflies resting on branches, the whole centre of the picture left completely empty. Everything outside the trees is plain flat mid-grey background (to be removed later). No characters. ＋紙の最後 |
| 3 | `jupiter-forest-layer-near` | 1152×2048 | 手前の層：大きな木の枝と葉（左右のふち） | A near layer of a paper forest diorama: large overlapping paper leaves and branches framing the left and right edges and the top corners, in sage green, honey gold and dusty rose with cut-paper veins, a soft shadow on their undersides, the central 70% of the picture left completely empty. Everything outside the leaves is plain flat mid-grey background (to be removed later). No characters. ＋紙の最後 |
| 4 | `jupiter-forest-layer-front` | 1152×2048 | いちばん手前の層：草花（下の25%） | The front layer of a paper forest diorama: a band of tall paper grass, apricot and white paper daisies, small mushrooms and curled ferns along the bottom 25% of the picture, slightly out of focus, warm light catching the paper edges. Everything above the grass is plain flat mid-grey background (to be removed later). No characters. ＋紙の最後 |
| 5 | `jupiter-forest-layer-far-night` | 1152×2048 | 夜の空の層（1 と同じ構図） | Edit the first picture: keep the composition, hills and clouds exactly the same; change it to night: a deep navy paper sky with tiny pierced-paper stars glowing warm, a pale gold paper moon instead of the sun, the clouds edged with soft moonlight, a few warm lanterns glowing on the distant hills. ＋紙の最後 |
| 6 | `jupiter-art-easel-desk` | 1152×2048 | できあがり（場面A）：アートを立てる机 | A cozy paper diorama scene in a forest clearing: a small round wooden work table made of layered paper, on it a simple wooden easel stand holding an empty square frame area (the square area left plain and flat cream, centred at about 42% from the top, about 60% of the picture width), paper brushes in a cup, a few pressed leaves, soft golden light falling from the canopy above, blurred paper trees behind. No characters, no butterflies, nothing drawn inside the square area. ＋紙の最後 |
| 7 | `jupiter-atelier-dome-exterior` | 1152×2048 | myアトリエの外観（J-6） | A paper diorama of a small round geodesic dome atelier in a forest clearing: the dome built from hexagonal panels, some warm honey wood and some clear glass, a hexagonal glass door at the front, a wooden deck in front with two small paper lanterns, a small blank wooden signboard on a post by the deck, through the glass a glimpse of a huge ancient world tree glowing softly behind the dome, paper trees around, warm late-afternoon light. Seen from the front, slightly above, the dome centred at about 50% from the top. No people, no characters, no writing on the signboard. ＋紙の最後 |
| 8 | `jupiter-atelier-dome-interior` | 1152×2048 | myアトリエの中（場面D）：額が並ぶ壁 | Inside a small round geodesic dome atelier made of hexagonal honey-wood and glass panels, paper diorama style: a curved wooden wall with three empty square picture frames hung in a gentle row at eye level (frames empty, their insides plain flat cream), a large hexagonal window on the right showing a huge glowing world tree outside, a little wooden workbench below, hanging warm lamps, soft dust in the light. No people, no characters, nothing inside the frames. ＋紙の最後 |
| 9 | `jupiter-root-chamber` | 1152×2048 | 根っこ（J-2）：自分だけの物置 | A cozy secret chamber inside the roots of a great tree, paper diorama style: curving paper roots form little shelves and hooks along the walls, a round wooden door, a warm glowing paper lantern hanging from a root, soft earthy browns with honey gold and sage, tiny glowing seeds floating. The central area of the walls is clear for small cards and photos to be hung later. No characters, no pictures, no writing. ＋紙の最後 |
| 10 | `jupiter-art-book-spread` | 1152×2048 | アート帳（J-5）の見開き（上から見た開いたアルバム） | A large open handmade photo album seen from directly above, filling the frame: thick cream pages with deckled edges, a soft fabric spine in sage green, small paper photo corners in honey gold at the corners of one large empty square area on the right page, a pressed leaf and a tiny paper butterfly tucked on the left page, warm soft light. The square area is empty plain cream. No writing. ＋紙の最後 |
| 11 | `jupiter-atelier-empty-lot` | 1152×2048 | アトリエを作る前（空き地） | A gap in a paper forest on a small hill: a neat circle of smoothed paper soil, a small blank wooden name stake standing at its edge, tiny sprouts around it, the huge world tree glowing softly in the far background, warm morning light, hopeful and calm. No buildings, no characters, no writing. ＋紙の最後 |

### 蝶（体と羽を分ける）

> 体の絵は羽なし。羽は「右の羽一枚（上と下の羽がつながったもの）」を、つけ根が左のふちのまん中に来るように描く。コードで左右に鏡うつしにして羽ばたかせる。

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 12 | `neo-butterfly-body` | 1024×1024 | 自分（{neo}）の蝶の体（試作の見本の姿） | A tiny chibi version of a cheerful Japanese anime-style teenager with a short ash-brown bob haircut and an oversized cream hoodie, two small curled antennae on the head, NO wings, both small hands held out in front at chest height as if holding a square card (hands empty), floating pose, front view, centred, full body. Plain flat white background, no shadow. ＋蝶の最後 |
| 13 | `neo-butterfly-wing` | 1024×1024 | 自分の蝶の羽（右の一枚） | One single right butterfly wing (upper and lower wing joined as one piece) seen flat from the front, the wing root at the middle of the left edge of the picture, extending to the right: translucent glowing lavender and soft gold with delicate light patterns like stained glass, a soft inner glow, ornate edge pattern. Nothing else. Plain flat mid-grey background. ＋蝶の最後 |
| 14 | `kimorin-butterfly-body` | 1024×1024 | KIMORIN⭐︎の蝶の体 | A tiny chibi KIMORIN: a white round fox-like face with three small blue leaf marks on the forehead, blue spiral cheeks and a small ω mouth, white fox ears with blue insides, a deep red-brown hood with a small patterned cloak, round gold-rimmed sunglasses worn over the eyes, two small curled antennae, NO wings, both small hands held out in front as if holding a square card (hands empty), floating pose, front view, centred, full body. Plain flat white background, no shadow. ＋蝶の最後 |
| 15 | `kimorin-butterfly-wing` | 1024×1024 | KIMORIN⭐︎の蝶の羽（右の一枚） | One single right butterfly wing (upper and lower joined) seen flat from the front, wing root at the middle of the left edge: deep red-brown and cream with ornate white and blue patterns echoing a fox and leaves, small blue eye-spots, a thin gold edge. Nothing else. Plain flat white background. ＋蝶の最後 |
| 16 | `inviter-butterfly-body` | 1024×1024 | {inviter}の蝶の体（試作の見本の姿） | A tiny chibi version of a friendly Japanese anime-style teenager with long dark hair in a low ponytail and a navy cardigan over a white shirt, two small curled antennae, NO wings, both small hands held out in front as if holding a square card (hands empty), floating pose, front view, centred, full body. Plain flat white background, no shadow. ＋蝶の最後 |
| 17 | `inviter-butterfly-wing` | 1024×1024 | {inviter}の蝶の羽（右の一枚） | One single right butterfly wing (upper and lower joined) seen flat from the front, wing root at the middle of the left edge: soft sky blue and cream with delicate navy floral patterns and tiny gold dots, a thin gold edge. Nothing else. Plain flat white background. ＋蝶の最後 |
| 18 | `apprentice-butterfly-body` | 1024×1024 | {neo}の姿がまだない時の「見習いの蝶」（絵文字の代わり） | A tiny chibi round little paper spirit with a soft cream face, simple dot eyes and rosy cheeks, a small lavender hood, two curled antennae, NO wings, both small hands held out in front as if holding a square card (hands empty), floating pose, front view, centred, full body. Plain flat white background, no shadow. ＋蝶の最後 |

### アート・額・葉

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 19 | `jupiter-sample-art-01` | 1024×1024 | 見本のアート（紅葉）。デモの絵文字の置きかえ | A square artwork: a close-up of bright red and orange Japanese maple leaves against a softly blurred golden forest, morning light shining through the leaves, shallow depth of field, dreamy film-photo look with gentle grain, rich warm colours. Square composition, edge to edge. No text, no letters, no numbers, no logos, no watermark, no signature, no frame, no UI. |
| 20 | `jupiter-sample-art-02` | 1024×1024 | 見本のアート（やきいも） | A square artwork in loose watercolour: a split roasted sweet potato with steam curling up, golden flesh and purple skin, on crumpled paper, soft autumn colours, playful brush strokes and paper texture. Square composition, edge to edge. No text, no letters, no numbers, no logos, no watermark, no signature, no frame, no UI. |
| 21 | `jupiter-sample-art-03` | 1024×1024 | 見本のアート（広い空） | A square artwork: a wide clear blue sky over a quiet riverbank at golden hour, a single long contrail, tiny silhouettes of grass at the bottom, calm and open, soft pastel film tones. Square composition, edge to edge. No people, no text, no letters, no numbers, no logos, no watermark, no signature, no frame, no UI. |
| 22 | `jupiter-sample-art-04` | 1024×1024 | 見本のアート（夜の街の灯り） | A square artwork in a dreamy illustrated style: a quiet Japanese street at night after rain, warm glowing windows and vending-machine light reflecting on wet asphalt, purple and amber bokeh, cozy and cinematic. Square composition, edge to edge. No people, no readable signs, no text, no letters, no numbers, no logos, no watermark, no signature, no frame, no UI. |
| 23 | `jupiter-frame-walnut` | 1024×1024 | 額（アトリエの壁）木 | One empty square picture frame seen straight from the front: warm walnut wood with soft rounded edges and a thin inner gold line, the inside of the frame a perfectly empty area painted plain flat white, filling 90% of the picture. Plain flat mid-grey background outside the frame. ＋紙の最後 |
| 24 | `jupiter-frame-gold` | 1024×1024 | 額（アトリエの壁）金 | One empty square picture frame seen straight from the front: ornate soft honey-gold frame with small carved leaves and a tiny butterfly at the top centre, the inside a perfectly empty area painted plain flat white, filling 90% of the picture. Plain flat mid-grey background outside the frame. ＋紙の最後 |
| 25 | `jupiter-leaf-green` | 1024×1024 | 帰ってきたアートの額に出る葉（春・夏） | One single fresh paper leaf with a short curled stem, soft spring green with cut-paper veins and a faint golden glow along its edge, slightly curved like it just unfurled, front view, centred, filling 70% of the frame. Plain flat white background, no shadow. ＋紙の最後 |
| 26 | `jupiter-leaf-maple` | 1024×1024 | 同上（秋の版） | One single paper maple leaf with a short stem, warm red and apricot gradient with cut-paper veins and a faint golden glow along its edge, slightly curved, front view, centred, filling 70% of the frame. Plain flat white background, no shadow. ＋紙の最後 |
| 27 | `jupiter-textart-paper-washi` | 1024×1024 | 字だけのアートの地（和紙） | A square sheet of handmade Japanese washi paper filling the whole frame edge to edge: warm ivory with long visible fibres, faint pressed flower petals in dusty rose and tiny gold leaf flakes, soft even light, calm and empty in the centre for words to be added later. No text, no letters, no numbers, no logos, no watermark, no UI. |
| 28 | `jupiter-textart-paper-riso` | 1024×1024 | 字だけのアートの地（リソグラフのにじみ） | A square risograph-print style background filling the whole frame edge to edge: overlapping soft gradient blobs of fluorescent pink, sky blue and sunny yellow with grainy print texture and slight misregistration, playful and trendy, plenty of calm space in the centre for words to be added later. No text, no letters, no numbers, no logos, no watermark, no UI. |
| 29 | `jupiter-textart-paper-night-foil` | 1024×1024 | 字だけのアートの地（夜の金箔） | A square sheet of deep navy paper filling the whole frame edge to edge, with scattered tiny gold foil stars and a thin gold foil crescent moon in one corner, subtle paper texture and a soft sheen, elegant and calm, open space in the centre for words to be added later. No text, no letters, no numbers, no logos, no watermark, no UI. |

### 空の時・アイコン・部品の札

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 30 | `jupiter-empty-sky` | 1024×1024 | 推しの空にまだ何もない時 | A small paper branch with two sage-green paper leaves, and a tiny paper butterfly sleeping on it with its wings folded, a few soft paper clouds and one pierced-paper star behind, calm and gentle, centred. Plain flat white background, no shadow. ＋紙の最後 |
| 31 | `jupiter-empty-root` | 1024×1024 | 根っこが本当に空の時 | A small terracotta-coloured paper flower pot with a single tiny green sprout and two little leaves, a curl of paper root peeking from the pot's drainage hole, a few glowing seeds floating, centred, warm and hopeful. Plain flat white background, no shadow. ＋紙の最後 |
| 32 | `jupiter-nav-egg` | 1024×1024 | 下のまん中〔🥚 たまご〕のアイコン | A tiny icon of a smooth paper egg in warm apricot with soft cream speckles, a thin hairline crack near the top with a faint golden glow leaking out, layered paper look with a soft shadow, simple silhouette readable at small size, centred, filling 80% of the frame. Plain flat white background. ＋紙の最後 |
| 33 | `jupiter-nav-butterfly` | 1024×1024 | 下の左〔🦋 空〕のアイコン | A tiny icon of a paper butterfly in apricot and sage holding a tiny square card, with one small paper cloud behind it, layered paper look, simple silhouette readable at small size, centred, filling 80% of the frame. Plain flat white background. ＋紙の最後 |
| 34 | `jupiter-nav-atelier` | 1024×1024 | 下の右〔🎨 myアトリエ〕のアイコン | A tiny icon of a small round dome made of hexagonal honey-wood and glass panels with a warm light inside and a little wooden deck, layered paper look, simple silhouette readable at small size, centred, filling 80% of the frame. Plain flat white background. ＋紙の最後 |
| 35 | `jupiter-atelier-part-tokens` | 1024×1024 | アトリエを作る時の部品の札の小さな絵（3×3に切る） | Nine small separate paper-craft tokens arranged in a neat 3 by 3 grid with generous empty space between them, each the same size: a hexagonal dome, a stack of honey wood boards, a hexagonal glass window, a small wooden deck, a warm hanging lamp, a skylight with sun rays, a tiny world tree, a round paper lantern, a potted fern. Layered paper look, soft shadows, nothing overlapping. Plain flat white background. ＋紙の最後 |
| 36 | `jupiter-paper-petals` | 1024×1024 | 舞う花びら・紙吹雪（切り出して使う） | A loose scatter of fourteen separate small paper pieces, not touching each other, evenly spread: apricot and dusty rose paper petals, tiny sage-green paper leaves, and a few small honey-gold paper flakes, each piece clearly isolated with empty space around it, crisp cut edges. Plain flat mid-grey background, no shadows. ＋紙の最後 |

**メモ**：
- 試作に必要なのは 1〜4・6・8・10・12〜17・19・23・25・32〜34・36。5・7・9・11・18・20〜22・24・26〜31・35 はアプリへ入れる時に使う。
- 蝶の体と羽は、羽のつけ根の位置をそろえるため、体の絵の肩の高さを測ってコードで合わせる（羽の絵は左のふちのまん中がつけ根）。
- {neo}の蝶は、本番では利用者の姿から作る（12・13 は試作の見本）。作り方の参照には、月で作った{neo}の姿の絵を2枚目に添え、「Turn the person in the SECOND picture into …」と書きかえる。
- 背景の層（2〜4）は灰色の所を切り抜いて透明にする。切り抜きのふちに灰色が残らないよう、紙のふちの影は内側だけにする。
