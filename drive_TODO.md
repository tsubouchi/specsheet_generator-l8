# Google Drive 連携 TODO (Drive API + Cloud Run + Firebase Auth)

> 最終的な実装仕様は `gcp_design.md` セクション 5 と完全に一致させること。
> 本 TODO は **手順書** としてそのままコピー＆ペーストで作業が完了する粒度を目指す。

---
## 0. 変数定義（.env / シェル共通）
| 変数 | 例 | 用途 |
|------|----|------|
| `PROJECT_ID` | `specsheet-generator` | GCP プロジェクト ID |
| `PROJECT_NUM`| `503166429433`        | GCP プロジェクト番号 |
| `REGION`     | `asia-northeast1`     | Cloud Run / Artifact Registry リージョン |
| `RUN_SA`     | `specsheet-run-sa@$PROJECT_ID.iam.gserviceaccount.com` | Cloud Run 実行 SA |
| `OAUTH_CLIENT_ID_WEB` | `1234-abc.apps.googleusercontent.com` | Web クライアント ID (本番) |
| `OAUTH_CLIENT_ID_LOCAL` | `1234-def.apps.googleusercontent.com` | ローカル開発用 ID |
| `DRIVE_FOLDER_NAME` | `Specsheet Generator` | Drive 内保存フォルダ名 |
| `DRIVE_SCOPE` | `https://www.googleapis.com/auth/drive.file` | 必須スコープ定数 |
| `DRIVE_PUBLIC` | `true` または `false` | アップロード後に anyone 共有権限を付与するか |

---
## 1. 必要 API の有効化 ✅
```bash
gcloud services enable drive.googleapis.com --project=$PROJECT_ID
```

---
## 2. OAuth 同意画面設定 ✅
1. **Google Cloud Console → API とサービス → OAuth 同意画面**。
2. ユーザータイプ **外部 (External)** で作成。
3. アプリ情報 & サポートメール入力。
4. **スコープを追加**
   | ✅ | スコープ | 説明 |
   |---|---------|----|
   | ✔ | `${DRIVE_SCOPE}` | アプリが作成した Drive ファイルのみアクセス |
   | ✔ | `.../auth/userinfo.email` | Firebase Auth と統合 |
   | ✔ | `.../auth/userinfo.profile` | プロフィール |
5. **テストユーザー** に開発者メールを追加。
6. 検証が完了次第、公開ステータスを **本番** に切り替え。

---
## 3. OAuth 2.0 クライアント作成 ✅
### 3-1. 本番 (Web)
承認元: `https://<PROD_DOMAIN>`
リダイレクト URI: `https://<PROD_DOMAIN>/auth/callback`
→ 発行された **クライアント ID** を `.env.production` の `NEXT_PUBLIC_GIS_CLIENT_ID` に設定。

### 3-2. ローカル (Optional)
承認元: `http://localhost:3000`
リダイレクト URI: `http://localhost:3000/auth/callback`
→ `.env.local` に `NEXT_PUBLIC_GIS_CLIENT_ID` を設定。

---
## 4. フロントエンド実装 TODO
| ファイル | 作業 |
|----------|------|
| `hooks/useAuth.ts` | `provider.addScope(DRIVE_SCOPE)` を追加し、アクセストークンを取得して Context に保持 |
| `lib/googleIdentity.ts` | GIS ワンタイムトークン → アクセストークンのラッパーを実装 |
| `components/SaveButton.tsx` | 公開リンクトグル(checkbox) + 生成リンク表示＆コピー機能を実装 |

### 4-1. SaveButton コード例
```tsx
export const SaveButton = ({ markdown }: { markdown: string }) => {
  const { accessToken, idToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const handleClick = async () => {
    if (!accessToken) return alert('Google Drive 認可が必要です');
    setSaving(true);
    const res = await fetch('/api/drive-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ markdown, driveAccessToken: accessToken }),
    });
    const json = await res.json();
    alert(`Drive に保存しました: ${json.webViewLink}`);
    setSaving(false);
  };
  return <button onClick={handleClick} disabled={saving}>Drive 保存</button>;
};
```

---
## 5. バックエンド (Cloud Run) TODO
| ファイル | 作業 |
|----------|------|
| `app/api/drive-upload/route.ts` | 下記サンプルをベースに実装 |

### 5-1. route.ts 雛形
```ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from '@/lib/firestore';

export async function POST(req: NextRequest) {
  const { markdown, fileName, driveAccessToken } = await req.json();
  const idToken = req.headers.get('authorization')?.split(' ')[1];
  if (!idToken) return NextResponse.json({ error: 'no token' }, { status: 401 });
  const decoded = await getAuth().verifyIdToken(idToken);

  // Drive クライアント
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: driveAccessToken });
  const drive = google.drive({ version: 'v3', auth: oauth2 });

  // フォルダ確認 / 作成
  const folderId = await ensureFolder(drive);
  const media = {
    mimeType: 'text/markdown',
    body: markdown,
  };
  const res = await drive.files.create({
    requestBody: {
      name: fileName ?? `specsheet_${Date.now()}.md`,
      parents: [folderId],
      mimeType: 'text/markdown',
    },
    media,
    fields: 'id, webViewLink',
  });

  // (任意) Firestore へ履歴保存
  await firestore
    .collection('drive_logs')
    .doc(decoded.uid)
    .collection('items')
    .add({ fileId: res.data.id, link: res.data.webViewLink, ts: new Date() });

  return NextResponse.json(res.data);
}
```
> `ensureFolder()` は `drive.files.list` → 無ければ `drive.files.create(type:folder)` のユーティリティ。

---
## 6. セキュリティ ✅
- サーバーに Drive の **Refresh Token** は保持しない。
- Cloud Run SA に Drive 権限は付与しない。
- ログ出力時にアクセストークン・Markdown 本文はマスクする。

---
## 7. Cloud Build 変更 ✅
- `cloudbuild.yaml` に `googleapis` インストールステップを追加（既存 npm ci がある場合は省略可）。
- E2E テスト (`/api/drive-upload`) を追加して PR 時に検証。

---
## 8. 手動テスト手順 🧪
```bash
# 1) Google サインイン → Console で access_token & id_token を取得
TOKEN="ya29..."        # access_token (Drive)
ID="eyJhbGci..."       # Firebase ID Token

# 2) cURL
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID" \
  -d '{"markdown":"# Spec","driveAccessToken":"'$TOKEN'"}' \
  https://specsheet-generator-xxxx.run.app/api/drive-upload
```

---
## 9. マイルストーン & 進捗
| # | タスク | Owner | Due | Status |
|---|--------|-------|-----|--------|
| 1 | Drive API enable | ops | | ✅ |
| 2 | OAuth screen publish | ops | | ⏳ |
| 3 | GIS client IDs env | ops | | ⏳ |
| 4 | Front token flow | fe | | ✅ |
| 5 | /api/drive-upload | be | | ✅ |
| 6 | Firestore log | be | | ✅ |
| 7 | Cloud Build step | ops | | ✅ |
| 8 | E2E tests | qa | | ✅ |
| 9 | Public share toggle | fe/be | | ✅ |

---
## 10. 参考
- Drive API Quickstart: https://developers.google.com/drive/api/quickstart/nodejs
- Google Identity Services: https://developers.google.com/identity/oauth2/web/guides/overview
- Firebase Auth: https://firebase.google.com/docs/auth/web/google-signin#expand-scope 