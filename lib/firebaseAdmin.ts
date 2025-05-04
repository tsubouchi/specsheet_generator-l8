import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Workload Identity を使用する場合、明示的な serviceAccount キーは不要。
 * GCP 実行環境では Application Default Credentials が使われる。
 */
export function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]

  // ローカル開発で GOOGLE_APPLICATION_CREDENTIALS を利用する場合は自動読み込み
  // Cloud Run では ADC (Workload Identity) で認証される
  return initializeApp()
}

export const db = getFirestore(getAdminApp()) 