import { db, auth } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore"; 
import { isIpSuspicious } from './ipWhitelist'; 
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
  // 移除了 sendSignInLinkToEmail
} from "firebase/auth";
import { TOTP, Secret } from 'otpauth'; // 匯入 otpauth

const DEVICE_ID_KEY = 'app_device_id';
// 移除了 JUST_AUTHORIZED_IP_KEY 和 actionCodeSettings

// 設定 TOTP 的發行者名稱（會顯示在 Authenticator App 中）
const ISSUER = "SingleLoginApp"; // 您可以自訂

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

// registerUser (加入 totpSecret 和 totpEnabled 欄位)
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

    // 仍然需要發送 Email 驗證（用於確認 Email 有效性）
    await sendEmailVerification(user);

    const registrationIp = await getUserIP();
    
    await setDoc(userRef, {
        email: email,
        uid: user.uid,
        registrationIp: registrationIp,
        trustedIps: registrationIp ? [registrationIp] : [], 
        createdAt: serverTimestamp(),
        // ▼▼▼ START: 新增 TOTP 相關欄位 ▼▼▼
        totpSecret: null, // TOTP 金鑰 (Base32)
        totpEnabled: false, // 是否已啟用 TOTP
        // ▲▲▲ END: 新增 TOTP 相關欄位 ▲▲▲
        // Session 相關欄位
        loggedInDeviceId: null,
        activeSessionId: null,
        loggedInIp: null,
    });
    
    // 修改成功訊息，提示後續步驟
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

// ▼▼▼ START: 新增 TOTP 相關函式 ▼▼▼
/**
 * 為指定使用者產生 TOTP 金鑰和 otpauth:// URL。
 * 會將金鑰（未啟用狀態）儲存到 Firestore。
 */
export const generateTotpSecret = async (username: string): Promise<{
  success: boolean, 
  message: string,
  otpauthUrl?: string, // 用於產生 QR Code
  secret?: string      // Base32 金鑰，用於手動輸入
}> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return { success: false, message: "找不到使用者。" };
  }
  const userEmail = userSnap.data().email;

  try {
    // 產生一個新的 TOTP 金鑰
    // 使用 otpauth 函式庫
    const secret = Secret.generate();
    const totp = new TOTP({
      issuer: ISSUER,
      label: userEmail || username, // 優先使用 Email 作為標籤
      algorithm: "SHA1", // 預設且最相容
      digits: 6,         // 標準 6 位數
      period: 30,        // 標準 30 秒
      secret: secret,      // 產生的金鑰物件
    });

    const otpauthUrl = totp.toString(); // 產生 otpauth:// 格式的 URL
    const secretBase32 = secret.base32; // 取得 Base32 格式的金鑰字串
    
    // 將金鑰（未啟用）暫存到 Firestore
    // 使用者必須掃描 QR Code 並驗證一次，才能啟用
    await updateDoc(userRef, {
      totpSecret: secretBase32,
      totpEnabled: false // 尚未啟用
    });
    
    return { success: true, message: "金鑰產生成功", otpauthUrl: otpauthUrl, secret: secretBase32 };
  } catch (error: any) {
     console.error("產生 TOTP 金鑰時出錯:", error);
     return { success: false, message: `產生金鑰時發生錯誤: ${error.message}` };
  }
};

/**
 * 驗證使用者輸入的 TOTP 碼是否正確，如果正確，則啟用 TOTP。
 */
export const verifyAndEnableTotp = async (username: string, token: string): Promise<{ success: boolean; message: string }> => {
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists() || !userSnap.data().totpSecret) {
    return { success: false, message: "找不到金鑰資料，請返回上一步重試。" };
  }
  
  const secretBase32 = userSnap.data().totpSecret;
  const userEmail = userSnap.data().email;

  try {
    const secret = Secret.fromBase32(secretBase32);
    const totp = new TOTP({
      issuer: ISSUER,
      label: userEmail || username,
      secret: secret
      // 其他參數會從 Secret 物件中自動讀取
    });

    // 驗證 token，允許前後一個時間窗口 (window: 1) 的容錯
    const delta = totp.validate({ token: token, window: 1 });

    if (delta === null) {
      // 驗證失敗
      return { success: false, message: "驗證碼錯誤或已過期，請重試。" };
    }

    // 驗證成功，將 totpEnabled 設為 true
    await updateDoc(userRef, {
      totpEnabled: true
    });
    
    return { success: true, message: "兩步驟驗證已成功啟用！" };
  } catch (error: any) {
    console.error("驗證 TOTP 時出錯:", error);
    return { success: false, message: `驗證時發生錯誤: ${error.message}` };
  }
};
// ▲▲▲ END: 新增 TOTP 相關函式 ▲▲▲

