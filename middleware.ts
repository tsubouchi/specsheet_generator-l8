import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 許可するオリジンのリスト
const ALLOWED_ORIGINS = [
  'https://specsheet-generator-503166429433.asia-northeast1.run.app', // 本番環境
  'http://localhost:3000', // ローカル開発環境
];

// このミドルウェアはすべてのリクエストに適用されます
export function middleware(request: NextRequest) {
  // レスポンスの取得または新規作成
  const response = NextResponse.next();
  
  // リクエストヘッダーからオリジンを取得
  const origin = request.headers.get('origin');
  
  // オリジンが許可リストに含まれているか確認
  // オリジンが存在し、許可リストに含まれている場合のみ
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // CORSヘッダーを設定
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24時間
  }
  
  // プリフライトリクエスト（OPTIONS）の場合は空のレスポンスを返して終了
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204 });
  }
  
  return response;
}

// このミドルウェアをAPIルートにのみ適用
export const config = {
  matcher: '/api/:path*',
}; 