// components/SetupTotpPage.tsx
import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code'; // 匯入 QR Code 元件
import * as authService from '../services/authService';
import { LockIcon } from './icons';

interface SetupTotpPageProps {
  username: string;
  onSetupComplete: () => void; // 設定完成後的回呼
}

export const SetupTotpPage: React.FC<SetupTotpPageProps> = ({ username, onSetupComplete }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState(''); // 用於顯示 Base32 金鑰
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 元件載入時，呼叫後端產生金鑰和 QR Code URL
  useEffect(() => {
    const generateSecret = async () => {
      setIsLoading(true);
      setError('');
      try {
        const result = await authService.generateTotpSecret(username);
        if (result.success && result.otpauthUrl && result.secret) {
          setQrCodeUrl(result.otpauthUrl);
          setSecret(result.secret); // 儲存 Base32 金鑰以顯示
        } else {
          setError(result.message || '無法產生 TOTP 金鑰。');
        }
      } catch (err: any) {
        setError(`產生安全金鑰時發生錯誤: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    generateSecret();
  }, [username]); // 當 username 改變時重新產生

  // 提交驗證碼
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 基本驗證
    if (!/^\d{6}$/.test(verificationCode)) {
      setError('請輸入 6 位數字驗證碼。');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      // 呼叫後端驗證並啟用 TOTP
      const result = await authService.verifyAndEnableTotp(username, verificationCode);
      if (result.success) {
        alert('兩步驟驗證設定成功！您現在將返回登入頁面。');
        onSetupComplete(); // 通知 App.tsx 切換回登入頁
      } else {
        setError(result.message || '驗證碼錯誤或已過期。');
      }
    } catch (err: any) {
      setError(`驗證時發生錯誤: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始載入狀態
  if (isLoading && !qrCodeUrl) {
    return (
       <div className="flex items-center justify-center h-screen">
          正在產生兩步驟驗證設定...
       </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-8">
        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-4">
          設定兩步驟驗證
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-6">
          請使用您的 Authenticator App (例如 Google Authenticator, Authy) 掃描下方的 QR Code，或手動輸入金鑰。
        </p>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
            <p>{error}</p>
          </div>
        )}

        {/* QR Code 顯示區 */}
        <div className="bg-white p-4 rounded-lg flex justify-center mb-6">
          {qrCodeUrl ? (
            <QRCode value={qrCodeUrl} size={200} />
          ) : (
            <p className="text-red-500">無法載入 QR Code。請重試。</p>
          )}
        </div>
        
        {/* 手動輸入金鑰 */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-4 break-all">
          或手動輸入金鑰： <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded font-mono">{secret}</code>
        </p>

        {/* 驗證碼輸入表單 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="totp-code" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              輸入 App 顯示的 6 位數驗證碼
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="totp-code"
                type="text" // 使用 text 以便 inputMode 生效
                inputMode="numeric" // 在手機上彈出數字鍵盤
                pattern="\d{6}" // HTML5 驗證（可選）
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} // 只允許數字
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700"
                placeholder="123456"
                required
                autoComplete="one-time-code" // 提示瀏覽器這是 OTP 碼
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || verificationCode.length !== 6} // 確保輸入 6 位數
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isLoading ? '驗證中...' : '驗證並啟用'}
          </button>
        </form>
      </div>
    </div>
  );
};
