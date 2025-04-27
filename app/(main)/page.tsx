import { SpecificationGenerator } from "@/components/specification-generator"

export default function MainPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      {/* <h1 className="text-2xl font-bold mb-6 text-center">AI仕様書ジェネレーター</h1> */}
      {/* <p className="text-center mb-8 text-gray-600">製品アイデアを入力して、AIが開発仕様書を自動生成します</p> */}
      <SpecificationGenerator />
    </div>
  )
} 