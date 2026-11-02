# 地球（本部・宇宙の地図）UI 点検 ― アートディレクターの見立て

対象：`origin/claude/solar-system-home-planets-ew766y`（3a6ed26）の `/`（入口・宇宙の地図）、`/earth`（本部）、1日目の物語（E-0〜D01）。
見たもの：`planet_shots/earth/*`・`sun/01`（住人の地図）・`_storysheet/st_earth.jpg`、`画面設計/earth.md`・`index.md`、`SolarSystem.tsx`・`PlanetSphere.tsx`・`OshiShelf.tsx`・`EarthView.tsx`・`InviteCard.tsx`・`Comms.tsx`・`ManaChip.tsx`・`HomeGate.tsx`・`TomorrowScreen.tsx`・`lib/i18n/ja.ts`、既存の絵（`earth-bg.jpg`・`bati-stand-*.webp`・`d1-seal.webp`・`bluena.jpg` ほか）、土星の試作2本。
すでに報告ずみ（ここでは挙げない）：地図のロックの札が切れる／招待メールが切れる。

---

## 1. 総評

- 宇宙の地図は毎日みんなが通る「ロビー」なのに、今は**CSSの丸（地球は青い丸に緑の水玉3つ）が静かに浮くだけ**の図。止まっていて、今日どこへ行けばいいか、ダチから何が届いたかが何も分からない。ここを「生きている太陽系」にするのが、アプリ全体でいちばん効く改善。
- 本部（`/earth`）は**Webの設定ページのカード並び**（プロフィール→ウォレット→招待2つ→メール/電話→ボイス→ログアウト）。設計書の「本部の広間（一枚の絵が目次）」「連絡室＝交換台」「招待状の机に封筒2通」と大きくずれていて、世界観も触る楽しさもない。
- 「数を出さない」決まりに反する所が多い：**`✦ 880 MANA` がすべての画面の右上に出ている**（二周目からマナの数は出さない・「MANA」でなく「マナ」）。〔お財布〕が `🏦 アース・バンク`（「銀行」系の言葉は使わない）。
- 15〜20歳に効くのは「自分の会員証を集めて育てる」手ざわり。プロフィールを**ホロ加工のメンバーカード**にし、エクリプスで金の印が押される・星を回るとスタンプが増える、を見せると一気に「推せる」画面になる。
- 法務まわり：本部に**〔設定〕→〔毎月のマナ〕→〔やめる〕が存在しない**（支払い画面で約束しているやめ方の道がない）。公開前に必ず必要。

---

## 2. 改善点（効く順）

### A. 宇宙の地図（ホーム）

**1. 地図／惑星の絵 → CSSの丸で平たく、地球がおもちゃに見える**
- 改善案：惑星を Seedream の描きこんだ球（1024²・平らな背景）に替え、上にコードで「自転」（正距円筒の帯テクスチャを円でマスクして横に流す・1周 40〜90秒）、「大気のふち光」（地球は青、火星は赤橙の rim light）、「雲の層」（地球だけ別レイヤーを逆向きに少し速く）を重ねる。土星の輪は前後2枚に割り、惑星の手前と奥で奥行きを出す（土星の試作と同じ depth sort）。背景は星雲つきの縦長宇宙（1152×2048）＋星3層の視差（指で地図を少し引くと 2〜6px ずれる）。
- 種類：見た目／世界観／15-20ウケ

**2. 地図／「今日どこへ行く？」が分からない**
- 改善案：二周目・三周目で物語の続きがある時だけ、地球から次の星へ**金色の航路**（点線が流れる光の粒・ロケットの小さな影が往復）を引き、その星の上に{bati}がちょこんと乗って待つ。画面下に大きな一つの動詞ボタン〔🚀 旅の続きへ：土星〕。続きがない日（自由に回る日）はボタンを出さず、航路も引かない（押し売りしない）。残り時間・日数は出さない。
- 種類：分かりやすさ／使いやすさ

**3. 地図／ダチ・推しから届いたものが地図の上で見えない（〔推し〕を開くまで空っぽに見える）**
- 改善案：届いた作品を、その作品の星のそばを回る**小さな使い**にする（木星＝ダチの顔札をつけた蝶、水星＝小さな船、火星＝UFO、土星＝コロリン、金星＝レコード、天王星＝ふくろう）。一つの星に一つまで、数字・「NEW」・赤い点は出さない。押すとその作品が〔推し〕の棚で開き、そのまま再生。88時間たつと、使いが持ち主の星へゆっくり帰っていく絵（「88時間めぐって帰る」決まりの見える化）。何も届いていない時は使いは飛ばない（空でも寂しく見えないよう、星の自転と{bati}の動きで地図は常に生きている）。
- 種類：機能／世界観／15-20ウケ

