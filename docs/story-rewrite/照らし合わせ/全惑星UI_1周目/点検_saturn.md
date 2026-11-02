# 土星（ころりんぱ／器・広場）プレイ画面 レビュー

- 見たもの：`planet_shots/saturn/` の 01〜20 と `sheet.jpg`、`_storysheet/st_saturn.jpg`・`s2_saturn.jpg`、画面設計 `saturn.md`・`index.md`、試作 `二人のレコード.html`・`土星の広場のサイファー.html`、`decisions_round19.md`（M-R152・M-R153・M-R176・M-R183・M-R184）、アプリ `KororinWorld.tsx`・`PlazaMap.tsx`・`SaturnProfile.tsx`（origin/claude/solar-system-home-planets-ew766y）、既存の絵（`art/review/plaza/*`・`art/review/messenger/*`・`public/onboarding/s/saturn-*`・`public/saturn/kororin-*`）。
- 書き方：〔 〕はボタンの文字、「 」は画面の一行。既に報告ずみの不具合（検索欄のはみ出し・〔土星におとす〕が画面外・KIMORIN のコロリンの白い四角・下のナビが帯で切れる）は繰り返さず、必要な所で「既報」と書いて引くだけにする。

---

## 1. 総評

- **良い所**：コロリン（たこ焼き＋丸サングラス）は、15〜20歳に刺さるキャラ。ぷにっとした立体の絵、神殿の広間（赤茶の丸い柱と丸窓の輪）、夜の広場の絵（`plaza-stage-a`）も、もう「買ってでも見たい」質がある。承認ずみの二つの試作（レコード・サイファー）は、生成した舞台の絵に、コードで動く部品を楕円の上に置いて奥行きの順に描く作りで、これが目指す線。
- **一番弱い所**：アプリの画面がその質にまったく届いていない。①最初の画面が三周目の「広場の地図」で、知らない人のコロリンが小さく山になっているだけ（一周目の器から始まらない）②**核の報酬の瞬間（声→コロリンが生まれる→器に入る→サングラスが落ちて歌う）に演出がない**。今は吹き出しの字が出て、山にまぎれるだけ ③器は平らな紫の弧、KIMORIN のコロリンは赤い丸の顔写真、MONBAN は黒い四角。絵の素材がそろっていない ④☆・「のこり87時間」・「880 MANA」・「ダチは、おたがいにフォローしている人」など、世界の決まりに反する表示が残っている。
- **方針**：土星は「器（神殿の広間）＝作って、ためて、歌わせる場所」と「広場＝サイファー」の二つの舞台に絞る。どちらも、生成した舞台の絵＋コードで動くコロリンにする（試作と同じ作り）。最優先は**器の画面の試作**（3. に書いた）。広場は承認ずみのサイファー試作を、そのままアプリに入れる。

---

## 2. 改善点（効果の大きい順）

> 種類の略：見＝見た目／分＝分かりやすさ／使＝使いやすさ／機＝機能／世＝世界観／ウ＝15-20ウケ

### 1. 最初の30秒：入口が「三周目の広場の地図＋知らない人の山」
- **画面**：`/saturn` を開いた最初の画面（01）。
- **問題**：最初に出るのは浮島の地図（日本・K-POP好き…＝S-8、三周目の中身）。小さなコロリン（約30px）が島に固まっていて、何を押せばいいのか分からない。どれも知らない住人（サンプル）のもので、決まり（M-R176「スタートは背景と器だけ」、15歳未満は「ダチと自分だけ」）にも反する。上の帯 340px（星の見出し＋デモの帯＋「ころりんぱ」の字の見出し＋タブ）が画面の4割を使い、主役の絵が下に押し出されている。
- **改善案**：
  - 土星に着いたら、まず **S-3 器（神殿の広間）** を開く。画面のまん中に自分の器、奥に石の山、天井の丸窓に輪。一行目は「石に、声を吹きこんでみよう」だけ。下のまん中の〔🎙 つぶやく〕が呼吸するように光る（1.6秒周期で明るさが±10%。点滅にはしない）。
  - 2回目からは、器に自分のコロリンが並んだ状態で開く。新しく届いたダチのコロリンがあれば、広場のボタンのすみに小さな光の粒（数は出さない）。
  - 浮島の地図（S-8）は三周目の〔みんな〕タブの中だけにする。
- **種類**：分・世・機・ウ

### 2. 核の報酬の瞬間に「ころん」がない（生まれる→器に入る→歌う）
- **画面**：声をおとしたあと（06）、練習の器（13〜17）。
- **問題**：〔土星におとす〕を押すと、丘の上に白い吹き出しの字が出るだけ。コロリンが生まれる瞬間、器に転がって入る瞬間、サングラスが落ちて歌う変身（M-R153）が、どれも見えない。この星で一番気持ちいいはずの所が、SNS の投稿完了と同じ温度になっている。
- **改善案**（3. の試作の中心）：
  1. 話している間：石がゆっくり浮いて、声の大きさに合わせて内側から金色に灯る（上限を決め、急に明るくしない）。マイクから石へ、音の粒が弧を描いて吸いこまれる。話した言葉は、石の下に字で出る。
  2. 止めると{bati}（ぽん）が横から来て、石を指先でちょんと押す。石に金色のひびが走り、0.25秒で「ぽんっ」とコロリンが出る（押しつぶし→伸び→もどる、の弾み。1.25→0.9→1.0）。かつお節が数枚舞う。
  3. コロリンが祭壇の段を転がって（回りながら曲線で動く）器へ入る。底で2回小さく跳ねて止まる。「ころん」の音を一つ（小さく、大きさを0から0.15秒で上げる）。日付と時刻の小さな札が、ぴょこっと立つ。
  4. 2・3つ目（と自分でタップした時）：サングラスがおでこから「シャキーン」と目に落ち（0.12秒）、ピックがくるっとマイクに。体が拍に合わせて弾み、広間の明るさが0.6秒かけて75%に下がる。丸窓の輪に、ピンク→水色→金の光がゆっくり流れる。字は一字ずつ灯る（サイファー試作の字の出し方と同じ）。歌い終わると0.8秒かけて明るさがもどる。
- **種類**：ウ・見・世

