# 太陽（8日目の物語・/eclipse の支払いの最終確認）UI 点検 ― アートディレクターの見立て

対象：`origin/claude/solar-system-home-planets-ew766y`（3a6ed26）の8日目（`lib/onboarding/day8.ts`）、`/eclipse`（住人の再開）、`EclipseGuide.tsx`・`EclipsePay.tsx`。
見たもの：`planet_shots/sun/*`・`_storysheet/s2_sun.jpg`（8日目の通し）・`st_sun.jpg`（`day=7` で開いた金星の流れ。参考）、台本 `wip/P04/c02.md`・`c03.md`（D08-S007〜S011b）、`画面設計/earth.md`（§2 の8日目・E-11）・`index.md`（0.2・2.1〜2.3）、`decisions_round19.md`（M-R124・M-R126・M-R180）、既存の絵（`sun-temple.jpg`・`s/sun-inside.jpg`・`s/monban-screen.jpg`・`obolon.webp`・`s/rocket-sun.jpg`・`bati-stand-sun.webp`・`kimorin-sun*.webp`）。
すでに報告ずみ（ここでは挙げない）：太陽でキャラクターが重なる／チェックを入れる前は支払いのボタンが見えない。

---

## 1. 総評

- 8日目は物語の山場（謎2「全員、DJ」→記録 I→二択→エクリプス）なのに、**太陽の神殿そのものの絵がない**（`sun-temple.jpg` は橙の地に神殿のアイコンだけの仮の絵）。ほぼ全場面が「黒い丸＋金色のもや＋下の吹き出し」で、儀式の重みが出ていない。
- **白一色の画面（`whiteout`）**が2か所。暗いフィルムの直後にいきなり真っ白になるのは、目に強く、光に弱い人には危ない。「急に光らせない」（M-R180・土星 M-R153 の決まり）に当たると判断する。ゆっくり温かい白へ、に直す。
- 支払いの最終確認は、値段・更新日・自動で続くこと・やめ方・年齢がそろっていて**土台はよい**。足りないのは：①法律上の最終確認画面として要る項目（いつObolo Orderになるか＝引き渡しの時期、支払い方法、返金・取り消しの扱い、規約と特定商取引法の表記へのリンク）②書いてある「やめ方」の画面が**まだアプリにない**③年齢のチェックが「18歳以上」と「保護者の同意あり」を1つの□にまとめている④〔戻る〕だけが小さな下線の字で、断る道が弱く見える。
- 見た目は「金と黒の儀式」で方向は合っている。上の MONBAN の四角い絵を見出しの後ろに敷いているので字が読みにくい。**日食の冠（コロナ）を主役にした専用の絵**と、Stripe の白い枠を儀式の色に合わせることで、厳かで、しかも読みやすくできる。

---

## 2. 改善点（効く順）

**1. 白一色の画面（`13-story-whiteout-monban`、`day8.ts` の `{ t: 'whiteout' }` 2か所）**
- 問題：黒いフィルム（記録 I）・暗い窓の直後に、画面全体が一瞬で `#FFF` になる。暗い部屋でスマホを見ている15〜20歳には眩しく、光過敏の人には発作の引き金になりうる。さらに白地に MONBAN の四角い絵だけが浮き、壊れたページに見える。
- 判断：**決まり違反として直す**（急に光らせない・急に音を大きくしない）。
- 改善案：①明るさは 1.8〜2.5秒かけて上げる（ease-in。最初の 0.6秒はほとんど変えない）②色は真っ白でなく温かい象牙色（`#F3E6C8` 前後・明るさ 80% 以下）を上限に、中心から光が満ちる放射のグラデーション③同時に音は 1.5秒のクロスフェード（BGM `bgm-sun` は −6dB から入る）④「視差効果を減らす」設定の人は 0.6秒のクロスフェードで琥珀色まで⑤白の上に人物を出す時は「Bluena のスクリーン」の枠に入れる（改善2）。点滅は1秒2回より遅く、白→黒→白の往復はしない。
- 種類：機能（安全）／見た目

