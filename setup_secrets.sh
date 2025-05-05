#!/bin/bash
# Secret Manager 初期セットアップスクリプト
# -------------------------------------------
# 本スクリプトは以下を行います。
#   1. Firebase / Algolia / Generative AI などのシークレットを登録
#   2. Cloud Build / Cloud Run サービスアカウントへ閲覧権限を付与
# 値を対話的に入力するか、環境変数に事前設定してください。

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-specsheet-generator}"
REGION="${REGION:-asia-northeast1}"
RUN_SA="frontend-sa@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
CB_SA="service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com"

function create_or_update_secret() {
  local NAME="$1"; shift
  local VALUE="$1"; shift

  if ! gcloud secrets describe "$NAME" >/dev/null 2>&1; then
    echo "[INFO] シークレット $NAME を作成します"
    gcloud secrets create "$NAME" --replication-policy="automatic"
  fi
  echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=-
  echo "[INFO] $NAME のバージョンを追加しました"
}

function add_accessor() {
  local NAME="$1"; shift
  local MEMBER="$1"; shift

  gcloud secrets add-iam-policy-binding "$NAME" \
    --member="serviceAccount:$MEMBER" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
}

read -rp "NEXT_PUBLIC_FIREBASE_API_KEY: " FIREBASE_API_KEY
read -rp "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: " FIREBASE_AUTH_DOMAIN
read -rp "NEXT_PUBLIC_FIREBASE_PROJECT_ID: " FIREBASE_PROJECT_ID
read -rp "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: " FIREBASE_STORAGE_BUCKET
read -rp "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: " FIREBASE_SENDER_ID
read -rp "NEXT_PUBLIC_FIREBASE_APP_ID: " FIREBASE_APP_ID

read -rp "Firebase Admin Key のパス(JSON) または直接ペースト: " FIREBASE_ADMIN_KEY_CONTENT

read -rp "NEXT_PUBLIC_ALGOLIA_APP_ID: " ALGOLIA_APP_ID
read -rp "NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY: " ALGOLIA_SEARCH_KEY
read -rp "ALGOLIA_ADMIN_API_KEY: " ALGOLIA_ADMIN_KEY
read -rp "ALGOLIA_INDEX_NAME (specs): " ALGOLIA_INDEX_NAME
ALGOLIA_INDEX_NAME="${ALGOLIA_INDEX_NAME:-specs}"

read -rp "GOOGLE_GENERATIVE_AI_API_KEY: " GENERATIVE_AI_KEY

echo "\n=== シークレットを登録します ==="
create_or_update_secret NEXT_PUBLIC_FIREBASE_API_KEY "$FIREBASE_API_KEY"
create_or_update_secret NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN "$FIREBASE_AUTH_DOMAIN"
create_or_update_secret NEXT_PUBLIC_FIREBASE_PROJECT_ID "$FIREBASE_PROJECT_ID"
create_or_update_secret NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET "$FIREBASE_STORAGE_BUCKET"
create_or_update_secret NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "$FIREBASE_SENDER_ID"
create_or_update_secret NEXT_PUBLIC_FIREBASE_APP_ID "$FIREBASE_APP_ID"
create_or_update_secret FIREBASE_ADMIN_KEY "$FIREBASE_ADMIN_KEY_CONTENT"
create_or_update_secret NEXT_PUBLIC_ALGOLIA_APP_ID "$ALGOLIA_APP_ID"
create_or_update_secret NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY "$ALGOLIA_SEARCH_KEY"
create_or_update_secret ALGOLIA_ADMIN_API_KEY "$ALGOLIA_ADMIN_KEY"
create_or_update_secret ALGOLIA_INDEX_NAME "$ALGOLIA_INDEX_NAME"
create_or_update_secret GOOGLE_GENERATIVE_AI_API_KEY "$GENERATIVE_AI_KEY"

echo "\n=== IAM ポリシー バインド (secretAccessor) を付与します ==="
for SA in "$RUN_SA" "$CB_SA"; do
  for SECRET in \
    NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID NEXT_PUBLIC_FIREBASE_APP_ID \
    FIREBASE_ADMIN_KEY NEXT_PUBLIC_ALGOLIA_APP_ID NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY ALGOLIA_ADMIN_API_KEY \
    ALGOLIA_INDEX_NAME GOOGLE_GENERATIVE_AI_API_KEY; do
    add_accessor "$SECRET" "$SA"
  done
  echo "[INFO] $SA に secretAccessor 権限を付与しました"
done

echo "\n=== 完了 ==="
echo "Cloud Build で 'gcloud builds submit --config=cloudbuild.yaml .' を実行してデプロイをテストしてください。" 