### 3. 下の3つのボタンの言葉が分からない（〔ゆらす〕〔声をおとす〕〔おまかせ〕）
- **画面**：下の帯（01・02・06。既報のとおり、デモの帯で半分切れている）。
- **問題**：「ゆらす」「おまかせ」は、押すと何が起きるか分からない。ほかの星（木星・水星・火星）と位置もそろっていない。字の大きさ 11px、ボタンの幅 64px で、押せる高さもぎりぎり。
- **改善案**：設計どおり〔🪐 広場〕〔🎙 つぶやく〕〔🥣 器〕にする。まん中の〔🎙 つぶやく〕は直径72pxの丸を帯から少し上に飛び出させ、左右は 64×56px 以上。絵文字ではなく、生成した小さな立体アイコン（4. の絵の依頼 `saturn-nav-*`）。今いる画面のボタンは、下に小さな金の点と、アイコンが少し大きくなる（1.0→1.12）。〔ゆらす〕〔おまかせ〕は広場の中の小さなボタンにする（設計 §9）か、なくす。
- **種類**：分・使・見

### 4. 器が「平らな紫の弧」で、絵の中に置かれていない
- **画面**：練習の器（13〜18）。
- **問題**：画面の下4割を、紫のグラデーションの大きな弧が占めている。絵の質感（立体・やわらかい光）と合わず、フォームの部品のように見える。器の名札（『KIMORIN⭐︎』『{neo}』）もない。コロリンが器のふちの上に「乗っている」だけで、中に入っていない。
- **改善案**：器を生成した立体の絵（陶器・ラベンダーの釉薬・金のふち・土星の輪の模様）にする（`saturn-vessel-neo`・`saturn-vessel-kimorin`）。描く順は「器の絵 → コロリン（奥から手前の順）→ 同じ器の絵を、ふちの手前の楕円より下だけ切りぬいてもう一度」。これで、コロリンが器の中に沈んで見える（試作のレコードと同じ考え）。器の前に真鍮の名札（字はコードで書く）。器は画面の幅の8割、下の帯の上に置く。
- **種類**：見・世

### 5. キャラの絵がそろっていない（赤い丸の顔写真・黒い四角・白い四角）
- **画面**：練習の器（15。KIMORIN のコロリンが「KIMORIN の顔の入った赤い丸」になっている）、広場（19・20。MONBAN のコロリンが黒い四角の絵、デザイン後のコロリンが白い四角＝既報）。
- **問題**：たこ焼きの形をしていないコロリンが並ぶ。器・広場の世界がこわれて見え、キャラを集める気持ちがしぼむ。
- **改善案**：`art/review/plaza/` の `kororin-kimorin-*`・`kororin-monban-*`・`kororin-sister-*`・`kororin-brother-*`（ふつう／歌う、の2種）を切り抜いた PNG／WebP にして使う。顔の丸いバッジは使わない。どのコロリンも同じ大きさの基準（器の中で高さ 60〜64px、広場で 56px）と、同じ向きの影（下に楕円の影を一つコードで描く）にそろえる。
- **種類**：見・世・ウ

### 6. 「上へはじく」が、字の説明だけで手ざわりがない
- **画面**：練習の 18（「飛ばしたいコロリンを、上へはじこう」）。
- **問題**：どこをどう動かすのかを見せる絵がない。はじいた後に、コロリンがどこへ行ったのか（広場に届いた）も見えない。〔今はいい〕が画面の下に小さく出るだけ。
- **改善案**：
  - はじめての時だけ、半透明の指が器のコロリンを上へ払う見本を2回（1回1.2秒）。コロリンの上に、上向きの小さな矢印が3つ、順に灯る。
  - 指で持つとコロリンが少し持ち上がり（影が離れる）、指についてくる（ばねのような遅れ）。上へ速く払うと、くるくる回りながら小さくなり、天井の丸窓へ吸いこまれる。後ろに輪の色の光の尾。遅い・下向きだと、ゴムのように器の元の場所へもどって跳ねる。
  - 飛んだあと、画面の上から小さな丸い窓（ステンドグラスの枠）が下りてきて、広場にそのコロリンが「ころん」と着く様子を1.5秒だけ見せる。字は「コロリンが、広場へ飛んでいった」（設計のテロップ）。
  - 器の元の場所には、日付の札だけが薄く残る（88時間で帰る場所。残り時間は出さない）。
- **種類**：使・分・ウ

### 7. 歌う時の変身（M-R153）がアプリに入っていない
- **画面**：器・広場のコロリンをタップした時（13・15・20）。
- **問題**：今は ♪ の印が一つ出るだけ。サングラスが落ちる・ピックがマイクになる・かつお節が踊る・空が暗くなり輪に光が流れる、が何もない。
- **改善案**：
  - すぐできる形：ふつうの絵→歌う絵に替える瞬間に、体を0.92倍の横長→1.08倍の縦長にして入れ替えを隠し、目の高さに白い短い線を3本走らせる（「シャキーン」）。
  - 本気の形：サングラスなしのコロリン＋サングラスだけの絵（4. の `kororin-mine-bare`・`round-sunglasses-gold`）を重ね、サングラスをコードでおでこ→目へ落とす。どのデザインのコロリンにも同じ動きが使える。
  - 背景：広間（広場）を0.6秒で暗く、輪の色の光をゆっくり流す。青のりは歌っている間だけ、そのコロリンのまわり半径80pxに舞う。点滅・急な音量の上昇はしない。
- **種類**：ウ・世・見

### 8. 〔声をおとす〕のシートに情報が多すぎる（声が主役になっていない）
- **画面**：03。
- **問題**：見出し・行き先・大きなマイク・「タップして話してね」・文字欄（「🎙 を押して、いま思ったことを話してね」）・10pxの直し方の説明・280の数字・薄い〔バティの声で聞いてみる〕・下線のリンク・（画面外の）〔土星におとす〕＝既報。目で追う所が9つある。設計（M-R130）の「まん中に大きな〔🎙〕、すみに小さな⌨」と違う。
- **改善案**：シートをやめ、器の画面そのものを「吹きこむ画面」にする（2. の流れ）。画面にあるのは、石・大きな〔🎙 声を吹き込む〕・小さな字のお題（迷った時だけ）・すみの⌨（44×44px）の4つだけ。文字の数・バティの声の案内・下線のリンクは出さない（バティの声の登録は月の画面で案内する）。言い直しは〔🎙〕をもう一度押すだけ。
- **種類**：使・分・世

### 9. 吹き出しのチップが小さく、決まりに反するボタンがある（☆・💬）
- **画面**：06（吹き出しの下の〔ミナト ›〕〔💬〕〔☆〕）。
- **問題**：チップの高さ 28px（`h-7`）で、指では押しにくい。☆（いいね）は、どの周回でも出さない決まり（M-R74）。💬 返事・🔁 引用も、台本で教えていないので出さない（設計 §10 問い3）。
- **改善案**：吹き出しとチップをやめ、「コロリンをタップ＝そのコロリンだけ歌う」に一本化する。字は歌っている間、コロリンの上に出す（終われば消える）。名前と〔⋯〕（〔推しから外す〕〔🚩 通報する〕〔🚫 ブロックする〕）は長押しで出す。押せる所はどれも 44×44px 以上。
- **種類**：使・機・世

