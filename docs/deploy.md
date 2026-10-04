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

## ステップ1：Upstash Redis（5分）

1. https://console.upstash.com → **Create Database**
2. Region: **ap-northeast-1 (Tokyo)**、TLS: ON
3. 「Connect」→ **ioredis** タブの URL（`rediss://default:xxxx@xxxx.upstash.io:6379`）をメモ

## ステップ2：Google Cloud（Cloud Shell で 20〜30分）

https://console.cloud.google.com でプロジェクトを作り、右上の **Cloud Shell** アイコンを開いて、
下の値を自分のものに書き換えてから貼り付けます。

```bash
# ===== 書き換える値（P-INFRA-1）=====
PROJECT_ID=obolo-order-prod
GITHUB_REPO=kimotostudiocandyfoxx-commits/obolo_order
DB_PASSWORD='長いランダムな文字列'
REDIS_URL='rediss://default:xxxx@xxxx.upstash.io:6379'
GEMINI_API_KEY='（Google AI Studio で発行。まだ無ければ PLACEHOLDER のまま）'
# ====================================
REGION=asia-northeast1
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com

# Docker イメージ置き場
gcloud artifacts repositories create obolo --repository-format=docker --location=$REGION

# Cloud SQL (PostgreSQL 16) — デモは最小構成。後で読み取りレプリカを追加できます
gcloud sql instances create obolo-pg --database-version=POSTGRES_16 --region=$REGION \
  --tier=db-f1-micro --storage-auto-increase
gcloud sql databases create obolo --instance=obolo-pg
gcloud sql users create obolo --instance=obolo-pg --password="$DB_PASSWORD"
INSTANCE="$PROJECT_ID:$REGION:obolo-pg"

# シークレット
printf '%s' "postgres://obolo:$DB_PASSWORD@/obolo?host=/cloudsql/$INSTANCE" | gcloud secrets create obolo-database-url --data-file=-
printf '%s' "$REDIS_URL"      | gcloud secrets create obolo-redis-url --data-file=-
printf '%s' "$GEMINI_API_KEY" | gcloud secrets create obolo-gemini-api-key --data-file=-
printf '%s' "PLACEHOLDER"     | gcloud secrets create obolo-bunny-storage-key --data-file=-
printf '%s' "$(openssl rand -hex 24)" | gcloud secrets create obolo-admin-token --data-file=-   # 招待発行用。値は Secret Manager の画面で確認

# 実行用サービスアカウント
gcloud iam service-accounts create obolo-api-runtime
RUNTIME_SA=obolo-api-runtime@$PROJECT_ID.iam.gserviceaccount.com
for r in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$RUNTIME_SA --role=$r
done

# GitHub Actions からデプロイするためのサービスアカウント（鍵ファイル不要の Workload Identity）
gcloud iam service-accounts create obolo-deployer
DEPLOY_SA=obolo-deployer@$PROJECT_ID.iam.gserviceaccount.com
for r in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$DEPLOY_SA --role=$r
done
gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition="assertion.repository=='$GITHUB_REPO'"
POOL=$(gcloud iam workload-identity-pools describe github --location=global --format='value(name)')
gcloud iam service-accounts add-iam-policy-binding $DEPLOY_SA --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/$POOL/attribute.repository/$GITHUB_REPO"

echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCP_WIF_PROVIDER=$POOL/providers/github"
echo "GCP_DEPLOY_SA=$DEPLOY_SA"
echo "GCP_RUNTIME_SA=$RUNTIME_SA"
echo "CLOUDSQL_INSTANCE=$INSTANCE"
```

最後に表示された5行をメモします。

## ステップ3：GitHub に値を登録（5分）

GitHub のリポジトリ → **Settings → Secrets and variables → Actions → Variables** タブ → **New repository variable**

| 名前 | 値 |
|---|---|
| `GCP_PROJECT_ID` | ステップ2の出力 |
| `GCP_WIF_PROVIDER` | ステップ2の出力 |
| `GCP_DEPLOY_SA` | ステップ2の出力 |
| `GCP_RUNTIME_SA` | ステップ2の出力 |
| `CLOUDSQL_INSTANCE` | ステップ2の出力 |
| `CORS_ORIGINS` | `/^https:\/\/obolo-order[a-z0-9-]*\.vercel\.app$/`（Vercel のURLに合わせる。正式ドメインはカンマ区切りで追加） |
| `WEB_ORIGIN` | Vercel の URL（招待メールのリンクに使う） |
| `AUTH_DEMO_SHOW_CODE` | デモ中は `true`（ログインコードを画面に表示）。メール送信を設定したら `false` |

（Bunny を使う時は `BUNNY_STORAGE_ZONE` / `BUNNY_CDN_HOST` も追加し、シークレット `obolo-bunny-storage-key` を本物のキーに更新）

## ステップ4：API をデプロイ

GitHub → **Actions → Deploy API → Run workflow**（以後は main への push で自動）。
完了すると Cloud Run の URL（`https://obolo-api-xxxx-an.a.run.app`）が出ます。
`https://…run.app/readyz` を開いて `{"ok":true}` なら DB と Redis につながっています。
DB のテーブルは起動時に自動作成されます（`MIGRATE_ON_START=true`）。

## ステップ5：Web と API をつなぐ

Vercel → Project → **Settings → Environment Variables**
- `NEXT_PUBLIC_API_URL` = Cloud Run の URL（Preview と Production の両方にチェック）
- **Redeploy** すると、デモモードの黄色い帯が消え、本物のログイン・バティ・土星になります

## ステップ6：最初の招待状を出す

OBOLO ORDER は招待制なので、最初の1人は運営が招待します。
1. Google Cloud の **Secret Manager** → `obolo-admin-token` → 最新バージョンの「値を表示」でトークンをコピー
2. Vercel の URL に `/admin/invites` を付けて開く（例：`https://obolo-order-web.vercel.app/admin/invites`）
3. 管理トークン・招待する人のメール・招待者名（例：KIMORIN）を入れて「招待リンクをつくる」
4. できたリンクを、その人に送る（メール自動送信は準備中）

## よくあるトラブル

| 症状 | 原因と対処 |
|---|---|
| 画面に黄色い「デモモード」帯が出る | `NEXT_PUBLIC_API_URL` が未設定。設定後に Redeploy が必要（ビルド時に埋め込まれるため） |
| ログイン時に「Network error」 | CORS。`CORS_ORIGINS` にプレビューURLが一致しているか確認 |
| バティがいつも同じような返事 | `GEMINI_API_KEY` が未設定（オフラインの仮返答）。シークレットを更新して再デプロイ |
| 土星の音声が再生されない | Bunny 未設定時は API から仮配信しています。`https://…run.app/media/<id>` が開けるか確認 |
