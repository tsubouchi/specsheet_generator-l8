# v0プロジェクトローカル開発ベストプラクティス
v0で生成されたプロジェクトをCursorで開発する際のベストプラクティスを以下にまとめました。

## 初期セットアップ

1. **Reactバージョンの固定**
   - package.jsonでReactとReact DOMのバージョンを固定値に設定
   - `"react": "^19"` → `"react": "19.0.0"`
   - `"react-dom": "^19"` → `"react-dom": "19.0.0"`
   - これにより「Cannot read properties of null (reading 'useReducer')」などのフック関連エラーを防止

2. **環境変数の設定**
   - `.env.sample`ファイルを作成して必要な環境変数を記録
   - `.env.local`に実際の環境変数を設定
   - APIキーなどの秘密情報を`.env.local`で管理（`.gitignore`に追加）
   - **重要**: 環境変数名はコード内で使用されている名前と完全に一致させる
     - 例: コードで`process.env.GOOGLE_GENERATIVE_AI_API_KEY`と指定されている場合は、`.env.local`でも同じ名前を使用する必要がある

3. **キャッシュとモジュールのクリーン**
   - 問題が発生した場合は以下を実行:
     ```bash
     rm -rf node_modules .next
     npm cache clean --force # または pnpm store prune
     npm install # または pnpm install
     ```

4. **依存関係の更新**
   - パッケージマネージャとしてpnpmを使用
   - 最新のNext.jsおよびReactバージョンとの互換性を確認

## よくあるエラーと解決法

1. **React Hooksエラー**
   - エラー: `Cannot read properties of null (reading 'useReducer')`
   - 解決策: Reactとすべての関連ライブラリのバージョンを固定（互換性のあるバージョンに）

2. **環境変数アクセスの問題**
   - エラー: `API キーが設定されていません` または `API応答エラー: 500 API キーが設定されていません`
   - 解決策:
     - `.env.local`ファイルが正しく設定されているか確認
     - 環境変数名がコード内で参照している名前と完全に一致しているか確認（例: `GEMINI_API_KEY` vs `GOOGLE_GENERATIVE_AI_API_KEY`）
     - Next.jsでは`NEXT_PUBLIC_`プレフィックスをクライアントサイドで使用する変数につける
     - 開発サーバーを再起動して環境変数の変更を反映させる

3. **ビルドエラー**
   - TypeScriptやESLintのエラーが多すぎる場合は、`next.config.mjs`で以下を設定:
     ```js
     eslint: {
       ignoreDuringBuilds: true,
     },
     typescript: {
       ignoreBuildErrors: true,
     }
     ```

## 開発サイクル

1. パッケージをインストール: `pnpm install`
2. 開発サーバーを起動: `pnpm run dev`
3. 変更を加える
4. 本番用ビルドをテスト: `pnpm run build && pnpm start`

## v0特有の注意点

1. 生成されたコンポーネントは高品質だが、TypeScriptの型定義が不完全な場合がある
2. APIルートやサーバーアクションは手動で正しく設定する必要がある場合がある
3. APIキーのような機密情報は必ず`.env.local`に保存し、Gitにコミットしない
4. コードが参照している環境変数名を確認し、`.env.local`で正確に同じ名前を使用する

これらのベストプラクティスに従うことで、v0で生成されたプロジェクトをスムーズに開発できます。 