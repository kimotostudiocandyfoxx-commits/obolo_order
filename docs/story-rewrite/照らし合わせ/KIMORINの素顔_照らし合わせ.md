# KIMORIN 素顔チェック（白衣・ゴーグルを外した顔）— M-R177

- 基準：`docs/story-rewrite/画面設計/参考画像/kimorin_face_ref.png`
  白い丸い顔／おでこに青い葉3枚（まん中が長い）／目＝細い青い光の弧（上向きのゆるいカーブ、黒目・白目なし）／両ほほに青いうず巻き／ω の猫口（鼻なし）／白い毛の耳（内側は青）／丸いゴーグルをおでこに上げる
- 調べた絵：`origin/claude/solar-system-home-planets-ew766y` の `apps/web/public` にある KIMORIN の絵、全437枚（作業ツリーには触らず、`git archive` で取り出して確認）
- 衣装と絵のグループの対応（`components/story/Stage.tsx:55-60`、`components/onboarding/StoryPlayer.tsx:167-177, 741-760`）
  - **白衣**：`kimorin-i`＝ゴーグルをかけた顔（目は見えない）、`kimorin-iu`＝ゴーグルを額に上げた顔 → **対象は `kimorin-iu`**
  - ローブ（赤いフード）：`kimorin-g`・`kimorin-xs`＝サングラスをかけた顔、`kimorin-n`・`kimorin-x`・`kimorin-sun(-up)`＝サングラスを上げた顔、`kimorin-1/2/3/8`、`kimorin-face`、`kimorin-dragon` → 対象外（下の「参考」）
- `kimorin-iu` を使う場面：すべて2日目の `lib/onboarding/day2.ts`
  - 地球の神殿でゴーグルを押し上げてから（103行目）、月の神殿のドラゴン変身まで
  - `sprite 'kimorin-iu'`（220行目・238行目）：セリフごとの表情は `sayExpressions` が8ポーズから自動で選ぶ
  - KIMORIN が写っていない静止画の上で話すときに自動で出る立ち絵（`StoryPlayer.tsx:760-766, 1048`。`STILL_LOOK` 172-176行目から見た目を決める）
- **大事な発見**：画面では、`body` の上に `-eyes` レイヤーが不透明度 0.35〜0.95 で常に重なって光ります（`Stage.tsx:307-311`、`lib/story/motion.ts:16`）。`kimorin-iu-*-eyes.webp` の8枚には、基準と違う顔の一部が入っています。中身は、黒いふちの「つり目」、おでこの外側の2本線、うず巻きのコピー、talk では黒い鼻です。このため、`body` が正しい絵でも、**画面に出る顔は8ポーズすべて基準と違います**。下の表の「画面上」は、tail＋body＋eyes（0.95）を重ねて確認した結果です。

## 表（白衣・ゴーグル上げ）

| ファイル（apps/web/public/…） | 衣装／ゴーグル | 使う場面（day2.ts の行） | 判定 | 違うところ | 描き直しメモ |
|---|---|---|---|---|---|
| onboarding/kimorin-iu.webp | 白衣／上げ（立ち絵の基本） | 2日目 月の神殿・ピンポン2.5の説明 220行目／238行目、自動立ち絵 | **違う** | 目＝黒いふちのアーモンド形のつり目（弧ではない）。おでこ＝葉3枚＋外側に2本（全部で5本）。口＝黒い鼻＋にっこり口（ω ではない） | 顔を基準どおりに描き直す。レイヤーはないので1枚だけ |
| onboarding/kimorin-iu-joy(-body/-eyes/-mouth/-tail).webp | 白衣／上げ | 同上（喜びのセリフで自動に選ばれる） | **違う** | body：おでこ5本（葉3枚＋外側の曲線2本）、口は大きく開いた笑い口。eyes レイヤー：つり目 | おでこを葉3枚に。笑い口は表情として残してよいかを決める。4枚のレイヤーを作り直す |
| onboarding/kimorin-iu-lecture(…).webp | 白衣／上げ | 同上（説明のセリフ） | **違う（画面上）** | body は基準どおり。eyes レイヤーのせいで、つり目とおでこ外側2本が重なる | body はそのまま使える。eyes レイヤーを正しい body から切り直す（`scripts/sprite-layers.py`） |
| onboarding/kimorin-iu-point(…).webp | 白衣／上げ | 同上 | **違う（画面上）** | body は基準どおり。eyes レイヤー：つり目、余分な模様 | eyes レイヤーを切り直す |
| onboarding/kimorin-iu-shock(…).webp | 白衣／上げ | 同上（驚き） | **違う** | body：おでこ5本（葉3枚＋外側2本）、口は開いた「お」の形。eyes レイヤー：つり目 | おでこを葉3枚に描き直す。4枚のレイヤーを作り直す |
| onboarding/kimorin-iu-smug(…).webp | 白衣／上げ | 同上（得意げ） | **違う（画面上）** | body は基準どおり。eyes レイヤー：つり目、口元に余分な線 | eyes レイヤーを切り直す |
| onboarding/kimorin-iu-talk(…).webp | 白衣／上げ | 同上（ふつうに話す。いちばんよく出る） | **違う（画面上）** | body は基準どおり。eyes レイヤー：つり目、**黒い鼻**、おでこ外側2本 | eyes レイヤーを切り直す |
| onboarding/kimorin-iu-tears(…).webp | 白衣／上げ | 同上（涙） | **違う（画面上）** | body は基準どおり（涙あり）。eyes レイヤー：つり目、余分な模様 | eyes レイヤーを切り直す |
| onboarding/kimorin-iu-think(…).webp | 白衣／上げ | 同上（考える） | **違う** | body：**おでこの葉がない**、**ほほのうず巻きがない**、口元に黒い鼻。eyes レイヤー：つり目 | 顔を描き直す（葉3枚・うず巻き・ω口）。4枚のレイヤーを作り直す |
| onboarding/s/d2-hall-kimorin-up.jpg | 白衣／上げ | 2日目 地球の神殿 103行目（ゴーグルを額に上げた直後） | **違う** | 目＝アーモンド形の光（弧ではない）。おでこの葉が見えない。小さな鼻がある（横向き） | 静止画を描き直す（または合成し直す） |
| onboarding/s/d2-hall-sky-monban.jpg | 白衣／上げ | 2日目 星空の大広間 116行目 | **違う** | 目＝アーモンド形。おでこ＝斜めの線が数本（葉3枚ではない） | 静止画を描き直す |
| onboarding/s/d2-kimorin-pin-a.jpg | 白衣／上げ | 2日目「ピンとくる」119行目 | **違う** | おでこ5本（葉3枚＋外側2本）。目＝太い白い楕円の光 | ひらめきの光は残し、目は弧、おでこは葉3枚に |
| onboarding/s/d2-kimorin-pin-b.jpg | 白衣／上げ | 2日目 月の神殿「ピンとくる」250行目 | **違う** | おでこ5本（葉3枚＋外側2本）。目＝つり上がった細い線（ハの字）。口がない | 同上 |
| onboarding/s/d2-moon-kimorin.jpg | 白衣／上げ | 2日目 月の神殿 209・218・226行目 | 合う | 目が少し太く、少し斜め（気になるほどではない） | — |
| onboarding/s/d2-moon-kimorin-half.jpg | 白衣／上げ | 233行目 | 合う | 同上（KIMORIN の絵は moon-kimorin と同じ） | — |
| onboarding/s/d2-moon-kimorin-squint.jpg | 白衣／上げ | 235行目 | 合う | 同上 | — |
| story/avatars/kimorin-iu.webp | 白衣／上げ（チャットのアイコン） | `StoryPlayer.tsx:758-759`（kimorin-iu の間） | 合う | 葉3枚・弧の目・うず巻き・ω（ゴーグルのふちが真鍮色なのは下の注を参照） | — |

