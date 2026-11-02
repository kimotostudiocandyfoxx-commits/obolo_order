# 月（{bati}に聞く・{bati}の設定）UI 点検 ― アートディレクターの見立て

対象：`origin/claude/solar-system-home-planets-ew766y`（3a6ed26）の `/moon`、2日目の物語（月の神殿・姿づくり）。
見たもの：`planet_shots/moon/*`・`_storysheet/st_moon.jpg`・`s3_moon.jpg`・`_explore/combo/moo_*`、`画面設計/moon.md`・`index.md`（0.10〜0.12）、`decisions_round19.md`（M-R138〜M-R140・M-R147・M-R179）、`MoonView.tsx`・`lib/i18n/ja.ts`、既存の{bati}の絵（`bati-stand-earth.webp`・`bati-stand-sun.webp`・`art/review/saturn/gen-tests/bati-*`＝いちごのふくろうの表情6種）・`moon-bg.jpg`・`moon-temple.jpg`。
すでに報告ずみ（ここでは挙げない）：設定の〔リセット〕が下で切れる／名前が「バティ」で固定。

---

## 1. 総評

- 今の `/moon` は**ふつうのチャットアプリの見た目**：{bati}は「月の丸に `• ᴗ •`」の仮の顔（コードに `PLACEHOLDER (P-MOON-1)`）。でも本物の{bati}の絵（{food}から生まれた、ぷにっとした柔らかい生きもの・表情6種まで試作ずみ）がもうある。**相棒が画面にいない**のが最大の問題。
- 設計とのずれが大きい：入力が文字欄が主（声が主役・⌨はすみに小さく：M-R130）、**「今日 2/30」の回数表示**（数を出さない：M-R116(3)）、性格の**数字つきスライダー**（三つの言葉から選ぶ）、話し方が「今日はどんな一日だった？」の雑談・悩み相談寄り（{bati}は「調べて答える」役：MO-2）、答えの読み上げなし（M-R179）、答えの下の注意の一行なし（M-R111(1)）。
- 画面の上半分に吹き出し、下半分は星と月面だけ。手元（親指の位置）に何もなく、ヘッダーの歯車は背景の地球の絵とかぶって見えにくい。
- 15〜20歳に「本物の相棒」と感じさせるには、**{bati}が大きく画面にいて、表情が変わり、声で返し、調べる時に魔法の演出がある**ことが全部。雑談アプリにせず「何でも一緒に調べてくれる、ちょっと抜けた相棒」の手ざわりにする。

---

## 2. 改善点（効く順）

**1. {bati}の顔 → 仮の月の顔（`BatiFace`）のまま**
- 改善案：`me.bati.imageUrl`（生まれた時の一枚・背景なし）と表情6種（にっこり・きらきら・びっくり・考える・しょんぼり・あくび：index.md 0.10。できるまではふつうの顔）を使う。画面の上 38% を「月の神殿のテラス」の舞台にして、{bati}を**大きく（画面幅の45%）**置く。待機アニメはコードで：呼吸（縦に 1.00→1.03 の伸び縮み 2.8秒）、まばたき（目を閉じた差分 80ms・4〜7秒おき）、ときどき首をかしげる（±4°）、耳・羽などは持っていれば別パーツで揺らす（絵の作り方は立ち絵を動かす依頼と同じ）。小さなアイコン（吹き出しの横）も同じ顔の丸切り抜き。
- 種類：15-20ウケ／世界観／見た目

**2. 表情（ムード）が変わらない**
- 改善案：答えの内容で表情を切りかえる（新しい事実＝きらきら、意外な答え＝びっくり、調べている間＝考える、分からなかった・見つからない＝しょんぼり、夜23時以降の最初の一言＝あくび）。切りかえは 150ms のクロスフェード＋小さく弾む（scale 1.04→1.0）。動画にはしない（M-R138〜140）。
- 種類：15-20ウケ／世界観

**3. 声が主役になっていない（文字欄＋〔送る〕が主）**
- 改善案：下の帯のまん中に大きな丸い〔🎙 話してみよう〕（直径 84px、金の縁）。押すと聞き取り開始、声の大きさで縁の光が波打ち、話した言葉がその場で薄く浮かぶ。もう一度押すと送る。すみに小さく⌨（押すと文字欄が下からせり上がる。はじめて押した時だけ一度「声が出せる場所で、また来てね。ここは、声で作る宇宙です」）。{neo}が話している間は{neo}の大きな立ち絵が左下からすっと出て、話し終わると引く（index.md 0.12）。
- 種類：使いやすさ／機能（決まり）

