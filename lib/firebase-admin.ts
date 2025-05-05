import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import * as fs from 'fs';

if (!getApps().length) {
  try {
    let credentialJson: admin.ServiceAccount | undefined;

    // 1. Cloud Run: Secret Managerでマウントされたパス(FIREBASE_ADMIN_KEY)がある場合
    const keyEnv = process.env.FIREBASE_ADMIN_KEY;
    if (keyEnv) {
      // JSON形式そのものか、ファイルパスかを判定
      if (keyEnv.trim().startsWith('{')) {
        try {
          credentialJson = JSON.parse(keyEnv);
        } catch (_) {
          // パース失敗→ファイルパスとして扱う
        }
      }
      if (!credentialJson && fs.existsSync(keyEnv)) {
        credentialJson = JSON.parse(fs.readFileSync(keyEnv, 'utf8'));
      }
    }

    // 2. 環境変数セット型 (個々に与えられたキー)
    if (!credentialJson && process.env.FIREBASE_PRIVATE_KEY) {
      credentialJson = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      } as admin.ServiceAccount;
    }

    if (!credentialJson) {
      console.warn('Firebase Admin credential が取得できません。ビルド環境または開発フェーズの可能性があるため、Firebase Admin を初期化しません。');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(credentialJson),
        projectId: credentialJson.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'specsheet-generator',
      });
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export default admin; 