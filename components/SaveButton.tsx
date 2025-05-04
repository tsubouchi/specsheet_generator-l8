"use client";

import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { Copy } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface SaveButtonProps {
  markdown: string;
  defaultPublic?: boolean;
}

export function SaveButton({ markdown, defaultPublic = false }: SaveButtonProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [publicShare, setPublicShare] = useState(defaultPublic);
  const [link, setLink] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      setSaving(true);
      // get tokens via popup
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken as string;
      const idToken = await result.user.getIdToken();
      if (!accessToken) throw new Error('アクセストークン取得失敗');

      const res = await fetch('/api/drive-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ markdown, driveAccessToken: accessToken, public: publicShare }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'アップロード失敗');
      setLink(data.webViewLink);
      toast({ title: '保存完了', description: 'Google Drive に保存しました。' });
    } catch (e: any) {
      toast({ title: 'エラー', description: e.message ?? 'エラー' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button onClick={handleClick} disabled={saving || !markdown} variant="secondary">
          {saving ? '保存中…' : 'Google Drive に保存'}
        </Button>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={publicShare} onChange={e=>setPublicShare(e.target.checked)} /> 公開リンク
        </label>
      </div>
      {link && (
        <div className="flex items-center gap-1 text-xs break-all">
          <a href={link} target="_blank" rel="noopener" className="text-blue-600 underline">
            {link}
          </a>
          <button onClick={()=>{navigator.clipboard.writeText(link); toast({title:'コピーしました'});}}><Copy className="h-3 w-3"/></button>
        </div>
      )}
    </div>
  );
} 