**4. 答えが声で返らない**
- 改善案：{bati}の吹き出しは字をすぐ出し、{bati}の声が届きしだい読み上げる（M-R179）。読み上げ中は吹き出しの下に細い波形、{bati}の口（口パクの差分2枚）を音の大きさで開け閉め、からだが少し弾む。吹き出しのすみに小さな〔🔊〕で聞き直し。声が届かない時は字だけで進む。音量は BGM を自動で −8dB 下げてから話し始める（急に大きくしない）。
- 種類：機能／15-20ウケ

**5. 「今日 2/30」の回数表示**
- 問題：聞いた回数・残りの回数は出さない（M-R116(3)）。数字は「あと何回」の焦りを生む。
- 改善案：表示を消す。上限に来た時だけ一度〔画面：今日は、たくさん聞いたね。ここからは、1回ごとにマナを使います。使う前に、毎回たずねます〕［使う／今日はここまで］、以後は毎回の小さな確認［使う／やめる］。今のデモの文「今日の無料メッセージを使い切りました」も置きかえる。
- 種類：機能（決まり）／世界観

**6. 「考え中…」の点滅文字だけ**
- 改善案：調べる演出（MO-2 補足）：{bati}が目を閉じ（考える顔）、足もとに光の円がひらき、短い呪文の字幕「〈…〉——ここに、こたえを。」、マナジェムがほのかに光り、光の文字がくるくる回ってほどけて吹き出しになる。0.6〜3秒（答えが届くまで円がゆっくり回り続ける）。数字は出さない。光は脈打つだけで点滅させない。
- 種類：世界観／15-20ウケ

**7. 話し方が雑談・悩み相談寄り**
- 問題：入力欄「バティに話しかけてみよう」、あいさつ「やっほー！バティだよ🌙 今日はどんな一日だった？」。設計は「雑談や悩み相談の場所にしない（親が安心できる形）」「入口は〔💬 バティに聞く〕」。
- 改善案：あいさつ「{neo}、なにか、知りたいこと、ある？」。下に例の札（押すと話した言葉として入る）：「ビッグバンって、いつ起きたの？」「ブラックホールの正体って、なに？」「土星の輪って、何でできてるの？」。ボクっ子の口調と{food}への見立て（「その雲、{food}みたいだね」）で相棒らしさは十分に出せる。体や心の悩みの問いには、答えのあとに「家の人や、信じられる大人にも話してね。」（M-R111(1)）。
- 種類：世界観／分かりやすさ

**8. 答えの下の注意の一行がない**
- 改善案：毎回、吹き出しの下に小さく「{bati}の答えが、まちがっていることもあります。大事なことは、自分でも確かめてね」（M-R111(1)）。目立たせすぎず、でも読める明るさ（コントラスト 4.5:1）。
- 種類：機能（決まり）

**9. 〔🖼 絵で見る〕がない**
- 改善案：答えに写真・図がある時は吹き出しの中に〔🖼 絵で見る〕。押すと額縁つきのカードがひらき（`ask-picture-frame`）、写真の下に出どころの名前を小さく。ウィキメディア・コモンズと NASA の画像から・マナなし（M-R147）。見つからない時は言葉だけ。
- 種類：機能／15-20ウケ

**10. 吹き出しが上に積まれ、下半分が空っぽ（親指の届く所に何もない）**
- 改善案：上 38% を{bati}の舞台、下 62% を会話。新しい吹き出しは**下から**積み、いちばん新しい答えが手元にくる。吹き出しはばねで出る（下から 12px＋scale 0.96→1.0、220ms）。{bati}の吹き出しは月光色の和紙の手ざわり（`bubble-paper-texture`）、{neo}の吹き出しは右寄せで横に{neo}の丸いアイコン（index.md 0.12）。長い答えは1〜3文ずつの吹き出しに分けて順に出す（M-R179）。
- 種類：見た目／使いやすさ

**11. ヘッダー／背景の地球の絵が歯車と「今日 2/30」にかぶる（歯車がほぼ見えない）、右上にマナの数**
- 改善案：背景の地球は舞台の絵の中（{bati}の後ろの空）に移し、ヘッダーとは重ねない。ヘッダーは〔←〕「月」〔📜 前の話〕〔⚙︎〕だけ。`✦ 880 MANA` は出さない（地球の改善9と同じ）。
- 種類：見た目（バグ寄り）

