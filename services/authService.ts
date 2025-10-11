import { db } from './firebaseConfig'; // 引入我們剛才建立的設定
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const DEVICE_ID_KEY = 'app_device_id';

// 這個函數維持不變，因為 deviceId 確實是跟著裝置走的
export const getOrCreateDeviceId = (): string => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = self.crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

// IP 擷取功能維持不變
const getUserIP = async (): Promise<string | null> => {
  const ipServices = [
    'https://api.ipify.org?format=json',
    'https://jsonip.com',
  ];

  for (const url of ipServices) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      if (data.ip) return data.ip;
    } catch (error) {
      console.warn(`Failed to fetch IP from ${url}:`, error);
    }
  }
  
  console.error("All IP services failed. IP validation will be skipped.");
  return null;
};

// --- START: 使用 Firestore 的核心邏輯 ---

export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }
  
  // 在 Firestore 中建立新使用者文件
  // 實務上密碼應該要加密，這裡為了簡單起見直接儲存
  await setDoc(userRef, {
      password,
      loggedInDeviceId: null,
      activeSessionId: null,
      loggedInIp: null,
      createdAt: serverTimestamp()
  });
  
  return { success: true, message: '註冊成功！您現在可以登入。' };
};

export const loginUser = async (username: string, password: string, deviceId: string): Promise<{ success: boolean; message: string; sessionId?: string; }> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }
  
  const userAccount = userSnap.data();

  if (userAccount.password !== password) {
      return { success: false, message: '無效的使用者名稱或密碼。' };
  }
  
  // 檢查是否已有活躍的會話 (從 Firestore 檢查)
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
      }
  }

  // 允許登入，更新 Firestore 中的文件
  const currentUserIp = await getUserIP();
  const newSessionId = self.crypto.randomUUID();
  
  await updateDoc(userRef, {
      loggedInDeviceId: deviceId,
      activeSessionId: newSessionId,
      loggedInIp: currentUserIp,
      lastLogin: serverTimestamp()
  });

  return { success: true, message: '登入成功！', sessionId: newSessionId };
};

export const logoutUser = async (username: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const userRef = doc(db, "users", username);
  
  // 登出時，清除 Firestore 中的登入資訊
  await updateDoc(userRef, {
    loggedInDeviceId: null,
    activeSessionId: null,
    loggedInIp: null
  }).catch(err => console.error("Error during logout:", err));
};

export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return false;

  const userAccount = userSnap.data();
  
  // 基本驗證
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  // IP 驗證 (邏輯不變)
  const currentUserIp = await getUserIP();
  if (userAccount.loggedInIp && currentUserIp && userAccount.loggedInIp !== currentUserIp) {
      console.warn("Session IP mismatch. Logging out.");
      // 當 IP 不匹配時，強制讓遠端的使用者登出
      await logoutUser(username);
      return false;
  }

  return true;
};

// --- END: 使用 Firestore 的核心邏輯 ---
