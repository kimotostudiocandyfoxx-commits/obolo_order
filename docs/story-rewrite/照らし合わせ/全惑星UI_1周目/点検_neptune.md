# 海王星（ゲームストア → 深海の都『ナガレを越えて』）プレイ画面の点検と改善案

- 対象：`origin/claude/solar-system-home-planets-ew766y`（撮影 3a6ed26）の `/neptune`（`NeptuneView.tsx`、`lib/samples.ts` の `GAMES`）。
- 見たもの：`planet_shots/neptune/`（01〜06）、`画面設計/neptune.md`（第21稿）、`wip/P09/c02.md`（L2-NEPTUNE-S001〜S003）、`decisions_round19.md` M-R160〜M-R164、既存の絵 `onboarding/s/neptune-town.jpg`・`neptune-islands.jpg`（旧設定の浮き島）。
- 報告済みなので**ここでは数えない**：どのボタンも「準備中」。

---

## 1. 総評

- 今の `/neptune` は、昔の「HTML5ゲームストア」の見た目だけの見本です。月の絵文字の大きなカード・★評価・遊んだ数（「★4.8・12万」）・マナの値段・「開発者に92%」が並んでいます。**人気の数と評価は、アプリ全体の「数で人をはからない」決まり（index 2.2）に反します**。中身が空のうえに、決まりにも反している状態です。
- 第21稿の設計では、海王星は**深海の都**です。潜水艇で潜り、灯りの入った巻き貝の館で『ナガレを越えて』（{neo}を二頭身にした主人公のリズムアクション＋すごろくの地図）を遊びます。結果は「クリア」だけで、ゲームはコードと用意した絵で作ります（M-R160：遊ぶたびの生成費用なし）。**店ではなく、一本の本物のゲームを置く星**です。
- 結論：ストアの画面はすぐに外します（少なくとも★と遊んだ数は今日消す）。そのかわりに、**『ナガレを越えて』体験版の木星ステージ（自分の蝶に乗って、字の石が飛ぶ谷を越える）**を、一枚の canvas で本当に遊べる形で作ります。片手のタップだけ・失敗はすぐ手前からやり直し・ダチの小さな姿が旗を振るゴール、という作りで、15〜20歳が「ちゃんとゲームだ」と感じ、しかも決まり（点数・順位・ライフなし）を守れます。

---

## 2. 改善点（効く順）