**12. 下の入力欄が画面の下で切れている（`04` で入力欄の下のふちが見えない）**
- 問題：高さ `calc(100svh-56px-…)` の中に DemoBanner を入れているので、帯のぶん下がはみ出す。本番では帯が出ない可能性が高いが、iOS のキーボードを出した時も同じ計算で切れやすい。
- 改善案：外側を `100dvh` の flex にし、帯・ヘッダー・舞台・会話・入力をすべて flex の子にする。キーボードは `visualViewport` の高さに合わせて入力欄を持ち上げる。
- 種類：機能（バグ）

**13. 前の話の一覧・記録の扱いが設計と逆**
- 問題：今は「会話を覚えています🧠」で全履歴を残し、上へさかのぼって読み続けられる。設計は「はじめは〔残さない〕」「〔この話を残す〕を押した話だけ〔📜 前の話〕に」「下へ流し続けない」（M-R119）。
- 改善案：話の下に「この話は、閉じると消えます」＋小さな〔この話を残す〕。左上〔📜 前の話〕で左から巻物がすべり出て、題と日付だけのバナーが縦に並ぶ（数なし）。いちばん上に〔＋ 新しい話〕。バナーの〔⋯〕に〔題を変える〕〔この話を消す〕（長押しは使わない）。
- 種類：機能（決まり）

**14. {bati}の設定／数字つきスライダー3本（元気さ 80・話し方 30・ユーモア 65）**
- 問題：数字・目盛りは出さない、三つの言葉から選ぶ（MO-5）。スライダーは「キャラの調整」っぽく、相棒を道具扱いしてしまう。
- 改善案：一行ずつ大きな札3枚から選ぶ。元気さ〔おだやか〕〔ふつう〕〔元気〕、話し方〔ていねい〕〔ふつう〕〔くだけた〕。札を押すとその場で{bati}が一言試しに喋る（同じ文を三つの調子で。例：おだやか「きょうも、いい月だね」／元気「きょうも、いい月だねっ！」）。声〔{neo}の声を少し高くした声〕〔はじめの声〕。ユーモアの項目はなくす（{bati}の小さな抜けは性格として固定）。記録〔残さない〕〔いつも残す〕。
- 種類：分かりやすさ／15-20ウケ／機能（決まり）

**15. 〔記憶と履歴をリセット〕がブラウザの `confirm()`**
- 問題：OS の素の確認ダイアログが世界観を壊す。言葉も設計は〔記録をぜんぶ消す〕。
- 改善案：シートで「消した記録は、戻せません」〔消す〕〔やめる〕。消す時は{bati}がしょんぼり顔にならないこと（がっかりで引き止めない）。ふつうの顔で「わかった。」。
- 種類：使いやすさ／世界観

**16. デモの返事のずれ（`03`：最初の質問への返事があいさつの繰り返し）**
- 問題：「こんにちは、今日は音楽の話をしよう」→「やっほー！バティだよ🌙 今日はどんなことがあった？」と、あいさつがもう一度出る。壊れて見える。
- 改善案：デモの決まった返事を「聞く」形の例に合わせて作り直す（例：「土星の輪って何でできてるの？」→「氷と、石のかけらが、いっぱい集まってるんだって！ {food}の粉砂糖みたいだね。」＋〔🖼 絵で見る〕）。
- 種類：機能（バグ）

**17. 月の神殿のトップ（MO-1）と水盤（MO-3）が `/moon` にない**
- 問題：`/moon` を開くといきなりチャット。設計は神殿の一枚の絵が目次で〔💬 バティに聞く〕〔🪞 水盤〕〔⚙︎ バティの設定〕。
- 改善案：神殿の絵（`moon-temple-terrace-bg`）の中に{bati}（押す＝聞く）、水盤（押す＝姿を変える）、光の柱（OBOLON）。二つの大きな札〔💬 バティに聞く〕〔🪞 水盤〕。チャットは神殿からカメラが{bati}へ寄る遷移で開く。
- 種類：世界観／分かりやすさ

