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

  useEffect(() => {
    const validateSession = () => {
      try {
        const storedUserStr = sessionStorage.getItem('currentUser');
        if (storedUserStr) {
          const storedUser: CurrentUser = JSON.parse(storedUserStr);
          const deviceId = authService.getOrCreateDeviceId();
          
          if (authService.isSessionStillValid(storedUser.username, deviceId, storedUser.sessionId)) {
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

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'user_accounts') {
        validateSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
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