### 10. 数と時間が出ている（「のこり87時間」・「880 MANA」）
- **画面**：07（「のこり87時間で部屋に帰ってくる」）、すべての画面の上（〔✦ 880 MANA〕）、ひろばの詳しい所（`lifeLeft()` の「のこり12時間」「まもなく消える」）。
- **問題**：設計の「出さないもの」（残り時間・戻った数・マナの残り）に反する。15〜20歳には「急かされる・減っていく」感じを与え、土星の「ゆっくり、声を置く」に合わない。
- **改善案**：残り時間は全部消す。器では、広場に出ているコロリンの場所に「日付の札だけ薄く」残す（6.）。上の帯のマナの数は、一周目は出さない（デザインを使った時だけ〔テロップ：−3マナ〕が0.8秒で浮かんで消える）。二周目からは数も出さない。
- **種類**：世・機

### 11. 「ダチ」の空の時の文が、決まりと逆のことを言っている
- **画面**：上のタブ〔ダチ〕が空の時（`KororinWorld.tsx` 661行）、人のページの〔＋ フォローする〕（`SaturnProfile.tsx` 161行）。
- **問題**：「ダチは、おたがいにフォローしている人。名前をタップしてページからフォローしてね」と出る。ダチは招待状でつながった、本当に知っている人だけ（M-R175）。知らない人にダチの申しこみはできず、知らない人には〔推す〕（三周目から）だけ。15歳未満は知らない人とつながらない。今の文は、知らない人とつながる道を教えてしまう。
- **改善案**：タブを〔推し〕だけにし（一周目の3日目から。三周目に〔みんな〕が増える）、〔推し〕＝S-1 広場を開く。ダチが{inviter}・KIMORIN⭐︎だけで、まだだれも飛ばしていない時の広場は「まだ、ダチのコロリンは来ていない。器から上へはじくと、ここに届きます」。〔＋ フォローする〕は〔推す〕に変え、三周目から、ダチでない人の名前の〔⋯〕の中だけに置く。
- **種類**：機・世

### 12. 見出しが二重で、上の帯が重い
- **画面**：すべての画面の上（「← 土星 声でつぶやくSNS ✦880 MANA EN」の帯＋デモの帯＋「ころりんぱ」の字の見出し＋〔自分の部屋〕）。
- **問題**：同じ場所の名前が二回出る。「SNS」という言葉が、秘密結社の世界の外の言葉。「ころりんぱ」の字は細い明朝で字間が広く、ほかの部品（丸ゴシック）と合わない。
- **改善案**：上の帯を高さ 56px の一段にする：左に〔‹〕（44px）、まん中に小さく「SATURN」の金の英字と「土星の神殿」、右に〔👥 ダチ〕（44px）。帯は後ろが透ける暗いガラス（試作と同じ）。「声でつぶやくSNS」は外す。字の書体は試作にそろえる（見出し＝Dela Gothic One、本文＝Zen Maru Gothic／M PLUS Rounded 1c）。
- **種類**：見・世・分

### 13. 広場（ひろばの中）が「空6割＋下に山」で、だれのコロリンか分からない
- **画面**：02・06（ひろば「日本」の中）、練習の 19・20（夜の広場）。
- **問題**：02 は上の6割が何もない空、下の虹の丘に30以上のコロリンが重なって山になっている。名前も見えず、押しても一つずつ聞けるのか分からない。19・20 は、住人（シスター・ブラザー）が小さな全身の人物として立ち、オレンジと黄色の光の棒が線だけで描かれ、コロリンが四角い写真のように並ぶ。
- **改善案**：広場（S-1）を承認ずみの `土星の広場のサイファー.html` の作りにそのまま置きかえる。丸い石の舞台の楕円の上に、最大8つのコロリンを等間隔に（奥のものほど小さく、奥から順に描く）。それぞれの足もとに名札（「ダチ　@名前」）。まん中に金のスタンドマイク、下に〔🎤 サイファー〕（高さ62px、ふちに色が回る）。住人の人物の絵は広場に立たせない（コロリンだけ）。
- **種類**：見・分・ウ

### 14. 物語の台詞の進め方が分かりにくい（止まって見える所がある）
- **画面**：練習の台詞の枠（11〜20）、`st_saturn.jpg` の a140〜a260（「コロリンは、あなたの器に…」の説明が13回のタップでも変わらない）。
- **問題**：台詞の字は約12px、進めるしるしは右下の小さな▶だけ。「器のコロリンを続けてタップ」を待っている所でも、台詞の枠が「タップで進む」と同じ見た目なので、枠をタップし続けて止まる。
- **改善案**：
  - 台詞の字を15px以上、枠の下に「▼」を上下にゆっくり動かして置く。画面のどこを押しても進む。
  - 「〇〇してみよう」と手を動かす場面では、台詞の枠を少し暗くして▼を消し、やることを光らせる（器のコロリンに指のマークと輪の光）。枠を押した時は、やることを一度だけ小さく揺らす。
- **種類**：分・機

### 15. 日付と時刻の札が重なる
- **画面**：15・17（札「11/2 03:08」がコロリン同士で重なる）、`_story/satles/s108` 付近（お題の字の上に札）。
- **問題**：コロリンごとに大きな札が頭の上に出て、3つ並ぶと重なり、字も読めない。
- **改善案**：札は小さな紙の旗（高さ18px・字10px以上）にして、コロリンの右肩に斜めに立てる。同じ日の2つ目からは時刻だけ。器を長押しすると、全部の札が少し大きくなって読める（離すと戻る）。札は奥行きの順にコロリンと一緒に描き、手前のコロリンの後ろに隠れてよい。
- **種類**：見・分

### 16. 青のりの紙吹雪が、ずっと画面じゅうに散っている
- **画面**：15・17〜20（緑の小さな四角が画面全体に止まって見える）。
- **問題**：歌っていない時も散っていて、ゴミのように見える。四角い点なので青のりに見えない。
- **改善案**：青のりは歌っている間だけ、そのコロリンのまわりから舞い上がって落ちる（2秒で消える）。形は不ぞろいの小さな葉っぱ（生成した `aonori-katsuobushi-flakes` を切り出して使う）。「動きを減らす」の設定の人には出さない。
- **種類**：見・世

### 17. 虹の輪の線が、窓の絵を横切っている
- **画面**：15〜20（色の輪が、絵の上に細い線として重なる）。
- **問題**：絵の中の輪ではなく、画面の上に描いた楕円の線に見える。何の印か分からず、絵がずれたように見える。
- **改善案**：ふだんは消す。歌う時だけ、天井の丸窓の中の輪（絵の輪の位置に合わせた楕円）に、光をにじませて流す（線ではなく、ぼかした色の帯。`globalCompositeOperation='screen'`）。
- **種類**：見・世