**2. MONBAN の出方／四角い絵がそのまま貼られている**
- 問題：台本は「Bluena が光り、正方形のスクリーンに、門の前の MONBAN」（D08-S003・S010b）。今は細い青い線で囲んだだけの四角い写真で、スクリーン（遠くの門とつながった画面）に見えない。
- 改善案：Bluena から光の線がのびて空中に**ホログラムの額**（金の飾り縁・薄い走査線・ゆらぎ、`bluena-holo-frame`）がひらき（420ms、縦に開く）、その中に MONBAN（`monban-screen-bust`）。消える時は横線に縮んで消える（ブラウン管の終わりの形・光らせない）。
- 種類：世界観／見た目

**3. 太陽の神殿の絵がない（`sun-temple.jpg` が仮のアイコン絵）**
- 問題：台本「上も下もない、あたたかい白い光の世界。足もとに水面のような光。遠くで大きな光の玉が回る。光の中に白い柱が輪になってかすむ」（D08-S007）。三周目 L3-SUN-S003 でも同じ場所に戻るので、一枚の主役の絵が要る。
- 改善案：`sun-temple-bg`（白い柱の輪・光の水面・遠い光の玉）を描き、光の玉はコードでゆっくり回す（`sun-orb-core`＋`sun-orb-corona` を逆回転）、水面の反射は横にゆらす。OBOLON はこの光の玉の手前に浮く。
- 種類：世界観／見た目

**4. 二択（〔エクリプスを受ける〕〔今は、住人のままでいる〕）が吹き出しと同じ形で、選ぶ重さと中身が伝わらない**
- 問題：`03-eclipse-step024`：MONBAN の吹き出し・「戻るか…」・二つの選択肢が同じ紫の吹き出しの形で右に寄り、会話の続きに見える。どちらを選ぶと何がどうなるかが画面にない。
- 改善案：会話が終わったら、下から**二枚の同じ大きさの札**が並んで上がる（どちらかを大きく・光らせることはしない＝誘導しない）。
  - 〔🌑 エクリプスを受ける〕の下に小さく「月額88円・毎月88マナ・天王星と海王星・二周目の旅」
  - 〔🏠 今は、住人のままでいる〕の下に小さく「無料・作ったもの・届けること・金星のDJ・声のコロリンはずっと使える」
  - 札は同じ金の細縁・同じ明るさ。押した札だけがゆっくり光り、もう一方は静かに引く。
- 種類：分かりやすさ／機能（公正さ）

**5. 支払いの最終確認／法律上の最終確認画面として足りない項目**
- 問題：特定商取引法の最終確認画面（2022年の改正）で求められる表示のうち、**引き渡しの時期**（いつ Obolo Order になり、いつマナが湧くか）、**支払い方法**、**申し込みの取り消し・返金の扱い**が書かれていない。規約・特商法の表記・個人情報の扱いへのリンクもない。
- 改善案（文は運営・法務の確認が前提）：今の四つの欄（値段・更新日・自動で続く・やめ方）の下に三つ足す。
  - 「いつから：支払いが終わると、すぐに Obolo Order になり、88マナが湧きます。次からは毎月の更新日に湧きます」
  - 「払い方：クレジットカードなど（次の画面で選びます）」
  - 「取り消し：〈運営が決める文：デジタルのため、支払い後の返金の扱い〉」
  - いちばん下に小さく〔利用規約〕〔特定商取引法にもとづく表記〕〔個人情報の扱い〕（押すと同じ画面の上にシートで開き、閉じると元の位置に戻る）。
  - 支払いが終わったら「受け取りの画面」（金額・日付・次の更新日・やめ方）を出し、同じ内容をメールでも送る。
- 種類：機能（法務・必須）／分かりやすさ

