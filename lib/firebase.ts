import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // 必要に応じて追加
// import { getStorage } from "firebase/storage"; // 必要に応じて追加

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Firebase Appの初期化（既に初期化されている場合は既存のAppを使用）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebaseサービスの取得
const auth = getAuth(app);
// const db = getFirestore(app); // 必要に応じて追加
// const storage = getStorage(app); // 必要に応じて追加

// Google認証プロバイダー
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider /*, db, storage */ }; // 必要に応じてエクスポートするサービスを追加 