### 18. 「自分の部屋」が器になっていない／自分の姿が仮の緑の玉
- **画面**：07。
- **問題**：上半分に平らな緑の玉（`BallAvatar`）、下半分は白いカードにボタン二つと一行の一覧。器（M-R176）ではなく、ふつうのプロフィールの画面。「キャラを描いてもらう」は、コロリンのデザイン（S-2b）と名前も中身もちがう。
- **改善案**：〔🥣 器〕の画面＝S-3（試作の画面）にする。自分の見た目は、S-2b で決めたコロリン（決めていなければ、ふつうのコロリン）。器の右上に〔🎨 デザイン〕（44px、パレットの立体アイコン）。自己紹介・名前の編集は地球の本部に寄せ、土星では出さない。
- **種類**：世・機・見

### 19. コロリンのデザイン（S-2b）を「集めたくなる」発表にする
- **画面**：S-2b（アプリにはまだない。設計 §9）。
- **問題**：設計はあるが、4つのデザインの出し方が決まっていない（§10 問い11）。ここは15〜20歳が一番盛り上がる「引いた！」の瞬間になれる所。
- **改善案**：{bati}がタッチすると、石の上に裏返しのカード（レコードのラベルの形の円盤）が4枚、扇のように並ぶ。1枚ずつ自動で表を向き（0.35秒おき）、表を向く時に金のふちが一周光る。4つとも、おでこのサングラスの色と縁が違う（M-R153）。選ぶと、そのカードが器へ飛び、器の三つのコロリンが一つずつ「ぽん」と新しい見た目に変わる。レア・星の数・確率は出さない（全部が自分のための一つ）。
- **種類**：ウ・見

### 20. 空の時の画面（器・広場・ダチ）が、文だけか、何もない
- **画面**：器のからっぽ（練習の 11・13 の前）、広場にだれもいない時、ダチの一覧が{inviter}だけの時、二人のレコードのからっぽ。
- **問題**：今は「まだ誰もフォローしていないよ」などの字だけ。15〜20歳は、空の画面を「さびれた場所」と感じてやめる。
- **改善案**：
  - 器：石がゆっくり灯り、器の底にうっすら輪の模様が光る。「石に、声を吹きこんでみよう」。マイクのボタンへ向けて光の粒が流れる。
  - 広場：誰もいない舞台に、マイクとスポットライト一つ（`plaza-stage-a` にそのまま）。「器から上へはじいたコロリンが、ここに集まります」。〔🥣 器へ〕（44px）。
  - ダチの一覧：二つの名札の下に、紙の招待状の絵（`saturn-empty-dachi`）と「ダチは、招待状でつながった、本当に知っている人だけ」（二周目からは〔🤝 ダチの招待状〕へ）。
- **種類**：分・見・世

### 21. 器と広場のあいだの「移動」がない
- **画面**：器→広場、広場→器。
- **問題**：下のボタンで画面が切り替わるだけで、神殿の中と外の位置関係が分からない。
- **改善案**：器→広場は、カメラが天井の丸窓へ上がる（背景を上へ0.5秒ずらしながら白っぽい夜空色へ）→広場の絵が上から下りてくる。広場→器は逆。はじめての夜だけ豪華映像 V21（約8秒）。どちらも明るさはゆっくり変え、白く飛ばさない。
- **種類**：世・分

### 22. 届いたダチのコロリンの「お知らせ」を、数なしで気持ちよく
- **画面**：広場・器・ダチの一覧（設計 S-1・S-13）。
- **問題**：アプリには届いた時の見せ方がない（設計は「少し光る」「一度だけ踊る」）。
- **改善案**：広場を開いた時、まだ聞いていないダチのコロリンだけ、足もとの影の輪がゆっくり金色に呼吸する。開いた瞬間に一度だけ、そのコロリンがサングラスを落として小さく踊る（音なし）。〔🪐 広場〕のボタンのすみに金の小さな点（数なし）。
- **種類**：分・ウ

### 23. 押せる所の大きさ（44px 未満の所）
- **画面**：各所（アプリのコードで確認）。
- **問題**：〔ミナト ›〕〔💬〕〔☆〕のチップ 28px（`h-7`）、〔← ひろば〕32px（`h-8`）、タブ（みんな／フォロー／ダチ）約32px、〔ゆらす〕〔おまかせ〕は字 11px で高さ約44pxだが幅64px、ひろばの詳しい所の〔×〕32px、作ったひろばのしるしの絵文字のマス約36px（09）、練習の〔今はいい〕約30px（18）。
- **改善案**：押せる所は全部 44×44px 以上（見た目が小さくても、押せる範囲を広げる）。コロリン自体は 60px 以上の範囲で押せるようにし、重なっている時は手前（奥行きの順で後に描いたもの）を優先する。
- **種類**：使

### 24. 音と手ごたえ（急に大きくしない）
- **画面**：全体。
- **問題**：作る・入る・飛ぶ、のどれにも音と手ごたえがない。
- **改善案**：音は「ころん」（入る）・「ぽんっ」（生まれる）・「ひゅるる」（飛ぶ）の三つを、どれも小さく（全体の大きさの上限 0.6、鳴らし始めは 0 から 0.15 秒かけて上げる）。最初にタップするまでは音を出さない。手ごたえ（振動）は対応している端末だけ、8ms を一回（生まれる・入る）。音を切るボタンを上の帯の〔⋯〕の中に。
- **種類**：ウ・使

### 25. 色と光のルール（夜の神殿と、昼のパステルが混ざっている）
- **画面**：01〜09（明るいラベンダーのパステル）と 11〜20（赤茶の神殿・夜の広場）。
- **問題**：同じ土星なのに、遊ぶ画面はパステルの平らな絵、物語は立体の神殿。物語から遊ぶ画面に移ると、別のアプリに見える。
- **改善案**：遊ぶ画面も、物語と同じ「コロリン風にデフォルメした立体の神殿」にそろえる（器＝広間、広場＝夜の石だたみ）。部品の色は、夜の紺（#09081a）・金（#ffd28a）・ピンク（#ff5fb8）・水色（#4fe3ff）・すみれ（#8b6bff）を試作と共通の色として使う。白いカード・紫のグラデーションのボタンはやめ、暗いガラス＋金のふちにする。
- **種類**：見・世

