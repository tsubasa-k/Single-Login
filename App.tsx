import React, { useState, useEffect, createContext, useCallback } from 'react';
import { LoginPage } from './components/LoginPage';
import { HomePage } from './components/HomePage';
import { RegisterPage } from './components/RegisterPage';
import { CurrentUser, AuthContextType } from './types';
import * as authService from './services/authService';
import { SunIcon, MoonIcon } from './components/icons';

// ▼▼▼ START: 匯入 Auth 相關函式 ▼▼▼
import { auth } from './services/firebaseConfig';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
// ▲▲▲ END: 匯入 Auth 相關函式 ▼▲▲

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // ▼▼▼ START: 
  const [isProcessingLink, setIsProcessingLink] = useState(true);
  const [justLoggedInViaLink, setJustLoggedInViaLink] = useState(false); // 
  // ▲▲▲ END: 

  const logout = useCallback(async () => {
    if (currentUser) {
      setIsLoading(true);
      await authService.logoutUser(currentUser.username);
      setCurrentUser(null);
      sessionStorage.removeItem('currentUser');
      setIsLoading(false);
    }
  }, [currentUser]);

  // (beforeunload effect 
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


  const login = useCallback((username: string, sessionId: string) => {
    const user: CurrentUser = { username, sessionId };
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  }, []);

  // ▼▼▼ START: 
  useEffect(() => {
    const handleEmailLinkLogin = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        setIsLoading(true); // 
        let email = localStorage.getItem('emailForSignIn');
        let username = localStorage.getItem('usernameForSignIn');
        
        if (!email || !username) {
          console.error("Email 連結登入失敗：找不到快取的 Email 或使用者名稱。");
          alert("Email 連結登入失敗，請重新登入。");
          setIsProcessingLink(false);
          setIsLoading(false);
          window.history.replaceState(null, '', window.location.origin);
          return;
        }

        try {
          // 1. 
          await signInWithEmailLink(auth, email, window.location.href);
          
          // 2. 
          const deviceId = authService.getOrCreateDeviceId();
          const sessionResult = await authService.createSession(username, deviceId);

          if (sessionResult.success && sessionResult.sessionId) {
            login(username, sessionResult.sessionId);
            setJustLoggedInViaLink(true); // 
          } else {
            console.error(sessionResult.message);
            alert(`建立工作階段失敗: ${sessionResult.message}`);
            await authService.logoutUser(username);
          }
          
        } catch (error) {
          console.error("Email 連結登入時發生錯誤:", error);
          alert(`連結登入失敗: ${error}`);
        } finally {
          // 
          localStorage.removeItem('emailForSignIn');
          localStorage.removeItem('usernameForSignIn');
          window.history.replaceState(null, '', window.location.origin);
          setIsProcessingLink(false);
          // 
        }
      } else {
        setIsProcessingLink(false);
      }
    };

    handleEmailLinkLogin();
  }, [login]);
  // ▲▲▲ END: 

  // (session validation effect / 
  useEffect(() => {
    // 
    if (isProcessingLink) {
      setIsLoading(true);
      return; // 
    }

    // ▼▼▼ START: 
    if (justLoggedInViaLink) {
      setIsLoading(false); // 
      return; // 
    }
    // ▲▲▲ END: 
    
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
    
    const intervalId = setInterval(validateSession, 60000); 

    return () => {
      clearInterval(intervalId);
    };
  }, [isProcessingLink, justLoggedInViaLink]); // 
  // ▲▲▲ 

  const value = { currentUser, login, logout, isLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


const ThemeToggle: React.FC = () => {
  // (ThemeToggle 
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

  // 
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