**4. 地図／惑星を押した時の手ごたえが「90%に縮むだけ」**
- 改善案：押した瞬間に「ぷにっ」（squash 0.92→弾んで1.06→1.0、180ms）、星ごとの短い音（土星＝鈴、木星＝羽音、水星＝波、火星＝電子音、金星＝スクラッチ。音量は環境音より −6dB、急に大きくしない）、`navigator.vibrate(8)`。そのまま画面がその星へ**ズームして吸いこまれる遷移**（600ms・周りの星は外へ流れる）→ 星のページ。ページ切りかえの白い・黒い一瞬を消す。
- 種類：使いやすさ／15-20ウケ

**5. 地図／上と下に大きな空き（2倍の撮影で y≈220〜540 と 1250〜1580 が空っぽ）**
- 改善案：上の帯＝小さなロゴ＋〔推し〕の瓶アイコン＋手紙入れ（届いた時だけ封筒が少し光る。数字なし）。下の帯＝「今日の行き先」（2の金のボタン、なければ{bati}が月のふちで寝転ぶ絵だけ）。地図そのものは今より12〜15%大きくし、画面のまん中より少し下へ（親指で届く位置）。
- 種類：見た目／使いやすさ

**6. 地図／開発用の言葉が残っている**
- 問題：「● = 実際に動く惑星」の凡例と、星名の横の緑の点（金星は動くのに点がない）。
- 改善案：凡例と点をなくす。本番で動かない星は描かない、または「扉だけ見える星」と同じ扱いにする。
- 種類：分かりやすさ／機能

**7. 地図／ロックの星（天王星・海王星）の見せ方**
- 問題：🔒絵文字＋灰色＋「Obolo Orderになるとひらく」の説明の札（設計は「扉だけ見える星」で、説明は押した時だけ）。
- 改善案：星を薄い霧と細い金の鎖の輪で包んだ絵にし、札は星の名前だけ。押した時だけ今の EclipseGuide（MONBAN の一行＋〔太陽の神殿へ〕〔今はいい〕）。札が短くなるので、左端で切れる問題も根本から消える。
- 種類：世界観／見た目

**8. 地図／太陽が地図にない（住人が「太陽の神殿で、いつでも受けられる」の道を見つけられない）**
- 改善案：地図の左上の空に、**全員に同じように**遠い太陽の光をうっすら描く（太陽系の中心という絵の上の理由）。押すと、住人は太陽の神殿の二択（`/eclipse`）、Obolo Order は「太陽の神殿の記録」（記録映像をもう一度見る）へ。全員に同じ絵を出すので押し売りにならない。光はゆっくり脈打つだけ（1秒に2回より遅く）。
- 種類：分かりやすさ／世界観

**9. 地図・本部の右上／`✦ 880 MANA` がずっと出ている**
- 問題：二周目からマナの数字は出さない・言葉は「マナ」（index.md 2.2）。数字が増減するのを毎回見せると「ゲームの通貨」になり、親も不安になる。
- 改善案：右上は**小さなマナジェム**（ガラスの宝石の中の光の水位で、満ち具合だけを絵で）。押すと本部のジェムへ。正確な残りは〔⚙︎ 設定〕→〔毎月のマナ〕の「くわしく」に置く（マナジェムを買える以上、残りを確かめられる場所は法律の表示として必要。運営・法務で文を確認）。一周目のテロップ「−3マナ」はそのまま。
- 種類：世界観／機能（決まりの遵守）

**10. 地図／{bati}がいない**
- 改善案：{bati}の立ち絵（生まれた時の一枚・背景なし）を地球のそばに浮かべ、待機アニメ（ふわふわ上下 3秒周期・まばたき 4〜7秒おき・たまに{food}を眺める）。{bati}は必要な時しか喋らない決まり（M-R73）なので、ふだんは無言。手紙が届いた日だけ一回「キモリンから、手紙が来たよ。」。押すと月へ（`/moon`）。
- 種類：世界観／15-20ウケ

**11. 地図／時間で空が変わらない**
- 改善案：端末の時刻で背景の色温度を3段階（朝＝地球の昼側が明るい・夕方＝金色・夜＝地球の夜側に街の灯り）。画像を3枚用意し 20秒かけて混ぜる（急に変えない）。
- 種類：見た目／世界観

**12. 「また明日」画面（TomorrowScreen）／24時間のカウントダウンと毎秒のチクタク音**
- 問題：「残り時間・カウントダウンを出さない」「引き戻す仕掛けを置かない」（index.md 2.2）と食い違う。毎秒の音は夜に開くと気になる。
- 改善案：数字の減るカウントダウンをやめ、「明日の朝、ロケットが出る」の時刻だけ（例「あした 7:00ごろから」）を一行。絵は月で丸くなって眠る{bati}と、ゆっくり回る星。音は静かな環境音だけ。〔明日まで待てへん〕を残すかは物語側の決定どおり。
- 種類：世界観／機能（決まり）

