const USER_ACCOUNTS_KEY = 'user_accounts';
const DEVICE_ID_KEY = 'device_unique_id';

// 模擬儲存在 localStorage 中的使用者資料庫
const getInitialUsers = (): { [key: string]: { password: string; deviceId: string | null } } => {
  return {
    'user1': { password: 'password123', deviceId: null },
    'user2': { password: 'password123', deviceId: null },
  };
};

const getUserAccounts = (): { [key: string]: { password: string; deviceId: string | null } } => {
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

const setUserAccounts = (accounts: { [key: string]: { password: string; deviceId: string | null } }): void => {
  localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
};

// 獲取或生成一個唯一的設備 ID
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = self.crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const registerUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const accounts = getUserAccounts();
  if (accounts[username]) {
    return { success: false, message: '此使用者名稱已被註冊。' };
  }
  
  // 註冊時不綁定設備，將 deviceId 設為 null，允許在任何設備上進行首次登入
  accounts[username] = { password, deviceId: null };
  setUserAccounts(accounts);
  
  return { success: true, message: '註冊成功！您現在可以登入。' };
};

export const loginUser = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const accounts = getUserAccounts();
  const userAccount = accounts[username];

  // 步驟 1: 驗證使用者名稱和密碼
  if (!userAccount || userAccount.password !== password) {
    return { success: false, message: '無效的使用者名稱或密碼。' };
  }

  const currentDeviceId = getDeviceId();

  // 步驟 2: 檢查設備 ID
  if (userAccount.deviceId === null) {
    // 首次登入：將當前設備 ID 永久綁定到此帳號
    userAccount.deviceId = currentDeviceId;
    setUserAccounts(accounts);
  } else if (userAccount.deviceId !== currentDeviceId) {
    // 非首次登入且設備 ID 不匹配：拒絕登入
    return { success: false, message: '此帳號已被永久鎖定至另一台設備。' };
  }

  // 步驟 3: 登入成功 (設備 ID 匹配或首次綁定成功)
  return { success: true, message: '登入成功！' };
};

export const logoutUser = async (username: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  // 在永久設備鎖定模式下，登出時無需處理共享的會話狀態。
  // 客戶端將清除 sessionStorage。
};

export const isSessionValid = (username: string): boolean => {
  // 只要使用者帳號存在，其在 sessionStorage 中的會話就是有效的。
  // 真正的驗證發生在登入（login）時。
  const accounts = getUserAccounts();
  return !!accounts[username];
};
