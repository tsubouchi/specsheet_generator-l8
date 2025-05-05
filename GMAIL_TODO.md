# Gmail API連携による仕様書送信機能の実装

## 1. 概要
アプリにて出力された仕様書をGmail APIを使って直接ウェブアプリから送信できる機能を実装する。ユーザーは宛先、件名、本文を入力し、生成された仕様書を添付ファイルとして送信できるようにする。

## 2. 前提条件
- Firebase認証で認証済みのユーザーのみ利用可能
- PDFまたはMarkdown形式の仕様書を添付ファイルとして送信
- ユーザー自身のGmailアカウントから送信する（Firebase OAuth認証）

## 3. 技術スタック
- Next.js (APIルート)
- Google Gmail API
- Firebase OAuth 2.0認証
- Cloud Run（デプロイ先）

## 4. 開発手順詳細

### 4.1 Firebase と Gmail API の設定

1. GCPプロジェクトでGmail APIを有効化する
   ```bash
   gcloud services enable gmail.googleapis.com
   ```

2. Firebase Authentication で Google プロバイダを有効化
   - Firebase コンソールで「Authentication」→「Sign-in method」を開く
   - Google プロバイダを有効化
   - Gmail APIのスコープを追加: `https://www.googleapis.com/auth/gmail.send`

3. Firebase プロジェクト設定の確認
   ```javascript
   const firebaseConfig = {
     apiKey: "<YOUR_FIREBASE_API_KEY>",
     authDomain: "specsheet-generator.firebaseapp.com",
     projectId: "specsheet-generator",
     storageBucket: "specsheet-generator.firebasestorage.app",
     messagingSenderId: "503166429433",
     appId: "1:503166429433:web:359179414d605cc91eda28"
   };
   ```

4. Firebase Admin SDK の設定
   - Firebase コンソールで「プロジェクト設定」→「サービスアカウント」からサービスアカウントキーをダウンロード
   - キーファイルを `keys/firebase-admin.json` として保存

### 4.2 バックエンド実装

1. 必要なライブラリのインストール
   ```bash
   pnpm add @googleapis/gmail firebase-admin
   ```

2. Firebase Admin SDK 初期化 (`lib/firebase-admin.ts`)
   ```typescript
   import * as admin from 'firebase-admin';
   import { getApps } from 'firebase-admin/app';

   if (!getApps().length) {
     try {
       admin.initializeApp({
         credential: admin.credential.cert({
           projectId: process.env.FIREBASE_PROJECT_ID,
           clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
           privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
         }),
       });
     } catch (error) {
       console.error('Firebase admin initialization error', error);
     }
   }

   export default admin;
   ```

3. Gmail API連携用のライブラリ関数の作成 (`lib/gmail.ts`)
   ```typescript
   import { google } from 'googleapis';
   import admin from './firebase-admin';

   // Firebase tokenからGmailへのアクセストークンを取得
   export const getGmailToken = async (firebaseToken: string) => {
     try {
       // Firebase tokenを検証
       const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
       const uid = decodedToken.uid;
       
       // ユーザー情報を取得
       const userRecord = await admin.auth().getUser(uid);
       
       // Providerデータからgoogleアクセストークンを取得
       const googleProvider = userRecord.providerData.find(
         provider => provider.providerId === 'google.com'
       );
       
       if (!googleProvider || !googleProvider.photoURL) {
         throw new Error('Googleアカウントでのログインが必要です');
       }
       
       // Firebase AuthのProviderデータからGoogleトークンを取得
       // 注：これは簡略化したもので、実際にはFirebase Auth Custom Claimなどを使う必要がある場合があります
       const tokens = await admin.auth().createCustomToken(uid, {
         google_access_token: googleProvider.photoURL
       });
       
       return tokens;
     } catch (error) {
       console.error('Gmailトークン取得エラー:', error);
       throw error;
     }
   };

   // メール送信関数
   export const sendEmail = async (
     firebaseToken: string,
     to: string,
     subject: string,
     body: string,
     attachmentContent?: string,
     attachmentName?: string
   ) => {
     try {
       // Firebase IDトークンから認証情報を取得
       const accessToken = await getGmailToken(firebaseToken);
       
       // Gmail APIクライアントの初期化
       const oauth2Client = new google.auth.OAuth2();
       oauth2Client.setCredentials({ access_token: accessToken });
       
       const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
       
       // メールの作成とエンコード処理
       const message = createEmailWithAttachment(to, subject, body, attachmentContent, attachmentName);
       
       // メール送信
       const result = await gmail.users.messages.send({
         userId: 'me',
         requestBody: {
           raw: Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
         }
       });
       
       return result.data;
     } catch (error) {
       console.error('メール送信エラー:', error);
       throw error;
     }
   };

   // メールデータの作成（添付ファイルを含む）
   function createEmailWithAttachment(
     to: string,
     subject: string,
     body: string,
     attachmentContent?: string,
     attachmentName?: string
   ) {
     const boundary = 'boundary_' + Math.random().toString(16);
     const nl = '\n';
     
     let message = [
       `To: ${to}`,
       `Subject: ${subject}`,
       'MIME-Version: 1.0',
       `Content-Type: multipart/mixed; boundary=${boundary}`,
       '',
       `--${boundary}`,
       'Content-Type: text/plain; charset=UTF-8',
       'Content-Transfer-Encoding: 7bit',
       '',
       body,
       ''
     ].join(nl);
     
     // 添付ファイルがある場合
     if (attachmentContent && attachmentName) {
       message += [
         `--${boundary}`,
         `Content-Type: application/pdf; name=${attachmentName}`,
         'Content-Transfer-Encoding: base64',
         `Content-Disposition: attachment; filename=${attachmentName}`,
         '',
         attachmentContent,
         '',
         `--${boundary}--`
       ].join(nl);
     } else {
       message += `--${boundary}--`;
     }
     
     return message;
   }
   ```

