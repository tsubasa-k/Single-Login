import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// ▼▼▼ START: 匯入 getAuth ▼▼▼
import { getAuth } from "firebase/auth";
// ▲▲▲ END: 匯入 getAuth ▲▲▲

// 從 Vite 的環境變數中讀取設定
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 取得 Firestore 實例
export const db = getFirestore(app);

// ▼▼▼ START: 匯出 Auth 實例 ▼▼▼
export const auth = getAuth(app);
// ▲▲▲ END: 匯出 Auth 實例 ▼▲▲
