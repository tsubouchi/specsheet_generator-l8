# TODO リスト

## 環境構築・設定

-   [x] GCP API の有効化 (`run`, `secretmanager`, `cloudbuild`, `iam`)
-   [x] IAM 権限の設定 (`t@bonginkan.ai` へのロール付与)
-   [x] Secret Manager への Gemini API キー登録
-   [x] Firebase Authentication の設定 (Google プロバイダー有効化) - 2025-05-01 完了
-   [ ] Firebase Hosting の設定 (`firebase init`, `firebase use`)
-   [x] Firebase プロジェクト設定から `firebaseConfig` を Secret Manager に登録
-   [x] Cloud Run サービスアカウント作成と Secret Manager アクセス権限付与 - 2025-04-30 完了
-   [x] Compute SA への IAM 権限付与 (Storage, Secret Manager, Logging, Artifact Registry) - 2025-04-30 完了
-   [x] Dockerfile 修正 (依存関係フルインストール & Telemetry 無効化) - 2025-04-30 完了
-   [x] Firebase Admin SDK 初期化 (`lib/firebase-admin.ts`) - 2025-05-01 完了

## ドキュメント

-   [x] `README.md` 作成・更新
-   [x] `basic_design.md` 作成・更新
-   [x] `TODO.md` 作成 (このファイル)
-   [x] Firebase OAuth 2.0連携手順の文書化 - 2025-05-01 完了

## 認証機能 (フロントエンド)

-   [x] 必要な Firebase パッケージのインストール (`firebase`, `react-firebase-hooks`) - 2025-05-01 完了
-   [x] Firebase 初期化設定ファイル (`lib/firebase.ts`) 作成 - 2025-05-01 完了
-   [x] 認証状態管理コンテキスト (`components/AuthProvider.tsx`) 作成 - 2025-05-01 完了
-   [x] ルートレイアウト (`app/layout.tsx`) を `AuthProvider` でラップ - 2025-05-01 完了
-   [x] ログインページ (`app/(auth)/login/page.tsx`) 作成 (Google ログインボタン配置) - 2025-05-01 完了
-   [x] ログイン処理の実装 (Firebase GoogleAuthProvider) - 2025-05-01 完了
-   [x] ログアウト処理の実装 - 2025-05-01 完了
-   [x] ヘッダーコンポーネント (`components/Header.tsx`) 作成/修正 (ユーザーアイコン、名前、ログアウトボタン表示) - 2025-05-01 完了
-   [x] メインレイアウト (`app/(main)/layout.tsx`) にヘッダーを組み込み - 2025-05-01 完了
-   [x] ログイン状態に応じたリダイレクト処理 (未ログインなら `/login` へ) - 2025-05-01 完了

## バックエンド API 修正

-   [x] `@google-cloud/secret-manager` パッケージのインストール - 2025-04-30 完了
-   [x] `app/api/generate/route.ts` を修正し、Secret Manager から API キーを取得するように変更 - 2025-04-30 完了
-   [x] ローカル開発時とデプロイ環境での API キー取得ロジックの分岐 - 2025-04-30 完了

## 外部連携機能

-   [x] Drive API有効化と連携 - 2025-04-30 完了
-   [x] SaveButtonコンポーネント実装 - 2025-04-30 完了
-   [x] Drive APIクライアント(`lib/drive.ts`)実装 - 2025-04-30 完了
-   [x] `app/api/drive-upload/route.ts`エンドポイント実装 - 2025-04-30 完了
-   [x] Gmail API有効化と連携 - 2025-05-01 完了
-   [x] `lib/gmail.ts`クライアント実装 - 2025-05-01 完了
-   [x] `app/api/gmail-send/route.ts`エンドポイント実装 - 2025-05-01 完了
-   [x] EmailButtonコンポーネント実装 - 2025-05-01 完了
-   [x] `app/email-sender/page.tsx`メール送信ページ実装 - 2025-05-01 完了
-   [x] CORS対策用ミドルウェア(`middleware.ts`)実装 - 2025-05-01 完了

## デプロイ設定

-   [x] `Dockerfile` 作成 (Cloud Run 用)
-   [x] `cloudbuild.yaml` 作成 (CI/CD パイプライン定義)
    -   [x] 依存関係インストールステップ
    -   [x] フロントエンドビルドステップ
    -   [x] バックエンド Docker イメージビルド＆プッシュステップ
    -   [x] Cloud Run デプロイステップ (Secret Manager 連携含む)
-   [x] Cloud Build トリガー設定 (GitHub リポジトリ連携) 2025-04-29 完了

## テスト・調整

-   [x] ローカル環境での動作確認 (ログイン、仕様書生成)
-   [x] デプロイ環境での動作確認
-   [x] エラーハンドリングの見直し - 2025-05-01 完了
-   [ ] パフォーマンスチューニング (必要に応じて)
-   [x] Cloud Run min-instances=1 設定確認 - CI テスト : 2025年 4月30日 水曜日 09時00分00秒 JST
- CI テスト : 2025年 4月29日 火曜日 12時20分22秒 JST

## 今後の拡張予定

-   [ ] メール送信履歴の保存機能
-   [ ] メール送信テンプレート機能
-   [ ] 仕様書PDF出力機能の強化
-   [ ] Google Slides連携による仕様書プレゼン機能
