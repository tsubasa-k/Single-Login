import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as authService from '../services/authService';
import { UserIcon, LockIcon } from './icons';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();

  // --- START: Enhanced State Management ---
  // This state will control whether we show the login form or the verification code form.
  const [view, setView] = useState<'login' | 'verify'>('login');
  const [verificationCode, setVerificationCode] = useState('');
  // --- END: Enhanced State Management ---

  // Handles the initial username and password submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const deviceId = authService.getOrCreateDeviceId();
      const result = await authService.loginUser(username, password, deviceId);
      
      if (result.success && result.sessionId) {
        // If login is successful and no verification is needed, proceed.
        auth.login(username, result.sessionId);
      } else if (result.verificationRequired) {
        // If the auth service requires verification for this new device, switch the view.
        setError(result.message + ' 請查看開發者主控台獲取驗證碼以進行測試。');
        setView('verify');
      } else {
        // Handle standard login errors (e.g., wrong password).
        setError(result.message);
      }
    } catch (err) {
      setError('發生意外錯誤，請再試一次。');
    } finally {
      setIsLoading(false);
    }
  };

  // Handles the submission of the 6-digit verification code for the new device
  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        // Calls the new verification function from the auth service.
        const result = await authService.verifyNewDevice(username, verificationCode);
        if (result.success && result.sessionId) {
            // If verification is successful, complete the login.
            auth.login(username, result.sessionId);
        } else {
            setError(result.message);
        }
    } catch (err) {
        setError('驗證時發生意外錯誤，請再試一次。');
    } finally {
        setIsLoading(false);
    }
  };

  // A separate component to render the verification code input form
  const renderVerificationView = () => (
    <form onSubmit={handleVerificationSubmit} className="space-y-6">
        <div>
            <label htmlFor="verificationCode" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              6 位數驗證碼
            </label>
            <input
              id="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
              placeholder="請輸入驗證碼"
              required
              maxLength={6}
              autoComplete="one-time-code"
            />
        </div>
        <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
            {isLoading ? '驗證中...' : '驗證並登入'}
        </button>
        <div className="text-center">
          <button type="button" onClick={() => { setView('login'); setError(''); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none">返回登入</button>
        </div>
    </form>
  );

  // The original login form component
  const renderLoginView = () => (
    <form onSubmit={handleLoginSubmit} className="space-y-6">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">使用者名稱</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="h-5 w-5 text-slate-400" /></div>
          <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-50 dark:bg-slate-700" placeholder="您的使用者名稱" required />
        </div>
      </div>
      <div>
        <label htmlFor="password"className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">密碼</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockIcon className="h-5 w-5 text-slate-400" /></div>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-50 dark:bg-slate-700" placeholder="密碼" required />
        </div>
      </div>
      <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
        {isLoading ? '登入中...' : '登入'}
      </button>
    </form>
  );

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-8">
        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-2">
          {view === 'login' ? '歡迎回來' : '驗證您的裝置'}
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
          {view === 'login' ? '登入以繼續' : '我們偵測到您從一個新的裝置登入'}
        </p>
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert"><p>{error}</p></div>}
        
        {/* Conditionally render the correct view based on the state */}
        {view === 'login' ? renderLoginView() : renderVerificationView()}

        {view === 'login' && (
             <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                沒有帳號？{' '}
                <button onClick={onSwitchToRegister} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none">註冊</button>
             </div>
        )}
      </div>
    </div>
  );
};
