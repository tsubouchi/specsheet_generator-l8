import { NextRequest, NextResponse } from 'next/server';
import { google, drive_v3 } from 'googleapis';
import { getAuth } from 'firebase-admin/auth';
import '@/lib/firebaseAdmin'; // 環境初期化副作用のみ
import { db } from '@/lib/firebaseAdmin';

// フォルダが無ければ作成し ID を返す
async function ensureFolder(drive: drive_v3.Drive, folderName: string): Promise<string> {
  // 既存フォルダ検索
  const list = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replaceAll("'", "\'")}' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;

  // フォルダ作成
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  const id = res.data.id;
  if (!id) throw new Error('Failed to create folder');
  return id;
}

export async function POST(req: NextRequest) {
  try {
    const { markdown, fileName, driveAccessToken } = await req.json();
    if (!markdown || !driveAccessToken) {
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    // Firebase 認証
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'no auth' }, { status: 401 });
    const idToken = authHeader.split(' ')[1];
    const decoded = await getAuth().verifyIdToken(idToken);

    // Drive クライアント
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: driveAccessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2 });

    const folderId = await ensureFolder(drive, process.env.DRIVE_FOLDER_NAME || 'Specsheet Generator');

    const media = {
      mimeType: 'text/markdown',
      body: markdown as string,
    };

    const upload = await drive.files.create({
      requestBody: {
        name: fileName ?? `specsheet_${Date.now()}.md`,
        parents: [folderId],
        mimeType: 'text/markdown',
      },
      media,
      fields: 'id, webViewLink',
    });

    // 公開設定（任意）
    const makePublic = process.env.DRIVE_PUBLIC === 'true';
    if (makePublic && upload.data.id) {
      await drive.permissions.create({
        fileId: upload.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
      // 共有リンクを取得 (webViewLink は自動で Anyone 可になる)
    }

    // Firestore ログ
    if (db) {
      await db.collection('drive_logs').doc(decoded.uid).collection('items').add({
        fileId: upload.data.id,
        link: upload.data.webViewLink,
        ts: new Date(),
      });
    }

    return NextResponse.json(upload.data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
} 