**18. 〔送る〕ボタン／押せない時と押せる時の差が小さい**
- 改善案：⌨入力の時だけ出る〔送る〕は、空の時は薄い輪郭だけ、字が入ると金色に満ちて少し膨らむ。Enter で送る動きは今のまま（日本語変換中は送らない処理もそのまま）。
- 種類：使いやすさ

**19. 2日目の物語（姿づくり）／下のシートに選択肢が段になって重い**
- 問題：`11`・`12`：例の札（入力欄に見える）、マイク、「もう一度、話してみる」、〔これにする〕、「または、えらぶ」、札8枚、〔もどる〕と縦に7段。何を押せばいいか一目で分からず、上の月の神殿の絵とOBOLONがシートで隠れる。また、まだ話していないのに「もう一度、話してみる」と出る。
- 改善案：シートは3段に：①問い（OBOLON の吹き出し）②まん中の大きな〔🎙〕と、その下に例の文字（「例：しろくま」は入力欄に見えない、ただの小さな字に）③〔おまかせ〕〔パス〕と⌨。動物などの札は⌨を押した時だけ出す（設計どおり）。話す前は「話してみよう」、聞き取りに失敗した時だけ「もう一度、話してみる」。シートの高さを 48% までにして、神殿とOBOLONを見せ続ける。
- 種類：分かりやすさ／見た目

**20. 2日目／水盤が描いている間の待ち**
- 改善案：M-R181 の利用者の動画を流しつつ、水盤の水面に光の波紋をコードで重ね、描き終わった4枚が水面から1枚ずつ浮き上がって2×2に並ぶ（各 250ms ずらし）。決めた一枚は画面いっぱいに「ドーン」（光はゆっくり広がる。白く飛ばさない）。
- 種類：15-20ウケ／世界観

**21. 押した時の音と振動**
- 改善案：〔🎙〕を押す＝低い「ぽわん」＋振動10ms、送る＝水滴の音、{bati}の吹き出し＝小さな「ぷっ」（{bati}の声色に合わせて高め）、調べる演出＝鈴の残響。どれも BGM より下、0.2秒かけて出る。
- 種類：15-20ウケ

**22. 15歳未満の子ども仕様**
- 改善案：画面の見た目は同じにし、調べる・〔🖼 絵で見る〕は子ども向けの安全な検索で（index.md 0.10）。「子ども向けモードです」のような表示はしない（からかいの種にならないように）。
- 種類：機能

---

## 3. 試作プラン（1枚のHTML・canvas・390×844）

### 「{bati}に聞く ― 月のテラスの相棒」

ねらい：月を開くと、相棒が大きく画面にいて、声で聞くと考える顔→魔法の円→答えを声で返す。土星の試作と同じ作り方（舞台は生成した絵、{bati}・円・光・吹き出しはコード、画像は data URI）。

**画面の割り**
- 上 38%：舞台（canvas）。奥→手前：`moon-terrace-sky-bg`（地球の出の空・時刻で3段）→ 星の粒（コード）→ `moon-temple-pillars-fg-back`（奥の柱）→ 光の円（コード）→ ★{bati}（`bati-sample-*`）→ `moon-temple-pillars-fg-front`（手前の柱のふち）→ 光の粒（コード）。
- 下 62%：会話（DOM）。新しい吹き出しが下から。いちばん下に〔🎙〕・すみに⌨。
- ヘッダー：〔←〕月〔📜〕〔⚙︎〕。数字はどこにも出さない。

**動き**
- {bati}の待機：呼吸・まばたき・首かしげ（上の改善1）。指で{bati}をつつくと、ぷにっと潰れて戻り、たまに{food}の見立てを一言（1回の起動で3回まで。必要な時だけ喋る決まりに合わせ、自分から喋り続けない）。
- 〔🎙〕：押すと `getUserMedia` で声の大きさを取り、縁の光を波打たせる（許可がない・使えない時は理由を一行出して、例の札で進む）。試作では聞き取りは例の文で代用。
- 送ったあと：{bati}が考える顔→足もとに `spell-circle-moon` がひらき回転→ `mana-gem-small` がほのかに光る→光の文字（コードで描く小さな光の筋）がほどけて吹き出しになる。
- 答え：1〜3文ずつ吹き出し。表情を内容で切りかえ（試作は答えごとに指定）。読み上げは試作では `speechSynthesis`（ja-JP・高め）で代用し、口パク差分を音の有無で開閉。吹き出しの〔🔊〕で聞き直し。下に注意の一行。
- 〔🖼 絵で見る〕：額縁カード（`ask-picture-frame`）に例の宇宙の写真の代わりの絵（`ask-sample-saturn-rings`）と出どころの小さな字。
- 〔📜 前の話〕：左から巻物（`history-scroll-bg`）。題と日付のバナー、〔＋ 新しい話〕。「この話は、閉じると消えます」〔この話を残す〕。
- 〔⚙︎〕：三つの札×2（元気さ・話し方）と声の二択。札を押すとその調子で{bati}が試しに一言。〔記録をぜんぶ消す〕はシート確認。
- 夜（23時以降の想定ボタン）：最初の一言があくび顔。

