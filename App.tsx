import React, { useState, useEffect, createContext, useCallback } from 'react';
import { LoginPage } from './components/LoginPage';
import { HomePage } from './components/HomePage';
import { RegisterPage } from './components/RegisterPage';
import { CurrentUser, AuthContextType } from './types';
import * as authService from './services/authService';
import { SunIcon, MoonIcon } from './components/icons';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    if (currentUser) {
      setIsLoading(true);
      await authService.logoutUser(currentUser.username);
      setCurrentUser(null);
      sessionStorage.removeItem('currentUser');
      setIsLoading(false);
    }
  }, [currentUser]);

  // ▼▼▼ START: 新增自動登出邏輯 ▼▼▼
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 大部分的現代瀏覽器為了安全，會忽略 event.returnValue 的自訂訊息
      // 但某些舊版瀏覽器可能需要
      event.preventDefault(); 
      if (currentUser) {
        // 使用 navigator.sendBeacon 來確保請求在頁面關閉前發送
        // 由於 logoutUser 是非同步的，且 sendBeacon 不處理非同步，
        // 這裡我們只處理前端狀態，後端的 session 會因為定期檢查而失效。
        // 對於您的 Firebase 方案，登出是必要的。
        // 但 sendBeacon 只能發送 POST 請求，logoutUser 需要更複雜的邏輯
        // 因此這裡我們直接觸發 logout，並依賴瀏覽器盡力完成
        logout();
      }
    };

    // 頁面關閉或刷新時觸發
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser, logout]);
  // ▲▲▲ END: 新增自動登出邏輯 ▲▲▲

  useEffect(() => {
    const validateSession = async () => {
      try {
        const storedUserStr = sessionStorage.getItem('currentUser');
        if (storedUserStr) {
          const storedUser: CurrentUser = JSON.parse(storedUserStr);
          const deviceId = authService.getOrCreateDeviceId();
          
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
    
    // 定期檢查會話有效性
    const intervalId = setInterval(validateSession, 60000); 

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const login = useCallback((username: string, sessionId: string) => {
    const user: CurrentUser = { username, sessionId };
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  }, []);

  const value = { currentUser, login, logout, isLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


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


const AppContent: React.FC = () => {
  const { currentUser, isLoading } = React.useContext(AuthContext)!;
  const [view, setView] = useState<'login' | 'register'>('login');

  if (isLoading && !currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
          <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
      </div>
    );
  }

  const mainContent = () => {
    if (currentUser) {
      return <HomePage />;
    }
    if (view === 'login') {
      return <LoginPage onSwitchToRegister={() => setView('register')} />;
    }
    return <RegisterPage onSwitchToLogin={() => setView('login')} />;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
       <ThemeToggle />
       {mainContent()}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
