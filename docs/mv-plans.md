# MV の作り方 A / B（クライアント決定 2026-10-11）

MV の絵の描き方は2通り用意してあり、**GitHub の変数 `MV_PLAN` ひとつで切り替える**。
どちらも「受付 → 順番に処理 → できたら通知」（jobs + プッシュ通知）の上で動く。画質は 720p まで（docs/media.md）。

| | A：Runware（今） | B：自社 GPU 回しっぱなし（人が増えたら） |
|---|---|---|
| 絵 | **FLUX.2 [klein] 4B**（Apache-2.0）を Runware で、1場面1枚（`paintScenes`、`MV_PAINTER`） | **同じ FLUX.2 [klein] 4B** を自社 GPU（obolo-music）で動かす（準備中：`gpu/music/paint.py` に入れる） |
| 1本の費用 | 12場面 ≈ **約2.3円**（Model scout s02：1枚0.19円。MV lab m14：写真13枚で2.5円・6点 ＝ Seedream 4コマ版 約37円と同じ点） | 描いている時間だけ（1枚 数秒〜1分）。ただし GPU 1台が **月 約7〜11万円**（見込み）かかる |
| 向いている時 | 人が少なく、GPU を寝かせておく方が安い間 | GPU が一日中ほぼ休まず動くほど MV が来るようになったら（目安：会員 1,000〜1,200人〜） |
| 待ち時間 | 数分 | 数分〜（混んだら順番待ち。「明日届く」と案内してもよい） |

**共通のモデルは FLUX.2 [klein] 4B（クライアント決定 2026-10-12）**：A と B で同じモデルを使うので、切り替えても絵の感じが変わらない。
Seedream / Qwen-Image 2.x は中身が公開されておらず自社では動かせない。klein 9B は非商用ライセンスのため自社では使わない。

## A にする（今）
1. Runware の鍵はすでに Secret Manager の `obolo-seedream-api-key` にある。API の実行用サービスアカウントが読めるようにする（Cloud Shell で一度だけ）：
   ```bash
   gcloud secrets add-iam-policy-binding obolo-seedream-api-key \
     --member="serviceAccount:obolo-api-runtime@obolo-order.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```
2. GitHub の Variables に `MV_PLAN` = `A` を足す（任意で `MV_SHEET_SCENES` = 場面の数、4の倍数がむだがない。既定 12）。
3. 「Deploy API」を動かす。

## B に切り替える（人が増えたら）
1. GitHub の Variables の `MV_PLAN` を `B` にする。
2. 「Deploy music」と「Deploy API」を動かす。これで：
   - GPU は常に1台起きている（`--min-instances 1`、ひまでも自分で終わらない `IDLE_EXIT_SECONDS=0`）
   - MV の絵は自社 GPU が描く（`MV_GPU_PAINT=true`）
3. 自社 GPU の `/paint` は FLUX.2 [klein] 4B（参考画像つき）で描く。切り替える前に MV lab（painter `gpu`）で
   A と同じ点が出ることを確かめる。
4. 戻すときは `MV_PLAN` を `A` にして、同じ2つを動かす。

## 未設定のとき
`MV_PLAN` が空なら今まで通り（`MV_GPU_PAINT` / Runware / Qwen の順で描く）。

## キャラの見た目（Model scout s03 / s04、2026-10-12）
- 個性は**顔より「特徴」**で出す（クライアント方針）：帽子の色・サングラスの形・服・小物。FLUX.2 [klein] 4B はこれをほぼ完璧に保つ
  （黄色いバケットハット＋丸サングラス、スーツ＋赤ネクタイ、王冠、星形サングラス、黄色いフード…どの場面でも同じ）。
- 参考に渡す絵は**全身・白い背景**。丸く切り抜いた顔アイコンだと、別の人物（人間の女の子など）になってしまう。
- 指示文に、そのキャラが持っていない物の名前（「メガネ」など）を書かない — 書くと描き足される。飲み物も食事の場面だけ。
- 1キャラごとの学習（LoRA）はしない（1人300〜550円・人数に比例して重い）。やるなら有料プランの機能として。