**合格条件**
- 回数・残り・マナの数字が一切出ない。光の明滅は1秒2回より遅い。音は0.2秒以上かけて出る、BGM は話す前に下げる。
- 「AI」「プロンプト」の語なし。雑談・悩み相談の誘いなし（悩みの問いには「家の人や、信じられる大人にも話してね。」）。
- 390×844 で入力欄が切れない（`100dvh`＋`visualViewport`）。押せる物は 44px 以上。

---

## 4. 絵の依頼リスト（Seedream）

共通の書き添え：
`Japanese anime fantasy illustration, painterly and richly detailed, cute, soft dreamy moonlight with silver-blue and pearl tones and small warm gold accents, consistent with the attached references (moon-temple.jpg, moon-bg.jpg, bati-stand-earth.webp). Absolutely NO text, NO letters, NO numbers, NO logos, NO user interface, NO frames or borders, NO watermark.`
{bati}のスプライトには `soft matte vinyl-toy / mochi-like 3D cute creature exactly in the style of the attached reference (bati-stand-earth.webp): creamy smooth surface, big glossy brown eyes with star highlights, tiny blush, isolated on a plain flat solid neutral gray background (#808080), no floor, no cast shadow, centered with generous margin` を付ける（試作用のサンプルの{bati}。本番は利用者ごとの{bati}から同じ表情を作る）。

