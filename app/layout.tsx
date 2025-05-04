import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/AuthProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "AI仕様書ジェネレーター",
  description: "製品アイデアから開発仕様書を自動生成するAIツール",
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
        {children}
        <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
