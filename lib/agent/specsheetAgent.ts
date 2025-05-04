import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { GoogleGenAI } from '@google/genai'

/**
 * Gemini API で仕様書を生成するエージェント
 */
export async function generateSpec(productIdea: string): Promise<string> {
  const apiKey = await getApiKey()

  const ai = new GoogleGenAI({ apiKey })

  const modelName = 'gemini-2.5-flash-preview-04-17'
  const responseChunks = await ai.models.generateContentStream({
    model: modelName,
    config: {
      responseMimeType: 'text/plain',
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${SYSTEM_PROMPT}\n${productIdea}` },
        ],
      },
    ],
  })

  let result = ''
  for await (const chunk of responseChunks) {
    result += chunk.text ?? ''
  }

  return result || 'テキスト生成に失敗しました'
}

/* ---------- プロンプト ---------- */
const SYSTEM_PROMPT = `あなたは **Agent-A**。  
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

/**
 * API キーを環境変数または Secret Manager から取得
 */
async function getApiKey(): Promise<string> {
  // 1. 環境変数
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY
  }

  // 2. Secret Manager (Node.js ランタイム想定)
  if (process.env.GCP_PROJECT_ID) {
    const client = new SecretManagerServiceClient()
    const name = `projects/${process.env.GCP_PROJECT_ID}/secrets/GOOGLE_GENERATIVE_AI_API_KEY/versions/latest`
    const [version] = await client.accessSecretVersion({ name })
    const key = version.payload?.data?.toString()
    if (key) return key
  }

  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set')
} 