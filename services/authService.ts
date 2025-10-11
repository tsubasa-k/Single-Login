// services/authService.ts

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig"; // 引入我們設定好的 Firestore 實體

// 這個常數現在只用來取得 deviceId
const DEVICE_ID_KEY = 'app_device_id';

// 使用者帳號在 Firestore 中的資料結構
interface UserAccount {
  password: string; // 在真實應用中，密碼應該被雜湊(hashed)儲存
  loggedInDeviceId: string | null;
  activeSessionId: string | null;
  loggedInIp: string | null;
}

// 產生或取得儲存在本機的 deviceId
export const getOrCreateDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = self.crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

// 獲取公網 IP 的輔助函數
const getUserIP = async (): Promise<string | null> => {
  try {
    // 由於您的應用程式部署在 Cloudflare Pages 上，
    // 可以考慮使用 Cloudflare 提供的服務來取得 IP，
    // 或是使用既有的 ipify API。
    const response = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.warn(`Could not fetch IP address:`, error);
    return null;
  }
};

// 註冊使用者 (寫入新文件到 Firestore)
export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }

  const newUser: UserAccount = {
    password, // 再次提醒：真實世界需要雜湊密碼！
    loggedInDeviceId: null,
    activeSessionId: null,
    loggedInIp: null
  };

  await setDoc(userRef, newUser);
  return { success: true, message: '註冊成功！您現在可以登入。' };
};

// 登入使用者 (讀取並更新 Firestore 中的文件)
export const loginUser = async (username: string, password: string, deviceId: string): Promise<{ success: boolean; message: string; sessionId?: string; }> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }

  const userAccount = userSnap.data() as UserAccount;

  if (userAccount.password !== password) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }

  // **核心修改**
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
      return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。後登入者無法登入。` };
  }

  const currentUserIp = await getUserIP();
  const newSessionId = self.crypto.randomUUID();

  await updateDoc(userRef, {
    loggedInDeviceId: deviceId,
    activeSessionId: newSessionId,
    loggedInIp: currentUserIp
  });

  return { success: true, message: '登入成功！', sessionId: newSessionId };
};

// 登出使用者 (清除 Firestore 文件中的登入狀態)
export const logoutUser = async (username: string): Promise<void> => {
  if (!username) return;
  const userRef = doc(db, "users", username);
  await updateDoc(userRef, {
    loggedInDeviceId: null,
    activeSessionId: null,
    loggedInIp: null
  });
};

// 驗證會話是否仍然有效 (從 Firestore 讀取最新狀態)
export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  if (!username) return false;
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return false;
  }

  const userAccount = userSnap.data() as UserAccount;

  // 只要 deviceId 或 sessionId 不符，就視為無效
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
    return false;
  }

  return true;
};
