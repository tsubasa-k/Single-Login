import { db } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { isIpSuspicious } from './ipWhitelist'; 

const DEVICE_ID_KEY = 'app_device_id';

// getOrCreateDeviceId 函數維持不變
export const getOrCreateDeviceId = (): string => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = self.crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

// getUserIP 函數維持不變
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


// ▼▼▼ START: 修改 registerUser 函式 ▼▼▼
export const registerUser = async (username: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
// ▲▲▲ END: 修改 registerUser 函式 ▲▲▲
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!username.trim()) {
    return { success: false, message: '使用者名稱不能為空。' };
  }
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }

  const registrationIp = await getUserIP();
  
  // ▼▼▼ START: 儲存 email 欄位 ▼▼▼
  await setDoc(userRef, {
      password, // 實務上密碼應該要加密
      email: email, // 儲存 Email
      loggedInDeviceId: null,
      activeSessionId: null,
      loggedInIp: null,
      registrationIp: registrationIp, // 儲存註冊時的 IP
      createdAt: serverTimestamp()
  });
  // ▲▲▲ END: 儲存 email 欄位 ▼▲▲
  
  return { success: true, message: '註冊成功！您現在可以登入。' };
};


// loginUser 函數維持不變
// (它會繼續使用您現有的「點兩次確認」邏輯)
export const loginUser = async (
  username: string, 
  password: string, 
  deviceId: string,
  forceLogin: boolean = false
): Promise<{ 
  success: boolean; 
  message: string; 
  sessionId?: string; 
  needsVerification?: boolean; 
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

  const currentUserIp = await getUserIP();
  const isSuspicious = isIpSuspicious(currentUserIp); 

  if (isSuspicious && !forceLogin) {
    const regIpInfo = userAccount.registrationIp ? `(您註冊時的 IP 來源: ${userAccount.registrationIp})` : '';
    
    return {
      success: false,
      message: `偵測到從一個不熟悉的 IP (${currentUserIp || '未知'}) 登入。此 IP 未被辨識為臺灣學術網路 (TANet) 的一部分。${regIpInfo} 如果您認得此活動，請再次點擊登入以確認。`,
      needsVerification: true
    };
  }
  
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
      }
  }

  const newSessionId = self.crypto.randomUUID();
  
  await updateDoc(userRef, {
      loggedInDeviceId: deviceId,
      activeSessionId: newSessionId,
      loggedInIp: currentUserIp, 
      lastLogin: serverTimestamp()
  });

  return { success: true, message: '登入成功！', sessionId: newSessionId };
};

// logoutUser 函數維持不變
export const logoutUser = async (username: string): Promise<void> => {
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

// isSessionStillValid 函數維持不變
export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return false;

  const userAccount = userSnap.data();
  
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  const currentUserIp = await getUserIP();
  
  const isSuspicious = isIpSuspicious(currentUserIp);
  if (isSuspicious) {
    console.warn("Session IP is from a suspicious range (non-TANet). Logging out.");
    await logoutUser(username);
    return false;
  }

  if (userAccount.loggedInIp && currentUserIp && userAccount.loggedInIp !== currentUserIp) {
      console.warn("Session IP mismatch. Logging out.");
      await logoutUser(username);
      return false;
  }

  return true;
};
