import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/gmail';
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
      const response = NextResponse.redirect(new URL('/email-sender', req.url));
      
      // responseオブジェクトにcookieを設定
      response.cookies.set({
        name: 'gmail_access_token',
        value: tokens.access_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600, // 1時間
        path: '/'
      });
      
      return response;
    }
    
    // フロントエンドにリダイレクト
    return NextResponse.redirect(new URL('/email-sender', req.url));
  } catch (error) {
    console.error('Gmail認証エラー:', error);
    return NextResponse.json({ error: '認証に失敗しました' }, { status: 500 });
  }
} 