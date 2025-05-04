#!/bin/bash

# Algolia APIキーをSecret Managerに保存するスクリプト
# 以下の値は実際の値に置き換えてください

# Algoliaアプリケーション情報
ALGOLIA_APP_ID="YOUR_ALGOLIA_APP_ID"
ALGOLIA_SEARCH_API_KEY="YOUR_ALGOLIA_SEARCH_API_KEY"
ALGOLIA_ADMIN_API_KEY="YOUR_ALGOLIA_ADMIN_API_KEY"

# Secret Managerに保存
echo -n "$ALGOLIA_APP_ID" | gcloud secrets create NEXT_PUBLIC_ALGOLIA_APP_ID --replication-policy="automatic" --data-file=- || \
  echo -n "$ALGOLIA_APP_ID" | gcloud secrets versions add NEXT_PUBLIC_ALGOLIA_APP_ID --data-file=-

echo -n "$ALGOLIA_SEARCH_API_KEY" | gcloud secrets create NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY --replication-policy="automatic" --data-file=- || \
  echo -n "$ALGOLIA_SEARCH_API_KEY" | gcloud secrets versions add NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY --data-file=-

echo -n "$ALGOLIA_ADMIN_API_KEY" | gcloud secrets create ALGOLIA_ADMIN_API_KEY --replication-policy="automatic" --data-file=- || \
  echo -n "$ALGOLIA_ADMIN_API_KEY" | gcloud secrets versions add ALGOLIA_ADMIN_API_KEY --data-file=-

echo "Algoliaシークレットの設定が完了しました" 