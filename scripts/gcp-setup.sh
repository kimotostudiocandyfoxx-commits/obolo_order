#!/usr/bin/env bash
# One-time Google Cloud setup for the OBOLO ORDER API (docs/deploy.md, step 3).
# Run it in Cloud Shell. It asks for the values it needs and can be re-run safely:
# anything that already exists is kept, and secrets get a new version.
set -uo pipefail

REGION=asia-northeast1
GITHUB_REPO=kimotostudiocandyfoxx-commits/obolo_order

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "$PROJECT_ID" ] && [ "$(gcloud projects list --format='value(projectId)' 2>/dev/null | wc -l)" = 1 ]; then
  PROJECT_ID=$(gcloud projects list --format='value(projectId)')
fi
[ -n "$PROJECT_ID" ] || { echo "あなたのプロジェクト一覧:"; gcloud projects list --format='value(projectId)'; }
read -rp "プロジェクトID [${PROJECT_ID}]: " IN; PROJECT_ID="${IN:-$PROJECT_ID}"
[ -n "$PROJECT_ID" ] || fail "プロジェクトIDが空です"
read -rp "Upstash の Redis URL (rediss://...): " REDIS_URL
case "$REDIS_URL" in redis://*|rediss://*) ;; *) fail "Redis URL は rediss:// で始まります" ;; esac
read -rp "Gemini API キー（まだ無ければ空のまま Enter）: " GEMINI_API_KEY
GEMINI_API_KEY="${GEMINI_API_KEY:-PLACEHOLDER}"

gcloud config set project "$PROJECT_ID" >/dev/null || fail "プロジェクト $PROJECT_ID が見つかりません"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

say "API を有効化（1〜2分）"
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  || fail "API を有効にできません。請求先アカウントがプロジェクトにリンクされているか確認してください"
ok "有効化しました"

say "Docker イメージ置き場"
gcloud artifacts repositories describe obolo --location=$REGION >/dev/null 2>&1 \
  || gcloud artifacts repositories create obolo --repository-format=docker --location=$REGION --quiet
ok "obolo"

say "Cloud SQL (PostgreSQL 16)。初回は 5〜10 分かかります"
if ! gcloud sql instances describe obolo-pg >/dev/null 2>&1; then
  gcloud sql instances create obolo-pg --database-version=POSTGRES_16 --region=$REGION \
    --edition=enterprise --tier=db-f1-micro --storage-size=10 --storage-auto-increase --quiet \
    || fail "Cloud SQL を作成できませんでした"
fi
gcloud sql databases describe obolo --instance=obolo-pg >/dev/null 2>&1 \
  || gcloud sql databases create obolo --instance=obolo-pg --quiet
# The password lives only in the database-url secret, so it is set once and kept on re-runs.
DB_PASSWORD=""
if ! gcloud secrets describe obolo-database-url >/dev/null 2>&1; then
  DB_PASSWORD=$(openssl rand -hex 24)
  if gcloud sql users list --instance=obolo-pg --format='value(name)' | grep -qx obolo; then
    gcloud sql users set-password obolo --instance=obolo-pg --password="$DB_PASSWORD" --quiet
  else
    gcloud sql users create obolo --instance=obolo-pg --password="$DB_PASSWORD" --quiet
  fi
fi
INSTANCE="$PROJECT_ID:$REGION:obolo-pg"
ok "$INSTANCE"

put_secret() { # name value
  if gcloud secrets describe "$1" >/dev/null 2>&1; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else
    printf '%s' "$2" | gcloud secrets create "$1" --data-file=- >/dev/null
  fi
  ok "$1"
}
say "シークレット"
[ -n "$DB_PASSWORD" ] && put_secret obolo-database-url "postgres://obolo:$DB_PASSWORD@/obolo?host=/cloudsql/$INSTANCE"
put_secret obolo-redis-url "$REDIS_URL"
if [ "$GEMINI_API_KEY" != PLACEHOLDER ] || ! gcloud secrets describe obolo-gemini-api-key >/dev/null 2>&1; then
  put_secret obolo-gemini-api-key "$GEMINI_API_KEY"
fi
gcloud secrets describe obolo-bunny-storage-key >/dev/null 2>&1 || put_secret obolo-bunny-storage-key PLACEHOLDER
gcloud secrets describe obolo-admin-token >/dev/null 2>&1 || put_secret obolo-admin-token "$(openssl rand -hex 24)"

sa() { # name → creates if missing
  gcloud iam service-accounts describe "$1@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "$1" --quiet
}
bind() { gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$1" --role="$2" --condition=None --quiet >/dev/null; }

say "サービスアカウント"
sa obolo-api-runtime; RUNTIME_SA=obolo-api-runtime@$PROJECT_ID.iam.gserviceaccount.com
sa obolo-deployer;    DEPLOY_SA=obolo-deployer@$PROJECT_ID.iam.gserviceaccount.com
sleep 5 # new service accounts take a moment to become visible to IAM
for r in roles/cloudsql.client roles/secretmanager.secretAccessor; do bind "$RUNTIME_SA" $r; done
for r in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do bind "$DEPLOY_SA" $r; done
ok "obolo-api-runtime / obolo-deployer"

say "GitHub Actions からのデプロイ許可（Workload Identity）"
gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create github --location=global --quiet
gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool=github >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github \
       --issuer-uri=https://token.actions.githubusercontent.com \
       --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
       --attribute-condition="assertion.repository=='$GITHUB_REPO'" --quiet
POOL="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/$POOL/attribute.repository/$GITHUB_REPO" --quiet >/dev/null
ok "$GITHUB_REPO"

printf '\n\033[1;32m完了！ GitHub の Variables に次の2つを登録してください\033[0m\n\n'
printf '  GCP_PROJECT_ID      %s\n' "$PROJECT_ID"
printf '  GCP_PROJECT_NUMBER  %s\n\n' "$PROJECT_NUMBER"
