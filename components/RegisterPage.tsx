// components/RegisterPage.tsx
console.log("--- Loading RegisterPage.tsx ---"); 

import React, { useState } from 'react';
import * as authService from '../services/authService';
import { UserIcon, LockIcon, EmailIcon } from './icons';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  // ▼▼▼ 確保 onRegisterSuccess 屬性存在 ▼▼▼
  onRegisterSuccess: (username: string) => void; 
}

console.log("--- RegisterPage: Imports successful ---"); // <--- 新增 Log 1

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin, onRegisterSuccess }) => {
  console.log("--- RegisterPage: Component function started ---"); // <--- 新增 Log 2
  
  // State Hooks
  const [username, setUsername] = useState('');
  console.log("--- RegisterPage: useState username initialized ---"); // <--- 新增 Log 3
  const [email, setEmail] = useState('');
   console.log("--- RegisterPage: useState email initialized ---"); // <--- 新增 Log 4
  const [password, setPassword] = useState('');
   console.log("--- RegisterPage: useState password initialized ---"); // <--- 新增 Log 5
  const [confirmPassword, setConfirmPassword] = useState('');
   console.log("--- RegisterPage: useState confirmPassword initialized ---"); // <--- 新增 Log 6
  const [error, setError] = useState('');
   console.log("--- RegisterPage: useState error initialized ---"); // <--- 新增 Log 7
  const [success, setSuccess] = useState('');
   console.log("--- RegisterPage: useState success initialized ---"); // <--- 新增 Log 8
  const [isLoading, setIsLoading] = useState(false);
   console.log("--- RegisterPage: useState isLoading initialized ---"); // <--- 新增 Log 9

  // Helper function
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
   console.log("--- RegisterPage: validateEmail function defined ---"); // <--- 新增 Log 10

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
     console.log("--- RegisterPage: handleSubmit called ---"); // <--- 新增 Log 11 (點擊按鈕才會觸發)
    // ... (handleSubmit 內部邏輯不變) ...
     e.preventDefault();
     setError('');
     setSuccess('');
 
     if (password !== confirmPassword) {
       setError('密碼不相符。');
       return;
     }
     if (password.length < 6) {
         setError('密碼長度至少需要 6 個字元。');
         return;
     }
     if (!validateEmail(email)) {
       setError('請輸入有效的 Email 地址。');
       return;
     }
 
     setIsLoading(true);
 
     try {
       const result = await authService.registerUser(username, email, password);
       
       if (result.success) {
         onRegisterSuccess(username); 
       } else {
         setError(result.message);
       }
     } catch (err) {
       setError('發生意外錯誤，請再試一次。');
     } finally {
       setIsLoading(false);
     }
  };
   console.log("--- RegisterPage: handleSubmit function defined ---"); // <--- 新增 Log 12

   console.log("--- RegisterPage: Preparing to render JSX ---"); // <--- 新增 Log 13
  // Return JSX
  return (
    <div className="w-full max-w-md">
       {/* ... (JSX 內容不變) ... */}
       <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-8">
        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-2">
          建立帳號
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
          註冊一個新帳號以開始使用。
        </p>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
            <p>{error}</p>
          </div>
        )}
        
        {/* Success message 移除，因為會跳轉 */}
        {/* {success && (...)} */}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Input */}
          <div>
            <label htmlFor="username-reg" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              使用者名稱
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="username-reg" type="text" value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                placeholder="選擇一個使用者名稱" required autoComplete="username"
              />
            </div>
          </div>

          {/* Email Input */}
          <div>
            <label htmlFor="email-reg" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <EmailIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="email-reg" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                placeholder="您的 Email 地址" required autoComplete="email"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password-reg" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              密碼
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password-reg" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                placeholder="建立一個密碼" required autoComplete="new-password"
              />
            </div>
          </div>
          
          {/* Confirm Password Input */}
           <div>
            <label htmlFor="confirm-password-reg" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              確認密碼
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="confirm-password-reg" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                placeholder="再次輸入您的密碼" required autoComplete="new-password"
              />
            </div>
          </div>

          {/* Submit Button */}
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
            ) : '註冊'}
          </button>
        </form>
         <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            已經有帳號了？{' '}
            <button onClick={onSwitchToLogin} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none">
                登入
            </button>
         </div>
      </div>
    </div>
  );
};
