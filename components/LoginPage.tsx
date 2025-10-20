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
  // ▼▼▼ START: 新增 state ▼▼▼
  const [needsVerification, setNeedsVerification] = useState(false);
  // ▲▲▲ END: 新增 state ▲▲▲
  const auth = useAuth();

  // ▼▼▼ START: 修改 handleSubmit ▼▼▼
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 檢查當前是否為「確認登入」的第二次點擊
    const isForcedAttempt = needsVerification;

    setError('');
    setIsLoading(true);

    try {
      const deviceId = authService.getOrCreateDeviceId();
      // 傳入 isForcedAttempt 參數
      const result = await authService.loginUser(username, password, deviceId, isForcedAttempt);
      
      if (result.success && result.sessionId) {
        auth.login(username, result.sessionId);
      } else {
        setError(result.message);
        // 如果 API 回傳需要驗證，則更新 state
        setNeedsVerification(result.needsVerification || false);
      }
    } catch (err) {
      setError('發生意外錯誤，請再試一次。');
      setNeedsVerification(false); // 發生未知錯誤時重設
    } finally {
      setIsLoading(false);
    }
  };
  // ▲▲▲ END: 修改 handleSubmit ▲▲▲

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-8">
        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-2">
          歡迎回來
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
          登入以繼續
        </p>

        {error && (
          <div 
             // 根據是否需要驗證來改變錯誤提示的樣式
            className={`${
              needsVerification ? 'bg-yellow-100 border-yellow-500 text-yellow-700' : 'bg-red-100 border-red-500 text-red-700'
            } border-l-4 p-4 mb-6 rounded-md`}
            role="alert"
          >
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              使用者名稱
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setNeedsVerification(false); // 使用者修改欄位時重設驗證狀態
                  setError('');
                }}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                placeholder="您的使用者名稱"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password"className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              密碼
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.g.target.value);
                  setNeedsVerification(false); // 使用者修改欄位時重設驗證狀態
                  setError('');
                }}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                placeholder="密碼"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isLoading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
              // ▼▼▼ START: 根據 state 改變按鈕文字 ▼▼▼
              needsVerification ? '我認得此活動，請登入' : '登入'
              // ▲▲▲ END: 改變按鈕文字 ▲▲▲
            )}
          </button>
        </form>
         <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            沒有帳號？{' '}
            <button onClick={onSwitchToRegister} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none">
                註冊
            </button>
         </div>
      </div>
    </div>
  );
};
