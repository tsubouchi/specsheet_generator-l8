# AI仕様書ジェネレーター (GCP/Firebase版)

製品アイデアを入力すると、AI (Gemini) を利用してソフトウェア開発仕様書を自動生成するアプリケーションです。
Google Cloud Platform (GCP) と Firebase を活用して構築・デプロイされます。

## 技術スタック (2025-05 更新)

- **フロントエンド**: Next.js 15 + React 18, TypeScript, Tailwind CSS (白 / 黒のみ)
- **バックエンド (API)**: Next.js API Routes → Cloud Run (min-instances=1)
- **AI**: Google Gemini **2.5 Flash Preview** (`gemini-2.5-flash-preview-04-17`)
- **認証**: Firebase Authentication (Google OAuth 2.0) — Workload Identity
- **データベース**: Cloud Firestore – 生成仕様書を `specs` コレクションに保存
- **CI/CD**:
  - GitHub Actions → Cloud Build → Cloud Run
  - イメージは Artifact Registry へ push
- **インフラ**: GCP
  - Cloud Run + Secret Manager + Artifact Registry + Firestore
  - Workload Identity により SA キー不要

## 環境構築 (初回のみ)

### 1. 前提条件

-   Google Cloud SDK (`gcloud`) がインストール済みであること。
-   Node.js, pnpm がインストール済みであること。
-   GCP プロジェクト (`specsheet-generator`) が存在すること。
-   Firebase プロジェクト (`specsheet-generator`) が存在し、GCP プロジェクトにリンクされていること。

### 2. GCP API の有効化

以下のコマンドを実行して、必要な GCP API を有効化します。

```bash
gcloud services enable \
    run.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    iam.googleapis.com \
    --project=specsheet-generator
```

### 3. IAM 権限の設定

開発およびデプロイを行うユーザーアカウント (`t@bonginkan.ai`) に必要な IAM ロールを付与します。
**注意:** 本番環境では、最小権限の原則に基づき、専用のサービスアカウントを作成・利用することを強く推奨します。

```bash
gcloud projects add-iam-policy-binding specsheet-generator \
    --member="user:t@bonginkan.ai" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding specsheet-generator \
    --member="user:t@bonginkan.ai" \
    --role="roles/secretmanager.admin" # 必要に応じて secretAccessor に絞る

gcloud projects add-iam-policy-binding specsheet-generator \
    --member="user:t@bonginkan.ai" \
    --role="roles/iam.serviceAccountUser" # Cloud Build/Run がサービスアカウントとして動作するために必要

gcloud projects add-iam-policy-binding specsheet-generator \
    --member="user:t@bonginkan.ai" \
    --role="roles/cloudbuild.builds.editor"
```

### 4. Secret Manager への API キー登録

Gemini API キーを Secret Manager に登録します。

```bash
# シークレットの作成 (初回のみ)
gcloud secrets create GOOGLE_GENERATIVE_AI_API_KEY --project=specsheet-generator --replication-policy="automatic"

# シークレットにバージョンを追加 (APIキーを YOUR_GEMINI_API_KEY に置き換えてください)
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GOOGLE_GENERATIVE_AI_API_KEY --project=specsheet-generator --data-file=-
```
**注意:** `YOUR_GEMINI_API_KEY` は実際の Gemini API キーに置き換えてください。

### 5. Firebase の設定