### アプリで使っていない絵（参考。作り直すときは揃えるとよい）
- `onboarding/s/kimorin-iu-*-{o,notail,glow}.jpg`（24枚）：`kimorin-iu-*` の試し絵で、コードからは参照していません。顔は上のスプライトと同じです。スプライトを作り直したら、これも作り直すか削除します。
- `onboarding/s/kimorin-inv-up.jpg`：未使用の設定画。おでこ5本、つり目で **違う**。
- `onboarding/s/d2-pinpon.jpg`：未使用（動画 `d2-pinpon` のポスターは `md2-pinpon.jpg`）。おでこは葉3枚で合っています。

### 動画（参考。M-R177 の「背景透過の絵」には入りません）
- `md2-sky.jpg`／`md2-monban-walkin.jpg`（動画 `d2-sky`／`d2-monban-walkin`、day2.ts 110・113行目）、`d2-kimorin-startle`（101行目）の最後のコマ：d2-hall-kimorin-up と同じ横顔です。アーモンド形の目、鼻があり、おでこの葉が見えないので **違う**。動画を作り直すかどうかは別に決めます。
- `md2-pinpon.jpg`（216行目）：おでこは葉3枚、目は弧で、ほぼ合っています。

### 注：ゴーグル（白衣グループ全体に共通）
`kimorin-i`／`kimorin-iu` のゴーグルは、真鍮色のふちのスチームパンク風で、頭に小さなモニターが付いています。基準画像（とローブ版）は、黒いレンズに**銀のふち**の丸メガネ型です。M-R177 の文には「銀のふち」と書かれています。白衣のゴーグルを銀にするかどうかは、利用者に確認が必要です。今は真鍮色で揃っているので、この点だけでは「違う」に数えていません。

## 揃えて作り直すレイヤーグループ（body／eyes／mouth／tail を同じキャンバスで）
レイヤーは同じ大きさのキャンバスに重ねるので、1ポーズの4枚はまとめて作り直します。元の1枚絵 `kimorin-iu-<pose>.webp` と、`lib/story/sprite-layers.json` の行も一緒です。

1. **顔を描き直してから全レイヤーを切り直す**：`kimorin-iu-joy`、`kimorin-iu-shock`、`kimorin-iu-think`（body・eyes・mouth・tail＋元絵）
2. **eyes レイヤーだけ切り直せば直る**（body は基準どおり）：`kimorin-iu-lecture`、`kimorin-iu-point`、`kimorin-iu-smug`、`kimorin-iu-talk`、`kimorin-iu-tears`
   - 今の eyes レイヤーは、昔の `kimorin-iu.webp`（つり目）から切ったものと考えられます。正しい body から切り直せば、描き直しは要りません。位置がずれないよう、mouth と tail も同じ作業で書き出し直すのが安全です。
3. レイヤーのない1枚絵：`kimorin-iu.webp`（立ち絵）を描き直す

## 参考：ローブ版でサングラスを上げた顔（対象外）
- `kimorin-n-*`・`kimorin-x-*`（各8ポーズ）：body の目は細い弧で合っています。ただ eyes レイヤーが太い楕円の光で、画面では目が楕円に見えます（0.95 のとき）。
- `kimorin-n-shock`／`kimorin-x-shock`：body の目が縦の棒です（驚きの表情として描かれたもの）。
- `kimorin-g-talk`（サングラスをかけた顔）：おでこの葉がありません。
- `kimorin-face.webp`、`story/avatars/kimorin.webp`、`kimorin-1/2/3/8`、`kimorin-sun-up`：基準どおりです。
