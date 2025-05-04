import { SpecificationGenerator } from "@/components/specification-generator"
import { HistoryList } from "@/components/history-list"

export default function MainPage() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-12">
      {/* <h1 className="text-2xl font-bold mb-6 text-center">AI仕様書ジェネレーター</h1> */}
      {/* <p className="text-center mb-8 text-gray-600">製品アイデアを入力して、AIが開発仕様書を自動生成します</p> */}
      <SpecificationGenerator />
      <div>
        <h2 className="text-lg font-bold mb-4">生成履歴</h2>
        <HistoryList />
      </div>
    </div>
  )
} 