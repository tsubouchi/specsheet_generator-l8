"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Loader2, Download, Copy, Check, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// 製品タイプの選択肢
const productTypes = [
  { value: "webApp", label: "Webアプリ" },
  { value: "aiAgent", label: "AIエージェント" },
  { value: "other", label: "その他" },
]

// デプロイ環境の選択肢
const deployEnvironments = [
  { value: "vercel", label: "Vercel" },
  { value: "gcp", label: "GCP" },
  { value: "azure", label: "Azure" },
  { value: "aws", label: "AWS" },
]

// 言語の選択肢を追加
const programmingLanguages = [
  { value: "typescript", label: "TypeScript" },
  { value: "nodejs", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
]

export function SpecificationGenerator() {
  const [productIdea, setProductIdea] = useState("")
  const [productType, setProductType] = useState("webApp")
  const [deployEnvironment, setDeployEnvironment] = useState("vercel")
  const [programmingLanguage, setProgrammingLanguage] = useState("typescript")
  const [specification, setSpecification] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState("input")
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!productIdea.trim()) {
      toast({
        title: "入力が必要です",
        description: "製品アイデアまたは要件を入力してください",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setSpecification("")
    setError(null)
    setActiveTab("result")

    try {
      // 選択した製品タイプとデプロイ環境を含めてAPIに送信
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productIdea: `製品アイデア: ${productIdea}\n製品タイプ: ${productTypes.find((t) => t.value === productType)?.label}\nデプロイ環境: ${deployEnvironments.find((e) => e.value === deployEnvironment)?.label}\n使用言語: ${programmingLanguages.find((l) => l.value === programmingLanguage)?.label}`,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API応答エラー:", response.status, errorText)
        throw new Error(errorText || `API エラー: ${response.status}`)
      }

      let text = await response.text()

      // Markdownのコードブロックマーカーを削除
      text = text.replace(/^```markdown\s*\n/, "").replace(/\n```\s*$/, "")

      setSpecification(text)
    } catch (error) {
      console.error("仕様書生成エラー:", error)
      setError(error.message || "仕様書の生成中にエラーが発生しました")
      toast({
        title: "生成失敗",
        description: error.message || "仕様書の生成中にエラーが発生しました",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(specification)
      setIsCopied(true)
      toast({
        title: "クリップボードにコピーしました",
        description: "仕様書がクリップボードにコピーされました",
      })
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      toast({
        title: "コピー失敗",
        description: "クリップボードへのコピーに失敗しました",
        variant: "destructive",
      })
    }
  }

  const handleDownload = () => {
    const blob = new Blob([specification], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "basic_design.md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleRetry = () => {
    setError(null)
    handleGenerate()
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="input">入力</TabsTrigger>
            <TabsTrigger value="result" disabled={!specification && !isGenerating && !error}>
              結果
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-6">
            <div>
              <label htmlFor="product-idea" className="block text-sm font-medium mb-2">
                製品アイデアまたは要件を入力してください
              </label>
              <Textarea
                id="product-idea"
                placeholder="製品アイデア、要件、または機能を詳細に記述してください..."
                className="min-h-[200px]"
                value={productIdea}
                onChange={(e) => setProductIdea(e.target.value)}
              />
            </div>

            {/* 製品タイプの選択 */}
            <div>
              <h3 className="text-sm font-medium mb-3">作成する製品：</h3>
              <RadioGroup value={productType} onValueChange={setProductType} className="flex flex-wrap gap-4">
                {productTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.value} id={`product-type-${type.value}`} />
                    <Label htmlFor={`product-type-${type.value}`}>{type.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* デプロイ環境の選択 */}
            <div>
              <h3 className="text-sm font-medium mb-3">Deployする環境：</h3>
              <RadioGroup
                value={deployEnvironment}
                onValueChange={setDeployEnvironment}
                className="flex flex-wrap gap-4"
              >
                {deployEnvironments.map((env) => (
                  <div key={env.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={env.value} id={`deploy-env-${env.value}`} />
                    <Label htmlFor={`deploy-env-${env.value}`}>{env.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 言語の選択を追加 */}
            <div>
              <h3 className="text-sm font-medium mb-3">使用する言語：</h3>
              <RadioGroup
                value={programmingLanguage}
                onValueChange={setProgrammingLanguage}
                className="flex flex-wrap gap-4"
              >
                {programmingLanguages.map((lang) => (
                  <div key={lang.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={lang.value} id={`lang-${lang.value}`} />
                    <Label htmlFor={`lang-${lang.value}`}>{lang.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Button onClick={handleGenerate} disabled={isGenerating || !productIdea.trim()} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                "仕様書を生成"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="result" className="space-y-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>包括的な仕様書を生成中...</p>
                <p className="text-sm text-gray-500 mt-2">1〜2分かかる場合があります</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500 font-bold mb-2">エラーが発生しました</p>
                <p className="text-sm text-red-400 mb-4">{error}</p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("input")}>
                    入力に戻る
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRetry} className="flex items-center">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    再試行
                  </Button>
                </div>
              </div>
            ) : specification ? (
              <>
                <div className="flex justify-end space-x-2 mb-4">
                  <Button variant="outline" size="sm" onClick={handleCopyToClipboard} className="flex items-center">
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        コピー済み
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        コピー
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    ダウンロード
                  </Button>
                </div>

                <div className="border rounded-md p-4 bg-white overflow-auto max-h-[600px] w-full">
                  <pre className="whitespace-pre-wrap font-mono text-sm">{specification}</pre>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">まだ仕様書が生成されていません</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
