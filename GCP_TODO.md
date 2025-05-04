# GCP / Firebase 移行 TODO (Workload Identity + Cloud Run)

本ドキュメントは **AI 仕様書ジェネレーター** を
「Cloud Run (min-instances = 1) + Firebase Authentication (Google) + Firestore 保存」構成へ移行するための手順をまとめたものです。
すべて **Workload Identity** を前提とし、サービスアカウント鍵ファイルは発行しません。

---
## 0. 変数定義

| 変数 | 例 | 用途 |
|------|----|------|
| `PROJECT_ID` | `specsheet-generator` | GCP プロジェクト ID |
| `PROJECT_NUM` | `503166429433` | GCP プロジェクト番号 |
| `REGION` | `asia-northeast1` | Cloud Run / Artifact Registry リージョン |
| `RUN_SA` | `specsheet-run-sa@$PROJECT_ID.iam.gserviceaccount.com` | Cloud Run 実行 SA |
| `CB_SA`  | `service-$PROJECT_NUM@gcp-sa-cloudbuild.iam.gserviceaccount.com` | Cloud Build SA |
| `AR_REPO`| `specsheet-docker` | Artifact Registry リポジトリ |

---
## 1. 必要 API の有効化 ✅
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  --project=$PROJECT_ID
```

---
## 2. サービスアカウント & Workload Identity ✅
### 2-1. Cloud Run 用 SA 作成
```bash
# 作成
gcloud iam service-accounts create specsheet-run-sa \
  --display-name="Specsheet Generator – Cloud Run" \
  --project=$PROJECT_ID
```

### 2-2. Cloud Run SA にロール付与
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/run.invoker"    # (任意: 他サービスから呼び出す場合)

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/datastore.user" # Firestore へのアクセス

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/secretmanager.secretAccessor" # Gemini API Key
```

### 2-3. Cloud Build SA に ServiceAccountUser 権限
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser" \
  --condition="expression=resource.name==$RUN_SA,title=UseRunSA"
```
これで **Cloud Build → Cloud Run** デプロイ時に `--service-account $RUN_SA` が使用可能。

---
## 3. Artifact Registry ✅
```bash
gcloud artifacts repositories create $AR_REPO \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID
```
> 既に存在する場合はスキップ。

---
## 4. Secret Manager ✅
### 4-1. Gemini API Key
```bash
# シークレット (1 回のみ)
gcloud secrets create GOOGLE_GENERATIVE_AI_API_KEY \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# 最新バージョン追加
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add \
  GOOGLE_GENERATIVE_AI_API_KEY --data-file=- --project=$PROJECT_ID
```

### 4-2. Firebase Web Config 6 項目
```bash
for v in NEXT_PUBLIC_FIREBASE_API_KEY \
         NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
         NEXT_PUBLIC_FIREBASE_PROJECT_ID \
         NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
         NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
         NEXT_PUBLIC_FIREBASE_APP_ID; do
  gcloud secrets create $v --replication-policy="automatic" --project=$PROJECT_ID || true
  gcloud secrets versions add $v --data-file=- --project=$PROJECT_ID <<<'YOUR_VALUE'
