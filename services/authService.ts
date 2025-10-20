import { db } from './firebaseConfig';
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

// ▼▼▼ START: 新增 IP 檢查輔助函式 ▼▼▼
/**
 * 檢查 IP 是否可疑。
 * 根據您的規則，我們假設 "140.130." 開頭的是受信任的。
 * @param currentIp - 當前使用者的 IP
 * @returns boolean - 如果 IP 可疑則為 true
 */
const isIpSuspicious = (currentIp: string | null): boolean => {
  if (!currentIp) {
    // 如果無法獲取 IP，為安全起見，可以選擇視為可疑，
    // 但為了使用者體驗，這裡我們暫時放行。
    return false;
  }
  
  // 您的信任 IP 前綴
  const SAFE_PREFIX = "140.130.";
  
  // 如果 IP 不是以此前綴開頭，則視為可疑
  return !currentIp.startsWith(SAFE_PREFIX);
};
// ▲▲▲ END: 新增 IP 檢查輔助函式 ▲▲▲


// --- 使用 Firestore 的核心邏輯 ---

export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!username.trim()) {
    return { success: false, message: '使用者名稱不能為空。' };
  }

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }

  // ▼▼▼ START: 取得並儲存註冊 IP ▼▼▼
  const registrationIp = await getUserIP();
  
  await setDoc(userRef, {
      password, // 實務上密碼應該要加密
      loggedInDeviceId: null,
      activeSessionId: null,
      loggedInIp: null,
      registrationIp: registrationIp, // 儲存註冊時的 IP
      createdAt: serverTimestamp()
  });
  // ▲▲▲ END: 取得並儲存註冊 IP ▲▲▲
  
  return { success: true, message: '註冊成功！您現在可以登入。' };
};

// ▼▼▼ START: 修改 loginUser 函式以包含 IP 檢查 ▼▼▼
export const loginUser = async (
  username: string, 
  password: string, 
  deviceId: string,
  forceLogin: boolean = false // 新增參數，用於強制登入
): Promise<{ 
  success: boolean; 
  message: string; 
  sessionId?: string; 
  needsVerification?: boolean; // 新增回傳狀態
}> => {
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

  // --- IP 檢查邏輯 ---
  const currentUserIp = await getUserIP();
  const isSuspicious = isIpSuspicious(currentUserIp);

  if (isSuspicious && !forceLogin) {
    // IP 可疑且非強制登入
    const regIpInfo = userAccount.registrationIp ? `(您註冊時的 IP 為: ${userAccount.registrationIp})` : '';
    return {
      success: false,
      message: `偵測到從一個不熟悉的 IP (${currentUserIp}) 登入。此 IP 不在信任的 "140.130.x.x" 範圍內。${regIpInfo} 如果您認得此活動，請再次點擊登入以確認。`,
      needsVerification: true
    };
  }
  // --- IP 檢查結束 ---

  
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
      }
  }

  // IP 檢查通過 (或被強制) 且無其他裝置登入，才更新 session
  const newSessionId = self.crypto.randomUUID();
  
  await updateDoc(userRef, {
      loggedInDeviceId: deviceId,
      activeSessionId: newSessionId,
      loggedInIp: currentUserIp, // 儲存當前登入的 IP
      lastLogin: serverTimestamp()
  });

  return { success: true, message: '登入成功！', sessionId: newSessionId };
};
// ▲▲▲ END: 修改 loginUser 函式 ▲▲▲

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

  // ▼▼▼ START: 修改 Session 驗證以包含 IP 信任檢查 ▼▼▼
  // 檢查當前的 IP 是否仍在信任範圍內
  const isSuspicious = isIpSuspicious(currentUserIp);
  if (isSuspicious) {
    console.warn("Session IP is from a suspicious range. Logging out.");
    await logoutUser(username);
    return false;
  }
  // ▲▲▲ END: 修改 Session 驗證 ▲▲▲

  // 原始的 IP 變動檢查 (保持)
  if (userAccount.loggedInIp && currentUserIp && userAccount.loggedInIp !== currentUserIp) {
      console.warn("Session IP mismatch. Logging out.");
      await logoutUser(username);
      return false;
  }

  return true;
};
