# 地球 UI 1周目の絵：点検（earth/ui1・39枚）

対象：`origin/claude/solar-system-home-planets-ew766y` の `art/review/earth/ui1/*.jpg`（-cut 版はなし。全部 JPG）。
見たこと：依頼（点検_earth.md §4）と用途に合うか／絵柄がそろっているか／文字・数字・ロゴ・透かしがないか／切り抜けるか。

結果：**OK 26枚・差し戻し 13枚**。
全体として絵柄はそろっている（濃紺と金・アニメ調の厚塗り）。文字・数字・ロゴ・透かしは見つからなかった。いちばん多い問題は、**スプライトのはずの絵に背景の景色が描きこまれていて切り抜けない**こと（灰色の無地の背景という指定が守られていない）。

---

## OK（26）

加工したものは「→」のあとに書く。試作で使ったものには ◎。

| ファイル | 見立て |
|---|---|
| ◎ earth-home-space-bg-night | 静かで、中央があいている。理想的。 |
| ◎ earth-home-space-bg-dusk | 雲のような星雲が中央にもあるが、夕方らしさが強い。→ 絵の太陽が地図の太陽（左上）に重なるよう、ずらして敷いた。 |
| ◎ earth-home-space-bg-dawn | 下の4分の1に山の地平線（惑星の地面）があり「惑星なし」に反する。→ 地平線より上だけを切り出し、宇宙の色へ寄せて暗くした。次に描き直す機会があれば地平線なしで。 |
| ◎ earth-home-sun-glow | 黒地。加算でそのまま使える。→ 空の絵にも太陽があるので、朝と夕方は弱めて重ねる。 |
| ◎ planet-earth-sphere | とても良い。→ 動きを減らす設定の時と、読みこみ中の地球に使う。 |
| ◎ planet-earth-texture | 左右がつながる。正方形で描かれているので、地球を半周ずつ2回まわして形を自然に見せた。 |
| ◎ earth-cloud-layer | 黒地に白で良い。左右がつながっていなかった。→ PIL で継ぎ目を重ねてぼかし、つながるようにした。 |
| ◎ planet-moon-sphere | 良い。 |
| ◎ planet-saturn-sphere | 輪なしで良い。 |
| ◎ saturn-ring-front | 手前半分ではなく輪がまるごと描かれている。→ 楕円の長い軸で上と下に分け、上半分は惑星の後ろ、下半分は前に置いた。背景のかすみは消した。 |
| ◎ planet-jupiter-sphere | 良い（光の蝶つき）。 |
| ◎ planet-mercury-sphere | 良い。光が右から当たっている。→ 左右を反転。 |
| ◎ planet-venus-sphere | 良い（レコードの溝は弱め）。光が右から当たっている。→ 左右を反転。 |
| ◎ planet-mars-sphere | 良い。光の縁が右にある。→ 左右を反転。 |
| ◎ planet-neptune-veiled | 霧と鎖がきれい。→ 球の外の霧と鎖も明るさで切り抜いて使用。 |
| ◎ earth-hq-hall-bg | とても良い。床の封印の外周に、うすい文字のような模様がある（読めない飾りなので可）。 |
| earth-hq-switchboard-bg | 良い。名札は空欄。（この試作には出てこない） |
| invite-desk-envelopes | 良い。金の日食と銀の手の封蝋。（この試作には出てこない） |
| ◎ member-card-frame-front | 白地で切り抜きがきれい。窓と札の位置を測ってはめこんだ。 |
| ◎ holo-foil-overlay | 黒地。虹色より青と金が強いが、screen 合成で十分。 |
| ◎ seal-resident-silver | 背景は紺（灰色の無地ではない）。→ 塗りつぶしで背景を抜き、縁を 3px 削った。 |
| ◎ seal-order-gold | 同じく紺の背景から切り抜き。 |
| ◎ stamp-planets-sheet | 3×3 で番号も文字もない。→ 1枚ずつ丸く切り抜き、並べ直した。 |
| ◎ oshi-shelf-bg | 棚は3段（依頼は4段）だが十分。→ 15個のガラスドームの位置を測り、作品をドームの中に置いた。 |
| tomorrow-moon-sleep-bg | 良い。（この試作には出てこない） |
| entry-seal-glow | 良い。（この試作には出てこない） |

---

## 差し戻し（13）

共通の書き添え（§4）は今までどおり最後に付ける。スプライトの書き添えは、灰色の背景が守られなかったので強めの言い方に変える：
`Isolated single object on a completely plain, flat, uniform medium gray (#808080) background. The background must contain nothing at all: no scenery, no sky, no stars, no floor, no shadow, no gradient, no light rays. Generous empty margin on all sides.`

暫定で試作に入れたものには（暫定使用）と書いた。描き直した絵が届けば、同じファイル名で差し替えられる。

### 1. courier-butterfly
- 問題：夜の庭とお城の背景が描きこまれていて切り抜けない。
- 修正プロンプト：`A single small magical butterfly made of soft golden light with stained-glass wings in gold, sky blue and soft pink, carrying a tiny blank round gold tag on a navy ribbon, cute anime style, gentle inner glow, side three-quarter view, wings half open.` ＋スプライトの書き添え

### 2. courier-kororin
- 問題：山と草原の背景がある。この試作には出てこないが、ほかの画面で使う予定。
- 修正プロンプト：`A small round squishy creature like a soft white rice cake with a tiny gold star mark on its forehead, glossy pastel surface, shy happy closed-eye smile, tiny stubby arms, gently bouncing pose, cute soft 3D anime style.` ＋スプライトの書き添え

