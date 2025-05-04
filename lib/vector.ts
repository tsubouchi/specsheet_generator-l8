import { GoogleGenerativeAI } from "@google/genai"

const EMBED_MODEL = "embedding-001" // example

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set")
  const ai = new GoogleGenerativeAI({ apiKey })
  const { embeddings } = await ai.embedContent({
    model: EMBED_MODEL,
    content: text,
  })
  return embeddings.values
} 