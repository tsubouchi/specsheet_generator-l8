# 基本設計書 (AI仕様書ジェネレーター)

## 1. 概要

本ドキュメントは、「AI仕様書ジェネレーター」アプリケーションの基本設計について記述する。
ユーザーが入力した製品アイデアに基づき、Google Gemini API を利用してソフトウェア開発仕様書を Markdown 形式で生成する Web アプリケーションである。
認証には Firebase Authentication (Google OAuth 2.0) を使用し、GCP と Firebase の各種サービスを利用して構築・運用する。

## 2. 目的

-   製品アイデアから開発仕様書作成までの初期プロセスを自動化し、開発着手までの時間を短縮する。
-   開発者やプロダクトマネージャーが、アイデアを構造化された仕様に素早く変換できるように支援する。
-   GCP/Firebase のサーバレスアーキテクチャを活用し、スケーラブルでメンテナンス性の高いアプリケーションを提供する。

## 3. システム範囲

-   **範囲内**:
    -   ユーザー認証機能 (Google アカウントによるログイン/ログアウト)
    -   製品アイデア入力フォーム
    -   Gemini API を利用した仕様書生成機能 (バックエンド API)
    -   生成された仕様書の表示機能 (Markdown 形式)
    -   GCP/Firebase を利用したインフラ構築とデプロイ
-   **範囲外**:
    -   ユーザーアカウント管理機能 (パスワード変更、メールアドレス変更など)
    -   生成された仕様書の編集・保存機能
    -   複数ユーザー間での仕様書共有機能
    -   Google 以外の認証プロバイダーのサポート
    -   高度なエラーハンドリングとリトライロジック (API コール部分を除く)

## 4. 技術スタック（バージョン固定）

-   **フロントエンド**:
    -   Next.js: `15.2.4`
    -   React: `19.0.0`
    -   React DOM: `19.0.0`
    -   TypeScript: `^5.0.2`
    -   Tailwind CSS: `^3.4.17`
    -   Firebase SDK (Client): 最新版 (`firebase`)
    -   React Firebase Hooks: 最新版 (`react-firebase-hooks`)
    -   その他UIライブラリ (shadcn/ui 依存): `package.json` 参照
-   **バックエンド (API)**:
    -   Next.js API Routes (Edge Runtime): `15.2.4`
    -   Google Cloud Secret Manager Client Library: `@google-cloud/secret-manager` (最新版)
-   **認証**: Firebase Authentication (Google プロバイダー)
-   **ホスティング**: Firebase Hosting
-   **インフラ**: GCP
    -   Cloud Run: Node.js 最新 LTS 環境
    -   Secret Manager
    -   Cloud Build
-   **パッケージマネージャ**: pnpm

## 5. アーキテクチャ

-   **フロントエンド**: Next.js (App Router) を Firebase Hosting にデプロイ。
    -   認証状態の管理は React Context API と `react-firebase-hooks` を使用。
    -   UI コンポーネントは `shadcn/ui` をベースとする。
    -   Firebase 設定は環境変数 (`NEXT_PUBLIC_FIREBASE_*`) 経由で読み込む。
-   **バックエンド API**: `/api/generate` の Next.js API Route を Cloud Run (Managed) にデプロイ。
    -   Edge Runtime を使用。
    -   Gemini API キーは Secret Manager から取得。
    -   Cloud Run サービスアカウントには Secret Manager へのアクセス権限 (`roles/secretmanager.secretAccessor`) を付与。
-   **認証フロー**: Firebase Authentication の Google OAuth 2.0 フローを使用。クライアントサイドで認証を完結。
-   **CI/CD**: GitHub リポジトリへの Push をトリガーに Cloud Build が実行され、バックエンド (Cloud Run) とフロントエンド (Firebase Hosting) へ自動デプロイ。

## 6. ディレクトリ構成 (主要部分)

```
.
├── app/
│   ├── (auth)/             # 認証関連ページ (ログイン)
│   │   └── login/
│   │       └── page.tsx
│   ├── (main)/             # ログイン後ページ
│   │   ├── layout.tsx      # メインレイアウト (ヘッダー含む)
│   │   └── page.tsx        # 仕様書生成・表示ページ
│   ├── api/
│   │   └── generate/
│   │       └── route.ts    # 仕様書生成 API (Cloud Run)
│   ├── layout.tsx          # ルートレイアウト (認証Context Providerなど)
│   └── globals.css
├── components/
│   ├── ui/                 # shadcn/ui コンポーネント
│   ├── Header.tsx          # ログイン情報表示・ログアウトボタン
│   └── AuthProvider.tsx    # 認証状態管理コンテキスト
├── lib/
│   └── firebase.ts         # Firebase 初期化設定
├── public/
├── styles/
├── .env.local              # ローカル用環境変数 (Git管理外)
├── .env.sample             # 環境変数サンプル
├── next.config.mjs
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.ts
├── Dockerfile              # Cloud Run 用コンテナビルド
├── cloudbuild.yaml         # Cloud Build 設定ファイル
├── README.md
├── basic_design.md       # このファイル
└── TODO.md
```