**13. 地図の上〔推し〕の棚／絵文字のタイル（🪐🦋🚢）と「まだ、何も届いていません」**
- 改善案：棚を「88時間だけ泊まりに来ている作品の棚」として描く（木の棚＋小さなガラス瓶に作品が浮く）。作品は持ち主の顔札つき。空の時は{bati}が棚をふいている絵と「ダチが何か届けたら、ここに泊まりに来ます」。8つずつ・数なし・押した時だけ再生、はそのまま。
- 種類：見た目／分かりやすさ

### B. 本部（`/earth`）

**14. 本部／Webの設定ページのカード並び**
- 問題：設計 E-1 は「本部の広間：掲示板・鉄の扉（連絡室）・光の柱（OBOLON）・宇宙の地図・招待状の机・（該当者だけ）エージェントの机・お財布」を一枚の絵で。今は縦に長い管理画面。
- 改善案：縦長の**本部の広間の絵（1152×2048）**を背景に、押せる物だけを別の絵（スプライト）で上に置く。押せる物は1.5秒周期でふちが少し光る（点滅は1秒2回まで）。物：①メンバーカード（16）②マナジェムの台座（9）③招待状の机（18）④鉄の扉＝連絡室（19。二周目の帰還まで閉まった絵のまま・説明なし）⑤掲示板＝ひと巡りのカード⑥手紙入れ⑦〔⚙︎ 設定〕の歯車。下に〔🗺 宇宙の地図へ〕。スクロールはしない（一画面）。
- 種類：世界観／見た目／使いやすさ

**15. 本部のヘッダー／「ホーム・プロフィール・…」が切れる**
- 改善案：見出しは「本部」の二文字だけ。説明は広間の絵で伝える。
- 種類：見た目

**16. プロフィール → 「ミ」一文字の紫の丸＋緑の「デモ（¥88/月は準備中）」札**
- 改善案：**メンバーカード**にする。表：月の水盤で決めた立ち絵（背景なし）を大きく、名前・@ID・相棒の{bati}（小さな立ち絵）・身分の印（住人＝銀の三日月の封蝋／Obolo Order＝金の日食の封蝋）・宇宙に来た日。裏：星めぐりのスタンプ（行った星の消印が押される）・謎の書の札の灯り・二周目の帰還でもらう「星めぐりの証」。押すと3Dで裏返る（420ms・ばねで少し行き過ぎて戻る）、指で傾けるとホロの虹が動く（`DeviceOrientation` は許可を求めず、指のドラッグを基本に）。エクリプスを受けた瞬間、カードに金の印が「どん」と押される演出（太陽の試作とつなぐ）。人気・数字は一切のせない。外のSNSへの共有ボタンは置かない（掟その一「静かな招待だけで広がる」）。立ち絵がまだない人は、フード＋丸いサングラスのシルエット（頭文字の丸はやめる）。
- 種類：15-20ウケ／世界観／見た目

**17. プロフィールの〔編集〕／名前とIDをここで打ちかえられる**
- 問題：設計 E-11 は「姿・名前は月で変える。ここは見るだけ」。またIDの横の注記が「（半角英数字と _（3〜20文字））」と括弧が二重。
- 改善案：カードの〔編集〕は「ひとこと」だけ。名前と姿は〔🌙 月の水盤で変える〕へ案内。IDの変更は〔⚙︎ 設定〕の奥へ（打ちこむたびに「もう使われています」と出ると、他人のIDの有無を探れてしまうので、決定を押した時だけ判定する）。保存したら判子がぽんと押される小さな演出。
- 種類：分かりやすさ／機能

**18. 招待が2か所に分かれていて違いが分からない**
- 問題：「✉ 仲間を招待する」（メール欄＋〔招待状をつくる〕＋一言の文字欄）と「🤝 ダチの招待状」（リンク／QR）が別々のカード。設計 E-7 は**机の上の白い封筒2通**（『招待状』＝新しい人を宇宙へ、マナジェムを添える／『ダチの招待状』＝もう宇宙にいる本当に知っている人とダチに）。さらに招待状の一言は〔🎙 話してみよう〕が主（M-R130）なのに、文字欄だけ。
- 改善案：机の絵に封筒2通を置き、押すと封筒が手前にすべり出てひらく。
  - 『招待状』：①〔🎙 話してみよう〕で一言（すみに⌨）②宛先のメールアドレス③マナジェムの購入の確認（物語の外の買う画面）④中身の確認〔送る〕⑤封蝋が押されて封筒が空へ飛ぶ演出→「招待状を送りました。開くかどうかは、相手が決めます」。
  - 『ダチの招待状』：〔リンクを送る〕〔QRを見せる〕。QRは金の飾り枠の中に大きく。「一回だけ・48時間で消える」は一行で（残り時間のカウントダウンは出さない）。
  - 作った招待状は「封をした封筒」のカードで並べ、宛先は全部見える2行表示（切らない）。状態は『まだ開いていない』『開いた』の札だけ。