**6. 書いてある「やめ方」の画面が、まだない**
- 問題：「〔設定〕→〔毎月のマナ〕→〔やめる〕から、いつでも」と書いているのに、アプリにその画面がない（`EclipsePay.tsx` の注記 P-BILL-4：運営が Stripe で止める）。約束と実物のずれ。
- 改善案：地球の〔⚙︎ 設定〕→〔毎月のマナ〕→〔やめる〕を公開までに作る（地球の改善23）。最終確認の「やめ方」の欄には〔やめ方を見る〕を置き、押すと三つの画面の小さな見本を順に見せる（実際にやめる画面と同じ絵）。
- 種類：機能（法務・必須）

**7. 年齢の確認／□一つに「18歳以上」と「18歳未満で家の人の同意あり」がまとまっている**
- 問題：どちらの人も同じ□を押すので、未成年が保護者の同意の手順を飛ばしやすい。1日目に生まれた年を聞いている（M-R150）のに使っていない。
- 改善案：生まれた年から出す。18歳以上の人には「18歳以上です」の□だけ。18歳未満の人には「家の人と一緒に読みました。家の人が、支払いに同意しています」の□と〔家の人に見せる画面〕（値段・自動で続くこと・やめ方を大きな字で一枚にまとめた画面）。15歳未満も同じ形（子ども仕様でもエクリプスは受けられる）。どの人にも、□を入れると下に支払いの欄がひらくことを、□の前から一行で知らせる（「チェックを入れると、支払いの欄がひらきます」）。
- 種類：機能（法務）／分かりやすさ

**8. 〔戻る〕が小さな下線の字だけ（エラーの時は2つ出る）**
- 問題：断る道は進む道と同じくらい分かりやすくするのが公正（暗い仕掛けにしない）。今は〔支払う〕が大きな金のボタン、〔戻る〕は薄い下線の字。エラーの時は〔戻る〕が2つ並ぶ。
- 改善案：〔戻る〕は「金の細縁の、背の低いボタン」にして支払いの下に常に一つだけ。文言は〔今は、やめておく（二択にもどる）〕。エラーの時の重複を消す。
- 種類：使いやすさ／機能（公正さ）

**9. 支払いのボタンの文言／〔支払う〕だけ**
- 改善案：〔月額88円で、エクリプスを受ける〕。押した後の待ちは「秘密ロケットの手配中……」の世界観の字のままでよいが、同時に「支払いを確かめています。この画面を閉じないでください」を一行。
- 種類：分かりやすさ

**10. 支払いの画面の上の絵／MONBAN の絵の上に「ECLIPSE」「エクリプス」の字が重なって読みにくい**
- 改善案：上の絵を**日食の冠だけの専用の絵**（`eclipse-corona-hero`：黒い円盤と金の冠・細い光の筋・まわりは暗く静か）に替え、字の後ろは暗い余白にする。冠は 28秒で1周のゆっくりした回転（今のコードのまま）。
- 種類：見た目

**11. Stripe の白い支払い枠が儀式の色から浮く**
- 改善案：Stripe の見た目の設定（Appearance）で、暗い地・金のアクセント・角の丸み・字の色を合わせる（Stripe 側でできる範囲で）。枠のまわりに金の細縁と「支払いの欄」の小見出し。ここだけは装飾を減らし、読みやすさを優先。
- 種類：見た目

**12. 更新日の書き方／29〜31日に支払った人**
- 問題：`毎月{renewDay}日` をそのまま出すので、31日に払った人は「毎月31日」。31日のない月の扱いが書かれていない。また日付は端末の時計から計算している。
- 改善案：29〜31日の人には「毎月31日（31日のない月は、その月の最後の日）」。日付はサーバーの日時（支払いの記録と同じもの）から出す。
- 種類：機能（バグ寄り）／分かりやすさ

