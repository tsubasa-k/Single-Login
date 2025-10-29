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
  // ▼▼▼ START: 新增 TOTP 相關狀態 ▼▼▼
  const [totpCode, setTotpCode] = useState('');
  const [view, setView] = useState<'password' | 'totp'>('password'); // 'password' 或 'totp'
  // ▲▲▲ END: 新增 TOTP 相關狀態 ▼▲▲
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWarning, setIsWarning] = useState(false); // 用於 Email 未驗證等警告

  const auth = useAuth();

  // 處理密碼提交
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsWarning(false); 
    setIsLoading(true);

    try {
      // 呼叫 loginUser 檢查密碼和 IP
      const result = await authService.loginUser(username, password);
      
      if (result.success) {
        // 密碼正確且 IP 受信任，直接建立 Session
        const deviceId = authService.getOrCreateDeviceId();
        const sessionResult = await authService.createSession(username, deviceId);
        if (sessionResult.success && sessionResult.sessionId) {
          auth.login(username, sessionResult.sessionId); // 完成登入
        } else {
          setError(sessionResult.message || '建立工作階段失敗。');
          setIsWarning(false); 
        }
      } else {
        // 登入失敗或需要進一步驗證
        setError(result.message);
        if (result.needsTotp) { // 如果需要 TOTP
          setIsWarning(true); // 黃色提示
          setView('totp'); // 切換到 TOTP 輸入畫面
        } else {
          // 其他錯誤 (密碼錯誤、Email 未驗證等)
          setIsWarning(result.emailNotVerified || false);
          setView('password'); // 保持在密碼畫面
        }
      }
    } catch (err: any) {
      setError(`登入時發生意外錯誤: ${err.message}`);
      setIsWarning(false);
      setView('password');
    } finally {
      setIsLoading(false);
    }
  };

  // ▼▼▼ START: 新增處理 TOTP 提交的函式 ▼▼▼
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 基本驗證
     if (!/^\d{6}$/.test(totpCode)) {
      setError('請輸入 6 位數字驗證碼。');
      setIsWarning(false); // 這是一個錯誤，不是警告
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const deviceId = authService.getOrCreateDeviceId();
      // 呼叫新的驗證函式
      const sessionResult = await authService.verifyTotpAndCreateSession(username, totpCode, deviceId);

      if (sessionResult.success && sessionResult.sessionId) {
        auth.login(username, sessionResult.sessionId); // 完成登入
      } else {
        setError(sessionResult.message || 'TOTP 驗證失敗或建立工作階段失敗。');
        setIsWarning(false); // 驗證失敗是錯誤
        // 停留在 TOTP 畫面讓使用者重試
      }
    } catch (err: any) {
      setError(`驗證時發生意外錯誤: ${err.message}`);
      setIsWarning(false);
    } finally {
      setIsLoading(false);
    }
  };
  // ▲▲▲ END: 新增處理 TOTP 提交的函式 ▼▲▲

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-8">
        {/* 標題根據 view 改變 */}
        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-2">
          {view === 'password' ? '歡迎回來' : '裝置驗證'}
        </h2>
        {/* 副標題根據 view 改變 */}
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
          {view === 'password' ? '登入以繼續' : '請輸入您的 6 位數 Authenticator 驗證碼'}
        </p>

        {/* 錯誤/警告訊息顯示 */}
        {error && (
          <div 
            className={`${
              isWarning ? 'bg-yellow-100 border-yellow-500 text-yellow-700' : 'bg-red-100 border-red-500 text-red-700'
            } border-l-4 p-4 mb-6 rounded-md`}
            role="alert"
          >
            <p>{error}</p>
          </div>
        )}

        {/* ▼▼▼ START: 根據 view 顯示不同表單 ▼▼▼ */}
        {view === 'password' ? (
          // --- 密碼輸入表單 ---
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
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
                    setIsWarning(false); 
                    setError('');
                    // 如果使用者修改帳號，應回到密碼輸入
                    // setView('password'); 
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
                    setPassword(e.target.value); 
                    setIsWarning(false); 
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
              {isLoading ? ( /* Loading SVG */
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
              ) : '登入'}
            </button>
          </form>
        ) : (
          // --- TOTP 輸入表單 ---
          <form onSubmit={handleTotpSubmit} className="space-y-6">
            <div>
              <label htmlFor="totp-code" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Authenticator 驗證碼
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => {
                    setTotpCode(e.target.value.replace(/\D/g, '')); // 只允許數字
                    setError(''); // 清除舊錯誤
                  }}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6} // 確保輸入 6 位數
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? ( /* Loading SVG */
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
              ) : '驗證並登入'}
            </button>
            {/* 返回按鈕 */}
            <button
              type="button"
              onClick={() => {
                setView('password'); // 切換回密碼輸入
                setError('');      // 清除錯誤
                setIsWarning(false);
                setTotpCode('');    // 清空驗證碼
              }}
              className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none"
            >
              返回使用密碼登入
            </button>
          </form>
        )}
        {/* ▲▲▲ END: 根據 view 顯示不同表單 ▲▲▲ */}

         {/* 切換到註冊頁面的連結 (只在密碼畫面顯示) */}
         {view === 'password' && (
           <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              沒有帳號？{' '}
              <button onClick={onSwitchToRegister} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none">
                  註冊
              </button>
           </div>
         )}
      </div>
    </div>
  );
};
