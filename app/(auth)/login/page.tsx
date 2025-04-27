"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignInWithGoogle } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from "lucide-react";

// ローディング表示コンポーネント
const LoadingOverlay = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center min-h-screen py-2">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
    <p className="text-muted-foreground">{message}</p>
  </div>
);

export default function LoginPage() {
  const [signInWithGoogle, , loading, error] = useSignInWithGoogle(auth);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 既にログイン済みであればメインページへリダイレクト
    if (!authLoading && user) {
      router.push('/'); // メインページのパス
    }
  }, [user, authLoading, router]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // ログイン成功後のリダイレクトはuseEffectでハンドルされる
    } catch (e) {
      console.error("Googleログインエラー:", e);
      // エラーメッセージをユーザーに表示するなどの処理
    }
  };

  // 認証状態の読み込み中またはログイン処理中
  if (authLoading || loading) {
    return <LoadingOverlay message="読み込み中..." />;
  }

  // ログイン済みの場合のリダイレクト待ち（ちらつき防止）
  if (user) {
    return <LoadingOverlay message="リダイレクト中..." />;
  }

  // ログインフォーム
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-3xl font-bold mb-6">ログイン</h1>
      <p className="mb-4">Googleアカウントでログインしてください。</p>
      <Button onClick={handleLogin} disabled={loading}>
        {loading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 処理中</>
        ) : (
          'Googleアカウントでログイン'
        )}
      </Button>
      {error && <p className="text-red-500 mt-4">エラー: {error.message}</p>}
    </div>
  );
} 