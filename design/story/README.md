# 物語の素材の置き場（2026-10-13）

物語の人物・場所の絵、クライアントから届いたものはここに置く。届いていないものは Seedream で候補を描いて選んでもらう。
いま何が足りないかは `docs/story-import/assets.md`、見比べは `/preview/story-assets`。

## 届いた絵の置き方

| 何 | 置く場所 | 中身 |
|---|---|---|
| 人物 | `design/story/cast/<台本での名前>/` | 1枚目（名前順で最初）＝立ち絵。全身・正面寄り。背景は透過でも単色でもよい（単色ならこちらで切り抜く）。2枚目以降は表情・別の姿など（任意） |
| 場所 | `design/story/places/<場所の名前>/` | 縦長の背景（あれば 720×1280 以上）。横長なら縦に切り出す |

- フォルダ名は台本の名前そのまま（`エビ`、`mercury-beach`）。人物表で「同じ姿でよい呼び方」に書かれた名前は1つにまとまる。
- 置いたら `design/story-picks.json` で `"エビ": "client"` のように指定 → ワークフロー（story-assets）が切り抜き・縮小して本番の置き場へ。

## 描く絵（届いていないもの）

1. `design/story-assets-queue.json` の `paint` に名前を足す → ワークフロー「Story assets」が、人物表・場所表の説明から候補を3枚ずつ描く（`public/story/candidates/`）。
2. `/preview/story-assets` で見比べて、クライアントが番号で選ぶ。
3. `design/story-picks.json` に `"エビ": "2"`（候補の番号）→ 切り抜き（人物）・縮小して本番の置き場へ。

## 本番の置き場（アプリが読む）

- 人物の立ち絵：`apps/web/public/story/cast/<id>.webp`（透過、高さ1280まで）＋ `manifest.json`（名前 → 絵）
- 場所：`apps/web/public/story/places/<id>.jpg`（720×1280）
- id は人物表・場所表の `ID：`、なければ名前から自動で作る（`lib/story/sheets.ts` の idOf）