### 3. courier-record
- 問題：星雲の背景がある。黒いレコードの盤が紺の背景に溶けて、輪郭が抜けない。
- 修正プロンプト：`A single small black vinyl record with a blank golden center label (no writing), tilted in three-quarter view, a short trail of golden sparkles behind it, warm magenta rim light on the edge of the disc, painterly anime style.` ＋スプライトの書き添え

### 4. courier-ship
- 問題：夜の海と空が描きこまれている。船体が暗い紺で、背景と区別できない。
- 修正プロンプト：`A tiny cute fantasy sailing ship with a cream-white hull trimmed in gold, a puffed cream sail and a small glowing lantern, sitting on a small round splash of glittering turquoise water (only the splash, no sea), painterly anime style, three-quarter view.` ＋スプライトの書き添え

### 5. courier-ufo
- 問題：地球を見下ろす景色と月が描きこまれている。
- 修正プロンプト：`A tiny cute retro flying saucer in cream and gold with a clear glass dome and soft pink and cyan lights underneath, painterly anime style, three-quarter view, slight glow around the lights only.` ＋スプライトの書き添え

### 6. rocket-mini
- 問題：地球の大気圏の景色の上を飛んでいる。航路の上で小さく動かすので、切り抜けないと使えない。
- 修正プロンプト：`A tiny cute brass-and-cream retro rocket with three round portholes and small fins, flying diagonally toward the upper right, a short soft golden flame at the tail, painterly anime style, toy-like but detailed.` ＋スプライトの書き添え

### 7. oshi-jar-icon（暫定使用：丸く切り抜いて上の帯のボタンに）
- 問題：ぼけた背景と床がある。丸く切り抜けば見られるが、アイコンとしては背景がうるさい。
- 修正プロンプト：`A small round glass jar with a cork stopper and an ornate small gold stand, filled with drifting tiny glowing music notes and star dust in gold and soft pink, upright, front view, painterly anime style, magical and collectible.` ＋スプライトの書き添え

### 8. letterbox-icon（暫定使用：丸く切り抜いて上の帯のボタンに）
- 問題：石の壁・ランタン・つぼが描きこまれている。
- 修正プロンプト：`A small antique brass wall letter box with a crescent-moon ornament on the front and a cream envelope sealed with navy wax peeking out of the top slot, warm soft glow, painterly anime style, front three-quarter view.` ＋スプライトの書き添え

### 9. mana-gem-small
- 問題：燭台・カーテン・台座が描きこまれている。中に紫の楕円が描かれていて、水位をコードで描く「空の中身」になっていない。
- 修正プロンプト：`A faceted teardrop-shaped crystal gem, completely clear and empty colorless glass inside (no inner color, no inner shape) so a liquid light level can be drawn later, a faint violet-blue tint only on the facet edges, an ornate small golden cap with a tiny loop on top, painterly anime style, front view.` ＋スプライトの書き添え

### 10. saturn-ring-back
- 問題：奥半分ではなく輪がまるごと描かれている。背景に金色の星雲のかたまりがあり、明るさで抜くと一緒に残る。front と傾きも形も合わない。（試作では front の1枚を上下に分けて代わりにした）
- 修正プロンプト：`Only Saturn's ring, seen at a gentle 20-degree tilt: one complete elliptical band of glittering golden ice particles with fine concentric stripes and one thin dark gap, the planet itself absent (empty hole in the middle), painterly anime style, on a pure black background for additive blending, nothing else in the frame.`（奥と手前はコードで分けるので、1枚に統一する）

### 11. planet-uranus-veiled
- 問題：右側に、照準や図面のような細い線と同心円（UIのような模様）がある。鎖に黒いかけらがぶら下がっていて、南京錠のように見える。
- 修正プロンプト：`Planet Uranus as a perfect sphere in pale aqua, painterly anime style, wrapped in a thin silvery mist and encircled by a delicate floating ring of small golden chain links (only round links, nothing hanging from the chain), quiet and mysterious, slightly desaturated, plain deep-space background with only a few faint stars, no lines, no diagrams, no geometric shapes.`

### 12. member-card-frame-back（暫定使用：カードの裏）
- 問題：丸が9個ではなく8個しかない。真ん中が日食の紋章ではなく満月（日食は Obolo Order の印）。太陽の消印を押す場所がない。
- 修正プロンプト：`The back of the same luxurious collectible membership card, vertical playing-card proportion centered in the square, deep midnight-navy enamel with fine gold filigree borders, exactly nine small empty round stamp circles evenly spaced along a thin golden orbit ellipse, and in the center an embossed golden solar eclipse emblem (a black disc with a radiant gold corona ring), faint star-chart engraving, plain white background around the card, blank with no text.`

### 13. neo-sample-stand（暫定使用：カードの窓に背景ごと）
- 問題：神社の石段とろうそくの背景がある。点検 §2 B の決まり（「立ち絵（背景なし）」）に反する。サングラスの奥の目が少し見えている（目は隠す設定）。
- 修正プロンプト：`Full-body standing portrait of a teenage member of a secret society, Japanese anime semi-real style, wearing a large deep-navy hooded cloak with gold trim and small fox ears on the hood, thin gold round sunglasses that fully hide the eyes (opaque dark lenses), a friendly small smile, relaxed confident pose with one hand in the cloak, soft rim light.` ＋スプライトの書き添え
