# TODO リスト

## 環境構築・設定

-   [x] GCP API の有効化 (`run`, `secretmanager`, `cloudbuild`, `iam`)
-   [x] IAM 権限の設定 (`t@bonginkan.ai` へのロール付与)
-   [x] Secret Manager への Gemini API キー登録
-   [ ] Firebase Authentication の設定 (Google プロバイダー有効化)
-   [ ] Firebase Hosting の設定 (`firebase init`, `firebase use`)
-   [ ] Firebase プロジェクト設定から `firebaseConfig` を取得し `.env.local` に設定
-   [ ] Cloud Run サービスアカウント作成と Secret Manager アクセス権限付与

## ドキュメント

-   [x] `README.md` 作成・更新
-   [x] `basic_design.md` 作成・更新
-   [x] `TODO.md` 作成 (このファイル)

## 認証機能 (フロントエンド)

-   [ ] 必要な Firebase パッケージのインストール (`firebase`, `react-firebase-hooks`)
-   [ ] Firebase 初期化設定ファイル (`lib/firebase.ts`) 作成
-   [ ] 認証状態管理コンテキスト (`components/AuthProvider.tsx`) 作成
-   [ ] ルートレイアウト (`app/layout.tsx`) を `AuthProvider` でラップ
-   [ ] ログインページ (`app/(auth)/login/page.tsx`) 作成 (Google ログインボタン配置)
-   [ ] ログイン処理の実装 (Firebase GoogleAuthProvider)
-   [ ] ログアウト処理の実装
-   [ ] ヘッダーコンポーネント (`components/Header.tsx`) 作成/修正 (ユーザーアイコン、名前、ログアウトボタン表示)
-   [ ] メインレイアウト (`app/(main)/layout.tsx`) にヘッダーを組み込み
-   [ ] ログイン状態に応じたリダイレクト処理 (未ログインなら `/login` へ)

## バックエンド API 修正

-   [ ] `@google-cloud/secret-manager` パッケージのインストール
-   [ ] `app/api/generate/route.ts` を修正し、Secret Manager から API キーを取得するように変更
-   [ ] ローカル開発時とデプロイ環境での API キー取得ロジックの分岐 (任意)

## デプロイ設定

-   [x] `Dockerfile` 作成 (Cloud Run 用)
-   [x] `cloudbuild.yaml` 作成 (CI/CD パイプライン定義)
    -   [x] 依存関係インストールステップ
    -   [x] フロントエンドビルドステップ
    -   [x] バックエンド Docker イメージビルド＆プッシュステップ
    -   [x] Cloud Run デプロイステップ (Secret Manager 連携含む)
-   [x] Cloud Build トリガー設定 (GitHub リポジトリ連携) 2025-04-29 完了

## テスト・調整

-   [ ] ローカル環境での動作確認 (ログイン、仕様書生成)
-   [ ] デプロイ環境での動作確認
-   [ ] エラーハンドリングの見直し
-   [ ] パフォーマンスチューニング (必要に応じて)
-   [x] Cloud Run min-instances=0 設定確認 - CI テスト : 2025年 4月29日 火曜日 12時18分36秒 JST
