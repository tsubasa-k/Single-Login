import { db } from './firebaseConfig'; // 確保這行存在
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const DEVICE_ID_KEY = 'app_device_id';

// 這個函數維持不變
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

// --- 使用 Firestore 的核心邏輯 ---

export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 確保 username 不是空字串
  if (!username.trim()) {
    return { success: false, message: '使用者名稱不能為空。' };
  }

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }
  
  await setDoc(userRef, {
      password, // 實務上密碼應該要加密
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
  
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
      }
  }

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
  // 確保提供了 username 才執行
  if (!username) {
    console.warn("Logout attempt without username.");
    return;
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  const userRef = doc(db, "users", username);
  
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
  
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  const currentUserIp = await getUserIP();
  if (userAccount.loggedInIp && currentUserIp && userAccount.loggedInIp !== currentUserIp) {
      console.warn("Session IP mismatch. Logging out.");
      await logoutUser(username);
      return false;
  }

  return true;
};
