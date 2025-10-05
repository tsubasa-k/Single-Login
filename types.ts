export interface User {
  username: string;
}

// 代表目前登入的使用者及其有效的會話識別碼。
export interface CurrentUser extends User {
    sessionId: string;
}

export interface AuthContextType {
  currentUser: CurrentUser | null;
  login: (username:string, sessionId: string) => void;
  logout: () => void;
  isLoading: boolean;
}