4. メール送信APIの実装 (`app/api/gmail-send/route.ts`)
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { sendEmail } from '@/lib/gmail';
   import admin from '@/lib/firebase-admin';

   export async function POST(req: NextRequest) {
     try {
       // Firebase認証チェック
       const authHeader = req.headers.get('Authorization');
       if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
       }
       
       const idToken = authHeader.split('Bearer ')[1];
       
       // Firebaseトークン検証
       try {
         await admin.auth().verifyIdToken(idToken);
       } catch (error) {
         console.error('Firebase認証エラー:', error);
         return NextResponse.json({ error: '無効な認証トークンです' }, { status: 401 });
       }
       
       const body = await req.json();
       const { to, subject, emailBody, attachmentContent, attachmentName } = body;
       
       if (!to || !subject || !emailBody) {
         return NextResponse.json({ error: '宛先、件名、本文は必須です' }, { status: 400 });
       }
       
       // メール送信処理
       const result = await sendEmail(
         idToken,
         to,
         subject,
         emailBody,
         attachmentContent,
         attachmentName
       );
       
       return NextResponse.json({ success: true, messageId: result.id });
     } catch (error: any) {
       console.error('メール送信エラー:', error);
       
       // アクセストークンの期限切れの場合は再認証を促す
       if (error.message?.includes('invalid_grant') || error.message?.includes('Invalid Credentials')) {
         return NextResponse.json({ error: '再認証が必要です', requireReauth: true }, { status: 401 });
       }
       
       return NextResponse.json({ error: 'メールの送信に失敗しました' }, { status: 500 });
     }
   }
   ```

### 4.3 フロントエンド実装

1. メール送信ページの作成 (`app/email-sender/page.tsx`)
   ```tsx
   'use client';
   
   import { useState, useEffect } from 'react';
   import { useAuth } from '@/components/AuthProvider';
   import { Button } from '@/components/ui/button';
   import { Input } from '@/components/ui/input';
   import { Textarea } from '@/components/ui/textarea';
   import { useToast } from '@/components/ui/use-toast';
   import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
   import { auth } from '@/lib/firebase';
   
   export default function EmailSenderPage() {
     const { user, loading } = useAuth();
     const { toast } = useToast();
     const [to, setTo] = useState('');
     const [subject, setSubject] = useState('');
     const [body, setBody] = useState('');
     const [isSending, setIsSending] = useState(false);
     const [specData, setSpecData] = useState<any>(null);
     
     useEffect(() => {
       // クライアントサイドでのみ実行
       if (typeof window !== 'undefined') {
         // 仕様書データの取得（localStorageなどから）
         const savedSpec = localStorage.getItem('currentSpec');
         if (savedSpec) {
           try {
             const parsedSpec = JSON.parse(savedSpec);
             setSpecData(parsedSpec);
             setSubject(`仕様書: ${parsedSpec.title || '無題'}`);
             setBody(`添付ファイルに仕様書を同封します。ご確認ください。`);
           } catch (e) {
             console.error('仕様書データの解析エラー:', e);
           }
         }
       }
     }, []);
     
     const handleGmailAuth = async () => {
       try {
         // Google認証プロバイダを設定
         const provider = new GoogleAuthProvider();
         // Gmail送信のスコープを追加
         provider.addScope('https://www.googleapis.com/auth/gmail.send');
         
         // Googleでサインイン
         await signInWithPopup(auth, provider);
         
         toast({
           title: '認証成功',
           description: 'Gmailと連携しました',
         });
       } catch (error: any) {
         console.error('Gmail認証エラー:', error);
         toast({
           title: 'エラー',
           description: 'Gmail認証に失敗しました',
           variant: 'destructive',
         });
       }
     };
     
     const handleSendEmail = async () => {
       if (!to || !subject || !body) {
         toast({
           title: '入力エラー',
           description: '宛先、件名、本文は必須です',
           variant: 'destructive',
         });
         return;
       }
       
       if (!user) {
         toast({
           title: '認証エラー',
           description: 'ログインが必要です',
           variant: 'destructive',
         });
         return;
       }
       
       setIsSending(true);
       
       try {
         // IDトークンを取得
         const idToken = await user.getIdToken();
         
         const response = await fetch('/api/gmail-send', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${idToken}`
           },
           body: JSON.stringify({
             to,
             subject,
             emailBody: body,
             attachmentContent: specData?.markdown || specData?.content,
             attachmentName: `${specData?.title || 'spec'}.pdf`
           })
         });
         
         const data = await response.json();
         
         if (data.success) {
           toast({
             title: '送信完了',
             description: 'メールが正常に送信されました',
           });
         } else if (data.requireReauth) {
           toast({
             title: '再認証が必要です',
             description: 'Gmailの認証が切れました。再度認証してください',
             variant: 'destructive',
           });
           handleGmailAuth();
         } else {
           throw new Error(data.error || '送信に失敗しました');
         }
       } catch (error: any) {
         console.error('メール送信エラー:', error);
         toast({
           title: 'エラー',
           description: error.message || 'メールの送信に失敗しました',
           variant: 'destructive',
         });
       } finally {
         setIsSending(false);
       }
     };
     
     if (loading) return <div>読み込み中...</div>;
     
     if (!user) {
       return (
         <div className="p-6">
           <h1 className="text-2xl font-bold mb-4">ログインが必要です</h1>
           <p>この機能を利用するには、ログインしてください。</p>
         </div>
       );
     }
     
     const isGoogleProvider = user.providerData.some(
       provider => provider.providerId === 'google.com'
     );
     
     return (
       <div className="p-6 max-w-2xl mx-auto">
         <h1 className="text-2xl font-bold mb-6">仕様書をメールで送信</h1>
         
         {!isGoogleProvider ? (
           <div className="mb-6 p-4 border rounded-md bg-yellow-50">
             <h2 className="font-semibold mb-2">Google認証が必要です</h2>
             <p className="mb-4">仕様書を送信するには、Googleアカウントでのログインが必要です。</p>
             <Button onClick={handleGmailAuth}>
               Googleアカウントで認証する
             </Button>
           </div>
         ) : (
           <form className="space-y-4">
             <div>
               <label className="block mb-1">宛先</label>
               <Input
                 type="email"
                 value={to}
                 onChange={(e) => setTo(e.target.value)}
                 placeholder="送信先のメールアドレス"
                 required
               />
             </div>
             
             <div>
               <label className="block mb-1">件名</label>
               <Input
                 value={subject}
                 onChange={(e) => setSubject(e.target.value)}
                 placeholder="メールの件名"
                 required
               />
             </div>
             
             <div>
               <label className="block mb-1">本文</label>
               <Textarea
                 value={body}
                 onChange={(e) => setBody(e.target.value)}
                 placeholder="メールの本文"
                 rows={6}
                 required
               />
             </div>
             
             <div>
               <label className="block mb-1">添付ファイル</label>
               <div className="p-3 border rounded-md bg-gray-50">
                 {specData?.title || '無題'}.pdf
               </div>
               <p className="text-sm text-gray-500 mt-1">
                 現在表示中の仕様書が添付されます
               </p>
             </div>
             
             <Button
               type="button"
               onClick={handleSendEmail}
               disabled={isSending}
               className="w-full"
             >
               {isSending ? '送信中...' : 'メールを送信'}
             </Button>
           </form>
         )}
       </div>
     );
   }
   ```

2. メールボタンコンポーネントの作成 (`components/EmailButton.tsx`)
   ```tsx
   import React from 'react';
   import { Button } from '@/components/ui/button';
   import { useRouter } from 'next/navigation';
   import { Mail } from 'lucide-react';
   import { useAuth } from '@/components/AuthProvider';

   interface EmailButtonProps {
     specId?: string;
   }

   export function EmailButton({ specId }: EmailButtonProps = {}) {
     const router = useRouter();
     const { user } = useAuth();
     
     const handleClick = () => {
       if (typeof window !== 'undefined') {
         // 現在表示中の仕様書データを保存
         if (specId) {
           localStorage.setItem('emailSpecId', specId);
         }
         router.push('/email-sender');
       }
     };
     
     return (
       <Button
         variant="outline"
         size="sm"
         onClick={handleClick}
         className="flex items-center gap-1"
         disabled={!user}
       >
         <Mail className="h-4 w-4" />
         <span>メールで送信</span>
       </Button>
     );
   }
   ```

### 4.4 Firebase プロジェクト設定の更新

1. Google Sign-In のスコープ拡張
   - Firebase コンソールで「Authentication」→「Settings」→「Advanced」
   - OAuth スコープに `https://www.googleapis.com/auth/gmail.send` を追加

2. Google Cloud Console で Gmail API の制限を設定
   - APIとサービス」→「認証情報」→「制限事項」で、アプリからのみアクセス可能に設定

### 4.5 テスト

1. ローカル環境でのテスト
   ```bash
   pnpm dev
   ```

2. Firebase認証を使ったGmail API連携のテスト
   - Googleログインフロー
   - スコープの付与
   - メール送信機能
   - エラーハンドリング

### 4.6 デプロイ準備

1. Cloud Buildの更新（`cloudbuild.yaml`に環境変数を追加）
   ```yaml
   # Firebase Admin SDK関連の環境変数を追加
   - name: "gcr.io/cloud-builders/gcloud"
     args:
       - "run"
       - "deploy"
       - "specsheet-generator"
       - "--image=asia-docker.pkg.dev/$PROJECT_ID/specsheet-docker/specsheet-generator:$BUILD_ID"
       - "--region=asia-northeast1"
       - "--platform=managed"
       - "--min-instances=1"
       - "--service-account=specsheet-run-sa@$PROJECT_ID.iam.gserviceaccount.com"
       - "--allow-unauthenticated"
       - "--set-secrets=FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"
       - "--update-env-vars=FIREBASE_PROJECT_ID=specsheet-generator,FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@specsheet-generator.iam.gserviceaccount.com"
   ```

2. Secret Managerに認証情報を保存
   ```bash
   # Firebase Admin SDKの秘密鍵をシークレットとして保存
   gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=- <<< "YOUR_PRIVATE_KEY"
   
   # サービスアカウントにシークレットアクセス権限を付与
   gcloud secrets add-iam-policy-binding FIREBASE_PRIVATE_KEY \
     --member="serviceAccount:specsheet-run-sa@specsheet-generator.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

### 4.7 GCPへのデプロイ

1. 本番環境へのデプロイ
   ```bash
   # Cloud Build経由でデプロイ
   gcloud builds submit --config=cloudbuild.yaml
   ```

2. デプロイ後の動作確認
   - Firebase認証フロー
   - Gmail APIとの連携
   - メール送信機能
   - セキュリティ設定

## 5. セキュリティ考慮事項
- Firebase認証で適切なユーザー認証を確保
- 必要最小限のスコープをリクエスト（gmail.send のみ）
- バックエンドでFirebase IDトークンを必ず検証
- 秘密鍵やAPIキーは環境変数またはSecret Managerで管理

## 6. 注意点
- Gmail APIには1日あたりの送信制限があります（一般的には1日に500通）
- 添付ファイルサイズに制限あり（25MB）
- Googleアカウントでのログインが必須

## 7. 追加機能（オプション）
- 送信履歴の保存と管理
- テンプレートメッセージ機能
- 複数の宛先（CC, BCC）対応
- メール送信前のプレビュー機能

## 8. リソース
- [Gmail API ドキュメント](https://developers.google.com/gmail/api/guides)
- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth)
- [Gmail API Node.js クライアントライブラリ](https://github.com/googleapis/google-api-nodejs-client#google-apis-nodejs-client)

## 9. マイルストーン & 進捗
| # | タスク | Owner | Due | Status |
|---|--------|-------|-----|--------|
| 1 | Gmail API有効化 | ops | | ✅ |
| 2 | Firebase AuthでのGoogle認証設定 | ops | | 🔄 |
| 3 | Firebase Admin SDK設定 | ops | | 🔄 |
| 4 | Gmail連携用ライブラリ実装 | dev | | 🔄 |
| 5 | メール送信APIルート実装 | dev | | 🔄 |
| 6 | フロントエンド送信ページ実装 | dev | | 🔄 |
| 7 | EmailButtonコンポーネント実装 | dev | | ✅ |
| 8 | ローカルテスト | qa | | 🔄 |
| 9 | Firebase Admin SDK用シークレット設定 | ops | | 🔄 |
| 10 | Cloud Run環境変数設定 | ops | | 🔄 |
| 11 | 本番環境デプロイ | ops | | 🔄 |
| 12 | 本番環境テスト | qa | | 🔄 |