- 種類：分かりやすさ／世界観／使いやすさ

**19. 連絡（メール・電話）／ORDER 会員なのに「🔒 Obolo Orderに入るとひらきます」、しかもメールのタイルが残っている**
- 問題：メールは M-R183 でなくした（やり取りは土星の二人のレコード）。連絡室は二周目の帰還で開く・閉まっている間は鉄の扉の絵だけで説明なし（earth.md §9）。デモでは `getCommsStatus` が常に閉。
- 改善案：〔✉️ メール〕をなくす。**鉄の扉→連絡室＝古い交換台**の絵（壁一面の差し込み口、灯るのはダチの名札だけ、名札ごとにランプ2つ）。名札を押すと名札が大きくなって〔連絡OK〕〔📞 電話をかける〕（使えるまで薄い色で「準備中」）。一行「ダチとのやり取りは、土星の器で、コロリンでできます」＋〔🪐 二人のレコードへ〕。デモの状態判定も ORDER なら開いた状態に。
- 種類：機能（バグ）／世界観

**20. 「ボイス登録（フェーズ4）準備中」タイル**
- 問題：社内の言葉「フェーズ4」が利用者に見える。押せないタイルが一枠を占める。
- 改善案：公開時は出さない。出すなら声の登録は土星（D04-S005）の流れの中に。
- 種類：分かりやすさ

**21. MANA ウォレット／巨大な「880」、押せない「MANAの購入は準備中です（デモでは表示のみ）」、空の「最近の履歴」**
- 改善案：本部の台座に**マナジェム**（水位の絵・数字なし）。下に二行だけ「毎月の更新日に、88マナが湧きます」「最後に使ってから1年で消えます（次の予定：〈日付〉）」。購入ボタンは使える時だけ〔💎 マナジェムを買う〕（物語の外の買う画面へ）。履歴と正確な残りは〔⚙︎ 設定〕→〔毎月のマナ〕へ。押せない灰色の大きなボタンは置かない。
- 種類：見た目／世界観／分かりやすさ

**22. 〔お財布〕の名前と説明／`🏦 アース・バンク`「音楽配信やショップの売上がここに…」**
- 問題：言葉は〔お財布〕で「銀行」系は使わない（M-R108(5)）。ユーザーは obolo商店で売らない（M-R158）。中身は「見込み」「確定（振込日つき）」の2行（E-10）。
- 改善案：i18n を `👛 お財布` に、説明を「ここに出るのは、あなたの取り分だけです。ほかの人には見えません」に。2行の形にそろえる。
- 種類：機能（文言のバグ）

**23. 〔⚙︎ 設定〕がない（とくに〔毎月のマナ〕→〔やめる〕）**
- 問題：太陽の支払い画面に「やめ方：〔設定〕→〔毎月のマナ〕→〔やめる〕」と書いてあるのに、その画面がアプリにない（`EclipsePay.tsx` の注記 P-BILL-4）。支払いの約束と実物がずれるのは法務上いちばん危ない。
- 改善案：E-11 を作る：プロフィール（見るだけ）／毎月のマナ（次の更新日・〔やめる〕→確かめの一行〔やめる〕〔もどる〕。引き止め・おまけ・がっかりした顔なし）／声を待たずに進む／ブロックした人／{bati}の設定へ／メールアドレス／ログアウト（確認つき）。広間の歯車から。
- 種類：機能（法務・必須）

**24. 〔ログアウト〕／地球の絵の上に大きな白文字、確認なし**
- 改善案：〔⚙︎ 設定〕のいちばん下へ移し、「この端末からログアウトします」〔ログアウト〕〔やめる〕。
- 種類：使いやすさ

### C. 入口・1日目

**25. 入口（ログアウト時）／〔次へ〕が黒地に黒で、押せるかどうか分からない**
- 改善案：入力前は封蝋がうっすら、メールアドレスが形として正しくなった瞬間に封蝋が金色に灯り、〔次へ〕が金の縁で光る（状態の差をはっきり）。6桁のコードは1マスずつの金の枠（入力ごとに小さく光る）。
- 種類：使いやすさ／見た目

