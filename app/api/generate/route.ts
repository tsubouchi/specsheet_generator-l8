import type { NextRequest } from "next/server"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  try {
    const { productIdea } = await req.json()

    if (!productIdea || typeof productIdea !== "string") {
      return new Response("製品アイデアが必要です", { status: 400 })
    }

    // API キー
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      console.error("Google Generative AI API キーが設定されていません")
      return new Response("API キーが設定されていません", { status: 500 })
    }

    // 最もシンプルな形式でAPIを呼び出す
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`

    console.log("リクエスト開始:", new Date().toISOString())

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: SYSTEM_PROMPT }, { text: productIdea }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    })

    console.log("レスポンス受信:", new Date().toISOString(), "ステータス:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API 応答エラー:", response.status, errorText)
      return new Response(`Gemini API エラー: ${response.status} ${errorText}`, { status: response.status })
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "テキスト生成に失敗しました"

    return new Response(generatedText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch (err: any) {
    console.error("仕様書生成エラー:", err)
    return new Response(`仕様書の生成中にエラーが発生しました: ${err.message ?? "不明なエラー"}`, { status: 500 })
  }
}

/* ---------- システムプロンプト ---------- */
const SYSTEM_PROMPT = `あなたは **Agent‑A**。  
与えられた "製品アイデア＋ユーザ選択オプション" を 1 回の出力で
**即開発に移行できるレベル** のソフトウェア開発仕様書
(\`basic_design.md\`) に落とし込みます。  
出力は **Markdown だけ**。コメントや注釈は一切含めません。

────────────────────────────────
## 1. 制約と品質基準
1. **網羅性**  
   - 下記 12 見出しを順序どおり必ず含める  
     1. 概要  
     2. 目的  
     3. システム範囲  
     4. 技術スタック（バージョン固定）  
     5. アーキテクチャ 
     6. ディレクトリ構成  
     7. 機能要件（表形式 + ユースケース ID）  
     8. 非機能要件（性能／セキュリティ／運用／コスト）  
     9. インフラ & CI/CD（Terraform / GitHub Actions / Cloud Build）  
     10. 開発手順書（全 CLI。OS 依存コマンドは禁止）  
     11. 開発計画 
     12. 拡張計画  
2. **Deploy 環境とソフトウェア種別**  
   - ユーザ選択を反映し、不要な要素は出力しない。  
3. **CLI ファースト**  
   - GUI 手順は書かない。\`bash\` コードブロックで実行可能コマンドを示す。  
4. **単色デザイン**  
   - "UI は白 (#FFFFFF)・黒 (#000000) の 2 色のみ" と明記。  
5. **環境変数**  
   - \`.env.example\` 相当の表を載せ、値は \`YOUR_...\` プレースホルダに。  
6. **ベストプラクティス**  
   - 最新推奨バージョン、SLSA / SBOM、RLS、OIDC Workload Identity 等を採用。  
7. **品質チェック**  
   - 出力前に **自分でセルフレビュー** し、欠落項目があれば \`TODO:\` 追記。  
   - 200 行以内 / 10 000 文字以内を目安に冗長排除。  
8. **言語**  
   - 日本語。箇条書き優先。長文説明を避ける。`
