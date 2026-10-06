#!/usr/bin/env bash
# Stores the Stripe keys for the Day 9 Eclipse payment in Secret Manager (docs/deploy.md "Stripe").
# Run it in Cloud Shell. Re-running adds a new version of each secret (e.g. test → live keys).
# The API only reads them once the GitHub variable STRIPE_PUBLISHABLE_KEY is set (see the end).
set -uo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

REGION=asia-northeast1
say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
read -rp "プロジェクトID [${PROJECT_ID}]: " IN; PROJECT_ID="${IN:-$PROJECT_ID}"
[ -n "$PROJECT_ID" ] || fail "プロジェクトIDが空です"
gcloud config set project "$PROJECT_ID" >/dev/null || fail "プロジェクト $PROJECT_ID が見つかりません"

echo
echo "Stripe ダッシュボード →「開発者」→「API キー」の「シークレットキー」を貼り付けてください"
echo "（テストは sk_test_… 、本番は sk_live_… 。入力した文字は表示されません）"
read -rsp "シークレットキー: " SK; echo
case "$SK" in sk_test_*|sk_live_*|rk_test_*|rk_live_*) ;; *) fail "sk_test_ / sk_live_ で始まるキーを貼り付けてください" ;; esac
echo
echo "Webhook の署名シークレット（whsec_…）。まだ無ければ空のまま Enter"
read -rsp "署名シークレット: " WH; echo
case "$WH" in ''|whsec_*) ;; *) fail "whsec_ で始まる値を貼り付けてください（無ければ空のまま）" ;; esac

put_secret() { # name value
  if gcloud secrets describe "$1" >/dev/null 2>&1; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else
    printf '%s' "$2" | gcloud secrets create "$1" --data-file=- >/dev/null
  fi
}

say "Secret Manager に保存"
put_secret obolo-stripe-secret-key "$SK" || fail "obolo-stripe-secret-key を保存できませんでした"
ok "obolo-stripe-secret-key"
if [ -n "$WH" ]; then
  put_secret obolo-stripe-webhook-secret "$WH" && ok "obolo-stripe-webhook-secret"
elif ! gcloud secrets describe obolo-stripe-webhook-secret >/dev/null 2>&1; then
  put_secret obolo-stripe-webhook-secret PLACEHOLDER && ok "obolo-stripe-webhook-secret（あとで設定）"
fi

URL=$(gcloud run services describe obolo-api --region "$REGION" --format='value(status.url)' 2>/dev/null)
MODE=テスト; case "$SK" in *_live_*) MODE=本番 ;; esac

printf '\n\033[1;32m完了！（%sモードのキー）\033[0m 残りは2つです\n\n' "$MODE"
echo "1) GitHub → Settings → Secrets and variables → Actions → Variables に追加"
echo "     名前: STRIPE_PUBLISHABLE_KEY   値: pk_test_…（Stripe の「公開可能キー」）"
echo "2) GitHub → Actions → Deploy API → Run workflow"
echo
echo "（任意）Webhook を使う場合: Stripe →「開発者」→「Webhook」→ エンドポイントを追加"
echo "     URL:      ${URL:-https://<API の URL>}/billing/webhook"
echo "     イベント: checkout.session.completed / customer.subscription.updated / customer.subscription.deleted"
echo "   表示された whsec_… を、このスクリプトをもう一度実行して貼り付け → もう一度 Deploy API"
