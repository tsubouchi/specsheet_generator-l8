import type { NextRequest } from "next/server"
import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'

import { db } from '@/lib/firebaseAdmin'
import { generateSpec } from '@/lib/agent/specsheetAgent'

export const runtime = "nodejs"

// === CORS 共通ヘッダ ===
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
}

// Auth ヘッダから Firebase ID トークンを検証
async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return decoded.uid
  } catch (e) {
    console.error('ID Token verification failed', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { productIdea } = await req.json()

    if (!productIdea || typeof productIdea !== "string") {
      return new Response("製品アイデアが必要です", { status: 400, headers: CORS_HEADERS })
    }

    // 認証ユーザー確認
    const uid = await verifyUser(req)
    if (!uid) {
      return new Response('認証が必要です', { status: 401, headers: CORS_HEADERS })
    }

    // 仕様書生成
    const generatedText = await generateSpec(productIdea)

    // Firestore 保存
    await db.collection('specs').add({
      uid,
      productIdea,
      spec: generatedText,
      createdAt: FieldValue.serverTimestamp(),
    })

    return new Response(generatedText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...CORS_HEADERS,
      },
    })
  } catch (err: any) {
    console.error("仕様書生成エラー:", err)
    return new Response(`仕様書の生成中にエラーが発生しました: ${err.message ?? "不明なエラー"}`, { status: 500, headers: CORS_HEADERS })
  }
}

// OPTIONS プリフライトリクエスト用ハンドラ
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