// loginUser (修改為檢查 TOTP)
export const loginUser = async (
  username: string, 
  password: string
): Promise<{ 
  success: boolean; 
  message: string; 
  needsTotp?: boolean; // 改為需要 TOTP
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
    // 這裡可以選擇是否重發驗證信，取決於您的策略
    // await sendEmailVerification(user); 
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

  // 如果 IP 安全或已被信任，直接準備建立 Session
  if (isTANet || isTrusted) {
    return { success: true, message: "IP 驗證成功，正在建立安全連線..." };
  }

  // ▼▼▼ START: IP 不信任，檢查 TOTP 設定 ▼▼▼
  if (userAccount.totpEnabled && userAccount.totpSecret) {
    // 如果已啟用 TOTP，要求輸入驗證碼
    return {
      success: false,
      message: `偵測到從一個不熟悉的 IP (${currentUserIp || '未知'}) 登入。請輸入您的 6 位數 Authenticator 驗證碼。`,
      needsTotp: true // 標記需要 TOTP 驗證
    };
  } else {
    // 如果未啟用 TOTP，阻擋登入並提示
    return {
      success: false,
      message: `偵測到從不熟悉的 IP (${currentUserIp || '未知'}) 登入，且您的帳號尚未設定兩步驟驗證。為安全起見，請先從您信任的網路環境登入，或完成兩步驟驗證設定。`
      // 注意：這裡不再發送 Email 連結
    };
  }
  // ▲▲▲ END: IP 不信任，檢查 TOTP 設定 ▲▲▲
};

// ▼▼▼ START: 新增 TOTP 驗證並建立 Session 的函式 ▼▼▼
/**
 * 驗證 TOTP 碼，如果正確，則建立 Session。
 */
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
    const secret = Secret.fromBase32(secretBase32);
    const totp = new TOTP({
      issuer: ISSUER,
      label: userEmail || username,
      secret: secret
    });

    const delta = totp.validate({ token: token, window: 1 });

    if (delta === null) {
      return { success: false, message: "驗證碼錯誤或已過期，請重試。" };
    }

    // 驗證碼正確，呼叫 createSession 建立工作階段
    console.log("TOTP 驗證成功，準備建立 Session...");
    return await createSession(username, deviceId);

  } catch (error: any) {
    console.error("驗證 TOTP 時出錯:", error);
    return { success: false, message: `驗證時發生錯誤: ${error.message}` };
  }
}
// ▲▲▲ END: 新增 TOTP 驗證並建立 Session 的函式 ▲▲▲

// createSession (大致不變，移除 localStorage 邏輯)
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
  
  // 檢查是否已有 Session
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } else {
          // 理論上不該發生，因為登入時會先檢查
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

  // 如果 IP 是新的，加入信任列表
  if (currentUserIp && (!userAccount.trustedIps || !userAccount.trustedIps.includes(currentUserIp))) {
      updateData.trustedIps = arrayUnion(currentUserIp);
  }
  
  // 移除了 localStorage.removeItem(JUST_AUTHORIZED_IP_KEY);

  await updateDoc(userRef, updateData);
  console.log(`Session 建立成功 for ${username}, IP: ${currentUserIp}, SessionID: ${newSessionId}`);
  return { success: true, message: '登入成功！', sessionId: newSessionId };
}

// authorizeIpAndLogout 函式已不再需要，可以刪除

// logoutUser (移除 localStorage 邏輯)
export const logoutUser = async (username: string): Promise<void> => {
  if (!username) {
    console.warn("Logout attempt without username.");
  } else {
    const userRef = doc(db, "users", username);
    // 只清除 Session 資訊，不清空 trustedIps 或 TOTP 設定
    await updateDoc(userRef, {
      loggedInDeviceId: null,
      activeSessionId: null,
      loggedInIp: null
    }).catch(err => console.error("Error during Firestore logout:", err));
  }
  
  // 移除了 localStorage.removeItem(JUST_AUTHORIZED_IP_KEY);
  
  await signOut(auth).catch(err => console.error("Error during Auth signout:", err));
};

// isSessionStillValid (移除 localStorage 邏輯)
export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  
  // 檢查 Firebase Auth 狀態
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    // 不需要 logoutUser，因為沒有有效 session
    return false; 
  }

  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return false;

  const userAccount = userSnap.data();
  
  // 檢查 Email 是否匹配
  if (userAccount.email !== auth.currentUser.email) {
    // Email 不匹配，強制登出 Firestore 記錄 (如果有的話)
    await logoutUser(username); 
    return false;
  }
  
  // 檢查 Session ID 和 Device ID 是否匹配
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  // 檢查 IP 是否仍然受信任
  const currentUserIp = await getUserIP();
  const isTANet = !isIpSuspicious(currentUserIp);
  const isTrusted = userAccount.trustedIps && userAccount.trustedIps.includes(currentUserIp);
  
  // 移除了 isJustAuthorized 的檢查

  if (!isTANet && !isTrusted) {
    console.warn("Session IP is suspicious and not in trusted list. Forcing logout.");
    await logoutUser(username); // 強制登出
    return false;
  }

  // 所有檢查通過
  return true;
};