**26. E-0（開く前の確認）／生まれた年がOS標準のセレクト、ボタン名が設計とずれる**
- 問題：「1990年」の標準セレクトだけ浮いて見える。ボタンは〔開封準備完了〕、設計は〔封を開く準備ができた〕。〔あとで開く〕がほぼ見えない灰色。
- 改善案：年は金の数字のドラム（縦にくるくる回す・止まると小さな「カチ」音）。ボタン名を設計どおりに。〔あとで開く〕は読める明るさ（コントラスト 4.5:1 以上）。押すと封蝋が一度強く脈打ち、光になって奥へ（急に白くしない）。
- 種類：見た目／分かりやすさ

**27. 声で答える場面／「うまく聞き取れませんでした、もう一度どうぞ」だけ**
- 問題：声が届いているのか分からないので、何が悪いのか直せない。M-R179 は「マイクが使えない時は理由を一行」。
- 改善案：マイクのボタンのまわりに、声の大きさで脈打つ金の輪（話していると目に見えて波打つ）。聞き取れなかった時は理由を分けて一行（「マイクの許可がありません〔許可の仕方〕」「声が小さかったみたい。スマホを口に近づけてね」）。⌨はすみに小さく、そのまま。
- 種類：使いやすさ／機能

**28. 全体／押した時の音と振動の決まりがない**
- 改善案：共通の「さわり心地の表」を作る：主ボタン＝低めの「ぽん」＋振動8ms、封蝋・封筒＝紙と蝋の音、カード＝カードをめくる音、失敗＝やさしい下降音（ブザーは使わない）。音量はBGMより下、0.2秒以上かけて出す。端末の「視差効果を減らす」設定ではズーム・揺れを控える。
- 種類：15-20ウケ／使いやすさ

---

## 3. 試作プラン（1枚のHTML・canvas・390×844）

### 「生きている宇宙の地図 × メンバーカード」

ねらい：毎日開くホームを「触りたくなる太陽系」にし、地球を押すと自分の会員証が飛び出す。土星の試作と同じ作り方（生成した舞台の絵を canvas に敷き、動く部品はコードで描く・奥行き順に並べる・画像は data URI でHTMLに埋める）。

**画面と状態（デモの切りかえボタンを右上の小さな⋯に）**
1. **旅の続きがある日**：地球→土星へ金の航路、土星の上に{bati}、下に〔🚀 旅の続きへ：土星〕。
2. **自由な日**：航路なし。届きもの（木星に蝶、水星に船）が星のまわりを回る。
3. **住人**：天王星・海王星が霧と鎖の輪。押すと MONBAN の一行のシート。左上の太陽の光を押すと「太陽の神殿へ」のシート。
4. **夜**：背景が夜版に20秒で混ざる。地球の夜側に灯り。

**レイヤー（奥→手前。毎フレーム y で並べ替える物は★）**
1. 宇宙の背景（`earth-home-space-bg` 朝／夕／夜の3枚を時刻で混ぜる）
2. 星の粒3層（コードで描く。指で地図を引くと 2/4/6px の視差、離すとばねで戻る）
3. 遠い太陽の光（`earth-home-sun-glow`、加算合成で 6秒周期の明暗）
4. 軌道の輪（コード。細い点線の上を光の粒がゆっくり流れる）
5. ★惑星（各 `planet-*-sphere` を円でマスク＋`planet-*-texture` を横に流して自転＋rim light をコードで重ねる。土星の輪は `saturn-ring-back`／`saturn-ring-front` の2枚で惑星を挟む）
6. ★届きもの（`courier-butterfly` など。星のまわりを楕円で回り、奥にいる時は小さく暗く・惑星の後ろに隠れる）
7. 金の航路（コード。ベジエ曲線上に光の粒、ロケットの影 `rocket-mini` が往復）
8. ★{bati}（`bati-sample-*`。ふわふわ・まばたき＝目を閉じた差分を80ms）
9. 地球の雲（`earth-cloud-layer` を地球より1.4倍速で）＋地球の大気の光
10. 上の帯（ロゴ・〔推し〕の瓶 `oshi-jar-icon`・手紙入れ `letterbox-icon`・マナジェム `mana-gem-small`）と下の帯（行き先ボタン）

**さわった時**
- 惑星：squash＆stretch（180ms）→ 星ごとの音 → 600ms のズーム遷移（試作ではズームのあと「土星に着いた」の札を出して戻る）。
- 届きもの：押すと使いが手前に飛んできて、作品カード（ジャケットの絵・ダチの顔札・▶）がひらく。数字・既読の印は出さない。
- 地球：押すと地球から光がのびて**メンバーカード**が飛び出す（下から回転しながら 500ms）。
  - カード：`member-card-frame-front` の上に立ち絵（`neo-sample-stand`）、名前・@ID・相棒・身分の封蝋（`seal-resident-silver`／`seal-order-gold`）をコードで文字入れ。指でドラッグすると ±18° 傾き、`holo-foil-overlay` を傾きに合わせてずらす（screen 合成）。押すと裏返り（`member-card-frame-back`）、行った星の消印（`stamp-*`）と謎の札の灯り。〔Obolo Orderになった〕デモボタンで金の封蝋が上から落ちて「どん」（揺れ 2px・120ms、光は 0.8秒かけて広がる）。
