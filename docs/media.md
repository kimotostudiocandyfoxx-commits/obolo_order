# 写真・動画・音の保存と配信（クライアント決定 2026-10-06）

保存と配信は **Cloudflare R2**（バケット `obolo-media`、公開ドメイン `https://media.obolo.life`。クライアント決定 2026-11-25）。
それまでのファイルは Bunny Storage / CDN にあり、下の「Bunny から R2 へ」で R2 に移してから Bunny を解約する。費用が月88円の中に収まるように、
アップロードされたものはサーバーで必ず軽くしてから保存する。

**画質の上限は 720p（クライアント決定 2026-10-11）**：保存はすべて 720p 以下なので、作るもの（MV・絵・動画）も
720p を超えて作らない。絵を描くときも、それ以上の大きさで描く費用はかけない（MV の画面は 720×720）。

## アップロード時の変換（`apps/api/src/media/transcode.ts`、設定値は `MEDIA_POLICY`）
| 種類 | 変換 | 受け付ける元の大きさ |
|---|---|---|
| 動画 | 短い辺 720px まで（縦なら 720×1280）、H.264 約1.5Mbps、音声 AAC 96kbps、MP4（すぐ再生できる形）、長さは上限で切る（木星は8秒） | 120MB まで |
| 動画のサムネイル | 1コマ目を WebP（480px まで）。一覧ではこれだけ読み込み、動画は開いた時だけ読む | — |
| 写真 | WebP、長い辺 1600px まで、向きを補正し、位置情報などのメタデータは消す | 25MB まで |
| 声（土星） | そのまま（もともと小さい） | 3MB まで |

API：`POST /media/photo`、`POST /media/video?max=<秒>`（本文はファイルそのもの）、`POST /media/voice`。

## ブルーナの📎（端末から とりこむ・2026-11-24）
ブルーナの一覧のいちばん上〔とりこむ〕から、スマホ・iPad の写真・動画・音・ファイルを入れて、ダチの会話に送る／バティにわたす／ブルーナにしまう。
保存先は上と同じ（R2、R2 の設定がなければ Bunny、開発中は Postgres・ブルーナの広さに入る）。ただし **非公開**：`media_objects.kind = 'file'`、公開の `GET /media/:id` では出さない。
`GET /media/files/:id` が、持ち主と「その会話で送られたダチ（いまもダチ）」にだけ返す（R2 / Bunny からはストレージの鍵で読む。公開のURLは渡さない）。

| 種類 | 変換 | 受け付ける元の大きさ |
|---|---|---|
| 写真 | 上の写真と同じ（WebP・1600px・位置情報など消す）。iPhone の HEIC は heif-convert で JPEG にしてから | 25MB まで |
| 動画 | 上の動画と同じ（720p・はじめの60秒）＋サムネイル | 100MB まで |
| 音 | AAC 128kbps（MP4）、メタデータを消す、30分まで | 30MB まで |
| ファイル | そのまま。PDF・テキスト・CSV・ZIP・Word/Excel/PowerPoint だけ。中身の先頭が名乗った種類と合うか確かめる | 20MB まで |

Cloud Run は1回のリクエストが 32MiB までなので、**8MB ずつに分けて送る**：`POST /media/files`（名前・種類・大きさ）→ `POST /media/files/:id/parts/:n` → `POST /media/files/:id/done`。
分けた途中のものは R2（なければ Bunny）の `tmp/clip/` に置き、done で消す。回数の上限：とりこみ 60回/時、分けた送信 600回/時、バティに見せる 20回/時。

## 費用の考え方
- 1日88分しか使えない → 最大でも月44時間。全部を動画にしても 720p・1.5Mbps なら **月約30GB/人**。
- Bunny の Volume ネットワーク（約 $0.005/GB）なら約23円/人、Standard（約 $0.03/GB）だと約135円/人。
  → 人が増えてきたら Pull Zone を **Volume** に切り替える（P-MEDIA-4）。
- ~~保存は1人1GBまで（`STORAGE_QUOTA_BYTES`）~~ → R18：会員 5GB・会員でない人 1GB、増やすのは月ごとの「保存の魔法」（下）。
- ファイル名は毎回新しい ID なので、同じファイルは二度と変わらない → ブラウザに1年キャッシュさせてよい。

## Bunny 側で設定すること（管理画面）
1. Pull Zone → Caching：**Browser Cache Expiration を 1年**（または「最大」）。Edge のキャッシュも長く。
2. Pull Zone → Security：Allowed Referrers に `oboloorder-web.vercel.app`（よそのサイトへの直リンク防止）。
3. Pull Zone → Limits：月の配信量の上限（例 100GB）。
4. Billing：残高の自動チャージに上限、残高が少ない時のメール通知。