| # | 画面/場所 | 問題 | 改善案（具体） | 種類 |
|---|---|---|---|---|
| 1 | ゲームの一覧（01・03・06） | 「★ 4.8 · 12万」「★ 4.5」などの評価と遊んだ数が出ている。index 2.2（人気の数・☆・再生・順位は出さない）と neptune.md §5（評価・遊んだ数・★は出さない）に反する | **今すぐ** `NeptuneView` から `rating`・`plays`・`compact()` の表示を消す。すぐに作り直せない場合も、数だけは先に外す | 世界観/安全 |
| 2 | 画面の考え方全体 | 「開発者の取り分92%」「✦120」「無料」の店。第21稿では店も、ゲームを作る機能もない（M-R160〜M-R164） | N-1〜N-5 に置きかえる：潜水艇の窓から見る深海の都→巻き貝の館→すごろくの地図→ステージ→クリア。値段・取り分・開発者名・一覧はなくす | 機能/世界観 |
| 3 | N-1 深海の都（トップ） | 画面がない | 潜水艇の丸窓の枠の中に、深海の都の一枚絵。真ん中の巻き貝の館だけ、入口のネオンがしっかり灯る。まわりの5〜7館はネオンがゆっくり光ったり消えたり（2秒以上の周期）。巻き貝をタップすると、潜水艇が寄って泡が上る（0.8秒）。灯りのない館をタップすると「この館には、まだ灯りが入っていません」の一行と、館の窓が一瞬だけふっと灯る（期待させるが、日付は約束しない） | 世界観/15-20ウケ |
| 4 | N-2 らせんの通路 | 画面がない | 巻き貝の中をらせんに下りる短い移り変わり（1.2秒・タップで飛ばせる）。いちばん奥の丸い部屋の壁いっぱいの大きな画面に、地図が灯る | 世界観 |
| 5 | N-3 すごろくの地図 | 画面がない | 6マス（土星→木星→水星→火星→天王星→金星）と先の小さな舞台。灰色の嵐が地図の上をゆっくり回る。二周目は水星から先に布がかかる。小さな{neo}がマスをぴょんと跳んで移る。クリアしたマスには小さな旗。上の一行「主人公は、{neo}の小さな姿。1ステージ1〜2分。失敗しても、その場からやり直せます。結果は「クリア」だけが出ます」 | 機能/分かりやすさ |
| 6 | 木星ステージ（体験版の2面目） | 画面がない | **試作の本命（3章）**。自分の蝶が小さな{neo}を背に乗せ、タップで羽ばたいて谷を越える。横から字の石（〈次〉〈まだ見てるの？〉〈あの人みたいに〉）が流れてくる。背景の空いっぱいに自分のアート | 機能/15-20ウケ |
| 7 | 土星ステージ（体験版の1面目） | 画面がない | 字の石が嵐から近づいてくる。自分のコロリンをタップすると、サングラスが目に落ちて本人の声のまま歌い、近い石から一文字ずつほどけて光の粒になって落ちる。5〜6回で嵐が晴れてクリア。石は待ってくれる（間に合わないことはない） | 機能/世界観 |
| 8 | 失敗の扱い | — | ライフ・残り回数・ゲームオーバーは作らない。石に当たったら、蝶がくるりと一回転して（0.6秒）すぐ手前の岩に降り、そこから続ける。画面を赤くしない、揺らさない、責める言葉を出さない | 安全/使いやすさ |
| 9 | 難しさ | — | 見えない手助け：同じ区間で3回当たったら、石を15%ゆっくり・すき間を40px広く。5回当たったら〔案内つきで進む〕（光の道を蝶が自動でなぞる。いつでも自分のタップに戻せる。台本4-7「操作が難しい場合は案内つきで進める代替を用意」） | 使いやすさ |
| 10 | 結果 | — | 「クリア」の二文字だけ（金色・ゆっくり光る・白く光らせない）。谷の向こうで{inviter}の小さな姿と、丸いサングラスの小さなKIMORINが旗を振る。点数・タイム・星3つ・回数は出さない | 世界観 |
| 11 | 操作 | — | 片手でできるタップだけ。画面の下3分の2のどこをタップしても羽ばたく（左手でも右手でも）。上の帯（〔‹〕〔今日はここまで〕）だけはゲームの外 | 使いやすさ |
| 12 | 自分の作品が力になる | — | 木星の空＝自分のアート（ゆっくり流れる遠景）、蝶＝木星で作った自分の蝶、ゴールの崖のダチ＝ダチの小さな姿。作品がない時は、結社が用意した絵で進む（だれでもクリアできる） | 世界観/15-20ウケ |
| 13 | {bati}（ぽん）の出番 | 海王星には住人がいない（同行はKIMORIN） | {bati}は台詞を言わずに蝶の背に{neo}と一緒に乗り、5秒タップがないと前方の安全なすき間を小さく光って示す（ヒントの光）。KIMORINは潜水艇の席で横に座り、木星のゴールで「…………オレや。」（台本どおり一回だけ） | 世界観/分かりやすさ |
| 14 | 音 | — | 深海のゆっくりしたパッドの音（0から2秒かけて上げる）。羽ばたきはやわらかい「ふわっ」、石がほどけるのは小さなベルの音。クリアの音も急に大きくしない。〔🔈〕で消せる | 安全 |
| 15 | 光 | — | ネオン・石の光・嵐の稲光は1秒に2回まで。稲光は使わず、嵐は灰色の渦がゆっくり回るだけ | 安全 |
| 16 | 中断と再開 | — | 〔今日はここまで〕を押したら、次は地図の続きから（ステージの途中なら、そのステージのはじめから）。88分の残り時間は出さない。ステージの途中なら、終わってから止める | 使いやすさ |
| 17 | 体験版の終わり | — | 木星のあと「体験版は、ここまでです」〔もう一回〕〔館を出る〕。地図の水星から先の布が、少しだけ風でめくれて中がちらりと光る（期待させるが、日付は出さない） | 世界観 |
| 18 | 英語の切りかえ（06） | EN にすると「Developers keep 92%」「120K」がそのまま英語で出る | 新しい画面でも EN の文言を用意する（Nagare を越えて＝"Beyond the Nagare" など）。数字の文言はなくす | 分かりやすさ |
| 19 | 住人のロック画面（05） | 上に「サンプルデータ・この惑星は見た目のデモです」の帯が残ったまま。暗い背景に字だけ | 帯を外す。背景に、海面の嵐の切れ間から差す光と、深く沈んだ都の小さなネオンの絵（扉だけ見える星） | 見た目 |
| 20 | 「サンプルデータ…見た目のデモです（10/10時点）」の帯（01） | 遊べる画面に置きかえた後も残ると、本物に見えない | 遊べる木星ステージを入れた時点で `planets.ts` の neptune の `demo: 'mock'` を外す | 分かりやすさ |
| 21 | 遊ぶ前の説明 | — | 長い説明は出さない。ステージのはじめに「タップで、羽ばたく」の一行と、指のアイコンが1回だけ。最初の3秒は石を出さない（練習の空） | 分かりやすさ |
| 22 | 動きを減らす設定 | — | `prefers-reduced-motion` では遠景の流れと嵐の回転を弱め、蝶の羽ばたきの上下を小さくする | 安全 |
| 23 | 灯りのない館の数と形（設計の問い3） | 未定 | 6館をおすすめ：二枚貝・さんごの塔・真珠のドーム・タツノオトシゴの塔・海藻の劇場・沈んだ灯台。どれもネオンの縁取りだけで中は暗い | 世界観 |
| 24 | 三周目（PLAYER） | — | 布がすとんと落ちる演出（0.6秒）と〔テロップ：『ナガレを越えて』を、最後まで遊べるようになった〕。残りの4ステージ（水星・火星・天王星・金星）の操作は neptune.md N-4 のとおり。どれもタップ一つで遊べる形にそろえる | 機能 |