- 〔推し〕の瓶：棚のシートが下から（`oshi-shelf-bg`）。

**決まりの確認（試作の合格条件）**
- 画面に数字が出ない（マナ・届いた数・人数・残り時間）。日付だけは可。
- 光の明滅は1秒に2回より遅い。白一色の画面がない。音は0.2秒以上かけて出る。
- 390×844 で横スクロールなし、押せる物は 44px 以上、下の主ボタンは親指の届く y≥680。
- 「AI」「プロンプト」の語なし。住人は冗談を言わない（MONBAN の一行はまじめ）。

---

## 4. 絵の依頼リスト（Seedream）

共通の書き添え（各プロンプトの最後に入れる）：
`Japanese anime fantasy illustration, painterly and richly detailed, semi-realistic but cute, rich cinematic lighting with soft bloom, deep navy and gold palette consistent with the attached references (earth-bg.jpg, bluena.jpg, d1-seal.webp, bati-stand-earth.webp). Absolutely NO text, NO letters, NO numbers, NO logos, NO user interface, NO frames or borders, NO watermark.`
スプライトは `isolated on a plain flat solid neutral gray background (#808080), no floor, no cast shadow, no gradient, centered with generous margin` を付ける。光の効果だけは `on a pure black background for additive blending` にする。

| # | ファイル名 | サイズ | 用途 | プロンプト（英語） |
|---|---|---|---|---|
| 1 | earth-home-space-bg-night | 1152×2048 | 地図の背景（夜） | Vertical background for a phone home screen: a deep, calm outer-space view of our solar neighborhood at night. Soft violet and teal nebula clouds drifting across the upper third, a faint warm glow from a distant sun in the upper-left corner, countless fine stars of different sizes, a subtle darker empty circle area in the middle 70% of the frame where planets will be placed later, gentle cosmic dust swirling toward the lower edge. Elegant, quiet, mysterious secret-society mood. No planets, no moons, no spacecraft. |
| 2 | earth-home-space-bg-dawn | 1152×2048 | 地図の背景（朝） | Same composition as a calm vertical outer-space phone background, but in early morning tones: pale peach and lavender nebula, a brighter soft golden sunrise glow in the upper-left corner washing gently across the sky, fewer visible stars, airy and hopeful mood, empty middle 70% area for planets placed later. No planets, no moons, no spacecraft. |
| 3 | earth-home-space-bg-dusk | 1152×2048 | 地図の背景（夕方） | Same composition as a calm vertical outer-space phone background in dusk tones: rich amber and rose-gold nebula fading into deep indigo at the bottom, warm sun glow upper-left, first bright stars appearing, nostalgic after-school feeling, empty middle 70% area for planets placed later. No planets, no moons, no spacecraft. |
| 4 | earth-home-sun-glow | 1024×1024 | 左上の遠い太陽（加算） | A distant sun seen from deep space: a soft white-gold core with gentle layered corona rays and a faint lens halo, warm and calm, not harsh, on a pure black background for additive blending. |
| 5 | planet-earth-sphere | 1024×1024 | 地図の地球（中心） | A beautiful planet Earth as a perfect sphere viewed from space, painterly anime style, vivid blue oceans, green and ochre continents with recognizable but stylized shapes, thin swirling white clouds, a glowing cyan atmosphere rim, soft day side on the left and a night side on the right sprinkled with tiny warm city lights, gentle specular highlight on the ocean. |
| 6 | planet-earth-texture | 1024×1024 | 地球の自転用の帯（左右つながる） | Seamless horizontally tileable equirectangular surface map of a stylized anime Earth: blue oceans with subtle depth variation, green forests, tan deserts, white polar caps, painterly brush texture, flat lighting with no shading, no clouds. Left and right edges must connect seamlessly. |
| 7 | earth-cloud-layer | 1024×1024 | 地球の雲の層 | Seamless horizontally tileable equirectangular map of soft white swirling clouds and storm spirals for a stylized anime Earth, painterly, semi-transparent wisps, on a pure black background (clouds white, everything else black). Left and right edges connect seamlessly. |
| 8 | planet-moon-sphere | 1024×1024 | 地図の月 | The Moon as a perfect sphere, painterly anime style, pearly silver-white surface with soft gray maria and gentle craters, a faint cool blue rim light, calm and cute, tiny sparkle of moonlight. |
| 9 | planet-saturn-sphere | 1024×1024 | 土星の本体（輪なし） | Planet Saturn's body only, without rings, a perfect sphere in painterly anime style: creamy gold and caramel horizontal bands, soft pastel highlights, warm rim light. No rings. |
| 10 | saturn-ring-front | 1024×1024 | 土星の輪・手前半分 | Only the FRONT lower half of Saturn's ring seen at a gentle tilt, an elegant elliptical band of glittering golden ice particles and fine stripes, painterly anime style, the back half and the planet are absent (empty), isolated. |
| 11 | saturn-ring-back | 1024×1024 | 土星の輪・奥半分 | Only the BACK upper half of Saturn's ring seen at a gentle tilt, an elliptical band of golden ice particles slightly dimmer than the front, painterly anime style, the front half and the planet are absent (empty), isolated. |
| 12 | planet-jupiter-sphere | 1024×1024 | 地図の木星 | Planet Jupiter as a perfect sphere, painterly anime style, swirling cream, terracotta and soft brown bands, a gentle Great Red Spot, warm golden rim light, a few tiny glowing butterflies of light orbiting very close to the surface. |
| 13 | planet-mercury-sphere | 1024×1024 | 地図の水星（海の星） | A small fantasy ocean planet as a perfect sphere, painterly anime style, glittering teal-blue seas covering most of it, tiny fairy-tale islands, soft green and violet aurora shimmer near the poles, moonlit sparkles on the water, cool rim light. |
| 14 | planet-venus-sphere | 1024×1024 | 地図の金星（DJの星） | Planet Venus as a perfect sphere, painterly anime style, luminous golden-yellow clouds with subtle concentric swirls like the grooves of a vinyl record, warm magenta and amber rim light, a festive night-club glow. |
| 15 | planet-mars-sphere | 1024×1024 | 地図の火星（映像の星） | Planet Mars as a perfect sphere, painterly anime style, rusty red and orange canyons, a small white polar cap, faint neon city lights glittering in a few valleys, red-orange rim light. |
| 16 | planet-uranus-veiled | 1024×1024 | ロック中の天王星（霧と鎖） | Planet Uranus as a perfect sphere in pale aqua, painterly anime style, wrapped in a thin silvery mist and encircled by a delicate floating ring of golden chain links, like a sealed door, quiet and mysterious, slightly desaturated. No padlock icon. |
| 17 | planet-neptune-veiled | 1024×1024 | ロック中の海王星（霧と鎖） | Planet Neptune as a perfect sphere in deep royal blue, painterly anime style, wrapped in thin silvery mist and encircled by a delicate floating ring of golden chain links, like a sealed door, quiet and mysterious, slightly desaturated. No padlock icon. |
| 18 | courier-butterfly | 1024×1024 | 届きもの：木星の蝶 | A single small magical butterfly made of soft golden light and stained-glass wings, carrying a tiny blank round name tag on a ribbon, cute anime style, gentle glow, side three-quarter view. |
| 19 | courier-ship | 1024×1024 | 届きもの：水星の船 | A tiny cute fantasy sailing ship with a puffed cream sail and a small lantern, floating on a little splash of glittering water, painterly anime style, three-quarter view. |
| 20 | courier-ufo | 1024×1024 | 届きもの：火星のUFO | A tiny cute retro flying saucer with a glass dome and soft pink and cyan lights underneath, painterly anime style, three-quarter view, slight glow. |
| 21 | courier-kororin | 1024×1024 | 届きもの：土星のコロリン | A small round squishy creature like a soft rice cake with a tiny star mark, glossy pastel surface, shy happy closed-eye smile, gently bouncing pose, cute anime 3D-soft style. |
| 22 | courier-record | 1024×1024 | 届きもの：金星のレコード | A single small vinyl record with a blank golden label, flying with tiny sparkles trailing behind, warm magenta rim light, painterly anime style. |
| 23 | rocket-mini | 1024×1024 | 航路を飛ぶ小さなロケット | A tiny cute brass-and-cream retro rocket with round portholes and a soft golden flame, flying diagonally to the upper right, painterly anime style, toy-like but detailed. |
| 24 | oshi-jar-icon | 1024×1024 | 上の帯〔推し〕の瓶 | A small round glass jar with a cork stopper, filled with drifting tiny glowing music notes and star dust in gold and soft pink, sitting upright, painterly anime style, magical and collectible. |
| 25 | letterbox-icon | 1024×1024 | 手紙入れ | A small antique brass wall letter slot box with a crescent-moon ornament and a cream envelope peeking out of the top, warm candle-like glow, painterly anime style, front three-quarter view. |
| 26 | mana-gem-small | 1024×1024 | 右上のマナジェム（水位はコードで） | A faceted teardrop-shaped crystal gem, clear glass with a soft violet-blue inner light, empty inside so a liquid light level can be drawn later, ornate small golden cap, painterly anime style, front view. |
| 27 | earth-hq-hall-bg | 1152×2048 | 本部の広間（E-1） | Vertical background: the grand inner hall of a secret society headquarters on Earth, seen from the entrance looking in. A tall circular white-marble hall with gold filigree, a column of soft white light rising from a round floor seal in the center, a heavy closed iron door with rivets on the right wall, an old wooden notice board with pinned blank parchment on the left wall, a large antique writing desk at the lower right, an ornate pedestal at the lower left, a huge round window at the top showing a starry sky and the blue Earth. Warm candle-gold light mixed with cool moonlight, quiet and sacred, plenty of open floor in the middle. No people, no creatures. |
| 28 | earth-hq-switchboard-bg | 1152×2048 | 連絡室＝交換台（E-2） | Vertical background: a secret society communication room with an entire wall of an antique telephone switchboard made of dark walnut and brass, rows of round jack sockets and small unlit glass lamps, coiled cloth cables, empty brass name-plate holders (blank), a single warm desk lamp, a small writing desk below with two closed cream envelopes on it. Nostalgic, warm amber light, deep shadows, cozy and mysterious. No people. |
| 29 | invite-desk-envelopes | 1024×1024 | 招待状の机の封筒2通 | Two closed envelopes lying side by side on dark wood: the left one cream white sealed with a golden wax seal of a stylized eclipse, the right one cream white sealed with a silver wax seal of two clasped small hands, soft candle light, painterly anime style, top-down three-quarter view, blank paper with no writing. |
| 30 | member-card-frame-front | 1024×1024 | メンバーカード表の枠 | The front of a luxurious collectible membership card, vertical playing-card proportion centered in the square, deep midnight-navy enamel with fine gold filigree borders, a faint celestial map engraved in the background, an empty arched window area in the upper two thirds for a character portrait, a blank plaque area at the bottom, subtle holographic sheen, painterly. Blank card with no text. |
| 31 | member-card-frame-back | 1024×1024 | メンバーカード裏の枠 | The back of the same luxurious collectible membership card, vertical playing-card proportion centered in the square, deep navy with gold filigree, nine small empty round stamp circles arranged along a golden orbit line around a central embossed eclipse emblem, faint star-chart engraving, blank with no text. |
| 32 | holo-foil-overlay | 1024×1024 | カードのホロ（screen合成） | Seamless holographic foil texture: rainbow iridescent diagonal light bands with fine sparkle dust and tiny star shapes, high contrast on pure black so it can be blended in screen mode. |
| 33 | seal-resident-silver | 1024×1024 | 身分の印：住人 | A single round wax seal in soft silver with an embossed crescent moon and three tiny stars, slightly irregular wax edges, gentle highlight, painterly realistic, front view. |
| 34 | seal-order-gold | 1024×1024 | 身分の印：Obolo Order | A single round wax seal in rich gold with an embossed solar eclipse (a black disc with a radiant corona ring), slightly irregular wax edges, warm glow, painterly realistic, front view. |
| 35 | stamp-planets-sheet | 1024×1024 | 裏の消印（3×3で切り出す） | A 3x3 grid of nine round vintage postmark stamps in gold ink on transparent-looking dark navy, each with a simple planet pictogram: the Moon, Saturn with rings, Jupiter with a butterfly, an ocean planet with a ship, Mars with a flying saucer, Venus with a vinyl record, Uranus with an open book, Neptune with a seashell, and a sun with an eclipse, evenly spaced, no text, no numbers. |
| 36 | neo-sample-stand | 1024×1024 | 試作用の{neo}の立ち絵 | Full-body standing portrait of a teenage member of a secret society, Japanese anime semi-real style, wearing a large deep-navy hooded cloak with gold trim and small animal ears (fox) on the hood, thin gold round sunglasses hiding the eyes, a friendly small smile, relaxed confident pose, soft rim light. |
| 37 | oshi-shelf-bg | 1152×2048 | 〔推し〕の棚のシート背景 | Vertical background: a cozy wooden display shelf wall in a secret attic under the stars, four levels of empty shelves with small glowing glass domes and tiny brass name holders (blank), fairy lights strung along the edges, warm amber light with soft violet night outside a round window. No objects in the domes. |
| 38 | tomorrow-moon-sleep-bg | 1152×2048 | 「また明日」画面の背景 | Vertical background: a quiet night on the Moon's surface with the blue Earth hanging in the sky, a soft round cushion-shaped crater glowing faintly in the lower middle as a sleeping spot, gentle floating light motes, calm lullaby mood, deep blue and silver palette. No characters. |
| 39 | entry-seal-glow | 1024×1024 | 入口・E-0 の封蝋（灯る版） | An ornate round golden wax seal with a compass-rose and sun pattern, glowing softly from within as if awakened, tiny light particles rising from its edge, on a pure black background for additive blending. |
</content>
</invoke>
