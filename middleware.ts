import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 環境変数から許可オリジンを取得（カンマ区切り）
// デフォルト値を設定しつつ、環境変数があればそれを使用
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'https://specsheet-generator-503166429433.asia-northeast1.run.app', // 本番環境
      'http://localhost:3000', // ローカル開発環境
    ];

// 開発環境では全てのオリジンを許可するオプション
const ALLOW_ALL_IN_DEV = process.env.NODE_ENV === 'development' && process.env.ALLOW_ALL_ORIGINS === 'true';

// このミドルウェアはすべてのリクエストに適用されます
export function middleware(request: NextRequest) {
  // レスポンスの取得または新規作成
  const response = NextResponse.next();
  
  // リクエストヘッダーからオリジンを取得
  const origin = request.headers.get('origin');
  
  // オリジンの検証
  const isAllowedOrigin = origin && (
    ALLOW_ALL_IN_DEV || 
    ALLOWED_ORIGINS.includes(origin) || 
    ALLOWED_ORIGINS.includes('*')
  );
  
  if (isAllowedOrigin) {
    // CORSヘッダーを設定
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24時間
  }
  
  // プリフライトリクエスト（OPTIONS）の場合は空のレスポンスを返して終了
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204 });
  }
  
  // セキュリティヘッダーの追加（オプション）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }
  
  return response;
}

// このミドルウェアをAPIルートにのみ適用
export const config = {
  matcher: '/api/:path*',
}; 