### 26. 三周目の「広場の地図」（S-8）を直す時の注意
- **画面**：01・10（今の最初の画面。三周目の〔みんな〕へ移す）、09（ひろばをつくる）。
- **問題**：島の名前の札が島から離れて浮き、どの札がどの島か分からない（「アメリカ」の札が「日本」の島の下にある）。「日本」の島の後ろに、大きな桃色の丸がにじんで、絵のずれに見える。島のしるしが絵文字で、立体の絵の中で安く見える。検索欄のはみ出しは既報。
- **改善案**：札は島のふちの手前に、旗の形で刺す（島と一緒に揺れる）。後ろの桃色の丸は消す（選んだ島を示すなら、島の下に金の輪）。しるしは生成した立体の小物（`plaza-sign-tokens-*`）にする。言葉は〔島のしるし〕→「ひろばのしるし」（設計 §9）。島の上のコロリンは 40px 以上に。
- **種類**：見・分・世

### 27. 子ども（15歳未満）の画面に、知らない人の入口を残さない
- **画面**：広場の地図の検索欄、ひろばの中、人のページ。
- **問題**：今は、知らない住人のコロリン・〔＋ フォローする〕・名前で探す欄が、だれにでも出る。
- **改善案**：15歳未満の人の土星には、ダチと自分のコロリンだけを出す。検索欄・〔推す〕・知らない人の名前は出さない（「出せません」のような一行も出さず、初めからないものとして作る）。サンプルの住人も出さない。
- **種類**：機・世

### 28. 動きを減らす設定と、読み上げ
- **画面**：全体。
- **問題**：アプリの土星には `prefers-reduced-motion` の扱いがない（試作にはある）。
- **改善案**：動きを減らす設定の人には、転がる・はずむ・紙吹雪・カメラの移動を出さず、ふわっと出て消えるだけにする。コロリンの絵には「{名前}のコロリン：{言葉}」の読み上げの名前をつける。
- **種類**：使

---

## 3. 試作プラン：「器と石」— ころん、と生まれて、上へはじく

**画面**：S-3 器（神殿の広間）＋ S-2 つぶやく（石に吹きこむ）＋ 上へはじく（→広場）を、一枚の画面で。一つの HTML（canvas）、390×844。承認ずみの二つの試作と同じ作り（生成した舞台の絵＋コードで動く部品・楕円の上に置いて奥から順に描く・絵はファイルに埋めこむ）。

### 3.1 画面の割りつけ（390×844、縦）

| 場所 | 中身 |
|---|---|
| 0〜56px | 暗いガラスの帯：左〔‹〕44px、まん中「SATURN」（金・小）／「土星の神殿」、右〔👥 ダチ〕44px |
| 56〜700px | 舞台（canvas 全面。帯の下にも絵が続く）。背景 `saturn-hall-vessel-stage`（1152×2048）を高さに合わせて表示（倍率 0.412、左右を約42pxずつ切る） |
| 舞台の中 | 天井の丸窓（絵の座標でおよそ中心 576,520、楕円 260×140）／祭壇と石（576,980）／自分の器（中心 576,1480、口の楕円 横380×縦110） |
| 700〜844px | 下の帯（暗いガラス）：〔🪐 広場〕〔🎙 声を吹き込む〕（直径72px、帯から20px上に出る）〔🥣 器〕、右すみに⌨（44×44px） |

### 3.2 生成した絵／コードで動かすもの

| 生成した絵（4. の依頼） | コードで描く・動かす |
|---|---|
| 広間の背景（器なし）、夜のクラブ照明の同じ構図（歌う時に重ねてにじませる） | 背景の小さなずれ（指で引くと最大6px。奥行き感）、丸窓の輪に流れる色の光（screen で重ねる）、光の筋の中のちり |
| 器（自分用・KIMORIN 用）、真鍮の名札（字なし） | 器の「ふちの手前より下だけ」をもう一度描いて、コロリンを中に沈める。名札の字 |
| 声の石（ふつう・内側から灯る）、石のひび（金の線） | 石が浮く・灯る（声の大きさで明るさ。上限あり）、ひびの線が走る、音の粒が弧を描いて吸いこまれる |
| コロリン（ふつう・歌う。既存の `koro-me`・`art/review/plaza/*`）、サングラスなしのコロリン＋サングラス | 押しつぶし／伸び、転がる（回転＋曲線）、跳ねる、奥から順に描く、サングラスの落下、拍に合わせた弾み |
| {bati}（ぽん）が指でタッチする絵 | 横から飛んできて、ちょんと押して去る |
| かつお節・青のりのかけら | 舞う・落ちる（2秒で消える） |
| 広場の絵（既存 `plaza-stage-a`） | はじいた後の小窓（ステンドグラスの丸い枠はコード）で、コロリンが降りて着く 1.5 秒 |
| — | 日付の紙の旗、字の一字ずつの点灯、トースト、指の見本 |

### 3.3 さわる所と流れ

1. **開いた時（からっぽ）**：器の底に輪の模様がうっすら光り、石がゆっくり灯る。一行「石に、声を吹きこんでみよう」。〔🎙〕が呼吸するように光る。
2. **〔🎙 声を吹き込む〕を押す**：画面が石へ少し寄る（1.0→1.06、0.4秒）。石が 12px 浮き、声の大きさ（試作は本物のマイク。だめな時は見本の声の波）で内側の金の光が強くなる。マイクから石へ音の粒。言葉が石の下に字で出る（試作は見本の文「放課後のメロンパン、まだあったかかった」）。
3. **もう一度押して止める**：{bati}が左から飛んできて石に触れる→金のひびが 0.3秒で走る→「ぽんっ」とコロリン（押しつぶし→伸び→もどる）→かつお節が舞う→祭壇の段を転がって器へ→底で2回跳ねて止まる→日付の旗がぴょこっと立つ→「ころん」。
4. **タップ**：そのコロリンだけ歌う。サングラスが落ち、体が拍（100BPM）で弾み、広間が暗くなって丸窓の輪に色の光。字が一字ずつ灯る。終わるとサングラスがおでこへ戻る。
5. **続けてタップ（2つ以上）**：順番に歌ってつながる。歌い終わったコロリンから次へ、♪の粒がぽんと渡る（小さなクラブ。M-R153）。
6. **上へはじく**：持つと持ち上がって影が離れる。上へ速く払う（指の速さが毎秒900px 以上）→回りながら小さくなり、丸窓へ吸いこまれる（輪の色の尾）→上から小窓が下りて、広場にそのコロリンが「ころん」と着く→「コロリンが、広場へ飛んでいった」。遅い時は元へ戻って跳ねる。器の元の場所には旗だけが薄く残る。
7. **長押し**：〔⋯〕（〔消す〕）。押せる範囲は 60px 以上。
8. **〔🎨 デザイン〕（器の右上）**：おまけ。4枚のラベルの円盤が扇に並んで1枚ずつ表を向き、選ぶと器のコロリンが順に新しい見た目へ（改善点19）。

