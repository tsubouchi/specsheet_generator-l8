"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { Skeleton } from "@/components/ui/skeleton";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 認証状態の読み込みが完了し、かつユーザーがログインしていない場合
    if (!loading && !user) {
      router.push('/login'); // ログインページへリダイレクト
    }
  }, [user, loading, router]);

  // 認証状態の読み込み中、またはリダイレクトが必要な状態
  if (loading || !user) {
    // ヘッダーは表示しつつ、メインコンテンツ部分にローディングスケルトンを表示
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container mx-auto py-8 px-4">
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-32 w-full" />
          </div>
        </main>
      </div>
    );
  }

  // ログイン済みの場合のみ子要素（メインコンテンツ）を表示
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      {/* 必要であればフッターなどを追加 */}
    </div>
  );
} 