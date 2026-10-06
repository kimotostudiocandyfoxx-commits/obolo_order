#!/usr/bin/env bash
# One-time setup for the Mercury instrumental GPU service (gpu/music) on Cloud Run + NVIDIA L4.
# Run it in Cloud Shell. Safe to re-run.
set -uo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
read -rp "プロジェクトID [${PROJECT_ID:-obolo-order}]: " IN; PROJECT_ID="${IN:-${PROJECT_ID:-obolo-order}}"
gcloud config set project "$PROJECT_ID" >/dev/null || fail "プロジェクト $PROJECT_ID が見つかりません"
echo "GPU を使うリージョン。Cloud Run の GPU は東京ではまだ使えないので、アジアはシンガポール asia-southeast1"
read -rp "リージョン [asia-southeast1]: " REGION; REGION="${REGION:-asia-southeast1}"

BUCKET="$PROJECT_ID-models-$REGION"
MUSIC_SA="obolo-music-runtime@$PROJECT_ID.iam.gserviceaccount.com"
API_SA="obolo-api-runtime@$PROJECT_ID.iam.gserviceaccount.com"

say "API を有効化"
gcloud services enable run.googleapis.com storage.googleapis.com artifactregistry.googleapis.com --quiet >/dev/null || fail "API を有効にできません"
ok "Cloud Run / Cloud Storage"

say "GPU サービス用のアカウント"
gcloud iam service-accounts describe "$MUSIC_SA" >/dev/null 2>&1 || gcloud iam service-accounts create obolo-music-runtime --display-name "OBOLO music GPU" --quiet >/dev/null
sleep 5
ok "$MUSIC_SA"

say "AI モデルの置き場（Cloud Storage）"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --quiet >/dev/null || fail "バケットを作れません"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$MUSIC_SA" --role=roles/storage.objectAdmin --quiet >/dev/null
ok "gs://$BUCKET"

DEPLOY_SA="obolo-deployer@$PROJECT_ID.iam.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$DEPLOY_SA" --role=roles/storage.objectAdmin --quiet >/dev/null
ok "GitHub のデプロイからモデルを置ける（$DEPLOY_SA）"

say "API から GPU サービスを呼べるようにする"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$API_SA" --role=roles/run.invoker --condition=None --quiet >/dev/null
ok "$API_SA → run.invoker"

printf '\n\033[1;32m完了！\033[0m 残りは GitHub での3ステップです\n\n'
echo "1) GitHub → Settings → Secrets and variables → Actions → Variables に追加"
echo "     名前: MUSIC_REGION   値: $REGION"
echo "2) GitHub → Actions → Deploy Music GPU → Run workflow（初回は 15〜25 分）"
echo "3) 終わったら GitHub → Actions → Deploy API → Run workflow"
echo
echo "※ Deploy Music GPU が「quota（割り当て）」で失敗したら、Google Cloud の「IAM と管理 → 割り当て」で"
echo "   『Total Nvidia L4 GPU allocation without zonal redundancy』（$REGION）を 1 以上に申請してください。"
