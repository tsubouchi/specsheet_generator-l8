# Gmail API連携による仕様書送信機能の実装

## 1. 概要
アプリにて出力された仕様書をGmail APIを使って直接ウェブアプリから送信できる機能を実装する。ユーザーは宛先、件名、本文を入力し、生成された仕様書を添付ファイルとして送信できるようにする。

## 2. 前提条件
- Firebase認証で認証済みのユーザーのみ利用可能
- PDFまたはMarkdown形式の仕様書を添付ファイルとして送信
- ユーザー自身のGmailアカウントから送信する（OAuth認証）

## 3. 技術スタック
- Next.js (APIルート)
- Google Gmail API
- OAuth 2.0認証
- Cloud Run（デプロイ先）

## 4. 開発手順詳細

### 4.1 GCP設定 & APIの有効化

1. GCPプロジェクトでGmail APIを有効化する
   ```bash
   gcloud services enable gmail.googleapis.com
   ```

2. OAuth同意画面の設定
   - GCPコンソールで「APIとサービス」→「OAuth同意画面」を開く
   - 適切な範囲を設定: `https://www.googleapis.com/auth/gmail.send`
   - 必要なテストユーザーを追加

3. OAuthクライアントIDの作成
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project specsheet-generator
   ```

4. OAuthクライアントシークレットをダウンロードし安全に保存
   - JSONファイルをダウンロードして`keys/gmail-credentials.json`として保存

### 4.2 バックエンド実装

1. Gmail APIクライアントライブラリのインストール
   ```bash
   pnpm add @googleapis/gmail
   ```

2. Gmail API連携用のライブラリ関数の作成 (`lib/gmail.ts`)
   ```typescript
   import { google } from 'googleapis';
   import { OAuth2Client } from 'google-auth-library';

   // OAuth2クライアントの設定
   export const getOAuth2Client = async () => {
     const credentials = require('../../keys/gmail-credentials.json');
     const oauth2Client = new OAuth2Client(
       credentials.web.client_id,
       credentials.web.client_secret,
       process.env.NEXT_PUBLIC_URL + '/api/gmail-callback'
     );
     return oauth2Client;
   };

   // 認可URLの生成
   export const getAuthUrl = async () => {
     const oauth2Client = await getOAuth2Client();
     return oauth2Client.generateAuthUrl({
       access_type: 'offline',
       scope: ['https://www.googleapis.com/auth/gmail.send'],
       prompt: 'consent',
     });
   };

   // メール送信関数
   export const sendEmail = async (
     accessToken: string,
     to: string,
     subject: string,
     body: string,
     attachmentContent?: string,
     attachmentName?: string
   ) => {
     const oauth2Client = await getOAuth2Client();
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

3. 認証コールバックAPIの実装 (`app/api/gmail-callback/route.ts`)
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { getOAuth2Client } from '../../../lib/gmail';
   import { cookies } from 'next/headers';

   export async function GET(req: NextRequest) {
     try {
       const url = new URL(req.url);
       const code = url.searchParams.get('code');
       
       if (!code) {
         return NextResponse.json({ error: '認証コードがありません' }, { status: 400 });
       }
       
       const oauth2Client = await getOAuth2Client();
       const { tokens } = await oauth2Client.getToken(code);
       
       // トークンを安全に保存（本番環境ではより安全な方法を使用）
       if (tokens.access_token) {
         cookies().set('gmail_access_token', tokens.access_token, {
           httpOnly: true,
           secure: process.env.NODE_ENV === 'production',
           maxAge: 3600, // 1時間
           path: '/'
         });
       }
       
       // フロントエンドにリダイレクト
       return NextResponse.redirect(new URL('/email-sender', req.url));
     } catch (error) {
       console.error('Gmail認証エラー:', error);
       return NextResponse.json({ error: '認証に失敗しました' }, { status: 500 });
     }
   }
   ```

4. メール送信APIの実装 (`app/api/gmail-send/route.ts`)
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { sendEmail } from '../../../lib/gmail';
   import { auth } from '@firebase/auth';
   import { cookies } from 'next/headers';

   export async function POST(req: NextRequest) {
     try {
       // Firebase認証チェック
       const authHeader = req.headers.get('Authorization');
       if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
       }
       
       // アクセストークンの取得
       const accessToken = cookies().get('gmail_access_token')?.value;
       if (!accessToken) {
         return NextResponse.json({ error: 'Gmailへの認証が必要です' }, { status: 401 });
       }
       
       const body = await req.json();
       const { to, subject, emailBody, attachmentContent, attachmentName } = body;
       
       if (!to || !subject || !emailBody) {
         return NextResponse.json({ error: '宛先、件名、本文は必須です' }, { status: 400 });
       }
       
       // メール送信処理
       const result = await sendEmail(
         accessToken,
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
         cookies().delete('gmail_access_token');
         return NextResponse.json({ error: '再認証が必要です', requireReauth: true }, { status: 401 });
       }
       
       return NextResponse.json({ error: 'メールの送信に失敗しました' }, { status: 500 });
     }
   }
   ```

5. 認証開始APIの実装 (`app/api/gmail-auth/route.ts`)
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { getAuthUrl } from '../../../lib/gmail';

   export async function GET(req: NextRequest) {
     try {
       const authUrl = await getAuthUrl();
       return NextResponse.json({ authUrl });
     } catch (error) {
       console.error('Gmail認証URLの生成に失敗:', error);
       return NextResponse.json({ error: '認証URLの生成に失敗しました' }, { status: 500 });
     }
   }
   ```

### 4.3 フロントエンド実装

1. メール送信ページの作成 (`app/email-sender/page.tsx`)
   ```tsx
   'use client';
   
   import { useState, useEffect } from 'react';
   import { useAuth } from '@/hooks/useAuth';
   import { Button } from '@/components/ui/button';
   import { Input } from '@/components/ui/input';
   import { Textarea } from '@/components/ui/textarea';
   import { useToast } from '@/components/ui/use-toast';
   
   export default function EmailSenderPage() {
     const { user, isLoading } = useAuth();
     const { toast } = useToast();
     const [to, setTo] = useState('');
     const [subject, setSubject] = useState('');
     const [body, setBody] = useState('');
     const [isAuthenticated, setIsAuthenticated] = useState(false);
     const [isSending, setIsSending] = useState(false);
     const [specData, setSpecData] = useState<any>(null);
     
     useEffect(() => {
       // 仕様書データの取得（localStorageなどから）
       const savedSpec = localStorage.getItem('currentSpec');
       if (savedSpec) {
         setSpecData(JSON.parse(savedSpec));
         setSubject(`仕様書: ${JSON.parse(savedSpec).title || '無題'}`);
         setBody(`添付ファイルに仕様書を同封します。ご確認ください。`);
       }
       
       // Gmailの認証状態チェック
       checkGmailAuth();
     }, []);
     
     const checkGmailAuth = async () => {
       try {
         const response = await fetch('/api/gmail-check-auth');
         const data = await response.json();
         setIsAuthenticated(data.isAuthenticated);
       } catch (error) {
         console.error('認証確認エラー:', error);
       }
     };
     
     const handleGmailAuth = async () => {
       try {
         const response = await fetch('/api/gmail-auth');
         const data = await response.json();
         
         if (data.authUrl) {
           window.location.href = data.authUrl;
         }
       } catch (error) {
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
       
       setIsSending(true);
       
       try {
         const response = await fetch('/api/gmail-send', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${await user?.getIdToken()}`
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
           setIsAuthenticated(false);
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
     
     if (isLoading) return <div>読み込み中...</div>;
     
     if (!user) {
       return (
         <div className="p-6">
           <h1 className="text-2xl font-bold mb-4">ログインが必要です</h1>
           <p>この機能を利用するには、ログインしてください。</p>
         </div>
       );
     }
     
     return (
       <div className="p-6 max-w-2xl mx-auto">
         <h1 className="text-2xl font-bold mb-6">仕様書をメールで送信</h1>
         
         {!isAuthenticated ? (
           <div className="mb-6 p-4 border rounded-md bg-yellow-50">
             <h2 className="font-semibold mb-2">Gmail認証が必要です</h2>
             <p className="mb-4">仕様書を送信するには、Gmailへのアクセス許可が必要です。</p>
             <Button onClick={handleGmailAuth}>
               Gmailと連携する
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
   import { Envelope } from 'lucide-react';

   interface EmailButtonProps {
     specId?: string;
   }

   export function EmailButton({ specId }: EmailButtonProps) {
     const router = useRouter();
     
     const handleClick = () => {
       router.push('/email-sender');
     };
     
     return (
       <Button
         variant="outline"
         size="sm"
         onClick={handleClick}
         className="flex items-center gap-1"
       >
         <Envelope className="h-4 w-4" />
         <span>メールで送信</span>
       </Button>
     );
   }
   ```

3. SaveButtonコンポーネントにメール機能を統合 (`components/SaveButton.tsx`)
   ```tsx
   // EmailButtonコンポーネントをインポート
   import { EmailButton } from './EmailButton';
   
   // 既存のコンポーネントにEmailButtonを追加
   const saveOptions = (
     <div className="flex flex-col gap-2 p-4">
       {/* 既存のコード */}
       <div className="flex gap-2 mt-2">
         <DriveButton specId={currentSpecId} />
         <EmailButton specId={currentSpecId} />
       </div>
     </div>
   );
   ```

### 4.4 テスト

1. ローカル環境でのテスト
   ```bash
   pnpm dev
   ```

2. Gmail API連携のテスト
   - 認証フロー
   - メール送信機能
   - エラーハンドリング

### 4.5 デプロイ準備

1. Cloud Buildの更新（`cloudbuild.yaml`に環境変数を追加）
   ```yaml
   # Gmail API関連の環境変数を追加
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
       - "--set-secrets=GMAIL_CLIENT_ID=GMAIL_CLIENT_ID:latest,GMAIL_CLIENT_SECRET=GMAIL_CLIENT_SECRET:latest"
       - "--update-env-vars=GMAIL_REDIRECT_URI=https://your-domain.com/api/gmail-callback"
   ```

2. Secret Managerに認証情報を保存
   ```bash
   # OAuth2クライアントIDをシークレットとして保存
   gcloud secrets create GMAIL_CLIENT_ID --data-file=- <<< "YOUR_CLIENT_ID"
   
   # OAuth2クライアントシークレットをシークレットとして保存
   gcloud secrets create GMAIL_CLIENT_SECRET --data-file=- <<< "YOUR_CLIENT_SECRET"
   ```

3. サービスアカウントにGmail API権限を付与
   ```bash
   # サービスアカウントにGmailの権限を付与
   gcloud projects add-iam-policy-binding specsheet-generator \
     --member="serviceAccount:specsheet-run-sa@specsheet-generator.iam.gserviceaccount.com" \
     --role="roles/gmail.settings.sharing"
   ```

### 4.6 GCPへのデプロイ

1. 本番環境へのデプロイ
   ```bash
   # Cloud Build経由でデプロイ
   gcloud builds submit --config=cloudbuild.yaml
   ```

2. デプロイ後の動作確認
   - 認証フロー
   - メール送信機能
   - セキュリティ設定

## 5. セキュリティ考慮事項
- ユーザーの認証トークンはHTTP Cookieに保存し、HTTPOnlyとSecure属性を設定
- バックエンドでFirebase認証を必ず確認
- OAuth同意画面の設定は必要最小限のスコープで設定
- アクセストークンの有効期限を管理し、必要に応じて再認証を促す

## 6. 注意点
- Gmail APIには1日あたりの送信制限があります（一般的には1日に500通）
- 添付ファイルサイズに制限あり（25MB）
- OAuthの設定では適切なリダイレクトURIの設定が必要

## 7. 追加機能（オプション）
- 送信履歴の保存と管理
- テンプレートメッセージ機能
- 複数の宛先（CC, BCC）対応
- メール送信前のプレビュー機能

## 8. リソース
- [Gmail API ドキュメント](https://developers.google.com/gmail/api/guides)
- [Google OAuth 2.0 ドキュメント](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Node.js クライアントライブラリ](https://github.com/googleapis/google-api-nodejs-client#google-apis-nodejs-client)

## 9. マイルストーン & 進捗
| # | タスク | Owner | Due | Status |
|---|--------|-------|-----|--------|
| 1 | Gmail API有効化 | ops | | 🔄 |
| 2 | OAuth同意画面設定 | ops | | 🔄 |
| 3 | OAuthクライアントID作成 | ops | | 🔄 |
| 4 | Gmail連携用ライブラリ実装 | dev | | 🔄 |
| 5 | 認証APIルート実装 | dev | | 🔄 |
| 6 | メール送信APIルート実装 | dev | | 🔄 |
| 7 | フロントエンド送信ページ実装 | dev | | 🔄 |
| 8 | EmailButtonコンポーネント実装 | dev | | 🔄 |
| 9 | ローカルテスト | qa | | 🔄 |
| 10 | シークレット設定 | ops | | 🔄 |
| 11 | Cloud Run環境変数設定 | ops | | 🔄 |
| 12 | 本番環境デプロイ | ops | | 🔄 |
| 13 | 本番環境テスト | qa | | 🔄 |
