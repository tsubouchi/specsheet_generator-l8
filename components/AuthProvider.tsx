"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // './lib/firebase' からインポート
import { useAuthState } from 'react-firebase-hooks/auth';

interface AuthContextType {
  user: User | null | undefined;
  loading: boolean;
  error: Error | undefined;
}

const AuthContext = createContext<AuthContextType>({ 
  user: undefined,
  loading: true,
  error: undefined,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, loading, error] = useAuthState(auth);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    // useAuthState の初期ロード状態をハンドリング
    if (!loading) {
      setInitialLoading(false);
    }
  }, [loading]);

  // 初期ロード中は何も表示しないか、ローディング表示を出す
  if (initialLoading) {
    // ここでローディングスピナーなどを表示することも可能
    return null; // または <LoadingSpinner /> など
  }

  return (
    <AuthContext.Provider value={{ user, loading: initialLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 