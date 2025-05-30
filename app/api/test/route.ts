import type { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(req: NextRequest) {
  try {
    // API キー
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API キーが設定されていません" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    // テストユーザー情報を返す（クエリパラメータがtestuser=trueの場合）
    const url = new URL(req.url)
    if (url.searchParams.get('testuser') === 'true') {
      return new Response(JSON.stringify({
        email: process.env.TEST_USER_EMAIL || "test@example.com",
        password: process.env.TEST_USER_PASSWORD || "testpassword123",
        firebase_api_key: process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 最もシンプルなテスト
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Hello, how are you?" }],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({
          error: "API呼び出しエラー",
          status: response.status,
          details: errorText,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