**13. 支払いが終わった時の光（`coronaFlare`）**
- 問題：`box-shadow: 0 0 60px 30px rgba(255,214,140,0.9)` の輪が1.6秒で画面いっぱいに広がる。暗い画面での急な明るさの上昇になりうる。
- 改善案：明るさの上限を 60% に、2.4秒かけて広げ、ピークで止めずにそのまま物語のエクリプス（D08-S011）の金の輪へつなぐ。音も同時に 1.5秒で入る。
- 種類：機能（安全）／見た目

**14. エクリプスの儀式（D08-S011）が「黒い丸」の静止画のまま**
- 改善案：コードで演出する：OBOLON の黒い球が遠くの光の玉の前へ 6秒かけて動く→重なると光が隠れて金の輪だけ残る（`sun-orb-corona` を残して `sun-orb-core` を消す）→輪から光の粒が雪のように 8秒降る（`light-snow-gold`。{neo}・{bati}・KIMORIN・ピンポンくんに）→{neo}の胸に小さな光の泉が灯る→「Obolo Orderになった」のテロップ→**メンバーカードに金の封蝋が押される**（地球の試作とつなぐ）。音楽は静かに始まり、30秒かけて大きくなる（急に上げない）。
- 種類：15-20ウケ／世界観

**15. 金の切符の星図（D08-S003 の入り）が絵として出ていない**
- 改善案：二択の前に、切符の裏の星図を画面いっぱいに：金の線が土星→木星→水星→火星→金星→太陽へ順に灯り（各 300ms）、天王星・海王星は錠の印でうっすら。8日間の旅を一目で振り返れる「見返り」の一枚。
- 種類：世界観／分かりやすさ

**16. `/eclipse`（住人の再開）の入口／黒い画面に「続きから」だけ**
- 改善案：神殿の絵がうっすら見える中に光の玉、「、、、来たか。」の OBOLON から自然に始まる。音を出せない人のために「音を出してお楽しみください」は字幕の切りかえと並べる。
- 種類：見た目

**17. 地図から太陽の神殿へ戻る道が「錠の星を押した時」だけ**
- 改善案：地球の改善8：宇宙の地図の左上に、全員に同じ絵で遠い太陽の光。住人は押すと二択へ、Obolo Order は記録映像の見直しへ。全員に同じ絵なので押し売りにならない。
- 種類：分かりやすさ

**18. 記録映像（記録 I・II・III）の音と止め方**
- 改善案：映写機のカタカタ音は −12dB から入れ、映像の頭で BGM を 1秒かけて下げる。〔スキップ〕は台本どおり右下に常に（スキップしても謎4の開封は出す）。字幕を出せる設定。フィルムの最後の「白くなる」は改善1と同じ温かい色への 2秒の変化に。
- 種類：機能（安全）／使いやすさ

**19. 「ECLIPSE」「エクリプス」「支払いの最終確認」の三段の見出し**
- 改善案：見出しは「エクリプス」と小さく「支払いの最終確認」の二段に。英字の「ECLIPSE」は冠の絵の中の飾りにまかせる（字としては出さない）。
- 種類：見た目

**20. 住人の EclipseGuide（MONBAN の一行のシート）**
- 改善案：今の形（〔太陽の神殿へ〕〔今はいい〕・押した時だけ）は決まりどおりでよい。見た目だけ、シートの上に小さな Bluena のスクリーンの額（改善2）を置き、MONBAN の顔をそこに出す。〔今はいい〕を〔太陽の神殿へ〕と同じ大きさの細縁ボタンに（公正さ）。
- 種類：世界観／機能（公正さ）

---

## 3. 試作プラン（1枚のHTML・canvas・390×844）

### 「太陽の神殿 ― 二択から、エクリプスまで」

ねらい：厳かで、しかも誰が見ても中身が分かる「入会の儀式」。光の安全（急に白くしない）を守ったまま、金の冠と光の雪で最高の見せ場にする。土星の試作と同じ作り方（舞台は生成した絵、光の玉・冠・粒・ホログラム・カードはコード、画像は data URI）。

