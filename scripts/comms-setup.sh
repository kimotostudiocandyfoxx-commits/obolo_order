#!/usr/bin/env bash
# Earth mail & phone setup (docs/earth-comms.md). Run in Google Cloud Shell:
#   bash scripts/comms-setup.sh
# Asks for the Agora App Certificate without showing it (it goes straight to Secret Manager).
set -euo pipefail
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
RUNTIME_SA=obolo-api-runtime@$PROJECT_ID.iam.gserviceaccount.com
say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }

say "Firebase（メールのリアルタイム配達）"
gcloud services enable firestore.googleapis.com identitytoolkit.googleapis.com iamcredentials.googleapis.com firebase.googleapis.com --quiet
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 \
  || gcloud firestore databases create --location=asia-northeast1 --quiet
# the API writes messages to Firestore and signs members in (as itself — no key file)
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" --role=roles/datastore.user --condition=None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$RUNTIME_SA" --role=roles/iam.serviceAccountTokenCreator --quiet >/dev/null
ok "Firestore (asia-northeast1) / 権限"

say "Agora（電話の音声）"
read -rsp "  Agora の App Certificate を貼り付けて Enter（画面には出ません。スキップは空のまま Enter）: " CERT; echo
if [ -n "$CERT" ]; then
  if gcloud secrets describe obolo-agora-app-certificate >/dev/null 2>&1; then
    printf '%s' "$CERT" | gcloud secrets versions add obolo-agora-app-certificate --data-file=- --quiet >/dev/null
  else
    printf '%s' "$CERT" | gcloud secrets create obolo-agora-app-certificate --data-file=- --replication-policy=automatic --quiet >/dev/null
  fi
  ok "App Certificate を Secret Manager に保存"
else
  echo "  （スキップしました）"
fi
unset CERT

printf '\n\033[1;32m完了！\033[0m 次は docs/earth-comms.md の手順の続き（GitHub の Variables と Vercel の設定）へ。\n'
