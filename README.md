# AI仕様書ジェネレーター (GCP/Firebase版)

製品アイデアを入力すると、AI (Gemini) を利用してソフトウェア開発仕様書を自動生成するアプリケーションです。
Google Cloud Platform (GCP) と Firebase を活用して構築・デプロイされます。

## 技術スタック

-   **フロントエンド**: Next.js (React), TypeScript, Tailwind CSS
-   **バックエンド (API)**: Next.js API Routes (Serverless on Cloud Run)
-   **認証**: Firebase Authentication (Google OAuth 2.0)
-   **ホスティング**: Firebase Hosting
-   **データベース**: (現時点ではなし、必要に応じて Firestore 等を追加)
-   **インフラ**: Google Cloud Platform
    -   Cloud Run: バックエンドAPIの実行環境
    -   Secret Manager: APIキーなどの機密情報管理
    -   Cloud Build: CI/CD パイプライン
-   **AIモデル**: Google Gemini API

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
    --role="roles/firebasehosting.admin"

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
4.  **Hosting**:
    -   Hosting を開始します。
    -   `firebase login` コマンドで Firebase CLI にログインします。
    -   `firebase init hosting` を実行し、設定を行います。
        -   Public directory: `out` (Next.js の静的エクスポート先) または デフォルトの `public` (動的ホスティングの場合) を選択。 (※後述のデプロイ戦略に依存)
        -   Configure as a single-page app: `Yes`
        -   Set up automatic builds and deploys with GitHub?: `No` (Cloud Build を使用するため)
    -   `firebase use specsheet-generator` で対象プロジェクトを選択します。
5.  **プロジェクト設定**:
    -   「プロジェクトの設定」>「全般」タブを開きます。
    -   「マイアプリ」セクションでウェブアプリを選択 (または新規作成) します。
    -   **Firebase SDK snippet** の **`firebaseConfig`** オブジェクトの内容をコピーし、後述のフロントエンド設定で使用します。(`apiKey` などが含まれています)

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

デプロイは Cloud Build を使用して自動化されます (設定は `cloudbuild.yaml` に記述予定)。
手動でデプロイする場合:

1.  **バックエンド (Cloud Run)**:
    -   `Dockerfile` を使用してコンテナイメージをビルドします。
    -   `gcloud run deploy` コマンドで Cloud Run にデプロイします。Secret Manager から API キーを読み込むように設定します。
    -   (詳細は `cloudbuild.yaml` 作成時に追記)
2.  **フロントエンド (Firebase Hosting)**:
    -   `pnpm run build` で Next.js アプリケーションをビルドします。
    -   `firebase deploy --only hosting` コマンドで Firebase Hosting にデプロイします。

## TODO

詳細は `TODO.md` を参照してください。