---

## 3. 試作プラン：『ナガレを越えて』体験版・木星ステージ（縦 390×844・1枚のHTML＋canvas）

### ねらい

本物の「遊べる一本」。60〜90秒で谷を越えられる。片手のタップだけ、失敗はすぐ手前から、最後にダチが旗を振る。点数・ライフ・タイム・順位はなし。

### 流れ（試作の範囲）

1. **潜水艇の窓**（5秒）：深海の都の一枚絵、巻き貝だけが灯る。巻き貝をタップ→泡→らせん（1.2秒・飛ばせる）。
2. **地図**：6マス。土星には旗（試作では「クリアずみ」にしておく）、木星のマスが光る。小さな{neo}がぴょんと乗る→〔遊んでみる〕。
3. **木星ステージ**（約75秒）：下の「作り」のとおり。
4. **クリア**：谷の向こうの崖に着地→ダチの小さな姿が旗を振る→「クリア」→地図の木星に旗が立つ→「体験版は、ここまでです」〔もう一回〕〔館を出る〕。

### 木星ステージの作り

| 項目 | 値・作り方 |
|---|---|
| 画面 | 上 0–56：〔‹〕・小さな字 `NAGARE`・大きな字『ナガレを越えて』・〔🔈〕。56–844：ステージ |
| 層（遠い順） | ①空＝自分のアート（試作は `jupiter-art-sky-sample`）を 0.08 倍で流す ②遠い谷の崖（0.25倍）③霧の帯（0.4倍）④近い岩と足場（1倍）⑤手前の葉と光の粒（1.3倍） |
| 横の流れ | 秒速90px で自動に右へ進む（全長およそ 6,800px ＝約75秒） |
| 蝶 | 重さ 900px/s²、タップで上向き 320px/s、落ちる速さは最大 420px/s。羽は3コマ（または絵を縦に縮めて羽ばたきに見せる）。小さな{neo}と{bati}が背に乗る |
| 字の石 | 手で決めた6つの波（ランダムにしない）。石は灰色の岩の板に字（〈次〉〈次〉〈まだ見てるの？〉〈あの人みたいに〉など。字はコードで描く）。ゆっくり上下にゆれながら左へ。上下のすき間はいつも220px以上 |
| 当たった時 | 蝶がくるりと一回転（0.6秒）→直前の岩の足場（約15秒ごと、光る苔の印）へふわっと戻る→近くの石は消えてから再開。画面の赤・揺れ・音の大きな変化はなし |
| 手助け | 同じ区間で3回当たると石を15%遅く・すき間を+40px。5回で〔案内つきで進む〕が下に出る（光の道を自動でなぞる・タップで自分に戻る） |
| ヒント | 5秒タップがないと、{bati}が前方の安全なすき間を小さく光って示す |
| ゴール | 谷の向こうの崖のふちに、ダチの小さな姿2人（{inviter}の仮の姿と、丸いサングラスの小さなKIMORIN）が旗を振る。その奥に、夜の森の六角形のドームの灯り（フェスの町の予感）がほんのり見える |
| 音 | WebAudio で合成：深海のパッド（0から2秒で上げる）、羽ばたきの「ふわっ」（ノイズにローパス）、通り過ぎた石の小さなベル、クリアのやさしい和音。どれも急に大きくしない |
| 光 | 点滅は1秒に2回まで。稲光なし。クリアの文字は金色がゆっくり満ちる（0.8秒） |
| 描画 | devicePixelRatio は2まで、60fps。絵は data-URI の webp（合わせて2.5MB以内）。当たり判定は蝶の胴の楕円と石の角丸の四角 |
| 動きを減らす設定 | 遠景の流れと羽ばたきの上下を小さく、霧を止める |
| 守ること | 数（点数・距離・回数・タイム・%）を一つも出さない。「AI」「プロンプト」は使わない。KIMORIN以外は笑いの台詞を言わない |

