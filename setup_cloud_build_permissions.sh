#!/bin/bash
set -e

# プロジェクト情報
PROJECT_ID="specsheet-generator"
PROJECT_NUMBER="503166429433"

# サービスアカウント
CLOUDBUILD_SA="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"
COMPUTE_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
FRONTEND_SA="frontend-sa@$PROJECT_ID.iam.gserviceaccount.com"
BACKEND_SA="backend-sa@$PROJECT_ID.iam.gserviceaccount.com"

echo "Cloud Buildに必要な権限を設定します..."

# Cloud Build サービスアカウントに Cloud Run 管理者ロールを付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/run.admin"

# 追加でComputeサービスアカウントにも権限付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/run.admin"

# Cloud Build サービスアカウントに Service Account User ロールを付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/iam.serviceAccountUser"

# Cloud Build サービスアカウントに Storage 管理者ロールを付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/storage.admin"

# Cloud Build サービスアカウントに Artifact Registry 管理者ロールを付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/artifactregistry.admin"

# Cloud Build がサービスアカウントを利用できるようにする
gcloud iam service-accounts add-iam-policy-binding $FRONTEND_SA \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding $FRONTEND_SA \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/iam.serviceAccountUser"

# Secret Manager へのアクセス権を付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/secretmanager.secretAccessor"

echo "権限設定が完了しました。Cloud Buildを再実行してください。" 