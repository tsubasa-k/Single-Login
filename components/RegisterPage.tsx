import React, { useState } from 'react';
import * as authService from '../services/authService';
import { UserIcon, LockIcon, EmailIcon } from './icons';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onRegisterSuccess: (username: string) => void; // 新增回呼屬性
}

// 修改 Props 接收
export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin, onRegisterSuccess }) => { 
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 驗證邏輯不變...
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
        // 註冊成功後，不再只是顯示訊息
        // setSuccess(result.message); 
        // 清空欄位可以保留，或在切換頁面後自動清除
        // setUsername('');
        // setEmail(''); 
        // setPassword('');
        // setConfirmPassword('');

        // ▼▼▼ START: 呼叫成功回呼 ▼▼▼
        onRegisterSuccess(username); // 將 username 傳遞給 App.tsx
        // ▲▲▲ END: 呼叫成功回呼 ▼▲▲
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('發生意外錯誤，請再試一次。');
    } finally {
      setIsLoading(false);
    }
  };

  // return JSX 維持不變 (包含 form, input 等)
  return (
    <div className="w-full max-w-md">
      {/* ... (h2, p, error/success div) ... */}
       {/* 顯示註冊成功訊息可以移除，因為會直接跳轉 */}
        {/* {success && (...)} */}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ... (Username, Email, Password, Confirm Password inputs) ... */}

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
  );
};
