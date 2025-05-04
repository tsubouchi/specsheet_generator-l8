#!/bin/bash
set -e

# プロジェクト情報
PROJECT_ID="specsheet-generator"
REGION="asia-northeast1"
SERVICE_NAME="specsheet-generator"

echo "=== 問題を修正するスクリプトを実行します ==="

# 1. Firebase Admin SDKのサービスアカウントキーを再作成
echo "1. Firebase Admin SDKのサービスアカウントキーを再作成します..."
# サービスアカウントがない場合は作成
gcloud iam service-accounts describe firebase-admin-sa@$PROJECT_ID.iam.gserviceaccount.com > /dev/null 2>&1 || \
  gcloud iam service-accounts create firebase-admin-sa \
    --display-name="Firebase Admin SDK Service Account" \
    --project=$PROJECT_ID

# 権限を付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:firebase-admin-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:firebase-admin-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

# サービスアカウントキーを作成
echo "サービスアカウントキーを作成します..."
gcloud iam service-accounts keys create firebase-admin-key.json \
  --iam-account=firebase-admin-sa@$PROJECT_ID.iam.gserviceaccount.com

# キーをSecret Managerに保存
echo "キーをSecret Managerに保存します..."
gcloud secrets describe FIREBASE_ADMIN_KEY > /dev/null 2>&1 || \
  gcloud secrets create FIREBASE_ADMIN_KEY --replication-policy="automatic"

cat firebase-admin-key.json | gcloud secrets versions add FIREBASE_ADMIN_KEY --data-file=-

# キーファイルの削除（セキュリティのため）
rm firebase-admin-key.json

# 2. Algolia環境変数の設定
echo "2. Algolia環境変数を設定します..."

# Secret Managerから値を取得するか、存在しない場合はユーザー入力を求める
retrieve_secret() {
  local secret_name=$1
  local prompt_message=$2
  local default_value=$3
  
  if gcloud secrets describe $secret_name > /dev/null 2>&1; then
    echo "シークレット $secret_name が見つかりました。最新の値を取得します..."
    value=$(gcloud secrets versions access latest --secret=$secret_name)
    echo "シークレット $secret_name の値を取得しました。"
  else
    echo "シークレット $secret_name が見つかりませんでした。"
    read -p "$prompt_message" input_value
    value=${input_value:-$default_value}
  fi
  echo "$value"
}

# 既存のCloud Runサービスから環境変数を取得する
retrieve_from_cloud_run() {
  local env_var_name=$1
  local default_value=$2
  
  if gcloud run services describe $SERVICE_NAME --region=$REGION > /dev/null 2>&1; then
    echo "Cloud Runサービスから $env_var_name の値を取得します..."
    value=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.containers[0].env.find(key='$env_var_name').value)")
    if [ -n "$value" ]; then
      echo "Cloud Runサービスから $env_var_name の値を取得しました。"
      echo "$value"
      return
    fi
  fi
  
  echo "$default_value"
}

# Algolia値を取得
ALGOLIA_APP_ID=$(retrieve_secret "NEXT_PUBLIC_ALGOLIA_APP_ID" "Algolia App ID を入力してください: " "")
ALGOLIA_ADMIN_API_KEY=$(retrieve_secret "ALGOLIA_ADMIN_API_KEY" "Algolia Admin API Key を入力してください: " "")
ALGOLIA_INDEX_NAME=$(retrieve_secret "ALGOLIA_INDEX_NAME" "Algolia Index Name を入力してください [specs]: " "specs")
ALGOLIA_SEARCH_API_KEY=$(retrieve_secret "NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY" "Algolia Search API Key を入力してください (空白の場合はAdmin Keyを使用): " "$ALGOLIA_ADMIN_API_KEY")

# 入力値が空の場合の対応
if [ -z "$ALGOLIA_APP_ID" ]; then
  echo "警告: Algolia App ID が設定されていません。全文検索機能は無効になります。"
fi

if [ -z "$ALGOLIA_ADMIN_API_KEY" ]; then
  echo "警告: Algolia Admin API Key が設定されていません。全文検索機能は無効になります。"
fi

if [ -z "$ALGOLIA_INDEX_NAME" ]; then
  ALGOLIA_INDEX_NAME="specs"
  echo "Algolia Index Name はデフォルト値 'specs' に設定されました。"
fi

if [ -z "$ALGOLIA_SEARCH_API_KEY" ] && [ -n "$ALGOLIA_ADMIN_API_KEY" ]; then
  ALGOLIA_SEARCH_API_KEY="$ALGOLIA_ADMIN_API_KEY"
  echo "Algolia Search API Key が設定されていないため、Admin API Key を使用します（本番環境では別のキーを使用することを推奨）。"
fi

# Algolia環境変数をSecret Managerに保存
for KEY_NAME in NEXT_PUBLIC_ALGOLIA_APP_ID NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY ALGOLIA_ADMIN_API_KEY ALGOLIA_INDEX_NAME
do
  VALUE=""
  case $KEY_NAME in
    NEXT_PUBLIC_ALGOLIA_APP_ID)
      VALUE="$ALGOLIA_APP_ID"
      ;;
    NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY)
      VALUE="$ALGOLIA_SEARCH_API_KEY"
      ;;
    ALGOLIA_ADMIN_API_KEY)
      VALUE="$ALGOLIA_ADMIN_API_KEY"
      ;;
    ALGOLIA_INDEX_NAME)
      VALUE="$ALGOLIA_INDEX_NAME"
      ;;
  esac

  # シークレットが存在しなければ作成、存在すれば新しいバージョンを追加
  if [ -n "$VALUE" ]; then
    gcloud secrets describe $KEY_NAME > /dev/null 2>&1 || \
      gcloud secrets create $KEY_NAME --replication-policy="automatic"
    
    echo -n "$VALUE" | gcloud secrets versions add $KEY_NAME --data-file=-
    echo "シークレット $KEY_NAME を設定しました。"
  else
    echo "警告: $KEY_NAME の値が空のため、シークレットを更新しません。"
  fi
done

# 3. Cloud Runサービスを更新するための準備
echo "3. 既存のサービスを確認します..."

if gcloud run services describe $SERVICE_NAME --region=$REGION > /dev/null 2>&1; then
  echo "既存のサービスが見つかりました。環境変数の競合を避けるため、以下のいずれかの方法を選択してください:"
  echo "1. サービスを削除して再作成（推奨）"
  echo "2. 現在のサービスの環境変数を維持したまま更新"
  read -p "選択肢を入力してください (1 or 2): " choice
  
  if [ "$choice" = "1" ]; then
    echo "サービスを削除します..."
    gcloud run services delete $SERVICE_NAME --region=$REGION --quiet
    echo "サービスを削除しました。新しいCloud Buildを実行して再デプロイしてください。"
  else
    echo "現在の環境変数を維持します。cloudbuild.yamlのCloud Run環境変数設定を修正する必要があります。"
    echo "手動で次の変更を行ってください:"
    echo "1. Cloud Runのコンソールで現在の環境変数を確認"
    echo "2. cloudbuild.yamlから重複している '--set-env-vars=' を削除"
    echo "3. Gitにコミットして再度ビルドを実行"
  fi
else
  echo "サービスはまだ作成されていません。Cloud Buildを実行してデプロイしてください。"
fi

echo "=== スクリプトが完了しました ==="
echo "次のコマンドを実行してCloud Buildを実行してください:"
echo "gcloud builds submit --config=cloudbuild.yaml ." 