### 3.4 「わあ」となる瞬間

**声を止めてから3秒**：石にひび→ぽんっ→転がる→器の底で跳ねる→サングラスがシャキーンと落ちて、広間が夜のクラブの照明に変わる。そして**はじいたコロリンが丸窓をくぐって、広場の小窓に着く**ところ。神殿の中と外がつながった、と体で分かる。

### 3.5 作る時の決まり

- 急な点滅・急な音量の上昇はなし（明るさの変化は 0.6 秒以上かける。音は 0 から上げる）。最初のタップまで音を出さない。
- 「AI」「プロンプト」の言葉、数（器のコロリンの数・残り時間・マナの残り）を出さない。
- 動きを減らす設定の時は、転がる・はずむ・かけら・カメラの寄りをやめ、ふわっと出るだけにする。
- 試作の中の住人の台詞は入れない（入れるなら、ブラザー「器のコロリンを、上に、飛ばしてみるZE!!」のように語尾を守り、ふざけない）。

---

## 4. 絵の依頼リスト（Seedream）

**共通の書き方**：
- 背景：1152×2048（縦）。部品：1024×1024、透明にする前提で、無地の平らな背景（白いものは灰色 #808080、それ以外は白）に1つだけ描く。
- 土星の絵の調子（見た絵から）：コロリン風にデフォルメした、やわらかい光の立体の絵。丸い形、ラベンダー・桃色・ばら色のパステルに、温かい金の飾り。神殿は赤茶の丸い柱、天井の丸窓に土星の輪。夜は紺と金とネオン（ピンク・水色・すみれ）。
- すべてのプロンプトの最後に次をつける（下では「＋共通の最後」と書く）：`Soft-lit deformed 3D style, rounded shapes, gentle warm light, no harsh white glare. No text, no letters, no numbers, no symbols that read as writing, no logos, no watermark, no signature, no UI.`
- コロリンの部品は、既存の作り（1枚目＝基本のコロリン `kororin-style.jpg` を参照に添える）に合わせる。

### 背景・舞台

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 1 | `saturn-hall-vessel-stage` | 1152×2048 | 試作の舞台：器（S-3）の広間。器はコードで置くので描かない | Inside the Saturn temple hall drawn in the kororin-style deformed look: rounded terracotta red-brown pillars on both sides, a huge round window in the domed ceiling showing Saturn's rings glowing softly in a lavender dusk sky (no planet ball, only the rings), warm light shafts falling from the window with floating dust. In the middle distance a low round stone altar with three shallow steps, and on it a small heap of smooth round pastel Saturn stones. The lower 40% of the picture is an empty, softly lit polished floor in lavender and peach marble with a faint circular inlay, left completely empty for an object to be placed later. Camera at chest height looking slightly down, symmetric composition, the altar centred at about 48% from the top. Pastel lavender, peach and rose with warm gold ornaments. No people, no characters, no creatures, no bowls, no vessels. ＋共通の最後 |
| 2 | `saturn-hall-vessel-stage-club` | 1152×2048 | 歌う時に重ねる「夜のクラブ」版（1 と同じ構図） | Edit the first picture: keep the place, camera, framing, pillars, altar, stones and floor exactly the same, and change only the lighting: the hall is now dim like a cozy night club; Saturn's rings in the ceiling window glow with slowly flowing pink, cyan, violet and gold neon light; soft coloured light pools on the floor and the pillars; tiny mirror-ball sparkles on the round stones; deep navy shadows, gentle glow, nothing harsh. No people, no characters. ＋共通の最後 |
| 3 | `saturn-plaza-stage-dusk` | 1152×2048 | 広場（S-1）の夕方版。はじめて広場に出る時・昼に開いた時 | The round plaza outside the Saturn temple at sunset, in the kororin-style deformed look: behind, the round stepped temple with golden domes drawn deformed and cute; Saturn's rings arc across a peach, rose and lavender sunset sky (do NOT draw the planet ball). In the middle of the plaza a round stone stage with gold ornaments around its rim and a ring of tiny warm light dots; in the very centre ONE old-fashioned golden stand microphone, nothing else. Pastel cobblestones in lavender, peach and lilac. Seen from above at an angle so the stage reads as an ellipse squashed to about 0.5 of its width, spanning about 85% of the picture width, between 40% and 75% from the top. A few paper lanterns at the plaza edge. No people, no characters. ＋共通の最後 |
| 4 | `saturn-design-pedestal-stage` | 1152×2048 | コロリンのデザイン（S-2b）の舞台：4枚の円盤が並ぶ台 | A small round alcove inside the Saturn temple, kororin-style deformed look: rounded terracotta pillars framing a niche, a softly glowing round pedestal of pale marble with a gold rim in the centre, a gentle spotlight from above, floating tiny gold sparkles, Saturn's rings visible through a small round window behind. The area above the pedestal (30%–60% from the top) is open and uncluttered for cards to appear later. Warm lavender and rose palette with gold. No people, no characters, no objects on the pedestal. ＋共通の最後 |
| 5 | `saturn-hall-to-sky-transition` | 1152×2048 | 器→広場の移動（カメラが丸窓を抜ける）の中間の絵 | Looking straight up through a huge round window in the domed ceiling of a deformed cute Saturn temple: terracotta rim of the window around the edge of the picture, and beyond it a deep lavender-to-navy evening sky filled with Saturn's broad pastel rings seen from below, glittering ring particles, soft clouds. Dreamy, airy, gentle glow. No planet ball, no people, no characters. ＋共通の最後 |
| 6 | `saturn-ring-sky-map` | 1152×2048 | 三周目の広場の地図（S-8）の空。島はコードで置く | A vast dreamy sky above Saturn in the kororin-style deformed look: Saturn's wide pastel rings sweep diagonally across the whole picture like a road of light made of tiny glittering stones, soft cotton clouds at several depths, a lavender, peach and rose palette with gold sparkles, gentle evening light from the upper right. The middle of the picture is open sky with plenty of empty space for floating islands to be placed later. No planet ball, no islands, no buildings, no people, no characters. ＋共通の最後 |

