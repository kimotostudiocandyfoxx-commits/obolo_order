# 写真・動画・音の保存と配信（クライアント決定 2026-10-06）

保存は Bunny Storage、配信は Bunny CDN（Pull Zone）。費用が月88円の中に収まるように、
アップロードされたものはサーバーで必ず軽くしてから保存する。

## アップロード時の変換（`apps/api/src/media/transcode.ts`、設定値は `MEDIA_POLICY`）
| 種類 | 変換 | 受け付ける元の大きさ |
|---|---|---|
| 動画 | 短い辺 720px まで（縦なら 720×1280）、H.264 約1.5Mbps、音声 AAC 96kbps、MP4（すぐ再生できる形）、長さは上限で切る（木星は8秒） | 120MB まで |
| 動画のサムネイル | 1コマ目を WebP（480px まで）。一覧ではこれだけ読み込み、動画は開いた時だけ読む | — |
| 写真 | WebP、長い辺 1600px まで、向きを補正し、位置情報などのメタデータは消す | 25MB まで |
| 声（土星） | そのまま（もともと小さい） | 3MB まで |

API：`POST /media/photo`、`POST /media/video?max=<秒>`（本文はファイルそのもの）、`POST /media/voice`。

## 費用の考え方
- 1日88分しか使えない → 最大でも月44時間。全部を動画にしても 720p・1.5Mbps なら **月約30GB/人**。
- Bunny の Volume ネットワーク（約 $0.005/GB）なら約23円/人、Standard（約 $0.03/GB）だと約135円/人。
  → 人が増えてきたら Pull Zone を **Volume** に切り替える（P-MEDIA-4）。
- 保存は1人1GBまで（`STORAGE_QUOTA_BYTES`）。増やす場合は**月額**の追加容量にする（買い切りにすると年々赤字）。
- ファイル名は毎回新しい ID なので、同じファイルは二度と変わらない → ブラウザに1年キャッシュさせてよい。

## Bunny 側で設定すること（管理画面）
1. Pull Zone → Caching：**Browser Cache Expiration を 1年**（または「最大」）。Edge のキャッシュも長く。
2. Pull Zone → Security：Allowed Referrers に `oboloorder-web.vercel.app`（よそのサイトへの直リンク防止）。
3. Pull Zone → Limits：月の配信量の上限（例 100GB）。
4. Billing：残高の自動チャージに上限、残高が少ない時のメール通知。
