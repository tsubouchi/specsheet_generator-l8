"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";

export function Header() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // ログアウト後の処理は特に不要 (useAuthStateが検知)
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  return (
    <header className="w-full flex items-center justify-between px-4 py-2 border-b border-black bg-white sticky top-0 z-30">
      <h1 className="font-bold text-black">AI仕様書ジェネレーター</h1>
      {user && (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-black">
            {user.photoURL ? (
              <AvatarImage src={user.photoURL} alt="avatar" />
            ) : (
              <AvatarFallback className="bg-black text-white text-xs">
                {(user.displayName ?? user.email ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="text-sm text-black">{user.displayName ?? user.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1 border-black text-black hover:bg-black hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </Button>
        </div>
      )}
    </header>
  );
} 