import { db } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";

const DEVICE_ID_KEY = 'app_device_id';

export const getOrCreateDeviceId = (): string => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = self.crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

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
    } catch (error) { console.warn(`Failed to fetch IP from ${url}:`, error); }
  }
  console.error("All IP services failed.");
  return null;
};

// --- START: 受信任裝置模型的核心邏輯 ---

// 註冊時，新增 trustedDevices 欄位
export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (!username.trim()) return { success: false, message: '使用者名稱不能為空。' };

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }
  
  await setDoc(userRef, {
      password,
      loggedInDeviceId: null,
      activeSessionId: null,
      loggedInIp: null,
      trustedDevices: [], // 修改：儲存使用者信任的裝置(瀏覽器)列表
      verificationCode: null,
      verificationCodeExpires: null,
      createdAt: serverTimestamp()
  });
  
  return { success: true, message: '註冊成功！您現在可以登入。' };
};

export type LoginResult = {
    success: boolean;
    message: string;
    sessionId?: string;
    verificationRequired?: boolean;
};

// 登入邏輯重構
export const loginUser = async (username: string, password: string, deviceId: string): Promise<LoginResult> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return { success: false, message: '無效的使用者名稱或密碼。' };
  
  const userAccount = userSnap.data();

  if (userAccount.password !== password) return { success: false, message: '無效的使用者名稱或密碼。' };
  
  // 單一登入限制維持不變
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。` };
      } else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。' };
      }
  }

  const currentUserIp = await getUserIP();
  if (!currentUserIp) return { success: false, message: "無法取得您的 IP 位址，登入失敗。" };

  // 檢查 DeviceId 是否在信任清單中
  const isKnownDevice = userAccount.trustedDevices?.some((device: any) => device.deviceId === deviceId);

  if (isKnownDevice || userAccount.trustedDevices?.length === 0) {
    // 如果是已知裝置，或使用者是第一次登入，直接完成登入
    const newSessionId = self.crypto.randomUUID();
    const newDeviceEntry = { deviceId, ip: currentUserIp, addedAt: serverTimestamp() };

    await updateDoc(userRef, {
        loggedInDeviceId: deviceId,
        activeSessionId: newSessionId,
        loggedInIp: currentUserIp,
        lastLogin: serverTimestamp(),
        // 如果是第一次登入，將目前裝置加入信任清單
        trustedDevices: userAccount.trustedDevices?.length === 0 ? arrayUnion(newDeviceEntry) : userAccount.trustedDevices,
    });
    return { success: true, message: '登入成功！', sessionId: newSessionId };
  } else {
    // 如果是新裝置，產生驗證碼
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);

    await updateDoc(userRef, {
        verificationCode,
        verificationCodeExpires: expires,
        pendingDeviceId: deviceId, // 暫存待驗證的 DeviceId
        loggedInIp: currentUserIp,
    });

    console.log(`Verification code for ${username}: ${verificationCode}`);
    return { success: false, message: '偵測到新裝置登入，需要驗證。', verificationRequired: true };
  }
};

// 驗證新裝置
export const verifyNewDevice = async (username: string, code: string): Promise<{ success: boolean, message: string, sessionId?: string }> => {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return { success: false, message: "找不到使用者。" };
    
    const userAccount = userSnap.data();

    if (userAccount.verificationCode !== code) return { success: false, message: "驗證碼錯誤。" };
    
    if (!userAccount.verificationCodeExpires || new Date() > userAccount.verificationCodeExpires.toDate()) {
        return { success: false, message: "驗證碼已過期。" };
    }

    // 驗證成功，完成登入流程
    const newSessionId = self.crypto.randomUUID();
    const newDeviceEntry = { 
        deviceId: userAccount.pendingDeviceId, 
        ip: userAccount.loggedInIp, 
        addedAt: serverTimestamp() 
    };

    await updateDoc(userRef, {
        loggedInDeviceId: userAccount.pendingDeviceId,
        activeSessionId: newSessionId,
        lastLogin: serverTimestamp(),
        trustedDevices: arrayUnion(newDeviceEntry), // 將新裝置加入信任清單
        verificationCode: null,
        verificationCodeExpires: null,
        pendingDeviceId: null,
    });

    return { success: true, message: "新裝置驗證成功！", sessionId: newSessionId };
};


export const logoutUser = async (username: string): Promise<void> => {
  if (!username) return;
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
  
  return userAccount.loggedInDeviceId === deviceId && userAccount.activeSessionId === sessionId;
};
