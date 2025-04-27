import { SpecificationGenerator } from "@/components/specification-generator"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 lg:p-24">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-6 text-center">AI仕様書ジェネレーター</h1>
        <p className="text-center mb-8 text-gray-600">製品アイデアを入力して、AIが開発仕様書を自動生成します</p>
        <SpecificationGenerator />
      </div>
    </main>
  )
}
