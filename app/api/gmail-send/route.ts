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