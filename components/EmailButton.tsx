import React from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface EmailButtonProps {
  specId?: string;
}

export function EmailButton({ specId }: EmailButtonProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  
  const handleClick = () => {
    if (typeof window !== 'undefined') {
      // 現在表示中の仕様書データを保存
      if (specId) {
        localStorage.setItem('emailSpecId', specId);
      }
      router.push('/email-sender');
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="flex items-center gap-1"
      disabled={!user}
    >
      <Mail className="h-4 w-4" />
      <span>メールで送信</span>
    </Button>
  );
} 