## R18：保存先を Cloudflare R2 へ・ブルーナの広さ・保存の魔法（クライアント決定 2026-11-25）
- 保存は **Cloudflare R2** に移す（配信は無料、保存は **$0.015 / GB・月**。料金ページで確認）。値段は R2 から決める（`STORAGE_GB_MONTH_USD`）。移す作業は下の「Bunny から R2 へ」。
- ブルーナの広さ：会員 **5GB**（`STORAGE_MEMBER_GB`）、会員でない人 **1GB**（`STORAGE_FREE_GB`）。その人の保存しているもの全部を数える：とりこんだもの、作った作品とその版・分けた音・君の声の版・ポスター・場面の絵（`media_objects.size_bytes`）、本とゲームの文字。
- 広げる：**保存の魔法**（＋10／30／100GB・月、マナで毎月）。値段・唱え方・足りない時・やめる時は [マナの値段.md](マナの値段.md) 13.。
- 100% で、新しく保存すること（とりこむ・作る）が止まる。**自動で消すことはしない**。ブルーナで作品を開いた時の小さな〔消す〕で、作品とその版・分けた音・ファイルを消すと広さが戻る。
- ブルーナの上に、しずかな線で「ブルーナ：2.1GB / 5GB」。

### 長く来ていない人（これからの決まり・まだ作らない）
- 会員でない人が **12か月** アプリを開いていない時：メールで知らせ、次に来た時にバティからも一度知らせる。
- さらに **3か月**（あわせて15か月）たっても来ない時：ファイルを安い保存（R2 Infrequent Access など）へ **しまい直す**（アーカイブ）。本人のものとして残し、頼まれたら戻す。
- 本人の言葉なしに消すことはしない。消す決まりを作る時は、利用規約に書き、前もって知らせてから（`INACTIVE_POLICY`、`packages/shared/src/storage.ts`）。
- 会員（オボロオーダー）は、来ていなくても何もしない。

## Bunny から R2 へ（クライアント決定 2026-11-25）
新しいファイルは R2 へ。前からのファイルは裏で R2 に写し、全部写し終わったら Bunny を解約する。R2 は配信が無料なので、見る人が増えても配信の費用は増えない。

### しくみ（`packages/media`、`apps/api/src/media/backends.ts`・`r2-move.ts`）
- R2 は S3 と同じ API（`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`、region `auto`）。SDK は入れず、署名（AWS Signature V4）を `packages/media/src/r2.ts` で作る（AWS の例と同じ署名になることをテストで確かめている）。置く・読む（Range も）・大きさを見る・消す・バケットの中で写す。
- どこに置くか：`R2_ACCOUNT_ID`・`R2_BUCKET`・`R2_ACCESS_KEY_ID`・`R2_SECRET_ACCESS_KEY`・`R2_PUBLIC_BASE` が **5つとも** そろうと、新しいファイルは R2（URL は `https://media.obolo.life/<key>`）。1つでも欠けると今までどおり Bunny、どちらもなければ Postgres（開発だけ）。
- 行ごとに、どこにあるかを `media_objects.storage` に書く（`r2` / `bunny` / `db`）。URL から推測しない。写す作業の記録は `move_state`・`move_tries`・`move_error`・`moved_at`（migration `0054_r2_media`）。
- キーは Bunny と R2 で同じ（`photo/ab/<userId>/<uuid>.webp` など）。URL の違いは頭（`https://<BUNNY_CDN_HOST>/` ↔ `https://media.obolo.life/`）だけ。
- `Cache-Control`：ファイル名は毎回新しい ID で中身は二度と変わらないので `public, max-age=31536000, immutable`。ブルーナの📎（`file/…`）は `private, …`（共有のキャッシュに置かない）、分けて送る途中のもの（`tmp/…`）は `no-store`。`Content-Type` は保存した時の種類。
- 消す時は、そのファイルを持っている所すべてから消す（R2 の行は R2、写した元が残る Bunny も。Bunny の行は Bunny と、写しかけの R2 も）。
- 非公開のファイル（ブルーナの📎）も、API がストレージの鍵で読んで渡す（R2 でも同じ）。

### 写し方（3つの段階・何度動かしても同じ結果）
1. **写す**：`storage = 'bunny'` の生きている行を少しずつ（既定 25 件ずつ、4 本並べて）：Bunny Storage から鍵で読む（CDN を通さない）→ 長さが行の `size_bytes` と同じか → 同じキーで R2 に置く → R2 で大きさを見て同じか → `move_state = 'copied'`。この間も行は Bunny の URL のままで、見る人には何も変わらない。
   - R2 にもう同じ大きさで置いてあれば、写さずに印だけ（途中で止まっても続きから）。
   - Bunny に無い（404）は `missing`（写すものがない）。ほかの失敗は `failed`、5回まで自動でやり直す。
   - 写している間に消された行は、R2 の写しも消す。