**流れ（右上の⋯で場面へ飛べる）**
1. **到着**：`rocket-window-sun-bg` の丸窓→光が満ちる（2.2秒・象牙色まで、改善1の曲線）→ `sun-temple-bg`。テロップ「太陽の中に入った」。
2. **星図**：`ticket-starmap-bg` の上で金の線が星から星へ灯る（コードの線）。
3. **MONBAN**：Bluena（`bluena-device`）から光の線→ホログラムの額（`bluena-holo-frame`）がひらき `monban-screen-bust`。吹き出し「……エクリプスを受けなくても、お前は、住人のままだ…。それも、道だ…。」。
4. **二択**：同じ大きさの札2枚（`choice-card-eclipse`・`choice-card-home` の絵を札の左に）。各札の下に一行の中身。
5. **最終確認**（〔エクリプスを受ける〕の時）：`eclipse-corona-hero` の下に確認の巻物（`confirm-scroll-frame`）。欄：値段／毎月の更新日／自動で続きます／やめ方〔やめ方を見る〕／いつから／払い方／取り消し。年齢は生まれた年のデモ切りかえ（18歳以上／18歳未満）で□の文言が変わる。□の前から「チェックを入れると、支払いの欄がひらきます」。□で支払いの欄がひらき（試作はデモの欄）、〔月額88円で、エクリプスを受ける〕と同じ並びに〔今は、やめておく（二択にもどる）〕。下にリンク3つ（押すとシート）。
6. **エクリプス**：OBOLON（`obolon-sphere-hd`）が光の玉の前へ→金の輪（`sun-orb-corona`）→光の雪（`light-snow-gold` をコードで数百粒に）→{neo}（`neo-sample-stand`）の胸に光の泉（`chest-light-spring`）→テロップ→メンバーカード（`member-card-frame-front`）に金の封蝋（`seal-order-gold`）が落ちて「どん」。
7. **住人のまま**（〔今は、住人のままでいる〕の時）：MONBAN「……いつでも、来い…。」→ロケットの窓に五つの星の金の線→二つの〔画面〕の一行→〔宇宙の地図へ〕。がっかりした顔・引き止めの言葉は出さない。

**光と音の決まり（合格条件）**
- 画面全体の明るさの変化は、1秒あたり 40% 以下。上限は象牙色（明るさ 80%）。白→黒→白の往復なし。点滅は1秒2回より遅い。
- 音は 0.2秒以上（場面の切りかえは 1.5秒）かけて出る。台詞の前に BGM を下げる。
- 断る道（〔今は、住人のままでいる〕〔今は、やめておく〕）は進む道と同じ大きさ・同じ明るさ。
- 値段・更新日・自動で続く・やめ方・いつから・払い方・取り消し・年齢・リンクが、スクロールしても一画面の流れで全部読める。390×844 で切れない。
- 画面に人気の数・残り時間は出ない。「AI」「プロンプト」の語なし。OBOLON は「、、、」、MONBAN は「…」の話し方。住人は冗談を言わない（笑いは KIMORIN だけ）。

---

## 4. 絵の依頼リスト（Seedream）

共通の書き添え：
`Japanese anime fantasy illustration, painterly and richly detailed, semi-realistic, sacred and ceremonial mood, warm ivory-white and deep gold light with black accents, soft bloom but never harsh glare, consistent with the attached references (sun-inside.jpg, monban-screen.jpg, obolon.webp, rocket-sun.jpg). Absolutely NO text, NO letters, NO numbers, NO logos, NO user interface, NO frames or borders, NO watermark.`
スプライトは `isolated on a plain flat solid neutral gray background (#808080), no floor, no cast shadow, centered with generous margin`、光の効果は `on a pure black background for additive blending`。

