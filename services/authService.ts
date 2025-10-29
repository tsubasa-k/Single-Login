import { db, auth } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore"; 
import { isIpSuspicious } from './ipWhitelist'; 
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
// ▼▼▼ START: 修改 otpauth 匯入方式 ▼▼▼
// import { TOTP, Secret } from 'otpauth'; // 舊的匯入方式
import * as OTPAuth from 'otpauth'; // 改為命名空間匯入 (Namespace Import)
// ▲▲▲ END: 修改 otpauth 匯入方式 ▼▲▲

const DEVICE_ID_KEY = 'app_device_id';
const ISSUER = "SingleLoginApp"; 

// getOrCreateDeviceId 和 getUserIP 維持不變
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
    } catch (error) {
      console.warn(`Failed to fetch IP from ${url}:`, error);
    }
  }
  console.error("All IP services failed. IP validation will be skipped.");
  return null;
};

// registerUser 維持不變 (包含 totpSecret, totpEnabled 欄位)
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
    
    await setDoc(userRef, {
        email: email,
        uid: user.uid,
        registrationIp: registrationIp,
        trustedIps: registrationIp ? [registrationIp] : [], 
        createdAt: serverTimestamp(),
        totpSecret: null, 
        totpEnabled: false, 
        loggedInDeviceId: null,
        activeSessionId: null,
        loggedInIp: null,
    });
    
    return { success: true, message: '註冊成功！請檢查您的 Email 信箱以完成驗證，然後設定兩步驟驗證。' };

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


// generateTotpSecret (修改 Secret 和 TOTP 的使用方式)
export const generateTotpSecret = async (username: string): Promise<{
  success: boolean, 
  message: string,
  otpauthUrl?: string,
  secret?: string
}> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return { success: false, message: "找不到使用者。" };
  }
  const userEmail = userSnap.data().email;

  try {
    // ▼▼▼ START: 使用 OTPAuth.Secret ▼▼▼
    const secret = OTPAuth.Secret.generate(); 
    // ▲▲▲ END: 使用 OTPAuth.Secret ▼▲▲
    // ▼▼▼ START: 使用 OTPAuth.TOTP ▼▼▼
    const totp = new OTPAuth.TOTP({ 
      issuer: ISSUER,
      label: userEmail || username,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret, // 這裡傳入的是 Secret 物件
    });
    // ▲▲▲ END: 使用 OTPAuth.TOTP ▼▲▲

    const otpauthUrl = totp.toString(); 
    const secretBase32 = secret.base32; 
    
    await updateDoc(userRef, {
      totpSecret: secretBase32,
      totpEnabled: false 
    });
    
    return { success: true, message: "金鑰產生成功", otpauthUrl: otpauthUrl, secret: secretBase32 };
  } catch (error: any) {
     console.error("產生 TOTP 金鑰時出錯:", error);
     // 顯示更詳細的錯誤
     return { success: false, message: `產生金鑰時發生錯誤: ${error.message || error}` }; 
  }
};

// verifyAndEnableTotp (修改 Secret 和 TOTP 的使用方式)
export const verifyAndEnableTotp = async (username: string, token: string): Promise<{ success: boolean; message: string }> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists() || !userSnap.data().totpSecret) {
    return { success: false, message: "找不到金鑰資料，請返回上一步重試。" };
  }
  
  const secretBase32 = userSnap.data().totpSecret;
  const userEmail = userSnap.data().email;

  try {
    // ▼▼▼ START: 使用 OTPAuth.Secret ▼▼▼
    const secret = OTPAuth.Secret.fromBase32(secretBase32); 
    // ▲▲▲ END: 使用 OTPAuth.Secret ▼▲▲
    // ▼▼▼ START: 使用 OTPAuth.TOTP ▼▼▼
    const totp = new OTPAuth.TOTP({ 
      issuer: ISSUER,
      label: userEmail || username,
      secret: secret
    });
    // ▲▲▲ END: 使用 OTPAuth.TOTP ▼▲▲

    const delta = totp.validate({ token: token, window: 1 });

    if (delta === null) {
      return { success: false, message: "驗證碼錯誤或已過期，請重試。" };
    }

    await updateDoc(userRef, {
      totpEnabled: true
    });
    
    return { success: true, message: "兩步驟驗證已成功啟用！" };
  } catch (error: any) {
    console.error("驗證 TOTP 時出錯:", error);
    return { success: false, message: `驗證時發生錯誤: ${error.message}` };
  }
};

