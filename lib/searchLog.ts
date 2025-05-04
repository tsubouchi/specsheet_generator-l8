import { db } from "@/lib/firebaseAdmin"
import { FieldValue } from "firebase-admin/firestore"

export async function logSearch(params: {
  uid: string | null
  type: "text" | "vector"
  query: string
  hits: string[]
  latencyMs: number
}) {
  try {
    const { uid, ...rest } = params
    const ref = db
      .collection("search_logs")
      .doc(uid ?? "anonymous")
      .collection("items")
      .doc()

    await ref.set({ ...rest, ts: FieldValue.serverTimestamp() })
  } catch (e) {
    console.error("logSearch error", e)
  }
} 