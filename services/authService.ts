import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 您的 Web 應用程式的 Firebase 設定
// 從 Firebase 主控台複製貼上您的設定
const firebaseConfig = {
  apiKey: "AIzaSy...", // 替換成您的金鑰
  authDomain: "your-project-id.firebaseapp.com", // 替換成您的設定
  projectId: "your-project-id", // 替換成您的設定
  storageBucket: "your-project-id.appspot.com", // 替換成您的設定
  messagingSenderId: "...", // 替換成您的設定
  appId: "..." // 替換成您的設定
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Firestore 並匯出，以便在其他地方使用
export const db = getFirestore(app);