2. **切り替える**：待っているものも失敗も 0 になったら、1つのトランザクションで：写した行を `storage = 'r2'`・URL を R2 に。さらに **ほかの全部の表の文字と JSON の列** で、Bunny の URL の頭を R2 の頭に置き換える（キーが同じなので、それで全部つながる）。
   - 置き換える列は決め打ちにせず、Postgres の `information_schema` から、`media_objects` 以外の public の表の `text`・`varchar`・`jsonb`・`json` の列を全部見る。今の schema で URL を持つのは：`users`（`puni_pic_url`・`chibi_pic_url`・`butterfly_url`・`voice_kororin_url`・`voice_self_url`・`voice_bati_url`・`avatar_url`・`bati_image_url`、`batis_json`・`look_json`・`jupiter_branches` など）、`buddy_messages`（`audio_url`・`extra_json`）、`saturn_posts`（`voice_audio_url`・`photo_url`）、`planet_posts`・`mars_backstage`・`jupiter_roots`・`jupiter_posts`・`deliveries`（`url`・`poster_url`）、`invites.voice_url`、`songs`（`instrumental_url`・`mix_url`・`phrases_json`・`mix_json` など）、`radio_shows`（`audio_url`・`thumb_url`・`cues_json`）、`radio_lives.thumb_url`、`dm_messages.audio_url`、`dachi_messages`（`audio_url`・`work_json`）、`mv_projects`（`video_url`・`lyrics_video_url`・`poster_url`・`materials_json`・`plan_json`）、`jobs`（`input_json`・`result_json`）、`line_voices.url`、`moon_works`（`versions_json`・`materials_json`・`origin_json`）、`books.cover_url`、`games.versions_json` ほか。実際に置き換えた列と行の数は、ログと `POST /admin/media/r2/move` の答え（`columns`）に出る。
3. **解約してよいか**：`GET /admin/media/r2/ready` が `ready: true`（Bunny にある生きた行が 0、どの列にも Bunny の URL が 0）。

### 動かし方（リリースの後）
- 前もって：GitHub Actions の Secrets `R2_ACCESS_KEY_ID`・`R2_SECRET_ACCESS_KEY`、Variables `R2_ACCOUNT_ID`・`R2_BUCKET`・`R2_PUBLIC_BASE`（クライアント設定済み）。Deploy API が鍵を Secret Manager（`obolo-r2-access-key-id`・`obolo-r2-secret-access-key`）に書き、Cloud Run にはそこから渡す。**デプロイ用のサービスアカウント（obolo-deployer）に Secret Manager の権限が要る**（下）。権限がない・鍵がない時は、警告を出して Bunny のまま（デプロイは止まらない）。
- リリースすると、新しいファイルは R2 へ（API の起動ログ `media storage: new files → R2 (Bunny kept for the files from before)`）。
- 写す：Actions → **Media to R2** → `move`（30分ずつ。何度でも）。または Variable `R2_MIGRATE=true` で、API が動いている間 30 秒ごとに 1 回分（Cloud Run は `min-instances=0` なので、だれも使っていない時は止まる。急ぐ時は workflow で）。
- 様子：Actions → **Media to R2** → `status`（`total / migrated / waiting / failed / missing / GB`、失敗の理由 20 件）。失敗したものは `retry` のあと `move`。
- 切り替えは、写し終わった次の `move` で自動。
- 解約の前に：Actions → **Media to R2** → `ready` が緑。そのあと **1 週間ほど** Bunny を残す（ブラウザやアプリに残っている古い URL・Redis の短いキャッシュのため）。それから Bunny を解約し、Variables の `BUNNY_STORAGE_ZONE`・`BUNNY_CDN_HOST` を消し、`R2_MIGRATE` を消す。
- 管理の API（`x-admin-token`）：`GET /admin/media/r2`、`POST /admin/media/r2/move?n=100`、`POST /admin/media/r2/retry`、`GET /admin/media/r2/ready`。

### クライアントにお願いすること
- obolo-deployer に Secret Manager の権限（鍵を作る・版を足す・今の値と比べる）：Cloud Shell で
  `gcloud projects add-iam-policy-binding <PROJECT_ID> --member=serviceAccount:obolo-deployer@<PROJECT_ID>.iam.gserviceaccount.com --role=roles/secretmanager.admin`
  （広すぎると思う時は、先に2つの鍵を Cloud Shell で作り、その2つにだけ `roles/secretmanager.secretVersionManager` と `roles/secretmanager.secretAccessor` を付けてもよい）
- R2 のバケットに **ライフサイクルのルール**：`tmp/` で始まるものを 1 日で消す（とりこみの途中で止まった分）。
- Cloudflare の **Cache Rule**（media.obolo.life）：「Eligible for cache」・Edge TTL は「元の Cache-Control に従う」。動画（mp4）も端で持つように。
- CORS は今の4つ（vercel.app・obolo.life・www・localhost）。Vercel のプレビュー URL から絵を `crossOrigin` で読む所は、プレビューでは読めないことがある（本番は大丈夫）。
- 公開ドメインはバケット全体を見せる（Bunny の Pull Zone と同じ）。ブルーナの📎は推測できない ID のキーで、URL はアプリに出さない。もっと固くするなら、Cloudflare の WAF で `media.obolo.life/file/*` を止める（API はストレージの鍵で読むので困らない）。

### 動画
- MP4 は今までどおり、はじめから再生できる形（`+faststart`）で 1 本のファイル。R2 の公開ドメインは Range を受けるので、途中から再生・シークができる。
- HLS（画質を自動で切り替える配信）は今はしない。720p・1.5Mbps の短い動画なのでいらない。長い動画や遅い回線が問題になったら、Cloudflare Stream か、HLS に切ったファイルを R2 に置くことを考える。