// loginUser 維持不變 (包含 needsTotp 邏輯)
export const loginUser = async (
  username: string, 
  password: string
): Promise<{ 
  success: boolean; 
  message: string; 
  needsTotp?: boolean; 
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

  // 1. 驗證密碼
  let user;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
  } catch (error: any) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }

  // 2. 檢查 Email 是否已驗證
  if (!user.emailVerified) {
    // await sendEmailVerification(user); // 考慮是否需要重發
    return { 
      success: false, 
      message: '您的 Email 尚未驗證。請先完成 Email 驗證才能設定或使用兩步驟驗證。',
      emailNotVerified: true 
    };
  }
  
  // 3. 檢查 IP 是否信任
  const currentUserIp = await getUserIP();
  const isTANet = !isIpSuspicious(currentUserIp);
  const isTrusted = userAccount.trustedIps && userAccount.trustedIps.includes(currentUserIp);

  if (isTANet || isTrusted) {
    return { success: true, message: "IP 驗證成功，正在建立安全連線..." };
  }

  // IP 不信任，檢查 TOTP 設定
  if (userAccount.totpEnabled && userAccount.totpSecret) {
    return {
      success: false,
      message: `偵測到從一個不熟悉的 IP (${currentUserIp || '未知'}) 登入。請輸入您的 6 位數 Authenticator 驗證碼。`,
      needsTotp: true 
    };
  } else {
    return {
      success: false,
      message: `偵測到從不熟悉的 IP (${currentUserIp || '未知'}) 登入，且您的帳號尚未設定兩步驟驗證。為安全起見，請先從您信任的網路環境登入，或完成兩步驟驗證設定。`
    };
  }
};

// verifyTotpAndCreateSession (修改 Secret 和 TOTP 的使用方式)
export const verifyTotpAndCreateSession = async (
  username: string, 
  token: string, 
  deviceId: string
): Promise<{ 
  success: boolean; 
  message: string; 
  sessionId?: string; 
}> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists() || !userSnap.data().totpSecret) {
    return { success: false, message: "找不到帳號或尚未設定兩步驟驗證金鑰。" };
  }

  const secretBase32 = userSnap.data().totpSecret;
  const userEmail = userSnap.data().email;

  try {
    // ▼▼▼ START: 使用 OTPAuth.Secret ▼▼▼
    const secret = OTPAuth.Secret.fromBase32(secretBase32); 
    // ▲▲▲ END: 使用 OTPAuth.Secret ▼▲▲
    // ▼▼▼ START: 使用 OTPAuth.TOTP ▼▼▼
    const totp = new OTPAuth.TOTP({ 
      issuer: ISSUER,
      label: userEmail || username,
      secret: secret
    });
    // ▲▲▲ END: 使用 OTPAuth.TOTP ▼▲▲

    const delta = totp.validate({ token: token, window: 1 });

    if (delta === null) {
      return { success: false, message: "驗證碼錯誤或已過期，請重試。" };
    }

    console.log("TOTP 驗證成功，準備建立 Session...");
    return await createSession(username, deviceId);

  } catch (error: any) {
    console.error("驗證 TOTP 時出錯:", error);
    return { success: false, message: `驗證時發生錯誤: ${error.message}` };
  }
}

// createSession 維持不變 (包含 trustedIps 更新)
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
  
  const updateData: any = {
      loggedInDeviceId: deviceId,
      activeSessionId: newSessionId,
      loggedInIp: currentUserIp, 
      lastLogin: serverTimestamp()
  };

  if (currentUserIp && (!userAccount.trustedIps || !userAccount.trustedIps.includes(currentUserIp))) {
      updateData.trustedIps = arrayUnion(currentUserIp);
  }

  await updateDoc(userRef, updateData);
  console.log(`Session 建立成功 for ${username}, IP: ${currentUserIp}, SessionID: ${newSessionId}`);
  return { success: true, message: '登入成功！', sessionId: newSessionId };
}

// authorizeIpAndLogout 函式已不再需要，可以刪除

// logoutUser 維持不變
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

// isSessionStillValid 維持不變
export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
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
  const isTANet = !isIpSuspicious(currentUserIp);
  const isTrusted = userAccount.trustedIps && userAccount.trustedIps.includes(currentUserIp);
  
  if (!isTANet && !isTrusted) {
    console.warn("Session IP is suspicious and not in trusted list. Forcing logout.");
    await logoutUser(username); // 強制登出
    return false;
  }

  return true;
};
