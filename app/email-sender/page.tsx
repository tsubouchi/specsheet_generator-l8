'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function EmailSenderPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [specData, setSpecData] = useState<any>(null);
  
  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window !== 'undefined') {
      // 仕様書データの取得（localStorageなどから）
      const savedSpec = localStorage.getItem('currentSpec');
      if (savedSpec) {
        try {
          const parsedSpec = JSON.parse(savedSpec);
          setSpecData(parsedSpec);
          setSubject(`仕様書: ${parsedSpec.title || '無題'}`);
          setBody(`添付ファイルに仕様書を同封します。ご確認ください。`);
        } catch (e) {
          console.error('仕様書データの解析エラー:', e);
        }
      }
    }
  }, []);
  
  const handleGmailAuth = async () => {
    try {
      // Google認証プロバイダを設定
      const provider = new GoogleAuthProvider();
      // Gmail送信のスコープを追加
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      
      // Googleでサインイン
      await signInWithPopup(auth, provider);
      
      toast({
        title: '認証成功',
        description: 'Gmailと連携しました',
      });
    } catch (error: any) {
      console.error('Gmail認証エラー:', error);
      toast({
        title: 'エラー',
        description: 'Gmail認証に失敗しました',
        variant: 'destructive',
      });
    }
  };
  
  const handleSendEmail = async () => {
    if (!to || !subject || !body) {
      toast({
        title: '入力エラー',
        description: '宛先、件名、本文は必須です',
        variant: 'destructive',
      });
      return;
    }
    
    if (!user) {
      toast({
        title: '認証エラー',
        description: 'ログインが必要です',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSending(true);
    
    try {
      // IDトークンを取得
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/gmail-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          to,
          subject,
          emailBody: body,
          attachmentContent: specData?.markdown || specData?.content,
          attachmentName: `${specData?.title || 'spec'}.pdf`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: '送信完了',
          description: 'メールが正常に送信されました',
        });
      } else if (data.requireReauth) {
        toast({
          title: '再認証が必要です',
          description: 'Gmailの認証が切れました。再度認証してください',
          variant: 'destructive',
        });
        handleGmailAuth();
      } else {
        throw new Error(data.error || '送信に失敗しました');
      }
    } catch (error: any) {
      console.error('メール送信エラー:', error);
      toast({
        title: 'エラー',
        description: error.message || 'メールの送信に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };
  
  if (loading) return <div>読み込み中...</div>;
  
  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">ログインが必要です</h1>
        <p>この機能を利用するには、ログインしてください。</p>
      </div>
    );
  }
  
  const isGoogleProvider = user.providerData.some(
    provider => provider.providerId === 'google.com'
  );
  
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">仕様書をメールで送信</h1>
      
      {!isGoogleProvider ? (
        <div className="mb-6 p-4 border rounded-md bg-yellow-50">
          <h2 className="font-semibold mb-2">Google認証が必要です</h2>
          <p className="mb-4">仕様書を送信するには、Googleアカウントでのログインが必要です。</p>
          <Button onClick={handleGmailAuth}>
            Googleアカウントで認証する
          </Button>
        </div>
      ) : (
        <form className="space-y-4">
          <div>
            <label className="block mb-1">宛先</label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="送信先のメールアドレス"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1">件名</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="メールの件名"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1">本文</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="メールの本文"
              rows={6}
              required
            />
          </div>
          
          <div>
            <label className="block mb-1">添付ファイル</label>
            <div className="p-3 border rounded-md bg-gray-50">
              {specData?.title || '無題'}.pdf
            </div>
            <p className="text-sm text-gray-500 mt-1">
              現在表示中の仕様書が添付されます
            </p>
          </div>
          
          <Button
            type="button"
            onClick={handleSendEmail}
            disabled={isSending}
            className="w-full"
          >
            {isSending ? '送信中...' : 'メールを送信'}
          </Button>
        </form>
      )}
    </div>
  );
} 