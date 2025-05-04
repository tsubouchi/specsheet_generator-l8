import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import admin from './firebase-admin';

// OAuth2クライアントの設定
export const getOAuth2Client = async () => {
  // 環境変数から認証情報を取得
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || process.env.NEXT_PUBLIC_URL + '/api/gmail-callback';
  
  if (!clientId || !clientSecret) {
    throw new Error('Gmail OAuth認証情報が設定されていません');
  }
  
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    redirectUri
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
    
    if (!googleProvider) {
      throw new Error('Googleアカウントでのログインが必要です');
    }
    
    // 注：実際の実装では、Firebaseユーザーのカスタムクレームや
    // 別のセキュアな方法でアクセストークンを取得する必要があります
    // ここでは簡略化のためダミーのトークンを返しています
    return 'firebase-google-auth-token';
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