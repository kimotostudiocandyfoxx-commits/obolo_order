# デプロイ手順（iPad mini だけで完結）

ローカルにコマンド環境がなくても進められるよう、**ブラウザ（Safari）だけ**でできる手順にしています。
GCP の作業は Google Cloud の **Cloud Shell**（ブラウザ内のターミナル）を使います。

```
[iPad Safari] ──> Vercel (apps/web, ブランチごとにプレビューURL)
                     │  NEXT_PUBLIC_API_URL
                     ▼
               Cloud Run 東京 (apps/api) ──> Cloud SQL PostgreSQL
                     │                  └─> Upstash Redis（セッション・制限・キュー）
                     └─> Gemini API / Bunny Storage+CDN
```

## ステップ0：まず Vercel だけで見る（5分）

API がなくても、Web は**デモモード**で全画面を確認できます。

1. https://vercel.com → **Add New… → Project** → GitHub の `obolo_order` を Import
2. **Root Directory** を `apps/web` に変更（Framework は Next.js が自動選択）
3. 環境変数は何も入れずに **Deploy**
4. 以後、ブランチに push するたびに **プレビューURL** が自動で発行されます（PR のコメントにも表示）

> ビルド設定は `apps/web/vercel.json` にあります（モノレポの共有パッケージを先にビルドします）。

## ステップ1：Gemini API キー（3分）

1. https://aistudio.google.com/apikey を開いて Google アカウントでログイン
2. **Create API key**（「APIキーを作成」）→ 表示されたキー（`AIza…`）をメモ

> 無くても進められます（バティは仮の返事になります）。あとから入れ直せます。

## ステップ2：Upstash Redis（5分）

1. https://console.upstash.com → **Create Database**
2. Name: `obolo`、Region: **ap-northeast-1 (Tokyo)**（Primary Region）、プランは Free
3. できたデータベースの画面を下にスクロール → **Connect** の **ioredis** タブにある
   `rediss://default:xxxx@xxxx.upstash.io:6379` をメモ（目のアイコンで伏せ字を外してからコピー）

## ステップ3：Google Cloud（Cloud Shell で 15〜20分。ほぼ待つだけ）

1. https://console.cloud.google.com → 上部のプロジェクト選択 → **新しいプロジェクト**
   - 名前：`obolo-order`（プロジェクトID は自動で付きます）
2. 左メニュー **お支払い（Billing）** でこのプロジェクトに請求先アカウントをリンク
   （Cloud SQL に必要。デモ構成で月 1,500〜2,000円ほど。無料トライアルのクレジットでも可）
3. 右上の **Cloud Shell**（`>_` アイコン）を開き、次の1行を貼り付けて Enter

```bash
curl -fsSL https://raw.githubusercontent.com/kimotostudiocandyfoxx-commits/obolo_order/claude/solar-system-home-planets-ew766y/scripts/gcp-setup.sh -o setup.sh && bash setup.sh
```

4. 聞かれたものを貼り付けて Enter
   - プロジェクトID（表示されていればそのまま Enter）
   - Upstash の URL（ステップ2）
   - Gemini API キー（ステップ1。無ければ空で Enter）
   - 「承認」のポップアップが出たら **承認**
5. 最後に緑で **GCP_PROJECT_ID** と **GCP_PROJECT_NUMBER** が表示されたら完了

> 途中で止まっても、もう一度同じ1行を貼れば続きからやり直せます（作成済みのものはそのまま使います）。

## ステップ4：GitHub に2つの値を登録して API をデプロイ（5分）

1. GitHub のリポジトリ → **Settings → Secrets and variables → Actions → Variables** タブ
   → **New repository variable** で2つ登録

| 名前 | 値 |
|---|---|
| `GCP_PROJECT_ID` | ステップ3の最後に表示された値 |
| `GCP_PROJECT_NUMBER` | ステップ3の最後に表示された値 |

2. **Actions** タブ → 左の **Deploy API** → **Run workflow** → 緑の **Run workflow**
3. 5分ほどで緑のチェック。開くと **API URL: `https://obolo-api-xxxx.asia-northeast1.run.app`** が表示されます
   - その URL の最後に `/readyz` を付けて開き `{"ok":true}` なら DB と Redis につながっています
   - DB のテーブルは起動時に自動で作られます

以後、このブランチに push するたびに API も自動で更新されます。

<details><summary>任意の変数（普段は不要）</summary>

| 名前 | 既定値 / 用途 |
|---|---|
| `CORS_ORIGINS` | `/^https:\/\/obolo[a-z0-9-]*\.vercel\.app$/`。Vercel の URL が `obolo` で始まらない時や正式ドメインを足す時に（カンマ区切り） |
| `WEB_ORIGIN` | 招待メールのリンク先（メール送信を入れたら） |
| `AUTH_DEMO_SHOW_CODE` | 既定 `true`（ログインコードを画面に表示）。メール送信を設定したら `false` |
| `BUNNY_STORAGE_ZONE` / `BUNNY_CDN_HOST` | Bunny を使う時（シークレット `obolo-bunny-storage-key` も本物に更新） |

</details>

## ステップ5：Web と API をつなぐ（3分）

Vercel → Project → **Settings → Environment Variables**
- `NEXT_PUBLIC_API_URL` = Cloud Run の URL（Preview と Production の両方にチェック）
- **Redeploy** すると、デモモードの黄色い帯が消え、本物のログイン・バティ・土星になります

## ステップ6：最初の招待状を出す

OBOLO ORDER は招待制なので、最初の1人は運営が招待します。
1. Google Cloud の **Secret Manager** → `obolo-admin-token` → 最新バージョンの「値を表示」でトークンをコピー
2. Vercel の URL に `/admin/invites` を付けて開く（例：`https://obolo-order-web.vercel.app/admin/invites`）
3. 管理トークン・招待する人のメール・招待者名（例：KIMORIN）を入れて「招待リンクをつくる」
4. できたリンクを、その人に送る（メール自動送信は準備中）

## 動作確認を最初からやり直す

確認用の URL の最後に **`/reset`** を付けて開く（例：`https://obolo-order-web.vercel.app/reset`）。
ログアウトして、デモモードではこの端末に保存されたデモのデータ（アカウント・旅の進み具合）を全部消し、メールアドレス入力から始まる。
※ 本番 API 接続時はログアウトだけ（サーバーのアカウントは消えない）。同じアドレスで入ると続きから再開する。

## よくあるトラブル

| 症状 | 原因と対処 |
|---|---|
| 画面に黄色い「デモモード」帯が出る | `NEXT_PUBLIC_API_URL` が未設定。設定後に Redeploy が必要（ビルド時に埋め込まれるため） |
| ログイン時に「Network error」 | CORS。Vercel の URL が `obolo` で始まらない場合は変数 `CORS_ORIGINS` を追加して Deploy API を再実行 |
| バティがいつも同じような返事 | Gemini キーが未設定（仮返答）。Cloud Shell でセットアップの1行をもう一度実行してキーを入れ、Deploy API を再実行 |
| Deploy API が `Permission denied` / `unauthorized` | 変数の値違い、またはセットアップ直後で権限の反映待ち。数分おいて Re-run |
| 土星の音声が再生されない | Bunny 未設定時は API から仮配信しています。`https://…run.app/media/<id>` が開けるか確認 |
