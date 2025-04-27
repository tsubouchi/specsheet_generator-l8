"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut, LogIn } from 'lucide-react'; // アイコンをインポート

export function Header() {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // ログアウト後の処理は特に不要 (useAuthStateが検知)
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          {/* <Icons.logo className="h-6 w-6" /> */}
          <span className="font-bold sm:inline-block">
            AI仕様書ジェネレーター
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-1">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted"></div> // ローディング表示
            ) : user ? (
              <>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
                  <AvatarFallback>{user.displayName?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline-block px-2">{user.displayName || "ユーザー"}</span>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="ログアウト">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button asChild variant="ghost" size="sm">
                 <Link href="/login">
                   <LogIn className="mr-1 h-4 w-4" />
                   ログイン
                 </Link>
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
} 