const USER_ACCOUNTS_KEY = 'user_accounts';
const DEVICE_ID_KEY = 'app_device_id';

interface UserAccount {
  password: string;
  loggedInDeviceId: string | null;
  activeSessionId: string | null;
}

// 模擬儲存在 localStorage 中的使用者資料庫
const getInitialUsers = (): { [key: string]: UserAccount } => {
  return {
    'user1': { password: 'password123', loggedInDeviceId: null, activeSessionId: null },
    'user2': { password: 'password123', loggedInDeviceId: null, activeSessionId: null },
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

export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const accounts = getUserAccounts();
  if (accounts[username]) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }
  
  accounts[username] = { password, loggedInDeviceId: null, activeSessionId: null };
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

  // 檢查是否已有活躍的會話
  if (userAccount.loggedInDeviceId && userAccount.activeSessionId) {
    // 會話已在某處活躍
    if (userAccount.loggedInDeviceId !== deviceId) {
      // 活躍在不同的裝置上
      return { success: false, message: '此帳號已在另一台裝置上登入。請先從該裝置登出。' };
    } else {
      // 活躍在同一個瀏覽器的另一個分頁
      return { success: false, message: '此帳號已在此瀏覽器的另一個分頁中登入。請先登出。' };
    }
  }

  // 沒有活躍會話，允許登入
  const newSessionId = self.crypto.randomUUID();
  userAccount.loggedInDeviceId = deviceId;
  userAccount.activeSessionId = newSessionId;
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
    setUserAccounts(accounts);
  }
};

export const isSessionStillValid = (username: string, deviceId: string, sessionId: string): boolean => {
  const accounts = getUserAccounts();
  const userAccount = accounts[username];
  // 會話有效的條件是：裝置 ID 匹配，且會話 ID 是目前活躍的會話 ID。
  return !!userAccount && 
         userAccount.loggedInDeviceId === deviceId &&
         userAccount.activeSessionId === sessionId;
};