### 器・石・舞台の部品

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 7 | `saturn-vessel-neo` | 1024×1024 | 自分の器（コロリンが入る大きな器） | One large shallow round ceramic bowl, deformed cute 3D, seen from the front and slightly above so its opening reads as a wide ellipse (about 0.3 of its width tall), filling 90% of the frame width. Glossy pale lavender glaze, a thick polished gold rim, a band of Saturn-ring pattern in rose and gold around the outside, a soft inner shadow, a short round gold foot. Empty inside. Plain flat mid-grey background, no floor, no shadow on the ground. ＋共通の最後 |
| 8 | `saturn-vessel-kimorin` | 1024×1024 | KIMORIN⭐︎の器（3日目に並ぶ） | One large shallow round ceramic bowl, deformed cute 3D, same shape and camera as a wide ellipse opening seen slightly from above, filling 90% of the frame width. Glossy white glaze with soft blue leaf-shaped marks, two small white fox-ear shaped handles with blue inner ears on the rim, a thin gold rim line, a short round foot. Empty inside. Plain flat mid-grey background, no floor, no shadow on the ground. ＋共通の最後 |
| 9 | `saturn-voice-stone` | 1024×1024 | 声を吹きこむ石（ふつう） | One smooth round Saturn stone, about the size of a melon, deformed cute 3D, pastel peach and lilac with a faint glossy ring band around its middle like a tiny planet ring, softly polished, tiny gold flecks. Front view, centred, filling 70% of the frame. Plain flat white background, no floor, no shadow on the ground. ＋共通の最後 |
| 10 | `saturn-voice-stone-lit` | 1024×1024 | 声で灯った石（9 に重ねてにじませる） | Edit the first picture: keep the stone's shape, size, position and camera exactly the same; the stone now glows warmly from inside with soft golden light, its ring band shining, gentle light bloom around it, thin glowing golden crack lines starting to appear on its surface. Plain flat white background. ＋共通の最後 |
| 11 | `saturn-vessel-nameplate` | 1024×1024 | 器の前の真鍮の名札（字はコードで書く） | One small horizontal brass name plate with rounded ends, deformed cute 3D, polished warm gold with a darker engraved border of tiny Saturn rings and stars, the centre area perfectly blank and smooth, a short stand behind it. Front view, centred, filling 80% of the frame width. Plain flat white background, no shadow on the ground. ＋共通の最後 |
| 12 | `saturn-altar-steps` | 1024×1024 | 石が転がり落ちる祭壇の段（背景と別に重ねて、転がる道を見せる） | A low round stone altar with three shallow curved steps leading down towards the viewer, deformed cute 3D, pale lavender marble with gold trim, seen from the front and slightly above. Nothing on top. Plain flat white background, no shadow on the ground. ＋共通の最後 |
| 13 | `saturn-gold-stained-frame` | 1024×1024 | はじいた後に下りてくる小窓のふち（広場の絵を中に表示） | One round decorative window frame, deformed cute 3D: a thick gold ring with soft rose and lavender stained-glass segments around it and a tiny Saturn emblem at the top, the centre a perfectly empty circular hole (fully see-through area to be filled later, painted as flat pure white). Front view, centred, filling 90% of the frame. Plain flat mid-grey background. ＋共通の最後 |

### コロリン（キャラの部品）

> 1枚目に `kororin-style.jpg`（基本のコロリン）を添える。2枚目がある時は、その人物の絵。

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 14 | `kororin-mine-bare` | 1024×1024 | サングラスなしの自分のコロリン（コードでサングラスを落とすため） | A single kororin character in exactly the style of the FIRST attached image (a small squishy takoyaki ball with golden-brown body, takoyaki sauce, white mayonnaise zigzag, aonori and katsuobushi, small black dot eyes, short stubby arms and feet), with NO sunglasses at all and nothing on its forehead, an orange band around its lower body, a calm happy face. Full body, front view, centred, nothing cut off. Plain pure white background, no shadow on the ground, no floor. ＋共通の最後 |
| 15 | `kororin-mine-bare-sing` | 1024×1024 | 14 の歌う顔（口を開けて弾む。サングラスはコード） | A single kororin character exactly like the FIRST attached image, the same takoyaki with an orange band and NO sunglasses, now singing: mouth wide open, eyes happily closed, body squashed a little as if bouncing to a beat, one tiny arm raised, the katsuobushi flakes on top lifted as if dancing. Full body, front view, centred. Plain pure white background, no shadow on the ground. ＋共通の最後 |
| 16 | `round-sunglasses-gold` | 1024×1024 | コードで落とすサングラス（どのコロリンにも使う） | One pair of small round sunglasses with thin polished gold rims and dark glossy lenses with a soft highlight, deformed cute 3D, seen exactly from the front, centred, filling 70% of the frame width, no arms visible from the side. Plain flat white background, no shadow. ＋共通の最後 |
| 17 | `kororin-pick-mic` | 1024×1024 | ピックがマイクに変わる小物（歌う時に手もとに出す） | One takoyaki bamboo pick whose top has turned into a tiny round golden vintage microphone with a fine mesh head, deformed cute 3D, standing upright, centred, filling 60% of the frame height. Plain flat white background, no shadow. ＋共通の最後 |
| 18 | `kororin-design-01` | 1024×1024 | S-2b のデザイン候補（青と金・わくわく） | A single kororin character in exactly the style of the FIRST attached image (squishy takoyaki ball, sauce, mayonnaise zigzag, aonori, katsuobushi, dot eyes, stubby arms and feet). This design: a band of deep blue with gold stars around its lower body, a tiny gold star clip in the katsuobushi, round sunglasses with blue lenses and thin gold rims pushed up on its forehead, an excited sparkling smile. Full body, front view, centred. Plain pure white background, no shadow on the ground. ＋共通の最後 |
| 19 | `kororin-design-02` | 1024×1024 | S-2b の候補（ミントと白・のんびり） | A single kororin character in exactly the style of the FIRST attached image. This design: a soft mint green band with white polka dots around its lower body, a small white flower in the katsuobushi, round sunglasses with pale mint lenses and white rims pushed up on its forehead, a relaxed sleepy-happy smile. Full body, front view, centred. Plain pure white background, no shadow on the ground. ＋共通の最後 |
| 20 | `kororin-design-03` | 1024×1024 | S-2b の候補（ピンクと黒・ストリート） | A single kororin character in exactly the style of the FIRST attached image. This design: a hot pink and black checkered band around its lower body, a tiny black bucket hat perched on the katsuobushi, round sunglasses with pink lenses and black rims pushed up on its forehead, a confident grin. Full body, front view, centred. Plain pure white background, no shadow on the ground. ＋共通の最後 |
| 21 | `kororin-design-04` | 1024×1024 | S-2b の候補（すみれと銀・夜） | A single kororin character in exactly the style of the FIRST attached image. This design: a violet band with silver crescent moons around its lower body, a tiny silver headphone around the top, round sunglasses with smoky violet lenses and silver rims pushed up on its forehead, a gentle cool smile. Full body, front view, centred. Plain pure white background, no shadow on the ground. ＋共通の最後 |
| 22 | `kororin-design-card-back` | 1024×1024 | 4枚の候補の裏面（レコードのラベル風の円盤） | One round disc like a record label, deformed cute 3D, seen exactly from the front: glossy deep navy with a fine gold filigree border, a softly embossed Saturn-with-rings emblem in gold at the centre with a small centre hole, a gentle diagonal highlight. Centred, filling 92% of the frame. Plain flat white background, no shadow. ＋共通の最後 |
| 23 | `bati-pon-touch` | 1024×1024 | {bati}（試作の「ぽん」）が石に触れる | A small cute round purple octopus-like companion creature (soft violet body, big friendly dark eyes with sparkles, a tiny bowl-shaped hat on its head, short wavy tentacles), deformed cute 3D, floating, reaching forward with one tentacle whose tip glows with a tiny golden spark, a focused happy face. Three-quarter view facing right, centred. Plain flat white background, no shadow. ＋共通の最後 |

