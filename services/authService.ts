import { db, auth } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore"; // 
import { isIpSuspicious } from './ipWhitelist'; 
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  sendSignInLinkToEmail // 
} from "firebase/auth";

const DEVICE_ID_KEY = 'app_device_id';

// 
const actionCodeSettings = {
  // 
  // 
  url: window.location.origin, // 
  handleCodeInApp: true, // 
};

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


// registerUser (
export const registerUser = async (username: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
  
  if (!username.trim()) {
    return { success: false, message: '使用者名稱不能為空。' };
  }
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await sendEmailVerification(user);

    const registrationIp = await getUserIP();
    
    // 
    await setDoc(userRef, {
        email: email,
        uid: user.uid,
        loggedInDeviceId: null,
        activeSessionId: null,
        loggedInIp: null,
        registrationIp: registrationIp,
        trustedIps: registrationIp ? [registrationIp] : [], // 
        createdAt: serverTimestamp()
    });
    
    return { success: true, message: '註冊成功！請檢查您的 Email 信箱以完成驗證。' };

  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      return { success: false, message: '此 Email 已被註冊。' };
    }
    if (error.code === 'auth/weak-password') {
      return { success: false, message: '密碼強度不足，請至少設定 6 個字元。' };
    }
    return { success: false, message: '註冊時發生錯誤。' };
  }
};


// loginUser (
export const loginUser = async (
  username: string, 
  password: string
): Promise<{ 
  success: boolean; 
  message: string; 
  needsEmailLink?: boolean; // 
  emailNotVerified?: boolean; 
}> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }
  
  const userAccount = userSnap.data();
  const email = userAccount.email;
  if (!email) {
      return { success: false, message: '帳號資料不完整，缺少 Email 無法登入。' };
  }

  // 1. 
  let user;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
  } catch (error: any) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }

  // 2. 
  if (!user.emailVerified) {
    await sendEmailVerification(user); 
    return { 
      success: false, 
      message: '您的 Email 尚未驗證。我們已重新發送一封驗證信至您的信箱，請檢查後再試。',
      emailNotVerified: true 
    };
  }
  
  // 3. 
  const currentUserIp = await getUserIP();
  const isTANet = !isIpSuspicious(currentUserIp);
  const isTrusted = userAccount.trustedIps && userAccount.trustedIps.includes(currentUserIp);

  // 
  if (isTANet || isTrusted) {
    // 
    return { success: true, message: "IP 驗證成功，正在建立安全連線..." };
  }

  // 4. 
  try {
    // 
    localStorage.setItem('emailForSignIn', email);
    localStorage.setItem('usernameForSignIn', username); // 

    // ▼▼▼ START: 在這裡加入 console.log ▼▼▼
    console.log("正在發送 Email 連結，使用的 URL 是:", actionCodeSettings.url);
    // ▲▲▲ END: 加入 console.log ▲▲▲

    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    
    return {
      success: false,
      message: `偵測到從一個不熟悉的 IP (${currentUserIp || '未知'}) 登入。我們已發送一封【安全登入連結】到您的 Email 信箱。請點擊該連結以授權此裝置並登入。`,
      needsEmailLink: true
    };
  } catch (error: any) { // ▼▼▼ START: 
    console.error("Error sending sign-in link:", error);
    // 
    const specificError = (error as Error).message || '未知錯誤';
    return { 
      success: false, 
      message: `嘗試發送 Email 連結時失敗：${specificError}。請檢查 Firebase 控制台的「Authorized domains」設定。` 
    };
    // ▲▲▲ END: 
  }
};

// 
export const createSession = async (
  username: string,
  deviceId: string
): Promise<{ 
  success: boolean; 
  message: string; 
  sessionId?: string; 
}> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return { success: false, message: '找不到使用者資料。' };
  }
  const userAccount = userSnap.data();
  
  // 
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
  
  // 
  const updateData: any = {
      loggedInDeviceId: deviceId,
      activeSessionId: newSessionId,
      loggedInIp: currentUserIp, // 
      lastLogin: serverTimestamp()
  };

  // 
  if (currentUserIp && (!userAccount.trustedIps || !userAccount.trustedIps.includes(currentUserIp))) {
      updateData.trustedIps = arrayUnion(currentUserIp);
  }

  await updateDoc(userRef, updateData);

  return { success: true, message: '登入成功！', sessionId: newSessionId };
}

// logoutUser 
export const logoutUser = async (username: string): Promise<void> => {
  if (!username) {
    console.warn("Logout attempt without username.");
  } else {
    const userRef = doc(db, "users", username);
    await updateDoc(userRef, {
      loggedInDeviceId: null,
      activeSessionId: null,
      loggedInIp: null
    }).catch(err => console.error("Error during Firestore logout:", err));
  }
  
  await signOut(auth).catch(err => console.error("Error during Auth signout:", err));
};

// isSessionStillValid (
export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    await logoutUser(username);
    return false;
  }

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return false;

  const userAccount = userSnap.data();
  
  if (userAccount.email !== auth.currentUser.email) {
    await logoutUser(username);
    return false;
  }
  
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  const currentUserIp = await getUserIP();
  
  // 
  const isTANet = !isIpSuspicious(currentUserIp);
  const isTrusted = userAccount.trustedIps && userAccount.trustedIps.includes(currentUserIp);

  if (!isTANet && !isTrusted) {
    console.warn("Session IP is suspicious and not in trusted list. Logging out.");
    await logoutUser(username);
    return false;
  }

  return true;
};