### 確かめたいこと

- 初めての人が、何回で谷を越えられるか（目標：1回目で越えられる人が半分、3回以内でほぼ全員）。
- 当たった時に「くやしいけど、いやじゃない」か（一回転の演出が罰に見えないか）。
- 自分のアートの空と、ゴールの旗で「自分の作品で越えた」と感じるか。

---

## 4. 絵の依頼リスト（Seedream）

共通の決まり：日本のアニメ寄りのセミリアル、深海のネオン（青・紫・ピンクの縁取り）と、木星ステージの暖かい谷の光。背景は縦 1152×2048。横に流す遠景・崖は 2048×1152（左右がつながる絵）。スプライトは 1024×1024 で平らな背景に一つだけ。既存の `neptune-town.jpg`・`neptune-islands.jpg` は旧設定（嵐の上の浮き島）なので使わない。

共通の後ろにつける文：
`Japanese anime semi-realistic style, cinematic rich lighting, high detail, no text, no letters, no numbers, no logos, no watermark, no UI elements.`
スプライトにはさらに：`single subject centered, isolated on a plain flat light gray background, soft edges.`

| # | ファイル名 | サイズ | 用途 | プロンプト（英語） |
|---|---|---|---|---|
| 1 | neptune-sub-window-city.jpg | 1152×2048 | N-1 深海の都（潜水艇の丸窓から） | View from inside a small submarine through a large round brass porthole, outside a sunken neon city at the bottom of a deep blue ocean like Atlantis, buildings shaped like shells, coral towers and a giant spiral seashell hall in the center whose entrance glows with strong cyan and pink neon, the other buildings outlined with faint dim neon, light rays from far above, drifting particles and small fish silhouettes, cozy riveted metal interior around the porthole. |
| 2 | neptune-deep-city-wide.jpg | 1152×2048 | N-1 の別案（窓の枠なし） | Vertical wide view of a sunken neon city on the deep ocean floor, a giant spiral seashell building glowing brightly in the center, surrounding shell, coral and pearl-dome buildings with faint neon outlines and dark windows, soft blue-violet water, god rays, bubbles, calm and magical. |
| 3 | neptune-shell-spiral-hall.jpg | 1152×2048 | N-2 らせんの通路 | Inside a giant seashell, a spiral corridor of glossy pearly walls curling downward, soft pink and cyan neon strips following the spiral, gentle bubbles, looking down the spiral toward a warm glowing round room. |
| 4 | neptune-screen-room.jpg | 1152×2048 | N-2 奥の丸い部屋（大きな画面） | A round chamber deep inside a seashell with pearly walls, a huge blank dark curved screen covering the far wall (empty, clearly framed), soft neon trim, cushioned round seats in front, calm deep-sea ambience. |
| 5 | nagare-map-board.jpg | 1152×2048 | N-3 すごろくの地図 | A top-down illustrated board-game map drawn like a treasure map on deep blue parchment, six round stepping-stone spaces connected by a winding dotted path from bottom to top, each space decorated with a small emblem of a different planet (ringed planet, striped giant, small grey planet, red planet, tilted teal planet with ring, golden planet), a small festival stage at the top, a soft grey swirling storm cloud drifting over the map, no letters. |
| 6 | jupiter-valley-far.png | 2048×1152 | 木星ステージの遠い崖（横につながる） | Horizontally seamless panorama of distant deep canyon cliffs in warm amber and violet tones with hazy atmosphere, layered rock spires, soft light from the right, bottom half dark fading into mist, top area transparent-looking pale sky. |
| 7 | jupiter-valley-mid.png | 2048×1152 | 木星ステージの中景の崖（横につながる） | Horizontally seamless strip of mid-distance canyon rock formations with mossy ledges and small glowing plants, warm sunset rim light, plain flat light gray sky above for keying. |
| 8 | jupiter-mist-band.png | 2048×1152 | 霧の帯（横につながる） | Horizontally seamless soft white-lavender mist band, wispy and translucent-looking, on a plain flat black background. |
| 9 | jupiter-art-sky-sample.jpg | 1152×2048 | 空の自分のアート（試作の仮） | A dreamy painted square-ish artwork stretched into a sky: giant pastel butterflies, swirling stars and a big soft moon, watercolor texture, joyful and personal. |
| 10 | rock-ledge-a.png | 1024×1024 | 近い岩の足場 | A floating chunk of canyon rock with a flat grassy top and hanging roots, warm light on top. |
| 11 | rock-ledge-checkpoint.png | 1024×1024 | やり直しの岩（光る苔の印） | A floating flat-topped canyon rock with a ring of softly glowing cyan moss and tiny flowers on top, inviting landing spot. |
| 12 | rock-pillar-tall.png | 1024×1024 | 下からのびる岩の柱 | A tall narrow canyon rock pillar with ledges and small plants, warm sunset rim light. |
| 13 | word-stone-blank-a.png | 1024×1024 | 字の石（字はコードで描く） | A flat grey stone tablet with rough chipped edges floating in the air, smooth blank face, faint grey dust trailing behind, slightly cold and heavy looking. |
| 14 | word-stone-blank-b.png | 1024×1024 | 字の石（横長） | A wide flat grey stone slab with a blank smooth face and cracked corners, floating, faint dust trailing. |
| 15 | storm-swirl-grey.png | 1024×1024 | 灰色の嵐の渦 | A soft grey swirling storm cloud vortex, round, muted and gentle, no lightning, on a plain flat black background. |
| 16 | butterfly-ride-wings-open.png | 1024×1024 | 蝶（羽を開く・仮） | A large luminous butterfly seen from the side flying to the right with wings fully open, iridescent violet and gold wings, sturdy body with a small soft saddle area on its back, empty back. |
| 17 | butterfly-ride-wings-mid.png | 1024×1024 | 蝶（羽ばたき中） | The same large luminous violet and gold butterfly seen from the side flying to the right with wings halfway closed, empty back. |
| 18 | butterfly-ride-wings-down.png | 1024×1024 | 蝶（羽を下ろす） | The same large luminous violet and gold butterfly seen from the side flying to the right with wings swept down, empty back. |
| 19 | chibi-neo-ride.png | 1024×1024 | 小さな{neo}（乗る・仮） | A chibi two-heads-tall young person in a hoodie with round sunglasses pushed up on the head, sitting astride and holding on with both hands, looking forward with a determined happy face, side view facing right. |
| 20 | pon-ride.png | 1024×1024 | ぽん（蝶の背に一緒に乗る） | A small cream-colored fluffy bunny-like plush creature with long floppy ears blowing back, big amber eyes and a tiny silver crescent moon mark on the forehead, sitting and holding on happily, side view facing right. |
| 21 | pon-glow-hint.png | 1024×1024 | ぽん（ヒントで光る） | The same small cream-colored fluffy bunny-like creature with its silver crescent moon mark glowing softly, pointing forward with one paw, side view facing right. |
| 22 | chibi-friend-flag.png | 1024×1024 | ダチの小さな姿（旗を振る・仮） | A chibi two-heads-tall friendly young person waving a small plain triangular pennant flag high with a big smile, full body, front view. |
| 23 | chibi-kimorin-flag.png | 1024×1024 | 小さなKIMORIN（旗を振る） | A chibi two-heads-tall white fox-faced character with blue inner ears and blue face markings, round black sunglasses, deep red hooded robe, small white tails with red tips, solemnly waving a small plain triangular pennant flag, full body, front view. |
| 24 | goal-cliff-festival.png | 2048×1152 | ゴールの崖とフェスの町の予感 | The far edge of a canyon at golden hour, a grassy cliff top on the right side where small figures could stand, beyond it a distant night forest with softly glowing hexagonal domes, warm and hopeful, left side open sky over the gorge. |
| 25 | light-mote.png | 1024×1024 | 光の粒（ほどけた字・手前の粒） | A single soft round glowing light particle with a gentle golden halo, on a plain flat black background. |
| 26 | saturn-stage-plaza-storm.jpg | 1152×2048 | 土星ステージの背景（次の段階） | A round stone plaza on a ringed planet at dusk, a grey wind storm curling in from the edges, a small empty stage area in the center, warm lanterns around the plaza, the planetary ring arching across the violet sky. |
| 27 | sub-exterior.png | 1024×1024 | 潜水艇（N-1・N-2 の移動） | A small round retro submarine with a big brass porthole, pastel teal hull with rivets, little propeller and a warm headlight beam, side view facing right. |
| 28 | kimorin-sub-seat.png | 1024×1024 | 潜水艇の席のKIMORIN | A white fox-faced character with blue inner ears and blue face markings, round black sunglasses, deep red hooded robe, many white tails with red tips, sitting politely in a small cushioned submarine seat with paws on the knees, three-quarter view. |
| 29 | hall-unlit-clam.png | 1024×1024 | 灯りのない館：二枚貝 | A building shaped like a giant half-open clam shell on the sea floor with faint dim neon outline and dark windows, deep blue tones. |
| 30 | hall-unlit-coral-tower.png | 1024×1024 | 灯りのない館：さんごの塔 | A tall tower made of branching pink coral with faint dim neon outline and dark windows, deep blue water tones. |
| 31 | hall-unlit-pearl-dome.png | 1024×1024 | 灯りのない館：真珠のドーム | A round pearl-white dome building on the sea floor with faint dim neon ring and dark round windows, deep blue tones. |
| 32 | hall-unlit-seahorse.png | 1024×1024 | 灯りのない館：タツノオトシゴの塔 | A slender tower shaped like a curled seahorse with faint dim neon outline and dark windows, deep blue tones. |
| 33 | neptune-locked-surface.jpg | 1152×2048 | 住人のロック画面の背景 | A dark stormy ocean surface at night with a single break in the clouds letting a shaft of light fall on the water, far beneath the surface the faint glow of a sunken neon city, quiet and mysterious. |

※ 16〜23 は既存の土星の試作のコロリン（`koro-*.webp`）と同じくらいの線の太さ・頭身でそろえる。19・22 は仮の姿で、本番は本人の{neo}の姿を二頭身にしたもの（M-R149）を使う。23・28 は既存の `kimorin-sun.webp` を参照画像として渡す。