| # | ファイル名 | サイズ | 用途 | プロンプト（英語） |
|---|---|---|---|---|
| 1 | sun-temple-bg | 1152×2048 | 太陽の神殿（主役の背景） | Vertical background: the Sun Temple inside the sun, a boundless world of warm ivory-white and soft gold light with no visible sky or horizon, a ring of tall slender white marble columns standing in a wide circle and fading into luminous haze, a calm mirror-like floor of liquid light with gentle ripples reflecting the columns, a huge softly glowing orb of light far away in the upper center, delicate golden dust floating. Peaceful, sacred, overwhelming in scale but gentle on the eyes, mid-tones kept soft, no pure white areas. No characters. |
| 2 | sun-temple-bg-dim | 1152×2048 | 神殿・エクリプスの後（暗め） | The same Sun Temple composition during a total eclipse: the light dimmed to deep amber and bronze, the far orb replaced by a black disc with a thin brilliant golden corona ring, the white columns catching rim light from the corona, the liquid-light floor reflecting golden sparkles, solemn and beautiful. No characters. |
| 3 | sun-orb-core | 1024×1024 | 遠い光の玉の芯（加算・回転） | A large soft glowing orb of warm white-gold light with gentle swirling plasma patterns on its surface, smooth falloff at the edges, calm not blinding, on a pure black background for additive blending. |
| 4 | sun-orb-corona | 1024×1024 | 日食の金の冠（加算・回転） | A total solar eclipse corona ring: a perfectly black empty circle in the center surrounded by a brilliant thin golden ring and delicate streaming corona filaments radiating outward, elegant and symmetrical, on a pure black background for additive blending. |
| 5 | eclipse-corona-hero | 1152×2048 | 支払いの画面の上の絵 | Vertical background for a ceremonial confirmation screen: a solemn total solar eclipse in the upper quarter, black disc with a radiant golden corona and fine light filaments, faint concentric golden astrolabe rings behind it, everything below the upper third fading smoothly into a calm, dark umber-to-black gradient with very subtle gold dust, leaving a large clean dark area for reading. No characters, no figures. |
| 6 | rocket-window-sun-bg | 1152×2048 | 到着：ロケットの丸窓 | Vertical background: inside a brass retro rocket cabin looking out of a large round porthole at the surface of the sun filling the window, slow rolling golden flames and plasma arcs, warm light spilling onto riveted brass walls and a cushioned seat edge at the bottom, glowing but not overexposed. No characters. |
| 7 | ticket-starmap-bg | 1152×2048 | 金の切符の裏の星図 | Vertical background: the back of an antique golden ticket filling the frame, aged gold-leaf paper with a hand-engraved star chart: small round planet pictograms for the Moon, Saturn with rings, Jupiter, an ocean planet, Mars, Venus and a sun, connected by faint empty dotted paths, plus two small planets marked with tiny engraved padlock seals at the edge, fine filigree border pattern inside the paper, soft warm light. No writing. |
| 8 | bluena-device | 1024×1024 | Bluena（スクリーンを出す小さな機械） | A small floating magical device like a polished sapphire-blue crystal orb set in an ornate gold ring cradle, with a soft blue light glowing from inside, three-quarter view. |
| 9 | bluena-holo-frame | 1024×1024 | 空中のスクリーンの額 | A floating square holographic screen frame made of thin glowing gold filigree lines and translucent blue-gold light panels, faint horizontal scanlines, small ornamental corners with eclipse motifs, the inside completely empty and dark, front view, on a pure black background for additive blending. |
| 10 | monban-screen-bust | 1024×1024 | スクリーンの中の MONBAN | Bust portrait of MONBAN, the hooded gatekeeper of a secret society, exactly as in the attached reference (monban-screen.jpg): a deep black hooded robe with fine gold embroidery, the face hidden in shadow except for a single glowing amber eye, a dark cloth covering the lower face, a large golden geometric seven-pointed star halo of light lines behind the head, standing before a dark gate with golden runes (abstract, not letters), solemn and still. |
| 11 | obolon-sphere-hd | 1024×1024 | OBOLON（高精細） | OBOLON exactly as in the attached reference (obolon.webp): a perfectly round matte black sphere with two thin curved closed-eye lines in soft white like a peaceful smile, a gentle warm golden rim glow around its edge, floating, calm and kind, front view. |
| 12 | obolon-sphere-eclipse | 1024×1024 | OBOLON（光の玉に重なった時） | The same round matte black sphere with peaceful closed-eye curves, now backlit by a brilliant golden eclipse corona ring with streaming filaments around its silhouette, solemn and beautiful, front view. |
| 13 | light-snow-gold | 1024×1024 | 降る光の雪（粒を切り出す） | A sheet of many separate soft glowing light flakes in warm gold and ivory, each a little six-armed snowflake-like sparkle or round bokeh mote of different sizes, evenly spaced with clear gaps between them, on a pure black background for additive blending. |
| 14 | chest-light-spring | 1024×1024 | 胸に灯る光の泉 | A tiny spring of warm golden light welling up like a small fountain from a single point, soft droplets of light rising and falling, gentle and heartwarming, on a pure black background for additive blending. |
| 15 | choice-card-eclipse | 1024×1024 | 二択の札の絵：エクリプスを受ける | A small ornate emblem: a black sun disc with a golden corona ring inside a round gold frame with fine filigree, glowing softly, front view, icon-like but painterly. |
| 16 | choice-card-home | 1024×1024 | 二択の札の絵：住人のままでいる | A small ornate emblem: a cozy tiny planet with a little glowing round-window house on top and a crescent moon beside it, inside a round gold frame with fine filigree, warm and welcoming, front view, icon-like but painterly. Same frame design as a matching eclipse emblem. |
| 17 | confirm-scroll-frame | 1152×2048 | 最終確認の巻物の地 | Vertical background: a long unrolled ceremonial scroll of dark umber parchment with a thin gold leaf border and tiny eclipse ornaments at the corners, gently glowing edges, large calm blank reading area with very subtle paper texture, high readability for light text placed later. No writing. |
| 18 | eclipse-seal-emblem | 1024×1024 | Obolo Order の紋章（字なし） | An emblem of a secret society: a solar eclipse disc surrounded by a ring of eight small stars and a delicate compass-rose of gold lines, engraved in polished gold on black enamel, symmetrical, no letters. |
| 19 | warm-ivory-bloom | 1024×1024 | 白くなる場面の代わりの光（加算） | A soft radial bloom of warm ivory and pale gold light, brightest in the center and fading smoothly to black at the edges, no hard core, no rays, on a pure black background for additive blending. |
| 20 | film-grain-overlay | 1024×1024 | 記録映像のフィルムの傷と粒 | Seamless tileable old film overlay: fine film grain, faint vertical scratches, a few dust specks and a subtle vignette, gray tones on pure black so it can be blended in screen mode. |
| 21 | sun-resident-return-bg | 1152×2048 | /eclipse 入口（住人の再開） | Vertical background: the Sun Temple seen from far away through soft golden haze, the ring of white columns small in the distance, a gentle glowing orb above, a calm path of liquid light leading from the bottom of the frame toward the temple, welcoming and quiet. No characters. |
| 22 | rocket-window-five-stars | 1152×2048 | 住人のまま帰る時の窓 | Vertical background: the round porthole of a brass retro rocket looking back at space, five small planets (Saturn with rings, Jupiter, a blue ocean planet, red Mars and golden Venus) connected by a softly glowing golden thread line, the warm sun receding behind, peaceful farewell mood. No characters. |
| 23 | kimorin-sun-arms-crossed | 1024×1024 | 二択の時の KIMORIN（腕を組んで黙る） | KIMORIN, a white fox-like character: a round white face with three blue leaf marks on the forehead (the middle one longest), small round black sunglasses covering the eyes, blue swirl marks on both cheeks, a tiny cat-like omega mouth, white furry ears with blue insides, wearing a deep red hooded robe with white feathered trim and a blue gem clasp, arms crossed and standing silently with a thoughtful serious posture, full body, consistent with the attached reference (kimorin-sun.webp). |
</content>
</invoke>
