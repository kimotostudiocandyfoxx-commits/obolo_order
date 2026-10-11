# MV の作り方 A / B（クライアント決定 2026-10-11）

MV の絵の描き方は2通り用意してあり、**GitHub の変数 `MV_PLAN` ひとつで切り替える**。
どちらも「受付 → 順番に処理 → できたら通知」（jobs + プッシュ通知）の上で動く。画質は 720p まで（docs/media.md）。

| | A：Runware 4コマ（今） | B：自社 GPU 回しっぱなし（人が増えたら） |
|---|---|---|
| 絵 | Seedream 5.0 Pro。1枚に4場面を2×2で描いて切り分ける（`seedreamSheets`） | 自社 GPU（obolo-music）の `/paint`。公開モデルを使う（今は Animagine XL） |
| 1本の費用 | 12場面 = 3枚 ≈ **約21円**（MV lab m12：写真13枚で約27円・6.2点） | 描いている時間だけ（1枚 数秒〜1分）。ただし GPU 1台が **月 約7〜11万円**（見込み）かかる |
| 向いている時 | 人が少なく、GPU を寝かせておく方が安い間 | GPU が一日中ほぼ休まず動くほど MV が来るようになったら（目安：会員 1,000〜1,200人〜） |
| 待ち時間 | 数分 | 数分〜（混んだら順番待ち。「明日届く」と案内してもよい） |

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
3. 切り替えた時に、その時点で一番良い公開モデルを MV lab（`scripts/mv-lab/round.json`、painter `gpu`）で確かめて、
   `gpu/music/paint.py` のモデルを入れ替える。キャラの見た目は、キャラ専用の LoRA か、参考画像を読める編集モデル
   （例：Qwen-Image-Edit）でそろえる — 公開モデルは数か月で良くなるので、モデル選びは**切り替える時**にする。
4. 戻すときは `MV_PLAN` を `A` にして、同じ2つを動かす。

## 未設定のとき
`MV_PLAN` が空なら今まで通り（`MV_GPU_PAINT` / Runware / Qwen の順で描く）。
