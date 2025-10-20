import { db, auth } from './firebaseConfig'; // 
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { isIpSuspicious } from './ipWhitelist'; 
// 
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

const DEVICE_ID_KEY = 'app_device_id';

// getOrCreateDeviceId 
export const getOrCreateDeviceId = (): string => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = self.crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

// getUserIP 
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


// registerUser 
export const registerUser = async (username: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!username.trim()) {
    return { success: false, message: '使用者名稱不能為空。' };
  }
  
  // 1. 
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }

  // 2. 
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 3. 
    await sendEmailVerification(user);

    // 4. 
    const registrationIp = await getUserIP();
    await setDoc(userRef, {
        email: email, // 
        uid: user.uid, // 
        loggedInDeviceId: null,
        activeSessionId: null,
        loggedInIp: null,
        registrationIp: registrationIp,
        createdAt: serverTimestamp()
        // 
    });
    
    return { success: true, message: '註冊成功！請檢查您的 Email 信箱以完成驗證。' };

  } catch (error: any) {
    // 
    if (error.code === 'auth/email-already-in-use') {
      return { success: false, message: '此 Email 已被註冊。' };
    }
    if (error.code === 'auth/weak-password') {
      return { success: false, message: '密碼強度不足，請至少設定 6 個字元。' };
    }
    console.error("Firebase Auth Error:", error);
    return { success: false, message: '註冊時發生錯誤。' };
  }
};


// loginUser (
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
  emailNotVerified?: boolean; 
}> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  // 1. 
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }
  
  const userAccount = userSnap.data();
  const email = userAccount.email; // 

  if (!email) {
      return { success: false, message: '帳號資料不完整，缺少 Email 無法登入。' };
  }

  // 2. 
  let user;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
  } catch (error: any) {
    // 
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }

  // 3. 
  if (!user.emailVerified) {
    // ▼▼▼ START: 新增自動重寄驗證信 ▼▼▼
    await sendEmailVerification(user); 
    return { 
      success: false, 
      message: '您的 Email 尚未驗證。我們已重新發送一封驗證信至您的信箱，請檢查後再試。',
      emailNotVerified: true 
    };
    // ▲▲▲ END: 新增自動重寄驗證信 ▲▲▲
  }
  
  // 4. 
  const currentUserIp = await getUserIP();
  const isSuspicious = isIpSuspicious(currentUserIp); 

  if (isSuspicious && !forceLogin) {
    const regIpInfo = userAccount.registrationIp ? `(您註冊時的 IP 來源: ${userAccount.registrationIp})` : '';
    
    // ▼▼▼ START: 
    await sendEmailVerification(user);
    // ▲▲▲ END: 

    return {
      success: false,
      // ▼▼▼ START: 
      message: `偵測到從一個不熟悉的 IP (${currentUserIp || '未知'}) 登入。${regIpInfo} 為安全起見，我們已發送一封確認信至您的 Email。如果您認得此活動，請再點擊一次登入以確認。`,
      // ▲▲▲ END: 
      needsVerification: true
    };
  }
  
  // 5. 
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
      }
  }

  // 6. 
  const newSessionId = self.crypto.randomUUID();
  
  await updateDoc(userRef, {
      loggedInDeviceId: deviceId,
      activeSessionId: newSessionId,
      loggedInIp: currentUserIp, 
      lastLogin: serverTimestamp()
  });

  return { success: true, message: '登入成功！', sessionId: newSessionId };
};

// logoutUser 
export const logoutUser = async (username: string): Promise<void> => {
  if (!username) {
    console.warn("Logout attempt without username.");
  } else {
    // 
    const userRef = doc(db, "users", username);
    await updateDoc(userRef, {
      loggedInDeviceId: null,
      activeSessionId: null,
      loggedInIp: null
    }).catch(err => console.error("Error during Firestore logout:", err));
  }
  
  // 
  await signOut(auth).catch(err => console.error("Error during Auth signout:", err));
};

// isSessionStillValid 
export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  
  // 1. 
  if (!auth.currentUser) {
    console.warn("Auth session missing, forcing logout.");
    return false;
  }
  
  // 2. 
  if (!auth.currentUser.emailVerified) {
    console.warn("Auth user email not verified, forcing logout.");
    await logoutUser(username); // 
    return false;
  }

  // 3. 
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return false;

  const userAccount = userSnap.data();

  // 4. 
  if (userAccount.email !== auth.currentUser.email) {
    console.warn("Auth user email mismatch with Firestore email, forcing logout.");
    await logoutUser(username);
    return false;
  }
  
  // 5. 
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  // 6. 
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
