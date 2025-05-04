# Firebase Hosting マニュアル

## 目次
- [前提条件](#前提条件)
- [Firebase CLIのインストール](#firebase-cliのインストール)
- [Firebaseプロジェクトの設定](#firebaseプロジェクトの設定)
- [初期設定](#初期設定)
- [Next.jsアプリの設定](#nextjsアプリの設定)
- [ビルドとデプロイ](#ビルドとデプロイ)
- [カスタムドメインの設定](#カスタムドメインの設定)
- [高度な設定](#高度な設定)
- [公開時の注意事項](#公開時の注意事項)
- [トラブルシューティング](#トラブルシューティング)

## 前提条件

- Node.js 14以上がインストールされていること
- npmまたはyarnがインストールされていること
- Googleアカウントを持っていること
- Firebaseプロジェクトが作成済みであること

## Firebase CLIのインストール

Firebase CLIをグローバルにインストールします：

```bash
npm install -g firebase-tools
```

インストールが完了したら、バージョンを確認します：

```bash
firebase --version
```

## Firebaseプロジェクトの設定

1. Firebase CLIでログインします：

```bash
firebase login
```

2. ブラウザが開き、Googleアカウントでの認証が求められます。認証を完了してください。

3. 既存のFirebaseプロジェクトを確認するには：

```bash
firebase projects:list
```

## 初期設定

1. プロジェクトのルートディレクトリで初期化コマンドを実行します：

```bash
firebase init
```

2. 表示されるプロンプトに従って設定します：
   - 使用するFirebaseサービスとして「Hosting」を選択
   - 既存のFirebaseプロジェクトを選択または新規作成
   - 公開ディレクトリとして `out` を指定（Next.jsの場合）
   - シングルページアプリケーションとして設定するか質問されたら `y` を選択
   - GitHub Actionsによる自動デプロイを設定する場合は指示に従って設定

3. 初期化が完了すると、以下のファイルが作成されます：
   - `firebase.json`：Firebaseの設定ファイル
   - `.firebaserc`：プロジェクト関連の設定ファイル
   - `firebase.rules`：セキュリティルール（Storage/Databaseを選択した場合）

## Next.jsアプリの設定

1. Next.jsの設定を変更するため、`next.config.js`を編集します：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // その他の既存の設定
}

module.exports = nextConfig
```

2. `package.json`のビルドスクリプトを確認します：

```json
"scripts": {
  "build": "next build",
  // その他のスクリプト
}
```

3. 一部のAPIルートを使用する場合、サーバー側の機能はCloud Functionsに移行する必要があります。

## ビルドとデプロイ

1. アプリケーションをビルドします：

```bash
npm run build
```

これにより`out`ディレクトリが生成されます。

2. Firebaseにデプロイします：

```bash
firebase deploy --only hosting
```

3. デプロイが成功すると、ホスティングURLが表示されます。例：
   - `https://your-project-id.web.app`
   - `https://your-project-id.firebaseapp.com`

## カスタムドメインの設定

1. Firebase Consoleにアクセスします（https://console.firebase.google.com/）

2. プロジェクトを選択 → Hosting → カスタムドメインを追加をクリック

3. ドメイン名を入力し、続行をクリック

4. DNSレコードの設定手順に従います：
   - CNAMEレコードを追加（サブドメインの場合）
   - Aレコードを追加（ルートドメインの場合）

5. DNSの伝播を待ちます（最大48時間）

6. Firebase Consoleで検証をクリックし、ドメインの設定を完了します

## 高度な設定

### firebase.jsonの設定例

```json
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### 複数のサイトのホスティング

1. `firebase.json`を編集して複数のサイトを設定：

```json
{
  "hosting": [
    {
      "target": "main",
      "public": "out",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    },
    {
      "target": "staging",
      "public": "out-staging",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
    }
  ]
}
```

2. ターゲットをプロジェクトのサイトに関連付けます：

```bash
firebase target:apply hosting main your-site-name
firebase target:apply hosting staging your-staging-site-name
```

## 公開時の注意事項

### CORS対策

Cross-Origin Resource Sharing (CORS) は、異なるオリジン（ドメイン、プロトコル、ポート）間でのリソース共有を制御するセキュリティ機構です。Firebase Hostingでアプリを公開する際は、以下のCORS対策を検討してください：

1. **ヘッダー設定による対応**

   `firebase.json` の `headers` セクションでCORSヘッダーを設定できます：

   ```json
   {
     "hosting": {
       "public": "out",
       "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
       "rewrites": [...],
       "headers": [
         {
           "source": "**/*.@(json|js|css|gif|jpg|jpeg|png|svg|webp)",
           "headers": [
             {
               "key": "Access-Control-Allow-Origin",
               "value": "*"
             }
           ]
         },
         {
           "source": "/api/**",
           "headers": [
             {
               "key": "Access-Control-Allow-Origin",
               "value": "https://yourspecificdomain.com"
             },
             {
               "key": "Access-Control-Allow-Methods",
               "value": "GET, POST, PUT, DELETE, OPTIONS"
             },
             {
               "key": "Access-Control-Allow-Headers",
               "value": "Content-Type, Authorization"
             }
           ]
         }
       ]
     }
   }
   ```

2. **Cloud Functions連携時のCORS対策**

   Cloud Functionsを使用してAPIを提供する場合は、関数内でCORSミドルウェアを設定します：

   ```javascript
   const functions = require('firebase-functions');
   const cors = require('cors')({ origin: true });
   
   exports.myFunction = functions.https.onRequest((req, res) => {
     return cors(req, res, () => {
       // 関数のロジックをここに記述
       res.status(200).send({ data: 'Some data' });
     });
   });
   ```

3. **環境別CORS設定**

   開発環境と本番環境でCORS設定を分けるには：

   ```javascript
   const allowedOrigins = process.env.NODE_ENV === 'production' 
     ? ['https://yourapp.web.app', 'https://yourdomain.com']
     : ['http://localhost:3000'];
   
   const cors = require('cors')({ 
     origin: (origin, callback) => {
       if (!origin || allowedOrigins.includes(origin)) {
         callback(null, true);
       } else {
         callback(new Error('Not allowed by CORS'));
       }
     } 
   });
   ```

4. **middlewareを使用するNext.jsプロジェクトの場合**

   Next.jsプロジェクトでは、`middleware.ts`を作成してCORS対策を実装できます：

   ```typescript
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   
   export function middleware(request: NextRequest) {
     const response = NextResponse.next();
     
     // CORSヘッダーを設定
     response.headers.set('Access-Control-Allow-Origin', '*');
     response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
     response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
     
     return response;
   }
   
   export const config = {
     matcher: '/api/:path*',
   };
   ```

5. **セキュリティのベストプラクティス**

   - `Access-Control-Allow-Origin: *` は開発中のみ使用し、本番環境では具体的なドメインを指定しましょう
   - 必要最小限のHTTPメソッドのみ許可してください
   - 機密性の高いエンドポイントには厳格なCORS設定を適用してください

## トラブルシューティング

### デプロイエラー

1. ビルド出力ディレクトリが存在しない：
   - `npm run build`を実行してから`firebase deploy`を実行

2. 権限エラー：
   - `firebase logout`を実行し、再度`firebase login`を実行

3. デプロイ時間がかかる：
   - 大量の小さなファイルがある場合は`firebase.json`の`ignore`設定を見直す

### 404エラー

1. `firebase.json`のrewrites設定を確認：

```json
"rewrites": [
  {
    "source": "**",
    "destination": "/index.html"
  }
]
```

2. ビルド設定とNext.jsの設定を確認

### APIルートが機能しない

Firebase Hostingは静的ファイルのみをサポートします。APIルートを使用する場合：

1. Cloud Functionsを使用してAPIを実装
2. または、Vercelなどのサーバーサイドレンダリングをサポートするプラットフォームを検討

```bash
# Cloud Functions初期化
firebase init functions
```

### キャッシュの問題

1. ブラウザのキャッシュをクリア
2. `firebase.json`にキャッシュ制御ヘッダーを追加

```json
"headers": [
  {
    "source": "/**",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "no-cache, no-store, must-revalidate"
      }
    ]
  }
]
```

### 本番環境での.envファイルの扱い

1. 環境変数は`NEXT_PUBLIC_`プレフィックスを付けて公開可能なものだけを使用
2. 機密情報はFirebase Secret ManagerまたはCloud Secret Managerを使用 