## 7. 機能要件

| ユースケースID | 機能名           | 概要                                                                 |
| -------------- | ---------------- | -------------------------------------------------------------------- |
| UC-001         | Google ログイン  | Google アカウントを使用してアプリケーションにログインする。                |
| UC-002         | ログアウト       | アプリケーションからログアウトする。                                     |
| UC-003         | 仕様書生成要求   | 製品アイデアを入力し、仕様書の生成をバックエンド API にリクエストする。 |
| UC-004         | 仕様書表示       | バックエンド API から返却された Markdown 形式の仕様書を表示する。         |
| UC-005         | ログイン状態表示 | ヘッダーにログイン中のユーザーアイコンと名前を表示する。                 |
| UC-006         | 未ログイン時リダイレクト | ログインが必要なページに未ログイン状態でアクセスした場合、ログインページへリダイレクトする。 |

## 8. 非機能要件

-   **性能**: 仕様書生成リクエストは Gemini API の応答時間に依存するが、フロントエンドは非同期で処理し、ユーザーをブロックしない。
-   **セキュリティ**:
    -   API キーは Secret Manager で管理し、ソースコードに含めない。
    -   Firebase Authentication のセキュリティルールを利用。
    -   HTTPS 通信を強制。
-   **運用**: Cloud Run, Firebase Hosting によりサーバー管理は不要。ログは Cloud Logging で収集。
-   **コスト**: GCP/Firebase の無料枠または従量課金。利用状況に応じてモニタリング。
-   **UI デザイン**: 白 (#FFFFFF) と黒 (#000000) の 2 色を基本とするシンプルなデザイン。

## 9. インフラ & CI/CD

-   **インフラ**: GCP (Cloud Run, Secret Manager), Firebase (Authentication, Hosting)
-   **CI/CD**: GitHub リポジトリと Cloud Build を連携。
    -   `main` ブランチへの Push 時に自動でビルド＆デプロイを実行。
    -   `cloudbuild.yaml` でビルドステップ（依存関係インストール、ビルド、コンテナプッシュ、デプロイ）を定義。

## 10. 開発手順書 (主要コマンド)

```bash
# 依存関係インストール
pnpm install

# ローカル開発サーバー起動
pnpm run dev

# Firebase ログイン (初回)
firebase login

# Firebase プロジェクト選択
firebase use specsheet-generator

# フロントエンドビルド
pnpm run build

# フロントエンドデプロイ (手動)
firebase deploy --only hosting

# バックエンドDockerイメージビルド (例)
docker build -t gcr.io/specsheet-generator/specsheet-api .

# バックエンドDockerイメージプッシュ (例)
docker push gcr.io/specsheet-generator/specsheet-api

# バックエンドデプロイ (手動 - Cloud Run)
gcloud run deploy specsheet-api \
    --image gcr.io/specsheet-generator/specsheet-api \
    --platform managed \
    --region asia-northeast1 \
    --allow-unauthenticated \
    --set-secrets=GOOGLE_GENERATIVE_AI_API_KEY=GOOGLE_GENERATIVE_AI_API_KEY:latest \
    --project=specsheet-generator
```

## 11. 開発計画

1.  環境構築・設定 (GCP API, IAM, Secret Manager, Firebase Auth/Hosting)
2.  ドキュメント整備 (README, basic_design, TODO)
3.  Firebase 認証機能の実装 (ログイン画面、認証Context)
4.  ヘッダー実装 (ユーザー情報表示、ログアウト)
5.  バックエンド API 修正 (Secret Manager 連携)
6.  Cloud Run デプロイ設定 (Dockerfile)
7.  CI/CD パイプライン構築 (Cloud Build)
8.  全体テストと調整

## 12. 拡張計画

-   仕様書編集・保存機能 (Firestore などを使用)
-   プロジェクト管理機能
-   他 AI モデル (Anthropic Claude など) の選択肢追加
-   チームでの共有機能
-   より詳細な非機能要件の設定・テスト 