# アーキテクチャ（スケール前提の設計メモ）

目標：日本で数千万、世界で数億ユーザーまで「作り直さずに」伸ばせること。
10/10 デモは小さい構成で動かしつつ、伸ばすときに差し替える場所を最初から分けてあります。

## 構成

| 層 | 今（デモ） | 伸ばすとき |
|---|---|---|
| フロント | Next.js（Vercel） | そのまま。静的部分は CDN キャッシュ |
| API | NestJS on Cloud Run 東京、**ステートレス** | インスタンス数を増やすだけ。リージョン追加（シンガポール等） |
| セッション・キャッシュ・制限 | Redis（Upstash） | Memorystore / Redis Cluster に URL を変えるだけ |
| 重い処理 | キュー抽象（`QUEUE_DRIVER=inline`） | `bullmq` に切り替え、`dist/worker.js` を別 Cloud Run / GPU ワーカーで実行 |
| DB | Cloud SQL PostgreSQL（1台） | `DATABASE_READ_URL` に読み取りレプリカ → 読み書き分離。接続プール（PgBouncer / Managed Connection Pooling）。惑星ごとのテーブルを別DBへ分離・パーティション |
| メディア | Bunny Storage + CDN（未設定時のみ DB に仮保存） | すべて Bunny。動画は Bunny Stream |
| LLM | Gemini（予備 OpenAI、キー無しは仮返答） | プロバイダ抽象のまま差し替え |

## 守っているルール

- **API はステートレス**：ログイン状態は Redis（`sess:<token>`）、1日の上限・レート制限も Redis。どのインスタンスに当たっても同じ結果。
- **読み書き分離できる作り**：`Database.write`（プライマリ）と `Database.read`（レプリカ）を使い分け。自分の書き込み直後に読む画面（残高・自分の投稿直後）は `write` を使う。
- **ページングはキーセット方式**（`created_at, id` のカーソル）：OFFSET を使わないので何億行でも速い。
- **惑星ごとにテーブル分離**（すべて `user_id` キー）：惑星単位でスケール・削除できる（仕様 §5）。
- **お金は整数・追記のみ・冪等キー**：`packages/ledger` に純粋なルールとテスト。DB 側は `SELECT … FOR UPDATE` でユーザー単位に直列化。MANA→円、MANA→他人 の処理は**存在しない**（仕様 §3.2）。
- **メディアキーはハッシュで分散**：`voice/ab/<userId>/<uuid>.m4a`。
- **多言語**：UI 文言は `apps/web/lib/i18n/{ja,en}.ts`（同じ型を強制）、言語はクッキー＋ブラウザ設定。バティは返答言語をプロンプトで指定。言語追加はファイルを1つ足して `LOCALES` に追加。
- **Web → API の契約**は `packages/shared`（zod スキーマ＋型）。将来のネイティブアプリ（Capacitor）も同じものを使う。

## モノレポ

```
apps/web        Next.js PWA（Vercel）
apps/api        NestJS API + キューワーカー（Cloud Run）
packages/shared 惑星一覧・定数・API の型とバリデーション
packages/ledger MANA / EARNINGS 二重台帳のルール（テスト付き）
packages/ai     LLM ラッパー、バティの人格、記憶要約、モデレーション
packages/media  Bunny のキー設計・アップロード
```

## API 一覧（デモ範囲）

| メソッド | パス | 用途 |
|---|---|---|
| POST | `/auth/request-code` | ログインコード送信 |
| POST | `/auth/verify` | コード確認 → トークン発行（初回は自動登録＋88 MANA） |
| POST | `/auth/logout` | ログアウト |
| GET/PATCH | `/me` | プロフィール |
| GET | `/wallet` | MANA・EARNINGS 残高と履歴（表示のみ） |
| GET/PATCH | `/buddy/profile` | バティの名前・性格スライダー |
| GET | `/buddy/messages` | 会話履歴 |
| GET | `/buddy/quota` | 今日の使用数 |
| POST | `/buddy/chat` | 会話（Gemini＋長期記憶） |
| DELETE | `/buddy/memory` | 記憶と履歴の削除 |
| POST | `/media/voice` | 録音アップロード（`Content-Type: audio/*`） |
| GET | `/saturn/posts` | 土星タイムライン |
| POST | `/saturn/posts` | 声つき投稿 |
| DELETE | `/saturn/posts/:id` | 自分の投稿を削除 |
| POST/DELETE | `/saturn/posts/:id/star` | Star |
| GET | `/healthz` `/readyz` | 稼働確認 |
