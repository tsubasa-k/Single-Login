const USER_ACCOUNTS_KEY = 'user_accounts';
const DEVICE_ID_KEY = 'app_device_id';

interface UserAccount {
  password: string;
  loggedInDeviceId: string | null;
  activeSessionId: string | null;
  loggedInIp: string | null;
}

// ▼▼▼ START: 修改此處 ▼▼▼
// 模擬儲存在 localStorage 中的使用者資料庫
const getInitialUsers = (): { [key: string]: UserAccount } => {
  // 返回一個空物件，不再有預設使用者
  return {};
};
// ▲▲▲ END: 修改此處 ▲▲▲

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

export const loginUser = async (username: string, password: string, deviceId: string): Promise<{ success: boolean; message: string; sessionId?: string; }> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const accounts = getUserAccounts();
  const userAccount = accounts[username];
  
  if (!userAccount || userAccount.password !== password) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }
  
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
      if (userAccount.loggedInDeviceId !== deviceId) {
          const ipInfo = userAccount.loggedInIp ? ` (IP: ${userAccount.loggedInIp})` : '';
          return { success: false, message: `此帳號已在另一台裝置${ipInfo}上登入。請先從該裝置登出。` };
      } 
      else {
          return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
      }
  }

  const currentUserIp = await getUserIP();
  const newSessionId = self.crypto.randomUUID();
  userAccount.loggedInDeviceId = deviceId;
  userAccount.activeSessionId = newSessionId;
  userAccount.loggedInIp = currentUserIp;
  setUserAccounts(accounts);

  return { success: true, message: '登入成功！', sessionId: newSessionId };
};

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
  
  if (userAccount.loggedInDeviceId !== deviceId || userAccount.activeSessionId !== sessionId) {
      return false;
  }

  const currentUserIp = await getUserIP();
  if (userAccount.loggedInIp && currentUserIp && userAccount.loggedInIp !== currentUserIp) {
      console.warn("Session IP mismatch. Logging out.");
      return false;
  }

  return true;
};