| # | ファイル名 | サイズ | 用途 | プロンプト（英語） |
|---|---|---|---|---|
| 1 | moon-temple-terrace-bg | 1152×2048 | 月の神殿トップ（MO-1） | Vertical background: the Moon temple, a circular terrace of white marble arches and slender columns open to space, the big blue Earth rising in the sky through the central arch, a shallow round silver scrying bowl filled with glowing water on the left, a soft vertical pillar of white light on the right, a cozy round cushion-like dais in the center foreground where a small companion creature will sit, polished reflective floor with moonlight pools. Sacred, calm, gentle. No characters. |
| 2 | moon-terrace-sky-bg | 1152×2048 | {bati}に聞く・舞台の空（夜） | Vertical background for the upper part of a chat screen: the view from a white marble terrace on the Moon, the blue Earth large in the upper right with a soft atmospheric glow, a sea of fine stars and a faint silver nebula, the top of a few white marble columns at the very bottom edge, lots of open sky in the center for a character. No characters. |
| 3 | moon-terrace-sky-dawn | 1152×2048 | 舞台の空（朝） | Same view from the Moon terrace but at lunar dawn: the Earth glowing with a bright day side, pale lavender and peach sky gradient, fewer stars, white marble column tops at the bottom edge, open sky in the center. No characters. |
| 4 | moon-terrace-sky-dusk | 1152×2048 | 舞台の空（夕方） | Same view from the Moon terrace at a golden earthrise: the Earth half-lit with a warm amber rim, rose and indigo sky, first stars twinkling, white marble column tops at the bottom edge, open sky in the center. No characters. |
| 5 | moon-temple-pillars-fg-front | 1024×1024 | 舞台の手前の柱（左右の縁） | A pair of white marble temple column edges and a low balustrade framing the left and right sides only, seen very close as foreground, with silver filigree and soft moonlight, the whole middle is empty, isolated. |
| 6 | moon-surface-fg | 1024×1024 | 舞台の足もとの月面 | A soft curved strip of pearly lunar ground with small gentle craters and sparkling moon dust, as a foreground floor band for a stage, painterly anime style, isolated. |
| 7 | bati-sample-normal | 1024×1024 | 試作用{bati}：ふつう | A small round companion creature shaped like a fluffy melon-bread bun with tiny bunny ears and a crescent-moon mark on the forehead, sitting upright with paws together, calm gentle smile, front view. |
| 8 | bati-sample-smile | 1024×1024 | 試作用{bati}：にっこり | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark, eyes curved shut in a big happy smile, little paws raised, cheeks blushing, front view. |
| 9 | bati-sample-sparkle | 1024×1024 | 試作用{bati}：きらきら | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark, huge shining eyes with star-shaped sparkles, mouth open in excitement, leaning forward, front view. |
| 10 | bati-sample-surprise | 1024×1024 | 試作用{bati}：びっくり | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark, round surprised eyes and a small o-shaped mouth, ears perked straight up, front view. |
| 11 | bati-sample-think | 1024×1024 | 試作用{bati}：考える（調べる） | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark, eyes peacefully closed in concentration, one paw raised as if casting a small spell, a faint glow on the forehead mark, front view. |
| 12 | bati-sample-sad | 1024×1024 | 試作用{bati}：しょんぼり | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark, slightly droopy ears and soft apologetic eyes, a tiny wobbly smile, gentle not tearful, front view. |
| 13 | bati-sample-yawn | 1024×1024 | 試作用{bati}：あくび | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark, a big sleepy yawn with eyes squeezed shut, one paw rubbing an eye, front view. |
| 14 | bati-sample-mouth-open | 1024×1024 | 口パク用（ふつう顔の口だけ開いた差分） | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark in exactly the same pose and framing as the calm normal version, but with the mouth slightly open as if speaking, front view. |
| 15 | bati-sample-eyes-closed | 1024×1024 | まばたき用差分 | The same melon-bread bun bunny companion creature with a crescent-moon forehead mark in exactly the same pose and framing as the calm normal version, but with both eyes gently closed in a blink, front view. |
| 16 | spell-circle-moon | 1024×1024 | 調べる時の光の円（加算・回転） | A flat top-down magic circle made of fine silver-blue light lines: concentric rings, crescent moons, small stars and abstract rune-like ornaments (not real letters), delicate and elegant, on a pure black background for additive blending. |
| 17 | light-motes-moon | 1024×1024 | 漂う光の粒（加算） | Scattered soft round light motes and tiny four-point star sparkles in silver and pale gold, various sizes, evenly spread, on a pure black background for additive blending. |
| 18 | bubble-paper-texture | 1024×1024 | {bati}の吹き出しの地（和紙） | Seamless tileable texture of soft moonlit washi paper: pearly off-white with very subtle fibers and faint silver flecks, gentle and light, flat even lighting. |
| 19 | ask-picture-frame | 1024×1024 | 〔🖼 絵で見る〕の額縁 | An ornate rectangular picture frame in brushed silver with small crescent and star ornaments at the corners, slightly glowing, the inside completely empty, front view, isolated. |
| 20 | ask-sample-saturn-rings | 1024×1024 | 試作用の「絵で見る」の中身 | A close-up painterly view of Saturn's rings showing countless chunks of ice and rock catching sunlight, the planet's golden curve in the background, educational and beautiful, anime-realistic. |
| 21 | history-scroll-bg | 1152×2048 | 〔📜 前の話〕の巻物の地 | Vertical background: a long unrolled antique parchment scroll glowing softly under moonlight, silver-blue edges with crescent ornaments, blank surface with gentle aged texture, wooden scroll rods at the top and bottom. No writing. |
| 22 | scrying-bowl-sprite | 1024×1024 | 神殿の水盤（押せる物） | A shallow round silver scrying bowl on a short marble pedestal, filled with luminous blue water reflecting stars, soft ripples, faint mist rising, three-quarter view. |
| 23 | light-pillar-obolon | 1024×1024 | 神殿の光の柱（加算） | A tall soft vertical pillar of white-gold light rising from a round floor glow, gentle drifting particles inside, calm and sacred, on a pure black background for additive blending. |
| 24 | mic-button-emblem | 1024×1024 | 〔🎙〕の丸ボタンの地 | A round glossy emblem button made of dark midnight glass with a thin glowing gold rim and a soft inner crescent-moon reflection, an empty center for an icon drawn later, front view. |
| 25 | moon-sleep-cushion | 1024×1024 | 夜・あくびの時の小道具 | A tiny round crescent-moon-shaped cushion in pale yellow velvet with a little star tassel, soft and squishy, three-quarter view. |
</content>
</invoke>
