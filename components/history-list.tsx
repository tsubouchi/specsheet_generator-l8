"use client"

import { useEffect, useState } from "react"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore"
import { clientDb } from "@/lib/firestore"
import { useAuth } from "@/components/AuthProvider"
import { Button } from "@/components/ui/button"
import { Loader2, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

interface SpecRecord {
  id: string
  productIdea: string
  spec: string
  createdAt?: Timestamp
}

export function HistoryList() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [records, setRecords] = useState<SpecRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(clientDb, "specs"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    )

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SpecRecord, "id">),
      }))
      setRecords(docs)
      setLoading(false)
    })

    return () => unsub()
  }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm("この履歴を削除しますか？")) return

    try {
      await deleteDoc(doc(clientDb, "specs", id))
      toast({ title: "削除完了", description: "履歴を削除しました" })
    } catch (err) {
      console.error("削除失敗", err)
      toast({
        title: "削除失敗",
        description: "履歴の削除に失敗しました",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">履歴がありません</p>
  }

  return (
    <div className="space-y-4">
      {records.map((r) => (
        <div
          key={r.id}
          className="border rounded-md p-4 flex justify-between items-start"
        >
          <div className="space-y-1 max-w-lg">
            <p className="font-medium break-words">
              {r.productIdea.length > 80
                ? `${r.productIdea.slice(0, 80)}…`
                : r.productIdea}
            </p>
            {r.createdAt && (
              <p className="text-xs text-muted-foreground">
                {format(r.createdAt.toDate(), "yyyy/MM/dd HH:mm", { locale: ja })}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(r.id)}
            title="削除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
} 