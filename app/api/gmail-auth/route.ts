import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail';

export async function GET(req: NextRequest) {
  try {
    const authUrl = await getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Gmail認証URLの生成に失敗:', error);
    return NextResponse.json({ error: '認証URLの生成に失敗しました' }, { status: 500 });
  }
} 