const USER_ACCOUNTS_KEY = 'user_accounts';
const DEVICE_ID_KEY = 'app_device_id';

interface UserAccount {
  password: string;
  loggedInDeviceId: string | null;
  activeSessionId: string | null;
  loggedInIp: string | null;
}

// 模擬儲存在 localStorage 中的使用者資料庫
const getInitialUsers = (): { [key: string]: UserAccount } => {
  return {
    'user1': { password: 'password123', loggedInDeviceId: null, activeSessionId: null, loggedInIp: null },
    'user2': { password: 'password123', loggedInDeviceId: null, activeSessionId: null, loggedInIp: null },
  };
};

const getUserAccounts = (): { [key: string]: UserAccount } => {
  try {
    const accounts = localStorage.getItem(USER_ACCOUNTS_KEY);
    if (!accounts) {
      const initialUsers = getInitialUsers();
      localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(initialUsers));
      return initialUsers;
    }
    return JSON.parse(accounts);
  } catch (error) {
    console.error("Failed to parse user accounts from localStorage", error);
    const initialUsers = getInitialUsers();
    localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(initialUsers));
    return initialUsers;
  }
};

const setUserAccounts = (accounts: { [key: string]: UserAccount }): void => {
  localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
};

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


export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const accounts = getUserAccounts();
  if (accounts[username]) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }
  
  accounts[username] = { password, loggedInDeviceId: null, activeSessionId: null, loggedInIp: null };
  setUserAccounts(accounts);
  
  return { success: true, message: '註冊成功！您現在可以登入。' };
};

// --- START: 已修正的核心邏輯 ---
export const loginUser = async (username: string, password: string, deviceId: string): Promise<{ success: boolean; message: string; sessionId?: string; }> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const accounts = getUserAccounts();
  const userAccount = accounts[username];
  
  if (!userAccount || userAccount.password !== password) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }
  
  // 檢查是否已有活躍的會話
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      // 如果 deviceId 不相同，代表是從不同的裝置或瀏覽器登入
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } 
      // 如果 deviceId 相同，代表是在同一個瀏覽器的不同分頁嘗試登入
      else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
      }
  }

  // 沒有活躍會話，允許登入
  const currentUserIp = await getUserIP(); // 只有在確定要登入時才獲取 IP
  const newSessionId = self.crypto.randomUUID();
  userAccount.loggedInDeviceId = deviceId;
  userAccount.activeSessionId = newSessionId;
  userAccount.loggedInIp = currentUserIp; // 儲存獲取到的 IP，如果失敗則為 null
  setUserAccounts(accounts);

  return { success: true, message: '登入成功！', sessionId: newSessionId };
};
// --- END: 已修正的核心邏輯 ---

export const logoutUser = async (username: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const accounts = getUserAccounts();
  const userAccount = accounts[username];
  if (userAccount) {
    userAccount.loggedInDeviceId = null;
    userAccount.activeSessionId = null;
    userAccount.loggedInIp = null;
    setUserAccounts(accounts);
  }
};

export const isSessionStillValid = async (username: string, deviceId: string, sessionId: string): Promise<boolean> => {
  const accounts = getUserAccounts();
  const userAccount = accounts[username];
  if (!userAccount) return false;
  
  // 基本驗證
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  // 盡力而為的 IP 驗證
  const currentUserIp = await getUserIP();
  // 只有在當時登入成功獲取了 IP，並且現在也能成功獲取 IP 的情況下，才進行 IP 比對
  if (userAccount.loggedInIp && currentUserIp && userAccount.loggedInIp !== currentUserIp) {
      console.warn("Session IP mismatch. Logging out.");
      return false;
  }

  return true;
};
