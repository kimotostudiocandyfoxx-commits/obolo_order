#!/usr/bin/env bash
# Background jobs (songs, MVs) through Cloud Tasks (2026-10-09). Run once in Google Cloud Shell:
#   bash scripts/jobs-setup.sh
# Then add the GitHub repository variable it prints (CLOUD_TASKS_QUEUE) and re-run "Deploy API".
set -euo pipefail
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION=asia-northeast1
RUNTIME_SA=obolo-api-runtime@$PROJECT_ID.iam.gserviceaccount.com
gcloud services enable cloudtasks.googleapis.com --quiet
gcloud tasks queues describe obolo-jobs --location=$REGION >/dev/null 2>&1 \
  || gcloud tasks queues create obolo-jobs --location=$REGION --max-concurrent-dispatches=20 --max-attempts=3 --min-backoff=10s --quiet
# the API puts tasks in the queue, signed as itself (the tasks call the API back with that identity)
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" --role=roles/cloudtasks.enqueuer --condition=None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$RUNTIME_SA" --role=roles/iam.serviceAccountUser --quiet >/dev/null
echo
echo "完了！ GitHub の Variables に次を追加してください:"
echo "  Name : CLOUD_TASKS_QUEUE"
echo "  Value: projects/$PROJECT_ID/locations/$REGION/queues/obolo-jobs"