1.  **Firebase コンソール** ([https://console.firebase.google.com/](https://console.firebase.google.com/)) にアクセスします。
2.  プロジェクト `specsheet-generator` を選択します。
3.  **Authentication**:
    -   「Sign-in method」タブを開きます。
    -   「Google」プロバイダーを有効にし、サポートメールアドレスを選択します。
    -   (必要に応じて) 承認済みドメインにデプロイ先のドメインを追加します。
4.  **Hosting**: 今回は Firebase Hosting を使用せず、Cloud Run に統合デプロイするためスキップします。

## 追加メモ (2025-04-30)

- Firebase CLI v14 以降を使用する場合は **Node.js 20 以上** が必要です。
- SDK Config の6項目 (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`) は Secret Manager に登録し、Cloud Build で `secretEnv` として参照します。
- Cloud Build で Compute Engine 既定 SA を使用する場合は、Storage/Secret Manager/Logging/Artifact Registry への権限付与が必要です。

## ローカル開発

1.  リポジトリをクローンします。
2.  `.env.local` ファイルをルートディレクトリに作成し、Firebase プロジェクト設定から取得した `firebaseConfig` の値を参考に、必要な環境変数を設定します。特に `NEXT_PUBLIC_FIREBASE_API_KEY` などが必要です。ローカルでの Gemini API 利用のために `GOOGLE_GENERATIVE_AI_API_KEY` も設定できます。
    ```.env.local
    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
    NEXT_PUBLIC_FIREBASE_APP_ID=...
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=... # Optional

    # ローカル開発時のみ Gemini API を直接叩く場合に設定
    # GOOGLE_GENERATIVE_AI_API_KEY=YOUR_GEMINI_API_KEY_FOR_LOCAL
    ```
3.  依存関係をインストールします: `pnpm install`
4.  開発サーバーを起動します: `pnpm run dev`
5.  ブラウザで `http://localhost:3000` を開きます。

## デプロイ

デプロイは Cloud Build を使用して自動化されます (設定は `cloudbuild.yaml` )。GitHub リポジトリと Cloud Build トリガーを連携すると、`main` ブランチへの push で自動ビルド＆デプロイが走ります。
手動でデプロイする場合:

1.  **バックエンド (Cloud Run)**:
    -   `Dockerfile` を使用してコンテナイメージをビルドします。
    -   `gcloud run deploy` コマンドで Cloud Run にデプロイします。Secret Manager から API キーを読み込むように設定します。
    -   (詳細は `cloudbuild.yaml` 作成時に追記)
2.  **フロントエンド / バックエンド (Cloud Run)**:
    -   `gcloud builds submit --config cloudbuild.yaml` で Cloud Build を実行します。
    -   `gcloud run deploy specsheet-generator --image asia-docker.pkg.dev/$PROJECT_ID/specsheet-docker/specsheet-generator --min-instances=1 --platform=managed --region=asia-northeast1` などで Cloud Run にデプロイします。
    -   **min-instances=1** を指定することで、常時 1 つのインスタンスを維持し、コールドスタートを回避します (若干のランニングコストが発生)。

### 本番 URL
https://specsheet-generator-503166429433.asia-northeast1.run.app

## API エンドポイント一覧

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| `POST` | `/api/generate` | Firebase ID トークン (Bearer) | 製品アイデアを送信して仕様書 Markdown を生成し、Firestore に保存。リクエスト JSON: `{ "productIdea": "..." }` |
| `GET`  | `/api/test`     | なし | Gemini API 接続テスト用。簡易レスポンスを返す |

サンプル (ID トークン付き):

```bash
TOKEN="$(firebase auth:sign-in-with-email --email=test@example.com --password=PASSWORD --local --json | jq -r .idToken)"

curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"productIdea":"ToDoアプリ"}' \
  https://specsheet-generator-503166429433.asia-northeast1.run.app/api/generate
```

## 開発 / 運用 TODO（抜粋）

詳細は `GCP_TODO.md` に集約されています。ここでは主要な完了ステータスのみ掲載します。

| カテゴリ | 項目 | 状態 |
|----------|------|------|
| インフラ | 必要 API 有効化, SA 作成, WIF, Secret Manager | ✅ 完了 |
| CI/CD    | GitHub Actions → Cloud Build → Cloud Run | ✅ 完了 |
| バックエンド | Gemini 2.5 Flash 呼び出し + Firestore 保存 | ✅ 完了 |
| フロントエンド | Google ログイン UI, 白黒デザイン | ✅ 完了 |
| API テスト | CURL サンプル | ✅ 完了 |

残タスクが発生した場合は `TODO.md` を更新してください。