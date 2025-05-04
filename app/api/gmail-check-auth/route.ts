import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // アクセストークンの存在を確認
    const accessToken = req.cookies.get('gmail_access_token')?.value;
    
    return NextResponse.json({
      isAuthenticated: !!accessToken
    });
  } catch (error) {
    console.error('Gmail認証確認エラー:', error);
    return NextResponse.json({ error: '認証状態の確認に失敗しました' }, { status: 500 });
  }
} 