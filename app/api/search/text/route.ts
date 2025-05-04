import type { NextRequest } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { db } from "@/lib/firebaseAdmin"
import { algoliaIndex } from "@/lib/algolia"
import { FieldPath } from "firebase-admin/firestore"
import { logSearch } from "@/lib/searchLog"

export const runtime = "nodejs"

// === CORS 共通ヘッダ ===
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// Auth ヘッダから Firebase ID トークンを検証（任意: 未認証でも可にする場合はコメントアウト）
async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) return null
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q")?.trim() ?? ""
    if (!query) {
      return new Response("q パラメータが必要です", { status: 400, headers: CORS_HEADERS })
    }

    if (!algoliaIndex) {
      return new Response("Algolia が設定されていません", { status: 500, headers: CORS_HEADERS })
    }

    // （任意）ユーザ認証 — 未ログインでも検索可能とする
    const uid = await verifyUser(req)

    // Algolia 検索
    const start = Date.now()
    const { hits } = await algoliaIndex.search(query, { hitsPerPage: 20 })
    const latency = Date.now() - start
    const ids: string[] = hits.map((h: any) => h.objectID)

    if (ids.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      })
    }

    // Firestore からドキュメント取得（最大 10 件ずつ in クエリ）
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))

    let results: any[] = []
    for (const chunk of chunks) {
      const snap = await db
        .collection("specs")
        .where(FieldPath.documentId(), "in", chunk)
        .get()
      snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() }))
    }

    // 検索履歴を保存（非同期）
    logSearch({ uid, type: "text", query, hits: ids, latencyMs: latency })

    // レスポンス
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    })
  } catch (err: any) {
    console.error("search error", err)
    return new Response("検索中にエラー", { status: 500, headers: CORS_HEADERS })
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
} 