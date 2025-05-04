# GCP Cloud Run デプロイ手順書

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [前提条件](#2-前提条件)
3. [必要なAPI有効化](#3-必要なapi有効化)
4. [IAMとサービスアカウントの設定](#4-iamとサービスアカウントの設定)
5. [Artifact Registryの設定](#5-artifact-registryの設定)
6. [Secret Managerの設定](#6-secret-managerの設定)
7. [Firebase設定](#7-firebase設定)
8. [ビルドとデプロイの設定](#8-ビルドとデプロイの設定)
9. [Cloud Runの設定とデプロイ](#9-cloud-runの設定とデプロイ)
10. [ドメイン設定とSSL](#10-ドメイン設定とssl)
11. [監視とロギング](#11-監視とロギング)
12. [運用コマンド集](#12-運用コマンド集)
13. [トラブルシューティング](#13-トラブルシューティング)

## 1. アーキテクチャ概要

```
                                  ┌────────────────────┐
                                  │   Cloud Run        │
                                  │  (フロントエンド)   │
                                  │   Next.js App      │
                                  └─────────┬──────────┘
                                            │
                                            ▼
┌─────────────────┐  API呼び出し  ┌────────────────────┐
│  Firebase Auth  │◄────────────►│   Cloud Run        │
└─────────────────┘              │  (バックエンド)     │
          ▲                      │   API サーバー      │
          │                      └─────────┬──────────┘
          │                                │
          │                                ▼
┌─────────┴───────┐              ┌────────────────────┐
│  Firestore      │◄────────────►│  Secret Manager    │
└─────────────────┘              └────────────────────┘
```

- **フロントエンド**: Next.jsアプリをCloud Runでホスティング
- **バックエンド**: APIサーバーをCloud Runでホスティング
- **認証**: Firebase Authentication
- **データベース**: Firestore
- **シークレット管理**: Secret Manager

### プロジェクト情報

- **プロジェクト名**: specsheet-generator
- **プロジェクト ID**: specsheet-generator
- **プロジェクト番号**: 503166429433
- **親組織**: bonginkan.ai

## 2. 前提条件

- GCPアカウントとプロジェクトが作成済み
- Google Cloud SDK（gcloud CLI）がインストール済み
- Dockerがインストール済み
- Node.js（バージョン16以上）がインストール済み
- `pnpm`または`npm`がインストール済み

## 3. 必要なAPI有効化

以下のAPIを有効化します。

```bash
# 変数設定
PROJECT_ID="specsheet-generator"
REGION="asia-northeast1"

# プロジェクト設定
gcloud config set project $PROJECT_ID

# API有効化
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com \
  cloudresourcemanager.googleapis.com
```

## 4. IAMとサービスアカウントの設定

### 4.1 サービスアカウントの作成

```bash
# フロントエンド用サービスアカウント
gcloud iam service-accounts create frontend-sa \
  --display-name="Frontend Service Account"

# バックエンド用サービスアカウント
gcloud iam service-accounts create backend-sa \
  --display-name="Backend Service Account"
```

### 4.2 IAMロールの割り当て

```bash
# フロントエンド用サービスアカウントの権限設定
gcloud projects add-iam-policy-binding specsheet-generator \
  --member="serviceAccount:frontend-sa@specsheet-generator.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# バックエンド用サービスアカウントの権限設定
gcloud projects add-iam-policy-binding specsheet-generator \
  --member="serviceAccount:backend-sa@specsheet-generator.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding specsheet-generator \
  --member="serviceAccount:backend-sa@specsheet-generator.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding specsheet-generator \
  --member="serviceAccount:backend-sa@specsheet-generator.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### 4.3 Cloud Build用の設定

```bash
# Cloud Buildがサービスアカウントとしてデプロイできるように設定
PROJECT_NUMBER="503166429433"
CB_SA="service-$PROJECT_NUMBER@gcp-sa-cloudbuild.iam.gserviceaccount.com"

# Cloud BuildからCloud Runへデプロイするための権限
gcloud projects add-iam-policy-binding specsheet-generator \
  --member="serviceAccount:$CB_SA" \
  --role="roles/run.admin"

# Cloud BuildがサービスアカウントをImpersonateできるように
gcloud iam service-accounts add-iam-policy-binding \
  frontend-sa@specsheet-generator.iam.gserviceaccount.com \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding \
  backend-sa@specsheet-generator.iam.gserviceaccount.com \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"
```

## 5. Artifact Registryの設定

```bash
# Artifact Registryリポジトリ作成
gcloud artifacts repositories create specsheet-docker \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Docker repository for specsheet generator"

# 認証設定
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```

## 6. Secret Managerの設定

```bash
# APIキーやDB接続情報など機密情報をSecret Managerに保存
gcloud secrets create GOOGLE_GENERATIVE_AI_API_KEY \
  --replication-policy="automatic"

# 値の設定（実際の値に置き換える）
# 注意: 以下のキーは例示用です。本番環境では実際のキーを使用してください
echo -n "AIzaSyCmbs5ZI8CxRunlBsAqjDKrPOiJLmrsDJM" | \
  gcloud secrets versions add GOOGLE_GENERATIVE_AI_API_KEY --data-file=-

# Firebase設定
for KEY in NEXT_PUBLIC_FIREBASE_API_KEY \
           NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
           NEXT_PUBLIC_FIREBASE_PROJECT_ID \
           NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
           NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
           NEXT_PUBLIC_FIREBASE_APP_ID
do
  gcloud secrets create $KEY --replication-policy="automatic" || true
  # 各シークレットには適切な値を設定
  # echo -n "your-value" | gcloud secrets versions add $KEY --data-file=-
done

# 例: Firebase API Keyの登録（注意: これは例示用です）
echo -n "AIzaSyCmbs5ZI8CxRunlBsAqjDKrPOiJLmrsDJM" | \
  gcloud secrets versions add NEXT_PUBLIC_FIREBASE_API_KEY --data-file=-

# 例: Firebaseプロジェクト設定
echo -n "specsheet-generator" | \
  gcloud secrets versions add NEXT_PUBLIC_FIREBASE_PROJECT_ID --data-file=-

echo -n "specsheet-generator.firebaseapp.com" | \
  gcloud secrets versions add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN --data-file=-
```

## 7. Firebase設定

### 7.1 Firebase Admin SDKのサービスアカウント設定

Firebase Admin SDKの初期化エラー（`Service account object must contain a string "private_key" property`）を解決するために、以下の手順を実行します。

```bash
# 1. Firebase用サービスアカウントの作成（既存のservice-accountを使用することも可能）
gcloud iam service-accounts create firebase-admin-sa \
  --display-name="Firebase Admin SDK Service Account" \
  --project=specsheet-generator

# 2. 必要な権限を付与
gcloud projects add-iam-policy-binding specsheet-generator \
  --member="serviceAccount:firebase-admin-sa@specsheet-generator.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding specsheet-generator \
  --member="serviceAccount:firebase-admin-sa@specsheet-generator.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

# 3. サービスアカウントキーを作成（セキュリティのため、使用後は削除することを推奨）
gcloud iam service-accounts keys create firebase-admin-key.json \
  --iam-account=firebase-admin-sa@specsheet-generator.iam.gserviceaccount.com

# 4. キーをSecret Managerに保存
cat firebase-admin-key.json | gcloud secrets create FIREBASE_ADMIN_KEY \
  --replication-policy="automatic" \
  --data-file=-

# 5. ローカルのキーファイルを削除
rm firebase-admin-key.json
```

### 7.2 Next.jsアプリケーションの環境変数設定

ビルド時のFirebase API Keyエラー（`Firebase: Error (auth/invalid-api-key)`）を解決するために、ビルド環境で正しい環境変数を設定します。

```bash
# .env.productionファイルを作成
cat > .env.production << 'EOF'
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCmbs5ZI8CxRunlBsAqjDKrPOiJLmrsDJM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=specsheet-generator.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=specsheet-generator
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=specsheet-generator.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=503166429433
NEXT_PUBLIC_FIREBASE_APP_ID=1:503166429433:web:359179414d605cc91eda28

# Firebase Admin SDK
FIREBASE_ADMIN_KEY_PATH=firebase-admin-key.json
# 本番環境ではパスではなくSecret Managerから取得
# FIREBASE_ADMIN_PROJECT_ID=specsheet-generator

# Algolia設定（必要に応じて）
# NEXT_PUBLIC_ALGOLIA_APP_ID=YOUR_ALGOLIA_APP_ID
# NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=YOUR_ALGOLIA_SEARCH_API_KEY
# ALGOLIA_ADMIN_API_KEY=YOUR_ALGOLIA_ADMIN_API_KEY
EOF
```

### 7.3 Firebase Admin SDKの初期化コード修正

Firebase Admin SDKの初期化コードを修正して、Secret Managerからキーを取得するように変更します。

```typescript
// lib/firebase-admin.ts のサンプル実装
import * as admin from 'firebase-admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let firebaseAdmin: admin.app.App;

async function getFirebaseAdminKey() {
  // 環境変数からキーパスが指定されている場合はそれを使用
  if (process.env.FIREBASE_ADMIN_KEY_PATH) {
    try {
      // 開発環境: ローカルファイルからキーを読み込む
      const serviceAccount = require(`../${process.env.FIREBASE_ADMIN_KEY_PATH}`);
      return serviceAccount;
    } catch (error) {
      console.error('Error loading service account key from file:', error);
      return null;
    }
  } else {
    try {
      // 本番環境: Secret Managerからキーを取得
      const secretClient = new SecretManagerServiceClient();
      const [version] = await secretClient.accessSecretVersion({
        name: 'projects/specsheet-generator/secrets/FIREBASE_ADMIN_KEY/versions/latest',
      });
      
      const secretData = version.payload?.data?.toString() || '';
      return JSON.parse(secretData);
    } catch (error) {
      console.error('Error loading service account key from Secret Manager:', error);
      return null;
    }
  }
}

export async function getFirebaseAdmin() {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  const serviceAccountKey = await getFirebaseAdminKey();
  
  if (!serviceAccountKey) {
    throw new Error('Firebase Admin SDK service account key not available');
  }

  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'specsheet-generator',
  });

  return firebaseAdmin;
}
```

## 8. ビルドとデプロイの設定

### 7.2 cloudbuild.yamlの作成

```yaml
# cloudbuild.yaml
steps:
  # 依存関係のインストール
  - name: 'node:20'
    entrypoint: npm
    args: ['install', '-g', 'pnpm']
    
  - name: 'node:20'
    entrypoint: pnpm
    args: ['install', '--frozen-lockfile']
    
  # 環境変数ファイルの作成
  - name: 'bash'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        cat > .env.production << 'EOF'
        NEXT_PUBLIC_FIREBASE_API_KEY=$$NEXT_PUBLIC_FIREBASE_API_KEY
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=$$NEXT_PUBLIC_FIREBASE_PROJECT_ID
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
        NEXT_PUBLIC_FIREBASE_APP_ID=$$NEXT_PUBLIC_FIREBASE_APP_ID
        EOF
    secretEnv: [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID'
    ]
    
  # ビルド
  - name: 'node:20'
    entrypoint: pnpm
    args: ['run', 'build']
    
  # Dockerイメージビルド
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build', 
      '-t', 'asia-northeast1-docker.pkg.dev/specsheet-generator/specsheet-docker/specsheet-generator:$COMMIT_SHA', 
      '-f', 'Dockerfile', 
      '.'
    ]
    
  # イメージのプッシュ
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'asia-northeast1-docker.pkg.dev/specsheet-generator/specsheet-docker/specsheet-generator:$COMMIT_SHA']
    
  # Cloud Runへデプロイ
  - name: 'gcr.io/cloud-builders/gcloud'
    args: [
      'run', 'deploy', 'specsheet-generator', 
      '--image=asia-northeast1-docker.pkg.dev/specsheet-generator/specsheet-docker/specsheet-generator:$COMMIT_SHA', 
      '--region=asia-northeast1', 
      '--platform=managed', 
      '--service-account=frontend-sa@specsheet-generator.iam.gserviceaccount.com',
      '--min-instances=1',
      '--allow-unauthenticated',
      '--set-env-vars=ALLOWED_ORIGINS=https://specsheet-generator-503166429433.asia-northeast1.run.app,http://localhost:3000',
      '--set-secrets=FIREBASE_ADMIN_KEY=FIREBASE_ADMIN_KEY:latest'
    ]
    
substitutions:
  _REGION: asia-northeast1
  
availableSecrets:
  secretManager:
    - versionName: projects/specsheet-generator/secrets/NEXT_PUBLIC_FIREBASE_API_KEY/versions/latest
      env: 'NEXT_PUBLIC_FIREBASE_API_KEY'
    - versionName: projects/specsheet-generator/secrets/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/versions/latest
      env: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    - versionName: projects/specsheet-generator/secrets/NEXT_PUBLIC_FIREBASE_PROJECT_ID/versions/latest
      env: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    - versionName: projects/specsheet-generator/secrets/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/versions/latest
      env: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
    - versionName: projects/specsheet-generator/secrets/NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID/versions/latest
      env: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
    - versionName: projects/specsheet-generator/secrets/NEXT_PUBLIC_FIREBASE_APP_ID/versions/latest
      env: 'NEXT_PUBLIC_FIREBASE_APP_ID'
```

## 9. Cloud Runの設定とデプロイ

### 8.1 手動デプロイ方法

```bash
# フロントエンドのデプロイ
gcloud run deploy specsheet-generator-frontend \
  --image=asia-northeast1-docker.pkg.dev/specsheet-generator/specsheet-docker/specsheet-generator-frontend:latest \
  --region=asia-northeast1 \
  --platform=managed \
  --service-account=frontend-sa@specsheet-generator.iam.gserviceaccount.com \
  --min-instances=1 \
  --allow-unauthenticated \
  --set-env-vars=ALLOWED_ORIGINS=https://specsheet-generator-503166429433.asia-northeast1.run.app,http://localhost:3000

# バックエンドのデプロイ
gcloud run deploy specsheet-generator-backend \
  --image=asia-northeast1-docker.pkg.dev/specsheet-generator/specsheet-docker/specsheet-generator-backend:latest \
  --region=asia-northeast1 \
  --platform=managed \
  --service-account=backend-sa@specsheet-generator.iam.gserviceaccount.com \
  --min-instances=1 \
  --set-secrets=GOOGLE_GENERATIVE_AI_API_KEY=GOOGLE_GENERATIVE_AI_API_KEY:latest \
  --set-env-vars=ALLOWED_ORIGINS=https://specsheet-generator-503166429433.asia-northeast1.run.app \
  --ingress=internal-and-cloud-load-balancing
```

### 8.2 Cloud Buildトリガーの設定

```bash
# GitHubリポジトリと連携したトリガー設定
gcloud builds triggers create github \
  --name="deploy-specsheet-generator" \
  --repo="bonginkan/specsheet-generator" \
  --branch-pattern="main" \
  --build-config="cloudbuild.yaml" \
  --project=specsheet-generator
```

## 10. ドメイン設定とSSL

### 9.1 カスタムドメインマッピング

```bash
# フロントエンドにカスタムドメインを設定
gcloud run domain-mappings create \
  --service=specsheet-generator-frontend \
  --domain=specsheet.bonginkan.ai \
  --region=asia-northeast1

# DNSレコードの確認
gcloud run domain-mappings describe \
  --domain=specsheet.bonginkan.ai \
  --region=asia-northeast1
```

### 9.2 DNSレコードの設定

```
# 以下のDNSレコードをドメインプロバイダーで設定
# specsheet.bonginkan.ai → CNAME → ghs.googlehosted.com
```

## 11. 監視とロギング

### 10.1 Cloud Monitoringアラートの設定

```bash
# メトリクスベースのアラートポリシー作成（レイテンシー）
gcloud alpha monitoring policies create \
  --policy-from-file=latency-alert-policy.json
```

`latency-alert-policy.json` の例:
```json
{
  "displayName": "High latency alert",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Cloud Run Latency",
      "conditionThreshold": {
        "filter": "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"specsheet-generator-frontend\" AND metric.type = \"run.googleapis.com/request_latencies\"",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_PERCENTILE_99"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 1000,
        "duration": "60s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "604800s"
  },
  "notificationChannels": [
    "projects/specsheet-generator/notificationChannels/$CHANNEL_ID"
  ]
}
```

### 10.2 ロギング設定

```bash
# エラーログのみをフィルタリングする例
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR AND resource.labels.service_name=specsheet-generator-frontend" \
  --limit=10 \
  --format=json \
  --project=specsheet-generator
```

## 12. 運用コマンド集

### 11.1 一般的な運用コマンド

```bash
# サービス一覧確認
gcloud run services list --platform=managed --region=asia-northeast1 --project=specsheet-generator

# リビジョン一覧確認
gcloud run revisions list --service=specsheet-generator-frontend --region=asia-northeast1 --project=specsheet-generator

# リビジョンロールバック
gcloud run services update-traffic specsheet-generator-frontend \
  --to-revisions=specsheet-generator-frontend-00001-abc=100 \
  --region=asia-northeast1 \
  --project=specsheet-generator

# サービスの説明表示
gcloud run services describe specsheet-generator-frontend --region=asia-northeast1 --project=specsheet-generator

# ログの表示
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=specsheet-generator-frontend" \
  --limit=20 \
  --project=specsheet-generator
```

### 11.2 スケーリング設定変更

```bash
# 最小・最大インスタンス数の変更
gcloud run services update specsheet-generator-frontend \
  --min-instances=2 \
  --max-instances=10 \
  --region=asia-northeast1 \
  --project=specsheet-generator

# 同時実行数（concurrency）の調整
gcloud run services update specsheet-generator-frontend \
  --concurrency=80 \
  --region=asia-northeast1 \
  --project=specsheet-generator
```

### 11.3 Ingress制限の設定

```bash
# 内部・ロードバランサー経由のみアクセス許可
gcloud run services update specsheet-generator-backend \
  --ingress=internal-and-cloud-load-balancing \
  --region=asia-northeast1 \
  --project=specsheet-generator

# VPCからのアクセスのみ許可
gcloud run services update specsheet-generator-backend \
  --ingress=internal \
  --region=asia-northeast1 \
  --project=specsheet-generator
```

## 13. トラブルシューティング

### 13.1 一般的な問題と解決方法

| 問題 | 解決方法 |
|------|---------|
| コンテナが起動しない | `gcloud run services logs read specsheet-generator-frontend --project=specsheet-generator` でログを確認 |
| APIが403を返す | IAMロールとサービスアカウントの権限を確認 |
| CORSエラー | `middleware.ts`の設定とCloud Run環境変数`ALLOWED_ORIGINS`を確認 |
| ビルドエラー | Cloud Buildのログを確認、依存関係のバージョンを確認 |
| 接続タイムアウト | min-instancesの設定を確認、コールドスタートの問題かもしれない |
| メモリ不足エラー | `--memory` フラグでメモリ割り当てを増やす |

### 13.2 よくあるエラーコードと意味

| エラーコード | 意味 | 解決策 |
|------------|------|-------|
| PERMISSION_DENIED | IAM権限不足 | 必要なロールが付与されているか確認 |
| RESOURCE_EXHAUSTED | リソース上限到達 | クォータ増加申請またはリソース最適化 |
| FAILED_PRECONDITION | 前提条件未達成 | APIが有効化されているか確認 |
| UNAUTHENTICATED | 認証エラー | サービスアカウントやAPIキーを確認 |

### 13.3 デバッグコマンド

```bash
# コンテナのディスク使用量確認
gcloud run services describe specsheet-generator-frontend --format="value(spec.template.containers[0].resources.limits.disk)" --project=specsheet-generator

# コンテナのCPU/メモリ使用量
gcloud run services describe specsheet-generator-frontend --format="value(spec.template.containers[0].resources.limits.cpu,spec.template.containers[0].resources.limits.memory)" --project=specsheet-generator

# 環境変数の確認
gcloud run services describe specsheet-generator-frontend --format="yaml(spec.template.containers[0].env)" --project=specsheet-generator
```

### 13.4 Firebase関連エラーの解決

| エラー | 原因 | 解決策 |
|-------|-----|-------|
| `Service account object must contain a string "private_key" property` | Firebase Admin SDKの初期化に必要なサービスアカウント鍵が不足している | Secret Managerから`FIREBASE_ADMIN_KEY`を正しく取得できているか確認。ローカルでは`FIREBASE_ADMIN_KEY_PATH`が正しいパスを指しているか確認 |
| `Firebase: Error (auth/invalid-api-key)` | クライアント側のFirebase初期化に無効なAPIキーが使用されている | 環境変数`NEXT_PUBLIC_FIREBASE_API_KEY`が正しく設定されているか確認。Cloud Runサービスの環境変数またはSecret Managerの値を確認 |
| `Error: The caller does not have permission` | サービスアカウントに必要な権限がない | Firebase Adminサービスアカウントに`roles/firebase.admin`と`roles/datastore.user`が付与されているか確認 |
| Algolia関連エラー | Algolia環境変数が未設定 | 必要に応じて`NEXT_PUBLIC_ALGOLIA_APP_ID`と`NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`を設定 |

### 13.5 Firebase Admin SDK初期化のデバッグ

Firebase Admin SDKの初期化をデバッグするためのテストスクリプト:

```bash
# firebase-admin-test.js
const admin = require('firebase-admin');
const fs = require('fs');

try {
  // サービスアカウントキーをファイルから読み込み
  const serviceAccount = JSON.parse(fs.readFileSync('./firebase-admin-key.json', 'utf8'));
  
  // Firebase Admin初期化
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin initialized successfully:', app.name);
} catch (error) {
  console.error('Firebase Admin initialization failed:', error);
}

# テスト実行
node firebase-admin-test.js
```