### かけら・小物・アイコン

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 24 | `aonori-katsuobushi-flakes` | 1024×1024 | 舞うかけら（切り出して使う） | A loose scatter of twelve separate small pieces, not touching each other, evenly spread on the canvas: six curled translucent pinkish-beige katsuobushi bonito flakes of different shapes and six tiny irregular bright green aonori seaweed flakes, deformed cute 3D, crisp edges, each piece clearly isolated with empty space around it. Plain flat mid-grey background, no shadows. ＋共通の最後 |
| 25 | `saturn-nav-plaza` | 1024×1024 | 下のボタン〔🪐 広場〕のアイコン | A tiny cute 3D icon: a round stone stage seen at an angle with a little golden stand microphone in the middle and a small pastel Saturn ring arching above it, deformed rounded shapes, glossy, pastel lavender and gold. Centred, filling 80% of the frame, readable at small size, simple silhouette. Plain flat white background, no shadow. ＋共通の最後 |
| 26 | `saturn-nav-mic-stone` | 1024×1024 | 下のまん中〔🎙〕のアイコン（石とマイク） | A tiny cute 3D icon: a round glossy pastel peach Saturn stone with a small ring band, and in front of it a chunky rounded golden microphone, soft golden glow, deformed rounded shapes. Centred, filling 80% of the frame, simple silhouette readable at small size. Plain flat white background, no shadow. ＋共通の最後 |
| 27 | `saturn-nav-vessel` | 1024×1024 | 下のボタン〔🥣 器〕のアイコン | A tiny cute 3D icon: a shallow lavender ceramic bowl with a gold rim and two tiny takoyaki balls peeking out of it, one wearing tiny round sunglasses on its forehead, deformed rounded shapes, glossy. Centred, filling 80% of the frame, simple silhouette readable at small size. Plain flat white background, no shadow. ＋共通の最後 |
| 28 | `saturn-icon-design-palette` | 1024×1024 | 器の右上〔🎨 デザイン〕のアイコン | A tiny cute 3D icon: a round artist's palette shaped like a takoyaki plate with four small paint dots in blue, mint, pink and violet and a little gold brush resting on it, deformed rounded shapes, glossy. Centred, filling 80% of the frame, simple silhouette. Plain flat white background, no shadow. ＋共通の最後 |

### 空の時・お祝い・二周目以降

| # | ファイル名 | 大きさ | 目的 | プロンプト |
|---|---|---|---|---|
| 29 | `saturn-empty-dachi` | 1024×1024 | ダチの一覧が少ない時の絵（招待状でつながる） | A sealed invitation envelope in deep navy paper with a round gold wax seal embossed with a tiny Saturn, resting on a soft lavender velvet cushion, two small brass name plates with blank faces standing beside it, a few gold sparkles, deformed cute 3D, calm and elegant. Centred, filling 75% of the frame. Plain flat white background, no shadow on the ground. ＋共通の最後 |
| 30 | `saturn-empty-plaza-mic` | 1024×1024 | 広場にだれもいない時の小さな絵（一覧・知らせの中で使う） | A single old-fashioned golden stand microphone standing on a small round stone stage with a gold rim and tiny warm lights, one soft spotlight from above, a few drifting sparkles, deformed cute 3D, quiet and inviting. Centred, filling 70% of the frame. Plain flat white background, no shadow on the ground. ＋共通の最後 |
| 31 | `saturn-first-kororin-badge` | 1024×1024 | はじめてコロリンができた時だけ出す記念の円盤（器のすみに飾れる） | One round commemorative record-label medallion, deformed cute 3D: glossy rose-gold disc with a fine filigree border, at the centre a small embossed takoyaki ball wearing round sunglasses on its forehead, tiny embossed stars around it, a soft diagonal highlight, no writing. Front view, centred, filling 90% of the frame. Plain flat white background, no shadow. ＋共通の最後 |
| 32 | `saturn-plaza-hedge-garden` | 1024×1024 | 二周目の「自分の広場」（垣根のある小さな広場。空の輪に浮かぶ） | A small floating round garden plaza, deformed cute 3D: a pastel cobblestone circle surrounded by a low rounded green hedge with tiny pink flowers, a little gold lantern post and a small arch gate, the underside a soft rounded rock in lavender and peach layers with wisps of cloud. Seen from slightly above, centred, filling 85% of the frame. Empty of people and characters. Plain flat white background. ＋共通の最後 |
| 33 | `plaza-sign-tokens-a` | 1024×1024 | 「ひろばのしるし」の立体の小物（絵文字の置きかえ。3×3に切る） | Nine small separate cute 3D tokens arranged in a neat 3 by 3 grid with generous empty space between them, each the same size, deformed rounded glossy style in pastel colours with gold accents: a tiny Japanese castle, a golden microphone, a music note, a sitting cat, an ocean wave, a stack of books, a paint palette, a snowy mountain, a slice of strawberry cake. Plain flat white background, no shadows, nothing overlapping. ＋共通の最後 |
| 34 | `plaza-sign-tokens-b` | 1024×1024 | 同上（2枚目） | Nine small separate cute 3D tokens arranged in a neat 3 by 3 grid with generous empty space between them, each the same size, deformed rounded glossy style in pastel colours with gold accents: a game controller, a soccer ball, a cherry blossom, a red torii gate, a snowman, a star, a crescent moon, a steaming ramen bowl, a camera. Plain flat white background, no shadows, nothing overlapping. ＋共通の最後 |

**メモ**：
- 試作に必要なのは 1・2・7・9・10・11・12・13・14〜17・23・24（＋既存の `koro-me`・`plaza-stage-a`・`art/review/plaza/kororin-*`）。18〜22・28 はおまけの〔🎨 デザイン〕用。
- 白い四角の背景が出ないよう、コロリン・小物はすべて透明にして WebP で使う（KIMORIN の白い四角＝既報と同じことを繰り返さない）。
- 2枚目以降を「1枚目を直す」形（2・10・15）にすると、位置と形がずれない。
