import React, { useState, useEffect, createContext, useCallback } from 'react';
import { LoginPage } from './components/LoginPage';
import { HomePage } from './components/HomePage';
import { RegisterPage } from './components/RegisterPage';
import { CurrentUser, AuthContextType } from './types';
import * as authService from './services/authService';
import { SunIcon, MoonIcon } from './components/icons';
// ▼▼▼ START: 匯入新的 TOTP 設定頁面 ▼▼▼
import { SetupTotpPage } from './components/SetupTotpPage'; 
// ▲▲▲ END: 匯入新的 TOTP 設定頁面 ▼▲▲

// 移除了 Email Link 相關的 import

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 移除了 isProcessingLink 和 justLoggedInViaLink

  const logout = useCallback(async () => {
    // logout 函式維持不變
    if (currentUser) {
      setIsLoading(true);
      await authService.logoutUser(currentUser.username);
      setCurrentUser(null);
      sessionStorage.removeItem('currentUser');
      setIsLoading(false);
    }
  }, [currentUser]);

  // beforeunload effect 維持不變
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault(); 
      if (currentUser) {
        logout();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser, logout]);

  // login 函式維持不變
  const login = useCallback((username: string, sessionId: string) => {
    const user: CurrentUser = { username, sessionId };
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  }, []);

  // 移除了處理 Email Link 的 useEffect

  // session validation effect (大致不變，移除 isProcessingLink 依賴)
  useEffect(() => {
    // 移除了 isProcessingLink 和 justLoggedInViaLink 的檢查
    
    const validateSession = async () => {
      try {
        const storedUserStr = sessionStorage.getItem('currentUser');
        if (storedUserStr) {
          const storedUser: CurrentUser = JSON.parse(storedUserStr);
          const deviceId = authService.getOrCreateDeviceId();
          
          // isSessionStillValid 會處理 Auth 狀態檢查
          if (await authService.isSessionStillValid(storedUser.username, deviceId, storedUser.sessionId)) {
            setCurrentUser(storedUser);
          } else {
            setCurrentUser(null);
            sessionStorage.removeItem('currentUser');
          }
        }
      } catch (error) {
        console.error("Failed to parse user from sessionStorage", error);
        sessionStorage.removeItem('currentUser');
      }
      setIsLoading(false);
    };

    validateSession();
    
    // 定期檢查
    const intervalId = setInterval(validateSession, 60000); 

    return () => {
      clearInterval(intervalId);
    };
  }, []); // 移除 isProcessingLink, justLoggedInViaLink

  const value = { currentUser, login, logout, isLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ThemeToggle 維持不變
const ThemeToggle: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
      return localStorage.getItem('theme') === 'dark';
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <button
      onClick={toggleTheme}
      className="absolute top-4 right-4 p-2 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
      aria-label="Toggle theme"
    >
      {isDarkMode ? <SunIcon className="h-6 w-6 text-yellow-400" /> : <MoonIcon className="h-6 w-6 text-slate-800" />}
    </button>
  );
};

// AppContent (加入 TOTP Setup 頁面邏輯)
const AppContent: React.FC = () => {
  const { currentUser, isLoading } = React.useContext(AuthContext)!;
  // ▼▼▼ START: 加入 setupTotp 狀態 ▼▼▼
  const [view, setView] = useState<'login' | 'register' | 'setupTotp'>('login');
  const [totpUsername, setTotpUsername] = useState<string | null>(null); // 用於傳遞 username
  // ▲▲▲ END: 加入 setupTotp 狀態 ▼▲▲

  // Loading 畫面維持不變
  if (isLoading) { 
    return (
      <div className="flex items-center justify-center h-screen">
          <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
      </div>
    );
  }

  // mainContent (加入 TOTP 頁面渲染)
  const mainContent = () => {
    if (currentUser) {
      return <HomePage />;
    }
    // ▼▼▼ START: 加入 setupTotp 邏輯 ▼▼▼
    if (view === 'login') {
      return <LoginPage onSwitchToRegister={() => setView('register')} />;
    }
    if (view === 'register') {
      return <RegisterPage 
                onSwitchToLogin={() => setView('login')} 
                // 註冊成功後，設定 username 並切換到 setupTotp 畫面
                onRegisterSuccess={(username) => {
                  setTotpUsername(username); 
                  setView('setupTotp');
                }}
              />;
    }
    if (view === 'setupTotp' && totpUsername) {
      return <SetupTotpPage 
                username={totpUsername}
                // TOTP 設定完成後，清除 username 並切換回 login 畫面
                onSetupComplete={() => {
                  setTotpUsername(null);
                  setView('login');
                }}
              />;
    }
    // 如果狀態不對，預設回到登入頁
    return <LoginPage onSwitchToRegister={() => setView('register')} />;
    // ▲▲▲ END: 加入 setupTotp 邏輯 ▼▲▲
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
       <ThemeToggle />
       {mainContent()}
    </div>
  );
};

// App 函式維持不變
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