done
```
> 設定値は Firebase コンソール → プロジェクト設定 → 全般から取得。

---
## 5. Firebase 設定 ✅
1. Firebase コンソールで **Google 認証プロバイダー** を有効化しサポートメールを登録。
2. Firestore データベースを **Native モード** & リージョン `$REGION` で作成。最初はテストルールで OK。
3. (任意) Firestore セキュリティルール調整: 認証ユーザーのみ読書き可。

---
## 6. Cloud Build 設定 (`cloudbuild.yaml`) ✅
- `docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/specsheet-generator:$BUILD_ID .`
- `gcloud run deploy` へ以下を追加
  ```
    --service-account=$RUN_SA \
    --min-instances=1 \
    --concurrency=80 \
  ```
- `availableSecrets.secretManager` に Gemini key と Firebase Config を登録済み。

---
## 7. デプロイ手順 ✅
```bash
# Cloud Build + Cloud Run
gcloud builds submit --config cloudbuild.yaml --project=$PROJECT_ID .
```

---
## 8. コード側 TODO ✅
| ファイル | 進捗 |
|----------|------|
| `lib/firebaseAdmin.ts` | **完了** — Admin SDK 初期化を実装 |
| `app/api/generate/route.ts` | **完了** — 仕様書生成 + Firestore 保存 + 認証検証を実装 |
| `components/` ログイン UI | **完了** — Google ログイン／ログアウト UI 実装済み |
| CORS ミドルウェア | **完了** — `app/api/*` ルートで `Access-Control-Allow-*` ヘッダ設定 |
| API テスト CURL | **完了** — サンプルコマンドを章 11 に記載 |
| Firestore CRUD UI | **完了** — ユーザ専用の履歴一覧 (タイトル, タイムスタンプ, プロンプト, MD) を表示・削除 |
| `lib/firestore.ts` | **完了** — フロント側 Firestore インスタンス生成 |

> クライアント側ログイン UI は後続イテレーションで対応予定。

---
## 9. 開発者 (t@bonginkan.ai) へのロール ✅
```bash
# 主要ロール（実行済み想定）
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:t@bonginkan.ai" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:t@bonginkan.ai" \
  --role="roles/datastore.owner"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:t@bonginkan.ai" \
  --role="roles/secretmanager.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:t@bonginkan.ai" \
  --role="roles/cloudbuild.builds.editor"
```

---
## 10. 参考リンク
- Gemini モデル一覧: Google Docs [Gemini 2.5 Flash Preview](https://ai.google.dev/gemini-api/docs/models?hl=ja#gemini-2.5-flash-preview)
- Workload Identity 公式: [Cloud Run でのサービスアカウント](https://cloud.google.com/run/docs/configuring/service-accounts)
- Firestore 権限: `roles/datastore.user` で読み書き可。

---
## 11. API テスト手順（curl） 🆕
```bash
# 1) Firebase CLI でテストユーザのカスタムトークン取得
firebase auth:sign-in-with-email --email=test@example.com --password=PASSWORD --local
TOKEN="$(cat ~/.config/firebase/...json | jq -r .idToken)"

# 2) 仕様書生成エンドポイント
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"productIdea":"ToDoアプリ"}' \
  https://specsheet-generator-********.run.app/api/generate
```

---
## 12. 今後の強化・未着手項目 📝
 | カテゴリ | 項目 | 優先度 |
 |----------|------|------|
 | セキュリティ | Firestore ルールを本番モードへ更新（認証ユーザのドキュメントのみアクセス許可） | ✅ 完了 |
 | セキュリティ | Cloud Run Ingress 制限・VPC Service Controls 検討 | 中 |
 | 監視 | Cloud Logging / Error Reporting でアラート設定 | 中 |
 | 監視 | Cloud Monitoring ダッシュボード整備（CPU・メモリ・レスポンス） | 中 |
 | 検索 | Algolia 全文検索 API & Cloud Functions 同期 | ✅ 完了 |
 | CI/CD | e2e テスト（Playwright）→ Cloud Build ステップ追加 | ✅ 完了 |
 
---
## 13. 運用コマンド集（Cloud Run / Firestore ルール）

### 13-1. Cloud Run サービス更新例（Ingress 制限）
```bash
SERVICE_NAME="specsheet-generator"
REGION="asia-northeast1"

# Ingress を Internal & Cloud Load Balancing のみ許可
# ついでに最新イメージへリビジョン更新する例
IMAGE="asia-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$SERVICE_NAME:latest"

gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --region=$REGION \
  --service-account=$RUN_SA \
  --ingress=internal-and-cloud-load-balancing \
  --min-instances=1 \
  --platform=managed \
  --allow-unauthenticated=false
```
> `ingress` を `internal` のみにすると Cloud Load Balancer 経由でのみアクセス可能。

### 13-2. Firestore セキュリティルールのデプロイ

`firestore.rules` をリポジトリルートに配置済み。CI あるいはローカルで以下を実行して本番適用する。
```bash
# Firebase CLI のログインが済んでいる前提
firebase deploy --only firestore:rules --project $PROJECT_ID
```
CI で自動化する場合は **Firebase CI Token** を GitHub Secrets (`FIREBASE_TOKEN`) に登録し、
ワークフローに次のステップを追加する。
```yaml
- name: Deploy Firestore rules
  run: |
    npm install -g firebase-tools
    firebase deploy --only firestore:rules --project $PROJECT_ID --token "$FIREBASE_TOKEN"
  env:
    FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```